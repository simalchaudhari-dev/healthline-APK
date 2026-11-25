import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { snPro } from '../../config/fonts';
import { useTheme } from '../../context/ThemeContext';
import { preloadGoogleSignIn } from '../../utils/googleSignIn';

/** Google's multi-colour "G" mark. */
export function GoogleLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

/** "Continue with Google" — white pill with the Google mark. Android app: native picker; web: popup. */
export default function GoogleButton({ onPress, loading, label = 'Continue with Google', style }) {
  const { isDark, themeColors: c } = useTheme();
  // Web: load Google's script now, so the tap can open the popup straight away (not blocked).
  useEffect(() => {
    preloadGoogleSignIn().catch(() => {});
  }, []);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: isDark ? c.cardBg : '#FFFFFF', borderColor: isDark ? c.border : '#d7e6d1' },
        (pressed || loading) && { opacity: 0.7 },
        style,
      ]}
    >
      <GoogleLogo />
      <Text style={[styles.text, { color: isDark ? c.text : '#0d1b2a', fontFamily: snPro('800') }]}>
        {loading ? 'Opening Google...' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1e5e24',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  text: { fontSize: 15 },
});
