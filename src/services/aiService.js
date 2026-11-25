import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTH_KEY } from '../config/storageKeys';
import { readAccessToken } from '../utils/apiAuth';
import { apiAiChat } from './authService';
import { cleanAiMessage } from '../utils/aiErrors';
import { loadAiModels } from './aiConfigService';
import {
  SYSTEM_PROMPT,
  buildTextUserPrompt,
  buildVisionUserPrompt,
  buildVisionFallbackText,
  COACH_SYSTEM_PROMPT,
  MEDICARE_SYSTEM_PROMPT,
  MEDICARE_FOLLOWUP_PROMPT,
  WORKOUT_AI_SYSTEM_PROMPT,
} from '../config/aiPrompts';
import { stripDataUrlPrefix } from '../utils/prepareMealImage';
import { emitTokenBalance } from '../utils/tokenBalanceBus';

const VAGUE_NAMES = /^(mixed\s*meal|food|plate|dish|meal|item|unknown|assorted|various|other)$/i;

function newChargeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripModelNoise(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
}

function rawMessagePart(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('\n');
  }
  return '';
}

/**
 * The model's answer only. Its reasoning ("Okay, let me think…") is never shown to the user — it is
 * used only to recover JSON when the answer is empty (meal parsing). Empty text lets callers retry.
 */
function messageText(message) {
  if (!message) return '';
  const content = stripModelNoise(rawMessagePart(message.content));
  if (content) return content;
  const reasoning = stripModelNoise(
    [message.reasoning, message.reasoning_content].filter((part) => typeof part === 'string').join('\n'),
  );
  return reasoning.includes('{') && reasoning.includes('}') ? reasoning : '';
}

/** Reasoning that leaked into the answer itself (no <think> tags) — treat as no answer so we retry. */
const LEAKED_REASONING = /^(okay|ok|alright|hmm+|so,? the user|the user|let me|first,? (i|let)|i need to|we need to)\b/i;
function looksLikeReasoning(text) {
  const s = String(text || '').trim();
  return LEAKED_REASONING.test(s) && /\b(the user|user's|they('| a)re|let me|i should|i need)\b/i.test(s);
}

/** Gujarati typed in English letters still counts as Gujarati, even if one Hindi word is mixed in. */
export function detectMessageLanguage(text) {
  const s = String(text || '');
  if (/[\u0A80-\u0AFF]/.test(s)) return 'gu';
  if (/[\u0900-\u097F]/.test(s)) return 'hi';
  const gujarati = (
    s.match(
      /\b(mane|tamne|tame|chhe|nathi|shu|kevu|kevok|kevo|lave|levu|levo|aapo|aapjo|bimari|kem|kyare|khavu|maru|taru|amne|karvu|joye|thay|samjyo|aave|joie|chu|chhu)\b/gi,
    ) || []
  ).length;
  const hindi = (s.match(/\b(mujhe|kya|kaise|chahiye|batao|nahin|khana|kyu|kyun)\b/gi) || []).length;
  if (gujarati > 0 && gujarati >= hindi) return 'gu';
  if (hindi > 0) return 'hi';
  return 'en';
}

function matchesReplyLanguage(text, language) {
  const s = String(text || '');
  if (!s.trim()) return false;
  if (language === 'gu') return /[\u0A80-\u0AFF]/.test(s);
  if (language === 'hi') return /[\u0900-\u097F]/.test(s);
  if (language === 'hinglish') {
    return /\b(hai|hain|ke|ki|mein|main|aap|yeh|ye|nahi|ka|ko|se|aur)\b/i.test(s);
  }
  return true;
}

const WORKOUT_FALLBACK = {
  en: {
    why: 'This session matches your level and how you feel today.',
    caution: 'Stop if something hurts. A little effort is enough.',
  },
  hi: {
    why: 'यह सेशन आपके लेवल और आज की तबीयत के हिसाब से है।',
    caution: 'दर्द हो तो रुक जाएं। थोड़ी मेहनत काफी है।',
  },
  gu: {
    why: 'આ સેશન તમારા લેવલ અને આજની તબિયત પ્રમાણે છે.',
    caution: 'દુખાવો થાય તો અટકી જાઓ. થોડી મહેનત પૂરતી છે.',
  },
  hinglish: {
    why: 'Yeh session aapke level aur aaj ki tabiyat ke hisaab se hai.',
    caution: 'Dard ho to ruk jaiye. Thodi mehnat kaafi hai.',
  },
};

