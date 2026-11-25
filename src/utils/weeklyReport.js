/**
 * Weekly report numbers from the real diary (`days` from DiaryContext) — no sample data.
 * Pure functions so the maths can be tested without React Native.
 */
import { dailyWeights } from './weightLogs';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function keyToDate(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateKey(key, delta) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + delta);
  return dateToKey(date);
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Food, exercise and water totals for one diary day. */
function dayStats(day) {
  const meals = day?.meals || {};
  const foods = ['breakfast', 'lunch', 'dinner', 'snacks'].flatMap((m) =>
    Array.isArray(meals[m]) ? meals[m] : [],
  );
  const exercise = Array.isArray(day?.exercise) ? day.exercise : [];
  return {
    foodCount: foods.length,
    calories: Math.round(foods.reduce((s, f) => s + num(f.calories), 0)),
    protein: Math.round(foods.reduce((s, f) => s + num(f.protein), 0)),
    carbs: Math.round(foods.reduce((s, f) => s + num(f.carbs), 0)),
    fat: Math.round(foods.reduce((s, f) => s + num(f.fat), 0)),
    exerciseMinutes: Math.round(exercise.reduce((s, e) => s + num(e.minutes), 0)),
    burned: Math.round(exercise.reduce((s, e) => s + num(e.calories), 0)),
    water: num(day?.water),
  };
}

const avg = (list) => (list.length ? Math.round(list.reduce((s, v) => s + v, 0) / list.length) : 0);

/** Totals for the 7 days ending on `endKey` (inclusive). */
function summarise(days, endKey) {
  const list = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = shiftDateKey(endKey, -i);
    list.push({ key, label: WEEKDAY_SHORT[keyToDate(key).getDay()], ...dayStats(days?.[key]) });
  }
  const logged = list.filter((d) => d.foodCount > 0);
  return {
    list,
    logged,
    avgCalories: avg(logged.map((d) => d.calories)),
    avgProtein: avg(logged.map((d) => d.protein)),
    exerciseMinutes: list.reduce((s, d) => s + d.exerciseMinutes, 0),
    burned: list.reduce((s, d) => s + d.burned, 0),
    exerciseDays: list.filter((d) => d.exerciseMinutes > 0).length,
  };
}

/** Weight change inside the window: last log in the week minus the last log before/at its start. */
function weightChange(weightLogs, startKey, endKey) {
  // One weight per day (that day's last update), oldest first.
  const logs = dailyWeights(weightLogs);
  const inWeek = logs.filter((w) => w.date >= startKey && w.date <= endKey);
  if (!inWeek.length) return null;
  const before = logs.filter((w) => w.date < startKey).pop();
  const first = before || inWeek[0];
  const last = inWeek[inWeek.length - 1];
  if (first === last) return null;
  return Math.round((num(last.weight) - num(first.weight)) * 10) / 10;
}

/**
 * Everything the Weekly report screen shows for the week ending `endKey`.
 * Averages use only days with food logged, so an un-logged day doesn't look like a 0 kcal day.
 */
export function buildWeeklyReport({ days, profile, weightLogs, endKey }) {
  const startKey = shiftDateKey(endKey, -6);
  const week = summarise(days, endKey);
  const prev = summarise(days, shiftDateKey(endKey, -7));

  const calorieGoal = num(profile?.calories) || 2200;
  const proteinGoal = num(profile?.protein) || 0;
  const waterGoal = num(profile?.waterGoal) || 8;

  const waterDays = week.list.filter((d) => d.water > 0);
  const insights = [];
  const n = week.logged.length;

  if (!n) {
    insights.push('No food logged this week yet. Log your meals in Diary to see your trends here.');
  } else {
    const pct = Math.round((week.avgCalories / calorieGoal) * 100);
    if (n < 4) insights.push(`You logged food on ${n} of 7 days — logging more days makes this report more accurate.`);
    if (pct > 110) insights.push(`Calories averaged ${pct}% of your goal on logged days — a little over target.`);
    else if (pct < 80) insights.push(`Calories averaged ${pct}% of your goal on logged days — well under target.`);
    else insights.push(`Calories averaged ${pct}% of your goal on logged days — close to target.`);
    if (proteinGoal && week.avgProtein < proteinGoal * 0.8) {
      insights.push(`Protein averaged ${week.avgProtein} g against a ${proteinGoal} g goal.`);
    }
  }
  const waterHit = week.list.filter((d) => d.water >= waterGoal).length;
  if (waterDays.length && waterHit < 4) {
    insights.push(`Water goal met on ${waterHit} of 7 days.`);
  }

  return {
    startKey,
    endKey,
    days: week.list,
    loggedDays: n,
    avgCalories: week.avgCalories,
    adherence: n ? Math.round((week.avgCalories / calorieGoal) * 100) : 0,
    avgProtein: week.avgProtein,
    exerciseMinutes: week.exerciseMinutes,
    exerciseDays: week.exerciseDays,
    burned: week.burned,
    avgWater: waterDays.length ? Math.round((waterDays.reduce((s, d) => s + d.water, 0) / 7) * 10) / 10 : 0,
    waterGoalDays: waterHit,
    weightChange: weightChange(weightLogs, startKey, endKey),
    prevAvgCalories: prev.logged.length ? prev.avgCalories : null,
    calorieGoal,
    proteinGoal,
    waterGoal,
    insights,
  };
}
