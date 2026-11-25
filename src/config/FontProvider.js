import React, { useEffect } from 'react';
import { Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { APP_FONT_MAP, FONT, snPro, poppins } from './fonts';

let patched = false;

function injectWebFontsCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('healthline-google-fonts')) return;
  const link = document.createElement('link');
  link.id = 'healthline-google-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Nunito+Sans:ital,wght@0,200..900;1,200..900&display=swap';
  document.head.appendChild(link);
}

/** Poppins / Nunito Sans faces pass through; anything else becomes Nunito Sans at its weight. */
function resolveFamily(flat = {}) {
  const existing = String(flat.fontFamily || '');
  if (existing.startsWith('Poppins_') || existing.startsWith('NunitoSans_')) {
    return existing;
  }
  if (existing === 'Poppins') {
    return poppins(flat.fontWeight);
  }
  return snPro(flat.fontWeight, flat.fontStyle === 'italic');
}

function patchText(Component) {
  if (!Component) return;

  if (typeof Component.render === 'function') {
    const originalRender = Component.render;
    Component.render = function render(props, ref) {
      const flat = StyleSheet.flatten(props?.style) || {};
      const fontFamily = resolveFamily(flat);
      return originalRender.call(
        this,
        {
          ...props,
          style: [
            props.style,
            {
              fontFamily,
              // Custom faces already encode weight — avoid synthetic bold / clip
              fontWeight: 'normal',
              fontStyle: 'normal',
            },
            // Only pad small UI labels — headlines already set lineHeight
            flat.lineHeight == null && flat.fontSize && Number(flat.fontSize) <= 14
              ? { lineHeight: Math.ceil(Number(flat.fontSize) * 1.45) }
              : null,
          ],
        },
        ref,
      );
    };
    return;
  }

  Component.defaultProps = Component.defaultProps || {};
  Component.defaultProps.style = [{ fontFamily: FONT.sn }, Component.defaultProps.style];
}

function ensurePatched() {
  if (patched) return;
  patched = true;
  patchText(Text);
  patchText(TextInput);
}

export function FontProvider({ children }) {
  const [loaded, error] = useFonts(APP_FONT_MAP);

  useEffect(() => {
    injectWebFontsCss();
  }, []);

  useEffect(() => {
    if (loaded) ensurePatched();
  }, [loaded]);

  if (!loaded && !error) return null;
  if (error && __DEV__) {
    console.warn('[fonts] load failed:', error.message || error);
  }

  if (loaded) ensurePatched();

  return children;
}
