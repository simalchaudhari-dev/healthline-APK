import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BRAND_GREEN,
  featureColors,
  getBrandColors,
  themeColors as buildThemeColors,
  primaryRgba,
} from '../config/colors';
import { THEME_MODE_KEY, COLOR_BRAND_KEY } from '../config/storageKeys';

export const ThemeContext = createContext(null);

/** The one brand theme (green). Only light/dark mode can change. */
const brand = BRAND_GREEN;

/**
 * Light/dark mode. The app always uses the green Health line brand.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');
  const themeRef = useRef('light');
  // Once the user taps a toggle, the (slower) saved-value load must not overwrite it.
  const userChangedRef = useRef(false);

  const applyTheme = useCallback((next) => {
    themeRef.current = next;
    setThemeState(next);
    AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mode = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (cancelled || userChangedRef.current) return;
        if (mode === 'dark' || mode === 'light') themeRef.current = mode;
        if (mode === 'dark' || mode === 'light') setThemeState(mode);
      } catch {
        // keep defaults
      }
      // Old builds saved a Blue/Green pick — no longer used.
      AsyncStorage.removeItem(COLOR_BRAND_KEY).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(
    (value) => {
      if (value !== 'light' && value !== 'dark') return;
      userChangedRef.current = true;
      if (value !== themeRef.current) applyTheme(value);
    },
    [applyTheme],
  );

  const toggleTheme = useCallback(() => {
    userChangedRef.current = true;
    applyTheme(themeRef.current === 'light' ? 'dark' : 'light');
  }, [applyTheme]);

  const isDark = theme === 'dark';
  const brandColors = useMemo(() => getBrandColors(brand), []);
  const surfaces = useMemo(() => buildThemeColors(isDark, brand), [isDark]);

  const value = useMemo(
    () => ({
      /** light | dark */
      theme,
      isDark,
      setTheme,
      toggleTheme,
      /** always 'green' */
      brand,
      brandColors,
      colors: brandColors,
      featureColors,
      isGreenBrand: true,
      /** page/card/text surfaces for current mode */
      themeColors: surfaces,
      c: surfaces,
      primaryRgba: (alpha) => primaryRgba(alpha, brand),
    }),
    [theme, isDark, setTheme, toggleTheme, brandColors, surfaces],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Convenience: brand colors + surfaces in one hook. */
export function useAppColors() {
  const { colors, themeColors, isDark, brand, primaryRgba } = useTheme();
  return { colors, themeColors, isDark, brand, primaryRgba };
}
