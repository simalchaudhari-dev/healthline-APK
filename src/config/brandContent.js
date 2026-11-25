import { BRAND_GREEN, DEFAULT_BRAND } from './colors';

/** Official app display name (always two words). */
export const APP_NAME = 'Health line';
export const APP_FULL_NAME = `${APP_NAME} Nutrition`;

const ONBOARD_FEATURES = [
  { id: 'meals', title: 'Track Meals', sub: 'Log breakfast, lunch, dinner & snacks in seconds' },
  { id: 'goals', title: 'Reach Your Goals', sub: 'Calories and macros tailored to you' },
  { id: 'health', title: 'Stay Healthy', sub: 'Water, exercise and weekly progress' },
];

export const BRAND_CONTENT = {
  [BRAND_GREEN]: {
    appName: APP_NAME,
    logoLetter: 'H',
    tagline: 'Eat Smart • Live Better',
    heroTitle: 'Small steps. Healthier you.',
    heroSub: 'Build healthy habits that fit your everyday life.',
    welcomeTitle: 'Your health journey starts here.',
    welcomeSub: 'Eat better, move more, stay hydrated, and track your progress — all in one place.',
    onboardFeatures: ONBOARD_FEATURES,
  },
};

export function getBrandContent(brandId) {
  return BRAND_CONTENT[brandId] || BRAND_CONTENT[DEFAULT_BRAND];
}
