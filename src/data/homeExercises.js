/**
 * Home exercises in two levels:
 *  - gentle: no equipment, safe for older adults — most moves seated or holding a chair / wall.
 *  - active: higher-effort cardio, strength and core for younger / fitter users.
 * Items without `level` are gentle. `met` = effort (MET) used for the calorie estimate when a
 * session is logged to the diary. Content is general fitness guidance, not medical advice.
 */

export const LEVELS = [
  { id: 'gentle', label: 'Older adult', hint: '55+ or beginner · gentle, seated moves' },
  { id: 'active', label: 'Younger adult', hint: 'Under 55 & fit · cardio, strength' },
];

export function levelOf(item) {
  return item?.level || 'gentle';
}

/** Age at which the Gentle level is suggested by default. */
export const GENTLE_FROM_AGE = 55;
const DEFAULT_ROUTINE = { gentle: 'morning-stretch', active: 'full-body-strength' };

export function suggestedLevel(age) {
  return (Number(age) || 0) >= GENTLE_FROM_AGE ? 'gentle' : 'active';
}

/**
 * The user's daily workout: their chosen level + routine (onboarding / Health details),
 * falling back to an age-based suggestion.
 */
export function workoutPlanFor(profile) {
  const level = ['gentle', 'active'].includes(profile?.workoutLevel)
    ? profile.workoutLevel
    : suggestedLevel(profile?.age);
  const chosen = ROUTINES.find((r) => r.id === profile?.workoutRoutine && levelOf(r) === level);
  // The admin can delete routines: fall back to the default, then to any routine for this level.
  const routine =
    chosen ||
    ROUTINES.find((r) => r.id === DEFAULT_ROUTINE[level] && levelOf(r) === level) ||
    ROUTINES.find((r) => levelOf(r) === level);
  return { level, routine, chosen: Boolean(chosen) };
}

/** Filled from the server (admin panel → Exercises at home). */
export const CATEGORIES = [];

export const EXERCISES = [];

/** Ready-made sessions: exercise ids in order. Durations come from each exercise. */
export const ROUTINES = [];

let BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id) {
  return BY_ID[id] || null;
}

// ---------- Catalog from the server (admin panel → Exercises at home) ----------
// The lists above start empty. The server copy (or the copy saved on the phone) fills them in place,
// so every import keeps working.

let catalogVersion = '';
const catalogListeners = new Set();

function replaceList(list, next) {
  list.splice(0, list.length, ...next);
}

/** Use the catalog from GET /api/home-exercises. Ignored when it is empty or malformed. */
export function applyExerciseCatalog(data) {
  const exercises = Array.isArray(data?.exercises) ? data.exercises.filter((e) => e?.id && e?.name) : [];
  if (!exercises.length) return false;
  const categories = Array.isArray(data.categories) ? data.categories.filter((c) => c?.id && c?.label) : [];
  const routines = Array.isArray(data.routines)
    ? data.routines.filter((r) => r?.id && r?.name && Array.isArray(r.exercises))
    : [];
  if (categories.length) replaceList(CATEGORIES, categories);
  replaceList(EXERCISES, exercises);
  replaceList(ROUTINES, routines);
  BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
  catalogVersion = String(data.version || Date.now());
  catalogListeners.forEach((fn) => fn(catalogVersion));
  return true;
}

export function exerciseCatalogVersion() {
  return catalogVersion;
}

export function onExerciseCatalogChange(fn) {
  catalogListeners.add(fn);
  return () => catalogListeners.delete(fn);
}

export function getRoutine(id) {
  return ROUTINES.find((r) => r.id === id) || null;
}

/** Exercise objects for a routine (repeated `rounds` times), skipping unknown ids. */
export function routineExercises(routine) {
  const once = (routine?.exercises || []).map(getExercise).filter(Boolean);
  const rounds = Math.max(1, Number(routine?.rounds) || 1);
  return Array.from({ length: rounds }, () => once).flat();
}

/** Body-part filter (Exercises at home). Worked out from each exercise's `target` text. */
export const BODY_PARTS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'arms', label: 'Arms' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
  { id: 'full', label: 'Full body' },
];

export function bodyPartsOf(exercise) {
  // "Back of the arms" / "Back of legs" mean arms / legs, not the back.
  const t = String(exercise?.target || '').toLowerCase().replace(/back of (the )?(arms|legs)/g, '$2');
  const parts = [];
  if (/chest/.test(t)) parts.push('chest');
  if (/back|spine|posture/.test(t)) parts.push('back');
  if (/arm|biceps|forearm/.test(t)) parts.push('arms');
  if (/shoulder/.test(t)) parts.push('shoulders');
  if (/leg|thigh|glute|calves|calf|ankle|hip|knee/.test(t)) parts.push('legs');
  if (/core|abs|waist/.test(t)) parts.push('core');
  if (/full body/.test(t)) parts.push('full');
  return parts;
}

export const EQUIPMENT = [
  { id: 'none', label: 'No equipment' },
  { id: 'chair', label: 'Chair' },
  { id: 'dumbbells', label: 'Dumbbells' },
];

export function equipmentOf(exercise) {
  if (exercise?.category === 'dumbbell' || /dumbbell/i.test(exercise?.name || '')) return 'dumbbells';
  return exercise?.chair ? 'chair' : 'none';
}

export function routineMinutes(routine) {
  return Math.round(routineExercises(routine).reduce((s, e) => s + e.seconds, 0) / 60);
}

/** kcal = MET × 3.5 × kg / 200 per minute (standard estimate). */
export function exerciseCalories(exercise, seconds, weightKg) {
  const w = Number(weightKg) > 30 && Number(weightKg) < 300 ? Number(weightKg) : 70;
  return ((exercise?.met || 2) * 3.5 * w) / 200 * (seconds / 60);
}

/**
 * Exercises the user actually moved through (skipped moves are left out).
 * Same id across rounds is one row: `times` is how many rounds counted, `calories` is only those seconds.
 * Rounded row calories add up to the session total.
 */
export function burnedMoves(moves, spent, weightKg) {
  const byId = new Map();
  (moves || []).forEach((move, i) => {
    const seconds = Math.max(0, Number(spent?.[i]) || 0);
    if (seconds <= 0 || !move?.name) return;
    const key = move.id || move.name;
    const row = byId.get(key) || { name: move.name, times: 0, seconds: 0, calories: 0 };
    row.times += 1;
    row.seconds += seconds;
    row.calories += exerciseCalories(move, seconds, weightKg);
    byId.set(key, row);
  });
  const rows = [...byId.values()].map((row) => ({
    name: row.name,
    times: row.times,
    seconds: Math.round(row.seconds),
    calories: Math.round(row.calories),
    raw: row.calories,
  }));
  const exact = Math.round(rows.reduce((s, row) => s + row.raw, 0));
  const rounded = rows.reduce((s, row) => s + row.calories, 0);
  if (rows.length && rounded !== exact) rows[rows.length - 1].calories += exact - rounded;
  return rows.map(({ name, times, seconds, calories }) => ({ name, times, seconds, calories }));
}
