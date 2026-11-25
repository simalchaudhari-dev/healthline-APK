import { useTheme } from '../../context/ThemeContext';

/**
 * Colours for the onboarding pages after the welcome screen (language, create account).
 * `fill` is the green for buttons and selected badges; `accent` is green text/icons that
 * must read on the page (a lighter green in dark mode).
 */
const LIGHT = {
  isDark: false,
  bg: '#f2f8ef',
  card: '#FFFFFF',
  cardOn: '#f7fcf5',
  ink: '#0d1b2a',
  muted: '#4b5563',
  fill: '#2e7d32',
  accent: '#2e7d32',
  accentStrong: '#1e5e24',
  soft: '#e2f2dc',
  softBorder: '#cfe6c7',
  line: '#dfeedb',
  badge: '#f1f5f0',
  radioOff: '#c9d6c5',
  note: 'rgba(226,242,220,0.6)',
  backBg: '#FFFFFF',
  backIcon: '#1e5e24',
  shadow: '#1e5e24',
};

const DARK = {
  isDark: true,
  bg: '#0A0A0A',
  card: '#151816',
  cardOn: '#132017',
  ink: '#F3F6F2',
  muted: '#A3ACB9',
  fill: '#2e7d32',
  accent: '#7cc47f',
  accentStrong: '#8fd192',
  soft: 'rgba(124,196,127,0.14)',
  softBorder: 'rgba(124,196,127,0.28)',
  line: '#26302A',
  badge: '#1F2521',
  radioOff: '#3A463C',
  note: 'rgba(124,196,127,0.08)',
  backBg: '#1C1F1D',
  backIcon: '#E6EFE6',
  shadow: '#000000',
};

export function useOnboardColors() {
  const { isDark } = useTheme();
  return isDark ? DARK : LIGHT;
}
