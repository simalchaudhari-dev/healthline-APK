import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBase } from '../config/env';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';
import { REMINDER_CATALOG_KEY } from '../config/storageKeys';

/**
 * Offline / first-launch fallback — mirrors AdminPanel DEFAULT_REMINDERS.
 * weekdays: 1 = Sunday … 7 = Saturday; all 7 = every day. times are 24h "HH:mm".
 */
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export const FALLBACK_REMINDERS = [
  { key: 'breakfast', label: 'Breakfast reminder', title: 'Breakfast time', body: 'Time to fuel your morning.', times: ['08:00'], weekdays: ALL_WEEKDAYS, defaultOn: true },
  { key: 'lunch', label: 'Lunch reminder', title: 'Lunch time', body: 'Log lunch — stay on track.', times: ['12:30'], weekdays: ALL_WEEKDAYS, defaultOn: true },
  { key: 'snack', label: 'Snack reminder', title: 'Snack window', body: 'Smart snack window open.', times: ['16:00'], weekdays: ALL_WEEKDAYS, defaultOn: false },
  { key: 'exercise', label: 'Exercise reminder', title: 'Move a little', body: 'Move for 10 minutes today.', times: ['18:00'], weekdays: ALL_WEEKDAYS, defaultOn: false },
  { key: 'dinner', label: 'Dinner reminder', title: 'Dinner time', body: 'Plan a balanced dinner tonight.', times: ['19:00'], weekdays: ALL_WEEKDAYS, defaultOn: true },
  { key: 'water', label: 'Water nudge', title: 'Hydration check', body: 'Drink a glass of water.', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'], weekdays: ALL_WEEKDAYS, defaultOn: true },
  { key: 'foodLog', label: 'Food logging', title: 'Log today’s meals', body: 'Open the app to mark meals Done.', times: ['21:00'], weekdays: ALL_WEEKDAYS, defaultOn: false },
  { key: 'mealPlan', label: 'Meal planning', title: 'Plan your week', body: 'Build next week’s meal plan.', times: ['18:00'], weekdays: [1], defaultOn: false },
  { key: 'weighIn', label: 'Weekly weigh-in', title: 'Weekly weigh-in', body: 'Log weight · celebrate progress.', times: ['08:00'], weekdays: [1], defaultOn: false },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `weekdays` list, or the older single `weekday` (0 = every day) from a cached catalog. */
function normalizeWeekdays(raw) {
  const list = Array.isArray(raw.weekdays) ? raw.weekdays : [Number(raw.weekday)];
  const days = [...new Set(list.map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort();
  return days.length ? days : ALL_WEEKDAYS;
}

export function isEveryDay(item) {
  return item.weekdays.length === ALL_WEEKDAYS.length;
}

function normalizeReminder(raw) {
  const key = String(raw?.key || '').trim();
  if (!key) return null;
  const times = (Array.isArray(raw.times) ? raw.times : []).filter((t) => TIME_RE.test(t));
  if (!times.length) return null;
  return {
    key,
    label: String(raw.label || key),
    title: String(raw.title || raw.label || key),
    body: String(raw.body || ''),
    times,
    weekdays: normalizeWeekdays(raw),
    defaultOn: !!raw.defaultOn,
  };
}

/** User's own toggle wins; otherwise the admin's ON-by-default. */
export function isReminderOn(reminders, item) {
  const value = reminders?.[item.key];
  return typeof value === 'boolean' ? value : !!item.defaultOn;
}

const WEEKDAY_NAMES = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "8:00 AM", "6 times a day", "Sunday · 8:00 AM", "Mon, Wed, Fri · 6:00 PM" */
export function reminderScheduleText(item) {
  const when = item.times.length > 2 ? `${item.times.length} times a day` : item.times.map(formatTime).join(', ');
  if (isEveryDay(item)) return when;
  const days =
    item.weekdays.length === 1
      ? WEEKDAY_NAMES[item.weekdays[0]]
      : item.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ');
  return `${days} · ${when}`;
}

export async function loadCachedReminderCatalog() {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_CATALOG_KEY);
    const list = raw ? JSON.parse(raw).map(normalizeReminder).filter(Boolean) : [];
    return list.length ? list : null;
  } catch {
    return null;
  }
}

/**
 * Reminders the admin has enabled, from AdminPanel `GET /api/reminders`.
 * Returns null when the server can't be reached (caller keeps the cached list).
 */
export async function apiFetchReminderCatalog() {
  const base = apiBase();
  if (!base) return null;
  try {
    const { res, data } = await fetchJson(`${base}/api/reminders`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok || !Array.isArray(data?.reminders)) return null;
    // An empty list is valid: the admin switched every reminder off.
    const list = data.reminders.map(normalizeReminder).filter(Boolean);
    AsyncStorage.setItem(REMINDER_CATALOG_KEY, JSON.stringify(list)).catch(() => {});
    return list;
  } catch {
    return null;
  }
}
