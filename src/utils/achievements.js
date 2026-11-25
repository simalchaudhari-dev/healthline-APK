/**
 * Live achievements from the real diary (`days` from DiaryContext, ~90 days synced from the server).
 * The streak badge is handled separately in utils/streak.js (it comes from app opens, not the diary).
 *
 * "earned" is sticky: once the rule was met on any day/window in the synced history, the badge stays
 * unlocked. "progress" always shows the last 7 days so users see where they stand now.
 * Pure functions — no React Native imports — so the rules can be tested in Node.
 */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const AI_SOURCES = ['ai-scan', 'ai-voice'];
const STEP_GOAL = 10000;

function fromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftKey(key, delta) {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isWalkOrRun = (name) => /walk|run|jog|hike|trek|step/i.test(String(name || ''));

/** Per-day numbers every rule needs. */
function dayFacts(day, profile) {
  const foods = MEALS.flatMap((m) => (Array.isArray(day?.meals?.[m]) ? day.meals[m] : []));
  const exercise = Array.isArray(day?.exercise) ? day.exercise : [];
  const calories = foods.reduce((s, f) => s + num(f.calories), 0);
  const protein = foods.reduce((s, f) => s + num(f.protein), 0);
  const water = num(day?.water);
  const calorieGoal = num(profile?.calories) || 2200;
  const proteinGoal = num(profile?.protein) || 0;
  const waterGoal = num(profile?.waterGoal) || 8;
  // One AI session = one meal on one day logged by scan/voice (a scan can add several items).
  const aiSessions = new Set(
    MEALS.flatMap((m) =>
      (day?.meals?.[m] || []).filter((f) => AI_SOURCES.includes(f?.source)).map((f) => `${m}:${f.source}`),
    ),
  ).size;

  return {
    logged: foods.length > 0,
    calories: Math.round(calories),
    protein: Math.round(protein),
    water,
    proteinHit: proteinGoal > 0 && protein >= proteinGoal * 0.9,
    waterHit: water >= waterGoal,
    inBalance: foods.length > 0 && calories >= calorieGoal * 0.9 && calories <= calorieGoal * 1.1,
    exerciseMinutes: Math.round(exercise.reduce((s, e) => s + num(e.minutes), 0)),
    walkMinutes: Math.round(exercise.filter((e) => isWalkOrRun(e.name)).reduce((s, e) => s + num(e.minutes), 0)),
    steps: Math.round(num(day?.steps)),
    aiSessions,
    calorieGoal,
    proteinGoal,
    waterGoal,
  };
}

/** Oldest → newest facts for every synced day plus the last 7 days ending today. */
function collect(days, profile, today) {
  const keys = Object.keys(days || {}).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= today);
  const firstKey = keys.length ? keys.sort()[0] : today;
  const all = [];
  for (let key = firstKey; key <= today; key = shiftKey(key, 1)) {
    all.push({ key, ...dayFacts(days?.[key], profile) });
  }
  const week = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = shiftKey(today, -i);
    week.push({ key, label: DOW[fromKey(key).getDay()], ...dayFacts(days?.[key], profile) });
  }
  return { all, week };
}

/** True if any 7-day window in `all` has at least `need` days passing `test`. */
function anyWindow(all, test, need) {
  for (let i = 0; i + 6 < all.length; i += 1) {
    if (all.slice(i, i + 7).filter(test).length >= need) return true;
  }
  return false;
}

function status(earned, progress) {
  if (earned) return 'Unlocked';
  return progress > 0 ? 'In progress' : 'Locked';
}

/** History rows (last 7 days) for the detail screen. */
const history = (week, valueOf, test, today) =>
  week.map((d) => ({
    label: d.key === today ? 'Today' : d.label,
    value: valueOf(d),
    done: test(d),
  }));

