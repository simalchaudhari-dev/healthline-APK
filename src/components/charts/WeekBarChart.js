import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';

export const BAR_SOFT = '#9cc98a';
export const BAR_EMPTY = '#e2f0dc';
const LABEL_SPACE = 22; // day label height + margin under the bars

/**
 * How tall the chart scales. Near the goal it scales to the goal (so the goal line shows);
 * on low weeks it scales to the data so bars stay readable.
 */
export function chartScale(values, goal) {
  const best = Math.max(0, ...values.map((v) => Number(v) || 0));
  const max = goal && best >= goal * 0.3 ? Math.max(goal, best) : Math.max(best * 1.15, 1);
  return { max, showGoalLine: !!goal && goal <= max };
}

/** "- - goal 10,000" when the dashed line shows, "Goal 10,000" when it doesn't. */
export function goalLegend(values, goal, format = (n) => n) {
  if (!goal) return '';
  const { showGoalLine } = chartScale(values, goal);
  return `${showGoalLine ? '- - goal' : 'Goal'} ${format(goal)}`;
}

/** Calorie bars: over 110% of the goal is red, 90–110% is on target (green). Use as `fillFor`. */
export function calorieFill(goal) {
  return (d, { isToday }) => {
    if (goal && d.value > goal * 1.1) return colors.danger;
    if (isToday) return colors.primaryDark;
    return goal && d.value >= goal * 0.9 ? colors.primary : BAR_SOFT;
  };
}

/**
 * The one 7-day bar chart used across the app (Steps, Exercise, Weekly report).
 * `days`: [{ key: 'YYYY-MM-DD', label: 'Mon', value, value2? }]
 * `fillFor(day, { isToday, goal })` may return a colour to override the default rule.
 * `secondary`: { color, formatValue } — draws `value2` as a second bar next to each day
 *   (own scale, e.g. minutes + kcal), like the admin exercise chart.
 * `onDayPress(day)` + `selectedKey`: tap a day to see its numbers.
 */
export default function WeekBarChart({
  days,
  goal,
  todayKey,
  height = 110,
  formatValue = (v) => v,
  fillFor,
  secondary,
  onDayPress,
  selectedKey,
}) {
  const { isDark, themeColors: c } = useTheme();
  const { max, showGoalLine } = chartScale(
    days.map((d) => d.value),
    goal,
  );
  const max2 = secondary ? chartScale(days.map((d) => d.value2)).max : 1;
  const goalLine = goal ? Math.round((goal / max) * height) : 0;
  const empty = isDark ? c.track : BAR_EMPTY;
  const barH = (v, m) => (v ? Math.max(8, Math.round((v / m) * height)) : 6);

  return (
    <View style={styles.bars}>
      {showGoalLine ? (
        <View
          pointerEvents="none"
          style={[styles.goalLine, { bottom: LABEL_SPACE + goalLine, borderColor: isDark ? c.muted : BAR_SOFT }]}
        />
      ) : null}
      {days.map((d) => {
        const value = Number(d.value) || 0;
        const value2 = Number(d.value2) || 0;
        const isToday = d.key === todayKey;
        const selected = d.key === selectedKey;
        // Empty days show a short flat bar, like the design.
        const custom = value && fillFor ? fillFor(d, { isToday, goal }) : null;
        const fill = !value
          ? empty
          : custom || (isToday ? colors.primaryDark : goal && value >= goal ? colors.primary : BAR_SOFT);
        const labelColor = isToday || selected ? colors.primary : c.muted;
        const Col = onDayPress ? Pressable : View;
        return (
          <Col
            key={d.key}
            style={styles.barCol}
            {...(onDayPress
              ? {
                  onPress: () => onDayPress(d),
                  accessibilityRole: 'button',
                  accessibilityState: { selected },
                  accessibilityLabel: `${d.label} ${value ? formatValue(value) : 0}${
                    secondary ? `, ${value2 ? (secondary.formatValue || ((v) => v))(value2) : 0}` : ''
                  }`,
                }
              : null)}
          >
            {secondary ? (
              <View style={styles.valRow}>
                <Text style={[styles.barVal2, { color: labelColor, fontFamily: snPro('700') }]} numberOfLines={1}>
                  {value ? formatValue(value) : ''}
                </Text>
                <Text style={[styles.barVal2, { color: secondary.color, fontFamily: snPro('700') }]} numberOfLines={1}>
                  {value2 ? (secondary.formatValue || ((v) => v))(value2) : ''}
                </Text>
              </View>
            ) : (
              <Text style={[styles.barVal, { color: labelColor, fontFamily: snPro('600') }]} numberOfLines={1}>
                {value ? formatValue(value) : ''}
              </Text>
            )}
            <View style={[styles.barSlot, { height }, secondary && styles.pairSlot, selected && styles.selectedSlot]}>
              <View
                style={[
                  styles.barFill,
                  secondary && styles.pairFill,
                  { height: barH(value, max), backgroundColor: fill },
                ]}
              />
              {secondary ? (
                <View
                  style={[
                    styles.barFill,
                    styles.pairFill,
                    { height: barH(value2, max2), backgroundColor: value2 ? secondary.color : empty },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.barLbl, { color: labelColor, fontFamily: snPro(isToday || selected ? '800' : '600') }]}>
              {String(d.label || '').slice(0, 1)}
            </Text>
          </Col>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  barCol: { flex: 1, alignItems: 'center' },
  barVal: { fontSize: 10, marginBottom: 4, height: 13 },
  barSlot: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barFill: { width: '72%', maxWidth: 34, borderRadius: 6 },
  barLbl: { fontSize: 11, marginTop: 6, height: 16 },
  valRow: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginBottom: 4, height: 13, width: '100%' },
  barVal2: { fontSize: 9, flexShrink: 1 },
  pairSlot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  pairFill: { width: '36%', maxWidth: 16, borderRadius: 5 },
  selectedSlot: { backgroundColor: 'rgba(46,125,50,0.08)', borderRadius: 8 },
});
