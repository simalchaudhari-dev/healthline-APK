/** Freemium plans — amounts are numbers (₹). Matches AdminPanel plans API. */

export const PLANS = [
  {
    id: 'Free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: null,
    tagline: 'Build a healthy habit',
    highlight: false,
    features: [
      'Calories, macros & water',
      'Meal & exercise logging',
      'Basic charts & goals',
      'Limited AI (5 / day later)',
    ],
    aiFeatures: ['barcodeScan', 'medicalAi'],
  },
  {
    id: 'Plus',
    name: 'Health line Plus',
    priceMonthly: 199,
    priceYearly: 1999,
    tagline: 'Personalization + AI insights',
    highlight: true,
    features: [
      'Everything in Free',
      'Unlimited reasonable AI',
      'Adaptive calorie & macros',
      'AI daily briefing & coach',
      'Advanced insights',
    ],
    aiFeatures: ['mealScanner', 'aiCoach', 'voiceLog', 'barcodeScan', 'medicalAi'],
  },
  {
    id: 'Family',
    name: 'Health line Family',
    priceMonthly: 299,
    priceYearly: 2999,
    tagline: 'Up to 5 profiles',
    highlight: false,
    features: [
      'Everything in Plus',
      'Up to 5 family profiles',
      'Separate histories',
      'Shared grocery list',
      'Family goals dashboard',
    ],
    aiFeatures: ['mealScanner', 'aiCoach', 'voiceLog', 'barcodeScan', 'workoutAi', 'medicalAi'],
  },
];

export function parsePlanAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const digits = String(value).replace(/[^\d.]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

export function formatInrAmount(amount) {
  const n = parsePlanAmount(amount);
  if (n == null) return '0';
  return n.toLocaleString('en-IN');
}

export function yearlySavings(plan) {
  const monthly = parsePlanAmount(plan?.priceMonthly);
  const yearly = parsePlanAmount(plan?.priceYearly);
  if (monthly == null || yearly == null || monthly <= 0) return 0;
  return Math.max(0, monthly * 12 - yearly);
}

export function getPlanById(id, plans = PLANS) {
  return plans.find((p) => p.id === id) || plans[0] || PLANS[0];
}

export function formatPlanLabel(planId, plans = PLANS) {
  const plan = getPlanById(planId, plans);
  return plan?.name || planId || 'Free';
}
