import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { snPro } from '../../config/fonts';
import { softShadow } from './premiumStyles';

/**
 * Productive-style habit row: icon · title · x/y · colored progress bar.
 */
export default function HabitProgressCard({
  icon: Icon,
  title,
  subtitle,
  current = 0,
  goal = 1,
  unit = '',
  color,
  onPress,
  right,
}) {
  const { isDark, themeColors: c } = useTheme();
  const [trackW, setTrackW] = useState(0);
  const pct = goal > 0 ? Math.min(1, Math.max(0, current / goal)) : 0;
  const fillW = trackW > 0 ? Math.max(0, trackW * pct) : `${pct * 100}%`;

  const content = (
    <>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
          <Icon size={20} color={color} strokeWidth={2.2} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: c.text, fontFamily: snPro('700') }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('400') }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.fraction, { color: c.text, fontFamily: snPro('800') }]}>
            {current}
            <Text style={[styles.goalPart, { color: c.muted }]}>
              /{goal}
              {unit ? ` ${unit}` : ''}
            </Text>
          </Text>
          {right}
        </View>
      </View>
      <View
        style={[styles.track, { backgroundColor: isDark ? '#2A2A2E' : `${color}18` }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - trackW) > 0.5) setTrackW(w);
        }}
      >
        {pct > 0 ? (
          <View
            style={[
              styles.fill,
              {
                width: fillW,
                backgroundColor: color,
              },
            ]}
          />
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          softShadow,
          {
            backgroundColor: c.cardBg,
            borderColor: c.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  fraction: { fontSize: 15 },
  goalPart: { fontSize: 13, fontWeight: '600' },
  track: {
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
  },
});
