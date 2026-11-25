import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useSafeTop } from '../../utils/safeArea';

/**
 * Paints status-bar / notch zone with theme pageBg.
 * Prefer padding on one continuous surface (no separate strip = no seam line).
 */
export function SafeAreaTop({ color }) {
  const { themeColors: c } = useTheme();
  const topPad = useSafeTop();
  if (topPad <= 0) return null;
  return <View style={{ height: topPad, backgroundColor: color ?? c.pageBg }} />;
}

export default function ScreenShell({ children, edges = ['top'], style }) {
  const { themeColors: c } = useTheme();
  const topPad = useSafeTop();
  const wantsTop = !edges || edges.includes('top');

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.pageBg, paddingTop: wantsTop ? topPad : 0 },
        style,
      ]}
    >
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
