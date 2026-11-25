/** Health profile choices — shared by onboarding (sign-up) and the Health details edit screen. */

export const FOCUS_GOALS = [
  { id: 'lose', label: 'Lose weight steadily', sub: '0.5 kg a week, no crash targets' },
  { id: 'protein', label: 'Build muscle', sub: 'Higher protein floor, timed around training' },
  { id: 'sugar', label: 'Manage blood sugar', sub: 'Flags spikes, suggests swaps' },
  { id: 'family', label: 'Feed my family well', sub: 'Plans and lists scale to 4' },
  { id: 'energy', label: 'Just eat better', sub: 'Fibre, veg and whole foods first' },
];

export const ACTIVITY = ['Low', 'Light', 'Moderate', 'High'];

export const SEX_OPTS = [
  { id: 'Female', label: 'Female' },
  { id: 'Male', label: 'Male' },
  { id: 'Prefer not to say', label: 'Prefer not to say' },
];

export const DIET_OPTS = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Mediterranean',
  'Low-carb',
  'High-protein',
  'Halal',
  'Kosher',
  'No preference',
];
export const DIET_EXCLUSIVE = 'No preference';

export const ALLERGENS = ['Fish', 'Peanuts', 'Dairy', 'Gluten', 'Shellfish', 'Eggs', 'Soy', 'Tree nuts'];

export const CONDITIONS = ['Pre-diabetic', 'Hypertension', 'IBS', 'High cholesterol', 'None'];
export const CONDITIONS_EXCLUSIVE = 'None';