const MEDICARE_FALLBACK = {
  en: {
    meaning: 'Could not explain that note. Try adding what the doctor said.',
    why: 'A few everyday habits can play a part. A doctor can say which ones fit you.',
    relief: 'Rest, drink water, and keep the next meal simple.',
    seeDoctor: 'Go back to your doctor if this gets worse or does not ease.',
  },
  hi: {
    meaning: 'यह नोट साफ नहीं हुआ। डॉक्टर ने क्या कहा, वह फिर लिखें।',
    why: 'रोज की कुछ आदतें वजह हो सकती हैं। कौन सी वजह आपकी है, यह डॉक्टर बता सकते हैं।',
    relief: 'आराम करें, पानी पिएं, और अगला खाना हल्का रखें।',
    seeDoctor: 'अगर तकलीफ बढ़े या आराम न मिले तो डॉक्टर के पास जाएं।',
  },
  gu: {
    meaning: 'આ નોંધ સ્પષ્ટ થઈ નહીં. ડૉક્ટરે શું કહ્યું તે ફરી લખો.',
    why: 'રોજિંદી કેટલીક આદતો કારણ બની શકે. તમારું કારણ ડૉક્ટર કહી શકે.',
    relief: 'આરામ કરો, પાણી પીઓ, અને આગળનું ભોજન હળવું રાખો.',
    seeDoctor: 'તકલીફ વધે અથવા આરામ ન મળે તો ડૉક્ટર પાસે જાઓ.',
  },
  hinglish: {
    meaning: 'Yeh note clear nahi hua. Doctor ne kya kaha, woh phir likhiye.',
    why: 'Roz ki kuch aadatein wajah ho sakti hain. Kaunsi wajah aapki hai, yeh doctor bata sakte hain.',
    relief: 'Aaram kijiye, paani pijiye, aur agla khana halka rakhiye.',
    seeDoctor: 'Agar takleef badhe ya aaram na mile to doctor ke paas jaiye.',
  },
};

function fallbackPack(table, language) {
  return table[language] || table.en;
}

const REPLY_LANGUAGE_ORDER = {
  en: 'Write every answer in English.',
  hi: 'Write every answer in Hindi using Devanagari. Do not use English sentences.',
  gu: 'Write every answer in Gujarati script. Do not use English sentences.',
  hinglish: 'Write every answer in Hinglish (Hindi words in Latin letters). Do not use English sentences.',
};

/** The account's saved reply language. This wins over the language of the note. */
function replyLanguageInstruction(language) {
  return REPLY_LANGUAGE_ORDER[language] || REPLY_LANGUAGE_ORDER.en;
}

function extractJson(text) {
  const trimmed = stripModelNoise(text);
  if (!trimmed) throw new Error('Empty AI response');
  const candidates = [trimmed];
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const raw of candidates) {
    try {
      return JSON.parse(raw);
    } catch {
      try {
        return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        /* try the next candidate */
      }
    }
  }
  throw new Error('Could not parse AI JSON');
}

/** Soft-correct macros so calories ≈ 4c+4p+9f when wildly off. */
function reconcileMacros({ calories, carbs, protein, fat }) {
  const fromMacros = carbs * 4 + protein * 4 + fat * 9;
  if (fromMacros <= 0) return { calories, carbs, protein, fat };
  const ratio = calories / fromMacros;
  if (calories > 0 && (ratio < 0.8 || ratio > 1.2)) {
    const scale = Math.sqrt(Math.min(Math.max(ratio, 0.5), 2));
    return {
      calories,
      carbs: Math.max(0, Math.round(carbs * scale)),
      protein: Math.max(0, Math.round(protein * scale)),
      fat: Math.max(0, Math.round(fat * scale)),
    };
  }
  return { calories, carbs, protein, fat };
}

function normalizeItems(raw) {
  const list = Array.isArray(raw?.items) ? raw.items : [];
  return list
    .map((item, i) => {
      const name = String(item.name || '').trim();
      let calories = Math.max(0, Math.round(Number(item.calories) || 0));
      let carbs = Math.max(0, Math.round(Number(item.carbs) || 0));
      let protein = Math.max(0, Math.round(Number(item.protein) || 0));
      let fat = Math.max(0, Math.round(Number(item.fat) || 0));
      ({ calories, carbs, protein, fat } = reconcileMacros({ calories, carbs, protein, fat }));

      const confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0.7));

      return {
        id: `ai-${Date.now()}-${i}`,
        name,
        serving: String(item.serving || '1 serving').trim(),
        calories,
        carbs,
        protein,
        fat,
        confidence,
      };
    })
    .filter(
      (item) =>
        item.name &&
        !VAGUE_NAMES.test(item.name) &&
        item.calories > 0 &&
        item.calories < 5000,
    );
}

