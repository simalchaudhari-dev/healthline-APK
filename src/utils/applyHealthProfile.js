/**
 * Apply server / onboarding health profile into local diary state helpers.
 */
export function applyHealthProfileToDiary(
  { updateProfile, setGoal, updateReminder },
  { user, profile: profileOverride, firstName, lastName } = {}
) {
  const p = profileOverride || user?.profile;
  if (!p || typeof p !== 'object') {
    const display = [firstName || user?.firstName, lastName || user?.lastName]
      .filter(Boolean)
      .join(' ');
    if (display) {
      updateProfile?.({
        name: display,
        firstName: firstName || user?.firstName || '',
        lastName: lastName || user?.lastName || '',
        email: user?.email || '',
      });
    }
    return;
  }

  const fn = String(firstName || user?.firstName || '').trim();
  const ln = String(lastName || user?.lastName || '').trim();
  const display = [fn, ln].filter(Boolean).join(' ') || user?.displayName || 'Health line user';

  updateProfile?.({
    name: display,
    firstName: fn,
    lastName: ln,
    email: user?.email || '',
    sex: p.sex || '',
    age: Number(p.age) || 30,
    heightCm: Number(p.heightCm) || 168,
    activity: p.activity || 'Moderate',
    calories: Number(p.calories) || 2200,
    carbs: Number(p.carbs) || 220,
    protein: Number(p.protein) || 140,
    fat: Number(p.fat) || 73,
    waterGoal: Number(p.waterGoal) || 8,
    weight: Number(p.weight) || 72,
    goalWeight: Number(p.goalWeight) || 68,
    diet: Array.isArray(p.diet) ? p.diet : [],
    allergies: Array.isArray(p.allergies) ? p.allergies : [],
    conditions: Array.isArray(p.conditions) ? p.conditions : [],
    focusGoals: Array.isArray(p.focusGoals) ? p.focusGoals : [],
    workoutLevel: p.workoutLevel || '',
    workoutRoutine: p.workoutRoutine || '',
  });

  if (p.goal && setGoal) setGoal(p.goal);

  const r = p.reminders || {};
  if (updateReminder) {
    if (r.breakfast !== undefined) updateReminder('breakfast', !!r.breakfast);
    if (r.lunch !== undefined) updateReminder('lunch', !!r.lunch);
    if (r.dinner !== undefined) updateReminder('dinner', !!r.dinner);
    if (r.water !== undefined) updateReminder('water', !!r.water);
    if (r.weighIn !== undefined) updateReminder('weighIn', !!r.weighIn);
  }
}
