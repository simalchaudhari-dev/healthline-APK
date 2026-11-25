/** AI feature keys — must match AdminPanel `src/config/ai-features.js`. */

export const AI_FEATURE_OPTIONS = [
  { id: 'mealScanner', label: 'Meal Scanner', hubId: 'scan' },
  { id: 'aiCoach', label: 'AI Nutrition Coach', hubId: 'coach' },
  { id: 'voiceLog', label: 'Voice Logging', hubId: null },
  { id: 'barcodeScan', label: 'Barcode Scan', hubId: 'barcode' },
  { id: 'workoutAi', label: 'Workout AI', hubId: 'workoutAi' },
  { id: 'medicalAi', label: 'Medicare assist', hubId: 'medicalAi' },
];

export const DEFAULT_AI_FEATURES_BY_PLAN = {
  Free: ['barcodeScan', 'medicalAi'],
  Plus: ['mealScanner', 'aiCoach', 'voiceLog', 'barcodeScan', 'medicalAi'],
  Family: ['mealScanner', 'aiCoach', 'voiceLog', 'barcodeScan', 'workoutAi', 'medicalAi'],
};

export function aiFeaturesForPlan(planCode, plans = []) {
  const code = String(planCode || 'Free');
  const fromApi = plans.find((p) => p.id === code || p.code === code);
  if (fromApi && Array.isArray(fromApi.aiFeatures)) {
    return fromApi.aiFeatures;
  }
  return DEFAULT_AI_FEATURES_BY_PLAN[code] || DEFAULT_AI_FEATURES_BY_PLAN.Free || [];
}

export function hasAiFeature(planCode, featureId, plans = []) {
  return aiFeaturesForPlan(planCode, plans).includes(featureId);
}

export function hubFeatureAiKey(hubId) {
  return AI_FEATURE_OPTIONS.find((item) => item.hubId === hubId)?.id || null;
}
