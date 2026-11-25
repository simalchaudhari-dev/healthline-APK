/**
 * One clear date format across the app: "19 Oct 2026" (day, short month name, full year).
 * Works the same on every phone (no locale / Intl differences).
 * Accepts a 'YYYY-MM-DD' day key (read as a local day), an ISO string, a Date or a timestamp.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const key = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  // A plain day key is a local calendar day, not midnight UTC.
  const d = key ? new Date(Number(key[1]), Number(key[2]) - 1, Number(key[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 19 Oct 2026 */
export function formatDate(value) {
  const d = toDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

/** Mon, 19 Oct 2026 */
export function formatDayDate(value) {
  const d = toDate(value);
  return d ? `${DAYS[d.getDay()]}, ${formatDate(d)}` : '';
}

/** 19 Oct 2026, 10:35 am */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const h = d.getHours();
  const hour = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hour}:${min} ${h < 12 ? 'am' : 'pm'}`;
}

/** 19 Oct — short label for chart axes, where the year is shown elsewhere. */
export function formatDayMonth(value) {
  const d = toDate(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
}

/**
 * Date range without repeating what is the same:
 * 12 – 18 Oct 2026 · 28 Sep – 4 Oct 2026 · 28 Dec 2025 – 3 Jan 2026
 */
export function formatRange(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return formatDate(a || b);
  if (a.getFullYear() !== b.getFullYear()) return `${formatDate(a)} – ${formatDate(b)}`;
  if (a.getMonth() !== b.getMonth()) return `${formatDayMonth(a)} – ${formatDate(b)}`;
  if (a.getDate() === b.getDate()) return formatDate(a);
  return `${a.getDate()} – ${formatDate(b)}`;
}
