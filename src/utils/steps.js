/**
 * Step maths for the Steps screen — pure functions (no React Native) so they can be tested in Node.
 * Distance and calories are estimates from height/weight; they are labelled as such in the UI.
 */

export const DEFAULT_STEP_GOAL = 10000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local-midnight start of the day `daysAgo` days before `now`. */
export function dayStart(daysAgo = 0, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
}

/** Walking stride ≈ 41.5% of height (common pedometer estimate). Falls back to 168 cm. */
export function strideMeters(heightCm) {
  const h = Number(heightCm) > 100 && Number(heightCm) < 250 ? Number(heightCm) : 168;
  return (h * 0.415) / 100;
}

export function distanceKm(steps, heightCm) {
  return Math.round(((Number(steps) || 0) * strideMeters(heightCm)) / 100) / 10;
}

/** ≈0.04 kcal per step for a 70 kg adult, scaled by body weight. */
export function stepCalories(steps, weightKg) {
  const w = Number(weightKg) > 30 && Number(weightKg) < 300 ? Number(weightKg) : 70;
  return Math.round((Number(steps) || 0) * 0.04 * (w / 70));
}

/**
 * Summary for the screen from daily totals.
 * `days`: [{ key: 'YYYY-MM-DD', steps }] oldest → newest, last item = today.
 */
export function summariseSteps(days, { goal = DEFAULT_STEP_GOAL, heightCm, weightKg } = {}) {
  const list = (Array.isArray(days) ? days : []).map((d) => {
    const [y, m, dd] = String(d.key).split('-').map(Number);
    return {
      key: d.key,
      label: DOW[new Date(y, m - 1, dd).getDay()],
      steps: Math.max(0, Math.round(Number(d.steps) || 0)),
    };
  });
  const today = list[list.length - 1] || { key: dateKey(), label: DOW[new Date().getDay()], steps: 0 };
  const withData = list.filter((d) => d.steps > 0);
  const best = withData.reduce((b, d) => (d.steps > (b?.steps || 0) ? d : b), null);
  const total = list.reduce((s, d) => s + d.steps, 0);

  return {
    days: list,
    today: today.steps,
    progress: goal > 0 ? Math.min(1, today.steps / goal) : 0,
    remaining: Math.max(0, goal - today.steps),
    goal,
    distanceKm: distanceKm(today.steps, heightCm),
    calories: stepCalories(today.steps, weightKg),
    weekTotal: total,
    weekAverage: withData.length ? Math.round(total / list.length) : 0,
    goalDays: list.filter((d) => d.steps >= goal).length,
    best,
  };
}
