/**
 * Daily app-open streak. The server (POST /api/streak/check-in) stores it on the
 * user: { current, best, lastActiveDate, activeDates }. The app checks in on
 * every open; this file only turns that record into what the UI shows.
 */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MILESTONES = [7, 14, 30, 60, 100, 365];

/** Device-local calendar day, YYYY-MM-DD. */
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shiftKey(key, delta) {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return localDateKey(d);
}

/**
 * Streak shown right now. Still alive if the last open was today or yesterday;
 * older than that means a day was missed, so it has broken.
 */
export function currentStreak(streak, today = localDateKey()) {
  const last = streak?.lastActiveDate || '';
  if (!last) return 0;
  if (last === today || last === shiftKey(today, -1)) return streak.current || 0;
  return 0;
}

function nextMilestone(count) {
  return MILESTONES.find((m) => m > count) || count + 1;
}

/** This week Mon → Sun, marked opened / missed / today / upcoming. */
function weekHistory(opened, today) {
  const t = fromKey(today);
  const mondayOffset = t.getDay() === 0 ? -6 : 1 - t.getDay();
  const monday = shiftKey(today, mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftKey(monday, i);
    const done = opened.has(key);
    let value = 'Missed';
    if (done) value = 'Opened';
    else if (key === today) value = 'Today';
    else if (key > today) value = '—';
    return { label: DOW[fromKey(key).getDay()], value, done };
  });
}

/** Overlay the user's stored streak onto the static "streak" catalog entry. */
export function withLiveStreak(achievement, streak, today = localDateKey()) {
  if (!achievement || achievement.id !== 'streak') return achievement;

  const count = currentStreak(streak, today);
  const best = streak?.best || 0;
  const activeDates = Array.isArray(streak?.activeDates) ? streak.activeDates : [];
  const goal = nextMilestone(count);
  const left = goal - count;
  const reachedWeek = count >= 7;

  let summary = 'Open the app every day to build your streak.';
  if (count > 0) {
    summary = `You opened HealthLine ${count} day${count === 1 ? '' : 's'} in a row. ${left} more day${
      left === 1 ? '' : 's'
    } to reach ${goal}.`;
  } else if (best > 0) {
    summary = `Your streak broke after a missed day. Best so far: ${best} days — open daily to beat it.`;
  }

  let status = 'Locked';
  if (reachedWeek) status = 'Unlocked';
  else if (count > 0) status = 'In progress';

  return {
    ...achievement,
    label: count > 0 ? `${count}-day streak` : 'Start a streak',
    earned: reachedWeek,
    progress: count,
    goal,
    status,
    summary,
    best,
    history: weekHistory(new Set(activeDates), today),
    // StreakCalendar marks these real open days instead of guessing from `progress`.
    calendarKeys: activeDates,
  };
}

export function withLiveAchievements(list, streak) {
  return (list || []).map((a) => withLiveStreak(a, streak));
}
