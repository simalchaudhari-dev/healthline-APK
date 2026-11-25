/**
 * Brand color palette — the app has one theme: Health line green.
 * Read colors through ThemeContext (useTheme) so light/dark switches re-render.
 */

export const BRAND_GREEN = 'green';
export const DEFAULT_BRAND = BRAND_GREEN;

const NEUTRALS = {
  light: {
    pageBg: '#F2F4F7',
    cardBg: '#FFFFFF',
    elevated: '#FFFFFF',
    border: '#E4E7EC',
    text: '#101828',
    muted: '#667085',
    label: '#667085',
    placeholder: '#98A2B3',
    invertBg: '#101828',
    invertText: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.45)',
    track: '#EAECF0',
    chip: '#F2F4F7',
    imageStage: '#EAECF0',
  },
  /** Productive-inspired dark surfaces */
  dark: {
    pageBg: '#0B0B0D',
    cardBg: '#16161A',
    elevated: '#1C1C22',
    border: '#2A2A32',
    text: '#F5F5F7',
    muted: '#9CA3AF',
    label: '#9CA3AF',
    placeholder: '#6B7280',
    invertBg: '#FFFFFF',
    invertText: '#101828',
    overlay: 'rgba(0,0,0,0.72)',
    track: '#2A2A32',
    chip: '#1C1C22',
    imageStage: '#1C1C22',
  },
};

/**
 * Green brand — same greens as the design canvas: #2e7d32 (main) · #1b5e20 (dark) · #e2f2dc (soft).
 * White text on #2e7d32 passes WCAG AA (≈5.1:1).
 */
const GREEN_BRAND = {
  id: BRAND_GREEN,
  primary: '#2e7d32',
  primaryDark: '#1b5e20',
  primarySoft: '#e2f2dc',
  accent: '#1b5e20',
  accentSoft: '#e2f2dc',
  /** Lime logo accent */
  lime: '#7EC845',
  forest: '#233525',
  aiPurple: '#6C5CE7',
  aiSoft: '#F0EDFF',
  carbs: '#FFA726',
  protein: '#42A5F5',
  fat: '#FF7043',
  exercise: '#66BB6A',
  danger: '#FF3B30',
  primaryRgb: '46,125,50',
  /** Light page tint from the design canvas. */
  pageBgLight: '#f2f8ef',
};

/** Feature icon tile colors (NutriZen board). Shared across brands. */
export const featureColors = {
  foodTracking: '#FF9800',
  mealScanner: '#03A9F4',
  calorieCounter: '#F06292',
  macroTracking: '#9B59B6',
  waterTracker: '#26C6DA',
  exerciseLog: '#66BB6A',
  weightTracker: '#FFCA28',
  progressCharts: '#7986CB',
  healthyRecipes: '#9CCC65',
  mealPlanner: '#FF7043',
  aiCoach: '#0984E3',
  reminders: '#FD79A8',
};

export const BRAND_PALETTES = {
  [BRAND_GREEN]: GREEN_BRAND,
};

let activeBrandId = DEFAULT_BRAND;

export function getActiveBrandId() {
  return activeBrandId;
}

/** Called by ThemeProvider when brand changes (keeps static `colors` Proxy in sync). */
export function setActiveBrandId(brandId) {
  if (BRAND_PALETTES[brandId]) activeBrandId = brandId;
}

export function getBrandColors(brandId = activeBrandId) {
  return BRAND_PALETTES[brandId] || BRAND_PALETTES[DEFAULT_BRAND];
}

/**
 * Live brand tokens. Prefer reading these during React render after useTheme()
 * so brand switches re-render correctly.
 */
export const colors = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === '__esModule') return false;
      const palette = getBrandColors();
      return palette[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(getBrandColors());
    },
    getOwnPropertyDescriptor(_t, prop) {
      return {
        configurable: true,
        enumerable: true,
        value: getBrandColors()[prop],
      };
    },
  },
);

/** Neutrals + surface colors for light/dark. Soft page tint follows brand on light. */
export function themeColors(isDark, brandId = activeBrandId) {
  const brand = getBrandColors(brandId);
  const base = isDark ? NEUTRALS.dark : { ...NEUTRALS.light };
  if (!isDark && brand.pageBgLight) {
    base.pageBg = brand.pageBgLight;
  }
  return base;
}

export function primaryRgba(alpha = 1, brandId = activeBrandId) {
  const { primaryRgb } = getBrandColors(brandId);
  return `rgba(${primaryRgb},${alpha})`;
}

export default colors;
