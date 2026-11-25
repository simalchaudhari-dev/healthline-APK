/**
 * Weight logs keep every update: { id, date: 'YYYY-MM-DD', at: ISO time, weight }.
 * A day can have several. Charts and trends use the last one of each day.
 */

function order(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ta = a.at || '';
  const tb = b.at || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return String(a.id || '') < String(b.id || '') ? -1 : 1;
}

/** Valid logs, oldest first (by day, then by time). */
export function sortWeightLogs(logs) {
  return (Array.isArray(logs) ? logs : [])
    .filter((w) => w?.date && Number(w.weight) > 0)
    .sort(order);
}

/** Valid logs, newest first: the history list. */
export function weightHistory(logs) {
  return sortWeightLogs(logs).reverse();
}

/** The last weight of each day, oldest first: what charts and trends use. */
export function dailyWeights(logs) {
  const byDay = new Map();
  sortWeightLogs(logs).forEach((w) => byDay.set(w.date, w));
  return [...byDay.values()];
}
