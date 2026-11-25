import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';

/**
 * Inline loading state (AdminPanel LoadingScreen style).
 * Use inside a screen/card while data loads.
 */
export default function LoadingScreen({
  message = '',
  fullScreen = false,
  size = 'large',
  style,
}) {
  const { themeColors: c, colors: brand } = useTheme();

  return (
    <View
      style={[
        styles.root,
        fullScreen && styles.fullScreen,
        fullScreen && { backgroundColor: c.pageBg },
        style,
      ]}
    >
      <ActivityIndicator size={size} color={brand?.primary || colors.primary} />
      {message ? (
        <Text style={[styles.message, { color: c.muted, fontFamily: snPro('500') }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    minHeight: undefined,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
  },
});