/**
 * AI usage is now recorded by the server for every call (with the reason when it fails),
 * so the app no longer sends its own count — that would only add a request per AI call.
 */
function reportAiUsage() {}

export async function chatCompletion(
  messages,
  { temperature = 0.15, maxTokens = 1000, feature, chargeId } = {},
) {
  const token = await readAccessToken().catch(() => '');
  if (!token) {
    reportAiUsage(feature, false);
    const err = new Error('Sign in to use AI.');
    err.code = 'NO_AUTH';
    throw err;
  }

  const models = await loadAiModels().catch(() => ({ textModel: '', visionModel: '' }));
  const hasImage = messages.some(
    (item) => Array.isArray(item.content) && item.content.some((part) => part?.type === 'image_url'),
  );
  const chosen = hasImage ? models.visionModel : models.textModel;

  try {
    const data = await apiAiChat(token, {
      messages,
      model: chosen,
      temperature,
      maxTokens,
      feature,
      chargeId,
    });
    reportAiUsage(feature, true);
    if (data?.tokenBalance != null) rememberTokenBalance(data.tokenBalance);
    return messageText(data?.message);
  } catch (err) {
    reportAiUsage(feature, false);
    throw err;
  }
}

function rememberTokenBalance(balance) {
  const next = Math.max(0, Number(balance) || 0);
  emitTokenBalance(next);
  AsyncStorage.getItem(AUTH_KEY)
    .then((raw) => {
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (!saved?.user) return null;
      saved.user.tokenBalance = next;
      delete saved.accessToken;
      return AsyncStorage.setItem(AUTH_KEY, JSON.stringify(saved));
    })
    .catch(() => {});
}

function finalizeResult(parsed) {
  const items = normalizeItems(parsed);
  if (!items.length) {
    throw new Error('AI returned no usable food items');
  }
  return {
    items,
    summary: String(parsed.summary || items.map((i) => i.name).join(', ')).trim(),
  };
}

function medicareText(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

async function rewriteIntoLanguage(payload, language, feature, chargeId) {
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: `Rewrite every text value into the required language. Keep keys and routineId unchanged. Return JSON only.\n${replyLanguageInstruction(language)}`,
      },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { temperature: 0.2, maxTokens: 2000, feature, chargeId },
  );
  try {
    return extractJson(content);
  } catch {
    return null;
  }
}

/** Plain-language explanation of a doctor's words, plus one home comfort step. */
export async function explainMedicare(note, language) {
  const text = String(note || '').trim();
  const lang = REPLY_LANGUAGE_ORDER[language] ? language : 'en';
  const order = replyLanguageInstruction(lang);
  const chargeId = newChargeId();
  let content = '';
  let parsed = {};
  try {
    content = await chatCompletion(
      [
        { role: 'system', content: `${order}\n\n${MEDICARE_SYSTEM_PROMPT}` },
        { role: 'user', content: text },
      ],
      { temperature: 0.3, maxTokens: 2000, feature: 'medicalAi', chargeId },
    );
    parsed = extractJson(content);
  } catch {
    parsed = {};
  }
  const fields = ['meaning', 'why', 'relief', 'seeDoctor'];
  const blank = fields.some((key) => !String(parsed[key] || '').trim());
  if (blank) {
    try {
      const againRaw = await chatCompletion(
        [
          {
            role: 'system',
            content: `${order}\n\n${MEDICARE_SYSTEM_PROMPT}\nThe last reply was empty. Answer this exact message in the required language. If they only said hello, greet them and ask how you can help.`,
          },
          { role: 'user', content: text },
        ],
        { temperature: 0.3, maxTokens: 2000, feature: 'medicalAi', chargeId },
      );
      try {
        parsed = { ...parsed, ...extractJson(againRaw) };
      } catch {
        if (!content) content = againRaw;
      }
      if (!proseFromReply(content)) content = againRaw;
    } catch {
      /* keep whatever the first reply had */
    }
  }
  const spoken = proseFromReply(typeof content === 'string' ? content : '');
  if (!String(parsed.meaning || '').trim() && spoken) parsed.meaning = spoken;
  const said = async (key) => forceLanguage(parsed[key], lang, 'medicalAi', chargeId);
  const meaning = await said('meaning');
  if (!meaning) throw new Error('No answer came back. Try again.');
  return {
    meaning,
    why: await said('why'),
    relief: await said('relief'),
    seeDoctor: await said('seeDoctor'),
    urgent: parsed.urgent === true,
  };
}

