import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getBrandContent } from '../../config/brandContent';
import { FONT, snPro } from '../../config/fonts';
import HealthlineMark from './HealthlineMark';

/**
 * App brand logo — uses assets/Logo.svg paths in the green brand colors.
 */
export default function BrandLogo({ size = 52, showName = false, style }) {
  const { brand, colors, themeColors: surfaces } = useTheme();
  const content = getBrandContent(brand);

  return (
    <View style={[styles.wrap, style]}>
      <HealthlineMark height={size} />
      {showName ? (
        <View style={styles.textBlock}>
          <Text style={[styles.name, { color: colors.primaryDark || colors.primary, fontFamily: FONT.nova }]}>
            {content.appName}
          </Text>
          <Text style={[styles.tagline, { color: surfaces.muted, fontFamily: snPro('500') }]}>
            {content.tagline}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  textBlock: { alignItems: 'center', marginTop: 10 },
  name: { fontSize: 28, letterSpacing: -0.5 },
  tagline: { fontSize: 13, marginTop: 4 },
});
