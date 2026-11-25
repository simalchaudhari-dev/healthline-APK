import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Award, Flame, Droplets, Scale, Dumbbell, Beef } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ScreenHeader from '../../components/common/ScreenHeader';
import ProgressRing from '../../components/common/ProgressRing';
import { useTheme } from '../../context/ThemeContext';
import { useDiary, todayKey } from '../../context/DiaryContext';
import { colors, themeColors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { buildWeeklyReport } from '../../utils/weeklyReport';
import WeekChartCard from '../../components/charts/WeekChartCard';
import { calorieFill } from '../../components/charts/WeekBarChart';
import WeekFilter, { thisMonday, addDays } from '../../components/charts/WeekFilter';

export default function WeeklyReportScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { days, profile, weightLogs, syncing, diaryLoading } = useDiary();
  const [weekStart, setWeekStart] = useState(thisMonday);

  const today = todayKey();
  const endKey = addDays(weekStart, 6);
  const r = useMemo(
    () => buildWeeklyReport({ days, profile, weightLogs, endKey }),
    [days, profile, weightLogs, endKey],
  );

  const vsPrev = r.prevAvgCalories != null && r.loggedDays ? r.avgCalories - r.prevAvgCalories : null;
  const weightText =
    r.weightChange == null ? '—' : `${r.weightChange > 0 ? '+' : ''}${r.weightChange.toFixed(1)} kg`;

  // First load after sign-in: show the common loader instead of empty / zero numbers.
  if (diaryLoading) {
    return (
      <ScreenShell>
        <ScreenHeader title="Weekly report" onBack={() => navigation.goBack()} theme={c} />
        <LoadingScreen message="Loading your week…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Weekly report" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Week filter with calendar (shared with every bar chart) — drives the whole report */}
        <WeekFilter
          weekStart={weekStart}
          onChange={setWeekStart}
          style={[styles.weekNav, { backgroundColor: c.cardBg, borderColor: c.border }]}
        />

        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.syncText, { color: c.muted }]}>Updating from your account…</Text>
          </View>
        ) : null}

        <View style={[styles.hero, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: colors.primary, fontFamily: snPro('700') }]}>
              DAILY AVERAGE
            </Text>
            <Text style={[styles.heroVal, { color: c.text, fontFamily: FONT.nova }]}>
              {r.loggedDays ? r.avgCalories : '—'}
            </Text>
            <Text style={[styles.heroMeta, { color: c.muted }]}>
              kcal / day · {r.loggedDays} of 7 days logged
            </Text>
            {vsPrev != null ? (
              <Text style={[styles.heroMeta, { color: c.muted }]}>
                {vsPrev === 0 ? 'Same as' : `${Math.abs(vsPrev)} kcal ${vsPrev > 0 ? 'more' : 'less'} than`} the
                week before
              </Text>
            ) : null}
          </View>
          <ProgressRing
            progress={Math.min(1, r.adherence / 100)}
            color={r.adherence > 110 ? colors.danger : colors.primary}
            trackColor={isDark ? '#2A2A2A' : '#e2f0dc'}
            size={84}
            stroke={8}
          >
            <Text style={[styles.ringPct, { color: c.text, fontFamily: snPro('800') }]}>
              {r.loggedDays ? `${r.adherence}%` : '—'}
            </Text>
          </ProgressRing>
        </View>

        <View style={styles.statGrid}>
          <Stat
            icon={Scale}
            label="Weight"
            value={weightText}
            hint={r.weightChange == null ? 'log weight to track' : 'change this week'}
            color={colors.accent}
            theme={c}
            isDark={isDark}
          />
          <Stat
            icon={Beef}
            label="Protein avg"
            value={r.loggedDays ? `${r.avgProtein} g` : '—'}
            hint={r.proteinGoal ? `goal ${r.proteinGoal} g/day` : 'per logged day'}
            color={colors.primary}
            theme={c}
            isDark={isDark}
          />
          <Stat
            icon={Dumbbell}
            label="Exercise"
            value={`${r.exerciseMinutes}m`}
            hint={`${r.exerciseDays} day${r.exerciseDays === 1 ? '' : 's'} · ${r.burned} kcal`}
            color={colors.exercise}
            theme={c}
            isDark={isDark}
          />
          <Stat
            icon={Droplets}
            label="Water avg"
            value={`${r.avgWater}`}
            hint={`goal met ${r.waterGoalDays}/7 days`}
            color={colors.primary}
            theme={c}
            isDark={isDark}
          />
        </View>

        <WeekChartCard
          title="Calories by day"
          days={r.days.map((d) => ({ key: d.key, label: d.label, value: d.calories }))}
          goal={r.calorieGoal}
          todayKey={today}
          fillFor={calorieFill(r.calorieGoal)}
        />

        <View
          style={[styles.insight, { backgroundColor: isDark ? c.track : colors.primarySoft, borderColor: c.border }]}
        >
          <Award size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.insightTitle, { color: c.text, fontFamily: snPro('700') }]}>Insights</Text>
            {r.insights.map((line) => (
              <Text key={line} style={[styles.insightBody, { color: c.muted }]}>
                • {line}
              </Text>
            ))}
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: c.muted }]}>
          Based on what you logged. For information only — talk to a clinician for medical decisions.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

function Stat({ icon: Icon, label, value, hint, color, theme, isDark }) {
  return (
    <View style={styles.statWrap}>
      <View style={[styles.stat, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.statIcon, { backgroundColor: isDark ? '#1C1C1E' : `${color}18` }]}>
          <Icon size={16} color={color} />
        </View>
        <Text style={[styles.statLbl, { color: theme.muted, fontFamily: snPro('600') }]}>{label}</Text>
        <Text style={[styles.statVal, { color: theme.text, fontFamily: snPro('800') }]}>{value}</Text>
        <Text style={[styles.statHint, { color: theme.muted }]}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  weekNav: { borderWidth: 1, padding: 4, marginBottom: 12 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  syncText: { fontSize: 12 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({ android: { elevation: 1 }, default: {} }),
  },
  kicker: { fontSize: 10, letterSpacing: 0.8 },
  heroVal: { fontSize: 32, marginTop: 4 },
  heroMeta: { fontSize: 12, marginTop: 4 },
  ringPct: { fontSize: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 4 },
  statWrap: { width: '50%', paddingHorizontal: 5, marginBottom: 10 },
  stat: { borderRadius: 14, borderWidth: 1, padding: 12 },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLbl: { fontSize: 11 },
  statVal: { fontSize: 18, marginTop: 2 },
  statHint: { fontSize: 11, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  insight: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  insightTitle: { fontSize: 14, marginBottom: 4 },
  insightBody: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  disclaimer: { fontSize: 11, marginTop: 12, textAlign: 'center' },
});
