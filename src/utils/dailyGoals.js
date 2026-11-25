/**
 * Today's seven targets — shared by Home ("3 of 7 daily goals done") and the Daily summary screen.
 * Pure function: pass in today's diary numbers, get back one row per target.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) => Math.round(num(v)).toLocaleString('en-IN');

function row(id, label, current, goal, unit, extra = {}) {
  const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
  const done = extra.done ?? pct >= 100;
  let status = 'Behind';
  if (extra.over) status = 'Over';
  else if (done) status = 'Done';
  else if (pct >= 50) status = 'On track';
  return {
    id,
    label,
    value: extra.value || `${fmt(current)} / ${fmt(goal)}${unit ? ` ${unit}` : ''}`,
    pct: Math.min(100, Math.max(0, pct)),
    done,
    status,
    left: Math.max(0, goal - current),
    route: extra.route,
  };
}

export function buildDailyGoals({ meals = {}, totals = {}, profile = {}, water = 0, steps = 0, stepGoal = 10000, workoutMinutes = 0, workoutGoal = 1 }) {
  const calGoal = num(profile.calories) || 2000;
  const eaten = num(totals.calories);
  const mainMeals = ['breakfast', 'lunch', 'dinner'].filter((k) => (meals[k] || []).length > 0).length;
  const waterGoal = num(profile.waterGoal) || 8;
  const over = eaten > calGoal * 1.1;

  return [
    row('calories', 'Calories', eaten, calGoal, 'kcal', {
      // Calories count as done when close to the goal, not just above it.
      done: eaten >= calGoal * 0.9 && !over,
      over,
      route: 'Diary',
    }),
    row('protein', 'Protein', num(totals.protein), num(profile.protein) || 1, 'g', { route: 'Diary' }),
    row('carbs', 'Carbs', num(totals.carbs), num(profile.carbs) || 1, 'g', { route: 'Diary' }),
    row('meals', 'Main meals', mainMeals, 3, 'logged', { route: 'Diary' }),
    row('water', 'Water', num(water), waterGoal, 'glasses', { route: 'water' }),
    row('steps', 'Steps', num(steps), stepGoal, '', { route: 'Steps' }),
    row('workout', 'Workout', num(workoutMinutes), Math.max(1, workoutGoal), 'min', { route: 'HomeExercises' }),
  ];
}

/** One plain sentence: what's done, and what's left to finish the day. */
export function dailyGoalsSentence(goals) {
  const done = goals.filter((g) => g.done).map((g) => g.label.toLowerCase());
  const todo = [];
  goals.forEach((g) => {
    if (g.done || g.status === 'Over') return;
    if (g.id === 'water') todo.push(`drink ${Math.ceil(g.left)} more glass${Math.ceil(g.left) === 1 ? '' : 'es'} of water`);
    else if (g.id === 'protein') todo.push(`add ${Math.round(g.left)} g protein`);
    else if (g.id === 'meals') todo.push(`log ${g.left === 1 ? 'one more meal' : `${g.left} more meals`}`);
    else if (g.id === 'workout') todo.push('finish today\'s workout');
    else if (g.id === 'steps') todo.push(`walk ${Math.round(g.left).toLocaleString('en-IN')} more steps`);
  });
  const join = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] || '');
  const over = goals.find((g) => g.id === 'calories' && g.status === 'Over');
  const parts = [];
  if (done.length) parts.push(`${join(done).replace(/^./, (c) => c.toUpperCase())} ${done.length === 1 ? 'is' : 'are'} done.`);
  if (over) parts.push('Calories are over your goal today.');
  if (todo.length) parts.push(`To finish the day, ${join(todo.slice(0, 3))}.`);
  if (!parts.length) parts.push('Log your meals, water and activity to see your progress here.');
  return parts.join(' ');
}
