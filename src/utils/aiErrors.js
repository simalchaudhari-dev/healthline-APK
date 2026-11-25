/**
 * AI provider errors can mention model ids, providers or endpoints
 * (e.g. "No endpoints found for vendor/model:free"). Users should never see those.
 */

const BUSY = 'AI is busy right now. Please try again in a minute.';
const GENERIC = 'AI could not finish this right now. Please try again.';

// vendor/model-name, ":free" style suffixes, provider and endpoint wording.
const TECHNICAL = /([a-z0-9][\w.-]*\/[\w.:-]+)|(:free\b)|\b(endpoints?|openrouter|provider|upstream|model|nemotron|llama|gemini|gpt|mistral|qwen|deepseek)\b/i;
const RATE_LIMIT = /\b(429|rate.?limit|too many requests|quota|overloaded|capacity)\b/i;

/** Returns a user-facing message: keeps plain app messages, replaces technical ones. */
export function cleanAiMessage(message, fallback = GENERIC) {
  const text = String(message || '').trim();
  if (!text) return fallback;
  if (RATE_LIMIT.test(text)) return BUSY;
  if (TECHNICAL.test(text)) return fallback;
  return text;
}

/** Same Error (keeps `code`, `status`), with a cleaned message. */
export function cleanAiError(err, fallback = GENERIC) {
  const next = err instanceof Error ? err : new Error(String(err || ''));
  const cleaned = cleanAiMessage(next.message, fallback);
  if (cleaned !== next.message) next.message = cleaned;
  return next;
}