const RULES = {
  protein({ all, week }, today) {
    const test = (d) => d.proteinHit;
    const hits = week.filter(test).length;
    const goalG = week[6].proteinGoal;
    const earned = anyWindow(all, test, 5);
    return {
      earned,
      progress: hits,
      goal: 5,
      unit: 'days this week',
      status: status(earned, hits),
      summary: goalG
        ? `You reached 90% of your ${goalG} g protein goal on ${hits} of the last 7 days.${earned ? '' : ` ${Math.max(0, 5 - hits)} more to unlock.`}`
        : 'Set a protein goal in Nutrition goals to track this badge.',
      history: history(week, (d) => (d.logged ? `${d.protein} g` : '—'), test, today),
      calendarKeys: all.filter(test).map((d) => d.key),
    };
  },

  water({ all, week }, today) {
    const test = (d) => d.waterHit;
    const hits = week.filter(test).length;
    const goalGlasses = week[6].waterGoal;
    const earned = anyWindow(all, test, 3);
    return {
      earned,
      progress: hits,
      goal: 3,
      unit: 'days this week',
      status: status(earned, hits),
      summary: `You hit ${goalGlasses} glasses on ${hits} of the last 7 days.${earned ? '' : ` ${Math.max(0, 3 - hits)} more to unlock.`}`,
      history: history(week, (d) => `${d.water}/${d.waterGoal}`, test, today),
      calendarKeys: all.filter(test).map((d) => d.key),
    };
  },

  // Steps synced from the phone (day.steps). People without step tracking can still earn it with
  // 60+ logged minutes of walking/running in a day.
  steps({ all, week }, today) {
    const test = (d) => d.steps >= STEP_GOAL || d.walkMinutes >= 60;
    const best = Math.max(0, ...week.map((d) => d.steps));
    const earned = all.some(test);
    const hasStepData = all.some((d) => d.steps > 0);
    return {
      label: '10k steps',
      earned,
      progress: Math.min(best, STEP_GOAL),
      goal: STEP_GOAL,
      unit: 'steps',
      status: status(earned, best || week.some((d) => d.walkMinutes > 0)),
      summary: earned
        ? 'You reached 10,000 steps (or 60 minutes of walking) in a day.'
        : hasStepData
          ? `Best day this week: ${best.toLocaleString('en-IN')} steps. Reach 10,000 in one day to unlock.`
          : 'Connect step tracking on the Steps screen, or log 60+ minutes of walking in one day.',
      history: history(
        week,
        (d) => (d.steps ? `${(d.steps / 1000).toFixed(1)}k` : d.walkMinutes ? `${d.walkMinutes}m` : '—'),
        test,
        today,
      ),
      calendarKeys: all.filter(test).map((d) => d.key),
    };
  },

  'week-perfect': function perfect({ all, week }, today) {
    const test = (d) => d.logged;
    const logged = week.filter(test).length;
    const earned = anyWindow(all, test, 7);
    return {
      earned,
      progress: logged,
      goal: 7,
      unit: 'days logged',
      status: status(earned, logged),
      summary: `You logged food on ${logged} of the last 7 days.${earned ? '' : ' Log every day for 7 days in a row to unlock.'}`,
      history: history(week, (d) => (d.logged ? 'Done' : '—'), test, today),
      calendarKeys: all.filter(test).map((d) => d.key),
    };
  },

  'calorie-balance': function balance({ all, week }, today) {
    const test = (d) => d.inBalance;
    const hits = week.filter(test).length;
    const earned = anyWindow(all, test, 5);
    const word = (d) => {
      if (!d.logged) return '—';
      if (d.inBalance) return 'In range';
      return d.calories > d.calorieGoal ? 'Over' : 'Under';
    };
    return {
      earned,
      progress: hits,
      goal: 5,
      unit: 'days in range',
      status: status(earned, hits),
      summary: `${hits} of the last 7 days landed within ±10% of your calorie goal.${earned ? '' : ` ${Math.max(0, 5 - hits)} more to unlock.`}`,
      history: history(week, word, test, today),
      calendarKeys: all.filter(test).map((d) => d.key),
    };
  },

  'first-workout': function firstWorkout({ all, week }, today) {
    const test = (d) => d.exerciseMinutes > 0;
    const earned = all.some(test);
    return {
      earned,
      progress: earned ? 1 : 0,
      goal: 1,
      unit: 'workout',
      status: earned ? 'Unlocked' : 'Locked',
      summary: earned
        ? `You've logged exercise on ${all.filter(test).length} day(s). Keep stacking movement minutes.`
        : 'Log any exercise once to unlock this badge.',
      history: history(week, (d) => (d.exerciseMinutes ? `${d.exerciseMinutes}m` : '—'), test, today),
      calendarKeys: all.filter(test).map((d) => d.key),
    };
  },

  mindful({ all }) {
    const total = all.reduce((s, d) => s + d.aiSessions, 0);
    const earned = total >= 3;
    const aiDays = all.filter((d) => d.aiSessions > 0);
    return {
      earned,
      progress: Math.min(total, 3),
      goal: 3,
      unit: 'AI logs',
      status: status(earned, total),
      summary: earned
        ? `You've logged ${total} meals with AI scan or voice.`
        : `Log a meal with AI photo scan or voice ${3 - total} more time${3 - total === 1 ? '' : 's'} to unlock.`,
      history: [1, 2, 3].map((n) => ({
        label: `Log ${n}`,
        value: total >= n ? 'Done' : '—',
        done: total >= n,
      })),
      calendarKeys: aiDays.map((d) => d.key),
    };
  },
};

/** Overlay live diary numbers onto one catalog achievement (unknown ids are returned unchanged). */
export function withLiveDiary(achievement, { days, profile, today }) {
  const rule = achievement && RULES[achievement.id];
  if (!rule) return achievement;
  const facts = collect(days, profile, today);
  const live = rule(facts, today);
  return { ...achievement, ...live, label: live.label || achievement.label };
}

export function withLiveDiaryAll(list, ctx) {
  if (!list?.length) return list || [];
  const facts = collect(ctx.days, ctx.profile, ctx.today);
  return list.map((a) => {
    const rule = RULES[a?.id];
    if (!rule) return a;
    const live = rule(facts, ctx.today);
    return { ...a, ...live, label: live.label || a.label };
  });
}
