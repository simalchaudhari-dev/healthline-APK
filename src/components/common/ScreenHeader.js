import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { FONT } from '../../config/fonts';
import AppButton from './AppButton';
import { useTheme } from '../../context/ThemeContext';

/** Shared top bar for stack screens opened from More / tabs. */
export default function ScreenHeader({ title, onBack, theme, right }) {
  const { themeColors: surfaces } = useTheme();
  const t = theme || surfaces;
  const chip = t?.chip ?? '#F3F4F6';
  const text = t?.text ?? '#111827';

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onBack} hitSlop={8} style={[styles.back, { backgroundColor: chip }]}>
        <ChevronLeft size={20} color={text} />
      </Pressable>
      <Text style={[styles.title, { color: text, fontFamily: FONT.nova }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right || <View style={styles.spacer} />}</View>
    </View>
  );
}

export function SaveButton({ onPress, label = 'Save', disabled = false }) {
  return <AppButton size="sm" label={label} onPress={onPress} disabled={disabled} />;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  right: { minWidth: 36, alignItems: 'flex-end' },
  spacer: { width: 36 },
});