function proseFromReply(text) {
  const cleaned = stripModelNoise(text);
  if (!cleaned || looksLikeReasoning(cleaned)) return '';
  try {
    const parsed = extractJson(cleaned);
    if (parsed && typeof parsed === 'object') {
      const parts = [parsed.answer, parsed.reply, parsed.meaning, parsed.why, parsed.relief, parsed.seeDoctor]
        .map((part) => String(part || '').trim())
        .filter(Boolean);
      if (parts.length) return [...new Set(parts)].join('\n\n');
    }
  } catch {
    /* plain sentences */
  }
  return cleaned;
}

/** Keep the model's own words, rewritten into the dropdown language. A canned line is not used here. */
async function forceLanguage(text, language, feature, chargeId) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const lang = REPLY_LANGUAGE_ORDER[language] ? language : 'en';
  if (lang === 'en' || matchesReplyLanguage(value, lang)) return value;

  const rewritten = await rewriteIntoLanguage({ answer: value }, lang, feature, chargeId);
  const next = String(rewritten?.answer || '').trim();
  if (next && matchesReplyLanguage(next, lang)) return next;

  try {
    const again = proseFromReply(
      await chatCompletion(
        [
          {
            role: 'system',
            content: `${replyLanguageInstruction(lang)}\nRewrite the message into the required language. Return only that text.`,
          },
          { role: 'user', content: value },
        ],
        { temperature: 0.2, maxTokens: 2000, feature, chargeId },
      ),
    );
    if (again && matchesReplyLanguage(again, lang)) return again;
    return again || next || value;
  } catch {
    return next || value;
  }
}

/** Short follow-up after a Medicare explanation. */
export async function medicareFollowUp(messages, language) {
  const order = replyLanguageInstruction(language);
  const chargeId = newChargeId();
  const content = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          order,
          MEDICARE_FOLLOWUP_PROMPT,
          'If they ask for another language, rewrite the earlier explanation in that language.',
          'Plain sentences only. No JSON.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      ...messages,
    ],
    { temperature: 0.3, maxTokens: 2000, feature: 'medicalAi', chargeId },
  );
  let reply = await forceLanguage(proseFromReply(content), language, 'medicalAi', chargeId);
  if (!reply) throw new Error('No answer came back. Try again.');
  return reply;
}

/** Nutrition coach reply in the language chosen in the header dropdown. */
export async function coachReply(history, userText, profileContext, language) {
  const lang = REPLY_LANGUAGE_ORDER[language] ? language : 'en';
  const order = replyLanguageInstruction(lang);
  const chargeId = newChargeId();
  let reply = proseFromReply(
    await chatCompletion(
      [
        { role: 'system', content: `${order}\n\n${COACH_SYSTEM_PROMPT}\n\n${profileContext}` },
        ...history,
      ],
      { temperature: 0.4, maxTokens: 2000, feature: 'aiCoach', chargeId },
    ),
  );
  if (!reply) {
    reply = proseFromReply(
      await chatCompletion(
        [
          {
            role: 'system',
            content: `${order}\n\n${COACH_SYSTEM_PROMPT}\nAnswer the user's last message directly in the required language.`,
          },
          ...history,
          { role: 'user', content: userText },
        ],
        { temperature: 0.4, maxTokens: 2000, feature: 'aiCoach', chargeId },
      ),
    );
  }
  reply = await forceLanguage(reply, lang, 'aiCoach', chargeId);
  if (!reply) throw new Error('No answer came back. Try again.');
  return reply;
}

