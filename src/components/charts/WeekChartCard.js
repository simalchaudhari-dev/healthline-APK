import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { poppins, snPro } from '../../config/fonts';
import WeekBarChart, { goalLegend } from './WeekBarChart';
import WeekFilter from './WeekFilter';

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(30,94,36,0.06)' },
  default: {
    shadowColor: '#1e5e24',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

/**
 * Card with a title, optional week filter (with calendar) and the shared 7-day bar chart.
 * Pass `weekStart` + `onWeekChange` to show the filter; `right` for a toggle; `children` for a footer.
 * All other props (days, goal, todayKey, formatValue, fillFor, height) go to WeekBarChart.
 */
export default function WeekChartCard({
  title,
  subtitle,
  right,
  weekStart,
  onWeekChange,
  maxWeeksBack,
  formatGoal,
  children,
  style,
  ...chart
}) {
  const { isDark, themeColors: c } = useTheme();
  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const legend = goalLegend(
    (chart.days || []).map((d) => d.value),
    chart.goal,
    formatGoal,
  );

  return (
    <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg }, style]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: ink, fontFamily: poppins('600') }]} numberOfLines={1}>
          {title}
        </Text>
        {right || (legend ? <Text style={[styles.legend, { color: muted, fontFamily: snPro('500') }]}>{legend}</Text> : null)}
      </View>
      {subtitle || (right && legend) ? (
        <Text style={[styles.subtitle, { color: muted, fontFamily: snPro('500') }]}>
          {[subtitle, right ? legend : ''].filter(Boolean).join('  ·  ')}
        </Text>
      ) : null}
      {weekStart && onWeekChange ? (
        <WeekFilter weekStart={weekStart} onChange={onWeekChange} maxWeeksBack={maxWeeksBack} style={styles.filter} />
      ) : (
        <View style={{ height: 10 }} />
      )}
      <WeekBarChart {...chart} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  legend: { fontSize: 11 },
  subtitle: { fontSize: 12, marginTop: 2 },
  filter: { marginTop: 10, marginBottom: 14 },
});
