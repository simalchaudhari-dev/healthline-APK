/**
 * Exercise report from the real diary (`days` from DiaryContext) — pure functions, testable in Node.
 * Every logged exercise counts: home sessions ("… (home)"), walks, runs, yoga, anything typed in.
 */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EXERCISE_TYPES = [
  { id: 'home', label: 'Exercises at home', color: '#2A4E2A' },
  { id: 'walk', label: 'Walking & running', color: '#4A8245' },
  { id: 'yoga', label: 'Yoga & stretching', color: '#AF52DE' },
  { id: 'cycle', label: 'Cycling', color: '#FF9500' },
  { id: 'strength', label: 'Strength', color: '#5AC8FA' },
  { id: 'other', label: 'Other', color: '#98A2B3' },
];

/** Which bucket a diary exercise belongs to, from its name. */
export function exerciseType(name) {
  const n = String(name || '').toLowerCase();
  if (/\(home\)\s*$/.test(n)) return 'home';
  if (/walk|run|jog|hike|trek|step/.test(n)) return 'walk';
  if (/yoga|stretch|pilates|breath|pranayam/.test(n)) return 'yoga';
  if (/cycl|bike|spin/.test(n)) return 'cycle';
  if (/strength|weight|gym|push|squat|lift|dumbbell/.test(n)) return 'strength';
  return 'other';
}

function fromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftKey(key, delta) {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function dayEntries(day) {
  return (Array.isArray(day?.exercise) ? day.exercise : []).filter((e) => num(e?.minutes) > 0 || num(e?.calories) > 0);
}

function week(days, endKey) {
  const list = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = shiftKey(endKey, -i);
    const entries = dayEntries(days?.[key]);
    list.push({
      key,
      label: DOW[fromKey(key).getDay()],
      minutes: Math.round(entries.reduce((s, e) => s + num(e.minutes), 0)),
      calories: Math.round(entries.reduce((s, e) => s + num(e.calories), 0)),
      entries,
    });
  }
  return list;
}

/** Consecutive days with exercise, ending today (or yesterday if nothing is logged yet today). */
export function activeStreak(days, today) {
  let key = dayEntries(days?.[today]).length ? today : shiftKey(today, -1);
  let count = 0;
  while (dayEntries(days?.[key]).length) {
    count += 1;
    key = shiftKey(key, -1);
  }
  return count;
}

/** Everything the Exercise report screen shows for the 7 days ending `endKey`. */
export function buildExerciseReport({ days, endKey, today = endKey, weeklyGoalMinutes = 150 }) {
  const list = week(days, endKey);
  const prev = week(days, shiftKey(endKey, -7));
  const minutes = list.reduce((s, d) => s + d.minutes, 0);
  const prevMinutes = prev.reduce((s, d) => s + d.minutes, 0);
  const activeDays = list.filter((d) => d.minutes > 0).length;

  const byType = EXERCISE_TYPES.map((t) => {
    const entries = list.flatMap((d) => d.entries.filter((e) => exerciseType(e.name) === t.id));
    return {
      ...t,
      sessions: entries.length,
      minutes: Math.round(entries.reduce((s, e) => s + num(e.minutes), 0)),
      calories: Math.round(entries.reduce((s, e) => s + num(e.calories), 0)),
    };
  })
    .filter((t) => t.sessions > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const sessions = list
    .flatMap((d) =>
      d.entries.map((e, i) => ({
        id: e.logId || `${d.key}-${i}`,
        key: d.key,
        label: d.label,
        name: String(e.name || 'Exercise').replace(/\s*\(home\)\s*$/i, ''),
        type: exerciseType(e.name),
        minutes: Math.round(num(e.minutes)),
        calories: Math.round(num(e.calories)),
        // false = stopped before the end (still counted in the totals)
        completed: e.completed !== false,
        moves: (Array.isArray(e.moves) ? e.moves : [])
          .filter((m) => m?.name && (num(m.seconds) > 0 || num(m.calories) > 0))
          .map((m) => ({
            name: String(m.name),
            times: Math.max(1, Math.round(num(m.times) || 1)),
            calories: Math.round(num(m.calories)),
          })),
      })),
    )
    .reverse(); // newest first

  const best = list.reduce((b, d) => (d.minutes > (b?.minutes || 0) ? d : b), null);
  const insights = [];
  if (!minutes) {
    insights.push('No exercise logged this week. Try a 10-minute session from Exercises at home.');
  } else {
    if (minutes >= weeklyGoalMinutes) {
      insights.push(`You reached ${minutes} active minutes — at or above the ${weeklyGoalMinutes}-minute weekly guideline.`);
    } else {
      insights.push(`${weeklyGoalMinutes - minutes} more active minutes this week would reach the ${weeklyGoalMinutes}-minute guideline.`);
    }
    if (activeDays < 3) insights.push(`Active on ${activeDays} of 7 days — short sessions on more days are easier on the body.`);
    if (prevMinutes && minutes > prevMinutes) insights.push(`${minutes - prevMinutes} minutes more than the week before.`);
  }

  return {
    startKey: shiftKey(endKey, -6),
    endKey,
    days: list.map(({ entries, ...d }) => d),
    minutes,
    calories: list.reduce((s, d) => s + d.calories, 0),
    activeDays,
    sessionsCount: sessions.length,
    avgPerActiveDay: activeDays ? Math.round(minutes / activeDays) : 0,
    prevMinutes,
    weeklyGoalMinutes,
    goalProgress: Math.min(1, minutes / weeklyGoalMinutes),
    // Only for the week that contains today (weeks run Monday–Sunday, so endKey can be in the future).
    streak: endKey >= today && shiftKey(endKey, -6) <= today ? activeStreak(days, today) : null,
    best: best && best.minutes ? { label: best.label, minutes: best.minutes } : null,
    byType,
    sessions,
    insights,
  };
}