/** Pick one real home session for how the user feels today. */
export async function suggestWorkout({ note, profile, goal, routines, language }) {
  const list = (routines || []).filter((r) => r?.id);
  if (!list.length) throw new Error('No workouts available');
  const chargeId = newChargeId();
  const catalog = list
    .map((r) => `- ${r.id}: ${r.name}. ${r.description}`)
    .join('\n');
  const conditions = Array.isArray(profile?.conditions) && profile.conditions.length
    ? profile.conditions.join(', ')
    : 'none';
  const feeling = String(note || '').trim() || 'No note. Suggest the best session for today.';
  const userContent = [
    `Age: ${profile?.age || 'unknown'}`,
    `Level: ${profile?.workoutLevel || 'not set'}`,
    `Goal: ${goal || 'general fitness'}`,
    `Conditions: ${conditions}`,
    '',
    'Allowed sessions:',
    catalog,
    '',
    `How they feel today: ${feeling}`,
    replyLanguageInstruction(language),
    'Reply with one JSON object only. why and caution must talk about this note, not a generic line.',
  ]
    .filter(Boolean)
    .join('\n');
  const content = await chatCompletion(
    [
      { role: 'system', content: `${replyLanguageInstruction(language)}\n\n${WORKOUT_AI_SYSTEM_PROMPT}` },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.2, maxTokens: 2000, feature: 'workoutAi', chargeId },
  );
  const lang = REPLY_LANGUAGE_ORDER[language] ? language : 'en';
  let raw = content;
  let parsed = {};
  try {
    parsed = extractJson(content);
  } catch {
    parsed = {};
  }
  if (!String(parsed.why || '').trim() || !String(parsed.caution || '').trim()) {
    try {
      const againRaw = await chatCompletion(
        [
          {
            role: 'system',
            content: `${replyLanguageInstruction(lang)}\n\n${WORKOUT_AI_SYSTEM_PROMPT}\nThe last reply missed why or caution. Answer this note directly. If they only said hello, greet them and ask how you can help.`,
          },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.2, maxTokens: 2000, feature: 'workoutAi', chargeId },
      );
      raw = againRaw || raw;
      const again = extractJson(againRaw);
      parsed = { ...parsed, ...again, routineId: parsed.routineId || again.routineId };
    } catch {
      /* keep the first reply */
    }
  }
  const spoken = proseFromReply(raw);
  if (!String(parsed.why || '').trim() && spoken) parsed.why = spoken;
  const routineId = chooseRoutineId(parsed, note, content, list);
  const why = await forceLanguage(parsed.why, lang, 'workoutAi', chargeId);
  if (!why) throw new Error('No answer came back. Try again.');
  return {
    routineId,
    why,
    caution: await forceLanguage(parsed.caution, lang, 'workoutAi', chargeId),
  };
}

function chooseRoutineId(parsed, note, content, list) {
  const allowed = new Set(list.map((r) => r.id));
  const rawId = String(parsed?.routineId || '').trim();
  if (allowed.has(rawId)) return rawId;
  const blob = `${rawId}\n${note || ''}\n${content || ''}`.toLowerCase();
  const named = list.find(
    (r) => blob.includes(String(r.id).toLowerCase()) || blob.includes(String(r.name).toLowerCase()),
  );
  if (named) return named.id;
  const gentle = list.filter((r) => r.level !== 'active');
  const pool = /pain|sore|knee|back|dizzy|hurt|injury|easy|gentle/.test(blob) && gentle.length ? gentle : list;
  if (/10\s*min|short|quick/.test(blob)) {
    return (pool.find((r) => /relax|stretch|breath/.test(r.id)) || pool[0]).id;
  }
  return pool[0].id;
}

/** Parse a meal description / voice transcript into diary food items. */
export async function parseFoodFromText(userText, feature = 'voiceLog', chargeId = newChargeId()) {
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildTextUserPrompt(userText) },
    ],
    { feature, chargeId },
  );
  return finalizeResult(extractJson(content));
}

function visionModelChain() {
  return loadAiModels()
    .then((models) => (models.visionModel ? [models.visionModel] : []))
    .catch(() => []);
}

async function runVisionOnce({ dataUrl, hint, model, chargeId }) {
  const content = await chatCompletion(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionUserPrompt(hint) },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    { maxTokens: 1200, model, feature: 'mealScanner', chargeId },
  );
  return finalizeResult(extractJson(content));
}

/**
 * Diagnose food from a meal photo (base64).
 * Uses a vision-capable model; falls back across models, then text note.
 */
export async function parseFoodFromImage({ base64, mimeType = 'image/jpeg', note = '' }) {
  const clean = stripDataUrlPrefix(base64);
  if (!clean) {
    throw new Error('No image data');
  }

  const hint = String(note || '').trim();
  const mime = mimeType || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${clean}`;
  const models = await visionModelChain();
  const chargeId = newChargeId();

  let lastErr = null;
  for (const model of models) {
    try {
      const parsed = await runVisionOnce({ dataUrl, hint, model, chargeId });
      return { ...parsed, mode: 'vision', model };
    } catch (err) {
      lastErr = err;
      continue;
    }
  }

  if (hint) {
    try {
      const fallback = await parseFoodFromText(buildVisionFallbackText(hint), 'mealScanner', chargeId);
      return { ...fallback, mode: 'text-fallback' };
    } catch (textErr) {
      lastErr = textErr;
    }
  }

  const detail = cleanAiMessage(lastErr?.message, 'AI could not read this photo').replace(/[.\s]+$/, '');
  const tip = hint ? '' : ' Add a short food description and tap Diagnose again.';
  const err = new Error(`${detail}.${tip}`);
  err.code = 'VISION_FAILED';
  throw err;
}

export { hasAiKey } from '../config/ai';
