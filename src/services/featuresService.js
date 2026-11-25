import { apiBase } from '../config/env';
import { featureColors } from '../config/colors';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

/** Main tabs — never fully blocked when a catalog feature is Inactive. */
export const TAB_ROUTES = new Set(['Diary', 'Discover', 'Progress', 'Dashboard']);

/** Offline / API-down fallback — mirrors AdminPanel DEFAULT features. */
export const FALLBACK_FEATURES = [
  {
    id: 'food',
    label: 'Food Tracking',
    icon: 'UtensilsCrossed',
    color: featureColors.foodTracking || '#FF9800',
    route: 'AddFood',
    params: { meal: 'breakfast' },
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'scan',
    label: 'Meal Scanner',
    icon: 'ScanLine',
    color: featureColors.mealScanner || '#03A9F4',
    route: 'ScanFood',
    params: { meal: 'lunch' },
    aiKey: 'mealScanner',
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'cal',
    label: 'Calorie Counter',
    icon: 'Flame',
    color: featureColors.calorieCounter || '#F06292',
    route: 'Diary',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'macro',
    label: 'Macro Tracking',
    icon: 'PieChart',
    color: featureColors.macroTracking || '#9B59B6',
    route: 'Progress',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'water',
    label: 'Water Tracker',
    icon: 'Droplets',
    color: featureColors.waterTracker || '#26C6DA',
    route: 'Dashboard',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'exercise',
    label: 'Exercise Log',
    icon: 'Dumbbell',
    color: featureColors.exerciseLog || '#66BB6A',
    route: 'LogExercise',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'weight',
    label: 'Weight Tracker',
    icon: 'Scale',
    color: featureColors.weightTracker || '#FFCA28',
    route: 'LogWeight',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'charts',
    label: 'Progress Charts',
    icon: 'ChartLine',
    color: featureColors.progressCharts || '#7986CB',
    route: 'Progress',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'recipes',
    label: 'Healthy Recipes',
    icon: 'Salad',
    color: featureColors.healthyRecipes || '#9CCC65',
    route: 'Discover',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'planner',
    label: 'Meal Planner',
    icon: 'CalendarDays',
    color: featureColors.mealPlanner || '#FF7043',
    route: 'MealPlan',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'coach',
    label: 'AI Nutrition Coach',
    icon: 'Sparkles',
    color: featureColors.aiCoach || '#0984E3',
    route: 'Coach',
    params: {},
    aiKey: 'aiCoach',
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: 'Bell',
    color: featureColors.reminders || '#FD79A8',
    route: 'Reminders',
    params: {},
    aiKey: null,
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'barcode',
    label: 'Barcode Scan',
    icon: 'Barcode',
    color: featureColors.weightTracker || '#FFCA28',
    route: 'BarcodeScan',
    params: { meal: 'snacks' },
    aiKey: 'barcodeScan',
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'voiceLog',
    label: 'Voice Logging',
    icon: 'Mic',
    color: '#6C5CE7',
    route: 'VoiceLog',
    params: { meal: 'snacks' },
    aiKey: 'voiceLog',
    showInHub: false,
    status: 'Active',
  },
  {
    id: 'workoutAi',
    label: 'Workout AI',
    icon: 'Dumbbell',
    color: '#2ECC71',
    route: 'WorkoutAi',
    params: {},
    aiKey: 'workoutAi',
    showInHub: true,
    status: 'Active',
  },
  {
    id: 'medicalAi',
    label: 'Medicare assist',
    icon: 'HeartPulse',
    color: '#FF3B30',
    route: 'Medicare',
    params: {},
    aiKey: 'medicalAi',
    showInHub: true,
    status: 'Active',
  },
];

export const FALLBACK_HUB_FEATURES = FALLBACK_FEATURES.filter(
  (f) => f.status === 'Active' && f.showInHub !== false
);

export function normalizeFeature(raw) {
  if (!raw) return null;
  const id = String(raw.id || raw.key || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(raw.label || id).trim(),
    description: String(raw.description || '').trim(),
    icon: String(raw.icon || '').trim(),
    color: String(raw.color || '#0070E0').trim(),
    route: String(raw.route || '').trim(),
    params: raw.params && typeof raw.params === 'object' ? raw.params : {},
    aiKey: raw.aiKey ? String(raw.aiKey).trim() : null,
    showInHub: raw.showInHub !== false && raw.showInHub !== 'No',
    status: raw.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

export function hubFeaturesFromCatalog(catalog = []) {
  return catalog.filter((f) => f.status === 'Active' && f.showInHub !== false);
}

export function findCatalogFeature(catalog = [], { key, route, aiKey } = {}) {
  if (key) {
    const byKey = catalog.find((f) => f.id === key);
    if (byKey) return byKey;
  }
  if (aiKey) {
    const byAi = catalog.find((f) => f.aiKey === aiKey);
    if (byAi) return byAi;
  }
  if (route) {
    const byRoute = catalog.find((f) => f.route === route);
    if (byRoute) return byRoute;
  }
  return null;
}

/**
 * Active = allowed. Missing from catalog = allow (not managed).
 * Main tabs are never blocked.
 */
export function isCatalogFeatureActive(catalog = [], { key, route, aiKey } = {}) {
  if (route && TAB_ROUTES.has(route)) return true;
  const feature = findCatalogFeature(catalog, { key, route, aiKey });
  if (!feature) return true;
  return feature.status === 'Active';
}

/**
 * Full App Features catalog from AdminPanel `GET /api/features`.
 * Includes Inactive so the APK can block screens.
 */
export async function apiFetchFeatureCatalog() {
  const base = apiBase();
  if (!base) return FALLBACK_FEATURES;

  try {
    const { res, data } = await fetchJson(`${base}/api/features`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return FALLBACK_FEATURES;

    const list = Array.isArray(data?.features) ? data.features : [];
    const mapped = list.map(normalizeFeature).filter(Boolean);
    return mapped.length ? mapped : FALLBACK_FEATURES;
  } catch {
    return FALLBACK_FEATURES;
  }
}

/** Hub tiles only (Active + showInHub). */
export async function apiFetchHubFeatures() {
  const catalog = await apiFetchFeatureCatalog();
  const hub = hubFeaturesFromCatalog(catalog);
  return hub.length ? hub : FALLBACK_HUB_FEATURES;
}
