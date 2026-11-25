/**
 * A logged food stores the totals for what was eaten ("3 × 1 bowl", 960 kcal).
 * Lists that are picked from again (recent foods) must keep ONE serving, or picking it with
 * 2 servings would give "2 × 3 × 1 bowl" and 6 bowls of calories.
 *
 * Only the "N × " prefix the app writes when logging several servings is read (the "×" sign,
 * not the letter x), so a catalog serving name like "2 x 50g" or "4x4 wrap" is left alone.
 * A food that says how many servings it holds (`servings`) is divided by that number.
 */
const NUM_KEYS = ['calories', 'carbs', 'protein', 'fat', 'fiber', 'sugar', 'sodium'];
const PREFIX = /^\s*(\d+(?:\.\d+)?)\s*×\s*(.+)$/;

/** "2 × 3 × 1 bowl" → { count: 6, serving: "1 bowl" } */
export function splitServing(serving) {
  let rest = String(serving || '');
  let count = 1;
  for (let i = 0; i < 5; i += 1) {
    const m = rest.match(PREFIX);
    if (!m) break;
    const n = Number(m[1]);
    if (!(n > 0)) break;
    count *= n;
    rest = m[2];
  }
  return { count, serving: rest.trim() };
}

/**
 * One serving of a food that may hold scaled totals (e.g. a logged entry or an old recent item).
 * `perServing: true` marks a food already brought to one serving, so it is not divided again.
 */
export function oneServing(food) {
  if (!food) return food;
  const known = Number(food.servings);
  // A known count always wins: a recent item (perServing) logged again with 3 servings holds 3.
  if (!(known > 1) && food.perServing) return food;
  let count;
  let serving;
  if (known > 1) {
    // The count is known: drop only the one "N × " the app added for it.
    count = known;
    const m = String(food.serving || '').match(PREFIX);
    serving = m && Number(m[1]) === known ? m[2].trim() : String(food.serving || '');
  } else {
    ({ count, serving } = splitServing(food.serving));
  }
  if (count === 1) return food;
  const next = { ...food, serving };
  delete next.servings;
  NUM_KEYS.forEach((k) => {
    if (Number.isFinite(Number(food[k]))) next[k] = Math.round((Number(food[k]) / count) * 10) / 10;
  });
  next.calories = Math.round(Number(next.calories) || 0);
  return next;
}
