import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Dumbbell,
  Scale,
  Droplets,
  Footprints,
  Flame,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import { useTheme } from '../../context/ThemeContext';
import { useDiary, todayKey } from '../../context/DiaryContext';
import { useSteps } from '../../context/StepsContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { buildWeeklyReport, shiftDateKey } from '../../utils/weeklyReport';
import { buildExerciseReport } from '../../utils/exerciseReport';
import { dailyWeights } from '../../utils/weightLogs';
import { DEFAULT_STEP_GOAL } from '../../utils/steps';

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

const fmt = (v) => Math.round(Number(v) || 0).toLocaleString('en-IN');

/** Each tile keeps its own colour in both themes (dark mode uses lighter tones that read on black). */
const TONES = {
  nutrition: { light: ['#e2f2dc', '#2e7d32'], dark: ['rgba(124,196,127,0.15)', '#7cc47f'] },
  fitness: { light: ['#e3eafb', '#1e3a8a'], dark: ['rgba(143,168,255,0.15)', '#8fa8ff'] },
  weight: { light: ['#fff1dc', '#b45309'], dark: ['rgba(245,180,92,0.15)', '#f5b45c'] },
  water: { light: ['#e0f4f7', '#0e7490'], dark: ['rgba(95,211,230,0.15)', '#5fd3e6'] },
  steps: { light: ['#e2f2dc', '#1e5e24'], dark: ['rgba(124,196,127,0.15)', '#7cc47f'] },
  streak: { light: ['#fde4e1', '#9b2c1f'], dark: ['rgba(255,138,122,0.15)', '#ff8a7a'] },
};

/** WHO: about 150 minutes of activity a week. */
const WEEKLY_ACTIVE_MIN = 150;
const pct = (v, goal) => (goal > 0 ? Math.min(1, Math.max(0, (Number(v) || 0) / goal)) : 0);

function hasFood(day) {
  const m = day?.meals || {};
  return ['breakfast', 'lunch', 'dinner', 'snacks'].some((k) => Array.isArray(m[k]) && m[k].length > 0);
}

/** Days in a row with food logged, ending today (or yesterday if today is still empty). */
function loggingStreak(days, today) {
  let key = hasFood(days?.[today]) ? today : shiftDateKey(today, -1);
  let count = 0;
  while (hasFood(days?.[key]) && count < 366) {
    count += 1;
    key = shiftDateKey(key, -1);
  }
  return count;
}

/** Latest weight and its change over the last 30 days. */
function weightSummary(weightLogs, profileWeight, today) {
  // One weight per day (that day's last update), oldest first.
  const logs = dailyWeights(weightLogs);
  const latest = logs[logs.length - 1];
  const current = latest ? Number(latest.weight) : Number(profileWeight) || 0;
  const monthAgo = shiftDateKey(today, -30);
  const base = logs.filter((w) => w.date <= monthAgo).pop() || logs[0];
  const change = latest && base && base !== latest ? Math.round((current - Number(base.weight)) * 10) / 10 : null;
  return { current, change };
}

/** Canvas "Health overview": the last 7 days at a glance, all from the real diary. */
export default function HealthOverviewScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { days, profile, weightLogs } = useDiary();
  const { today: steps } = useSteps();

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';

  const data = useMemo(() => {
    const today = todayKey();
    const week = buildWeeklyReport({ days, profile, weightLogs, endKey: today });
    const ex = buildExerciseReport({ days, endKey: today });
    return {
      week,
      ex,
      weight: weightSummary(weightLogs, profile?.weight, today),
      streak: loggingStreak(days, today),
    };
  }, [days, profile, weightLogs]);

  const { week, ex, weight, streak } = data;
  const exHours = Math.floor(ex.minutes / 60);
  const exMins = ex.minutes % 60;

  const tiles = [
    {
      key: 'nutrition',
      Icon: UtensilsCrossed,
      tint: '#e2f2dc',
      stroke: '#2e7d32',
      label: 'Nutrition',
      value: week.loggedDays ? `${fmt(week.avgCalories)} kcal` : 'No meals yet',
      sub: week.loggedDays
        ? `Daily average · goal ${fmt(Number(profile?.calories) || 2200)}`
        : 'Log food to see your average',
      progress: week.loggedDays ? pct(week.avgCalories, Number(profile?.calories) || 2200) : null,
      onPress: () => navigation.navigate('WeeklyReport'),
    },
    {
      key: 'fitness',
      Icon: Dumbbell,
      tint: '#e3eafb',
      stroke: '#1e3a8a',
      label: 'Fitness',
      value: `${ex.sessionsCount} workout${ex.sessionsCount === 1 ? '' : 's'}`,
      sub: ex.minutes ? `${exHours ? `${exHours} h ` : ''}${exMins} min of ${WEEKLY_ACTIVE_MIN} min` : 'Nothing logged this week',
      progress: pct(ex.minutes, WEEKLY_ACTIVE_MIN),
      onPress: () => navigation.navigate('ExerciseReport'),
    },
    {
      key: 'weight',
      Icon: Scale,
      tint: '#fff1dc',
      stroke: '#b45309',
      label: 'Weight',
      value: weight.current ? `${weight.current} kg` : 'Not set',
      sub:
        weight.change == null
          ? 'Log your weight to track it'
          : weight.change === 0
            ? 'No change this month'
            : `${weight.change < 0 ? 'Down' : 'Up'} ${Math.abs(weight.change)} kg this month`,
      onPress: () => navigation.navigate('LogWeight'),
    },
    {
      key: 'water',
      Icon: Droplets,
      tint: '#e0f4f7',
      stroke: '#0e7490',
      label: 'Water',
      value: `${week.waterGoalDays} of 7 days`,
      sub: `Hit ${week.waterGoal} glasses`,
      progress: pct(week.waterGoalDays, 7),
      onPress: () => navigation.navigate('WeeklyReport'),
    },
    {
      key: 'steps',
      Icon: Footprints,
      tint: '#e2f2dc',
      stroke: '#1e5e24',
      label: 'Steps',
      value: fmt(steps),
      sub: `Today, of ${fmt(DEFAULT_STEP_GOAL)}`,
      progress: pct(steps, DEFAULT_STEP_GOAL),
      onPress: () => navigation.navigate('Steps'),
    },
    {
      key: 'streak',
      Icon: Flame,
      tint: '#fde4e1',
      stroke: '#9b2c1f',
      label: 'Logging streak',
      value: `${streak} day${streak === 1 ? '' : 's'}`,
      sub: 'Days in a row with meals logged',
      progress: pct(streak, 7),
      onPress: () => navigation.navigate('Achievements'),
    },
  ];

  const insightCount = week.insights.length + (ex.minutes ? 1 : 0);

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.back, CARD_SHADOW, { backgroundColor: c.cardBg }]}
          >
            <ChevronLeft size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.6} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Health overview</Text>
            <Text style={[styles.date, { color: muted, fontFamily: snPro('400') }]}>Last 7 days</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Main', { screen: 'Progress' })} hitSlop={8} style={styles.trends}>
            <Text style={[styles.trendsText, { color: colors.primary, fontFamily: snPro('700') }]}>Trends</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {tiles.map((t) => {
            const [tint, tone] = (TONES[t.key] || TONES.nutrition)[isDark ? 'dark' : 'light'];
            return (
              <Pressable
                key={t.key}
                onPress={t.onPress}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}: ${t.value}`}
                style={({ pressed }) => [
                  styles.tile,
                  CARD_SHADOW,
                  { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#eef2ec' },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <View style={styles.tileTop}>
                  <View style={[styles.tileIcon, { backgroundColor: tint }]}>
                    <t.Icon size={19} color={tone} strokeWidth={2.3} />
                  </View>
                  <ChevronRight size={16} color={muted} strokeWidth={2.2} />
                </View>
                <Text style={[styles.tileLbl, { color: tone, fontFamily: snPro('800') }]}>{t.label.toUpperCase()}</Text>
                <Text style={[styles.tileVal, { color: ink, fontFamily: FONT.heading }]} numberOfLines={1} adjustsFontSizeToFit>
                  {t.value}
                </Text>
                <Text style={[styles.tileSub, { color: muted, fontFamily: snPro('500') }]} numberOfLines={2}>
                  {t.sub}
                </Text>
                {t.progress != null ? (
                  <View style={[styles.bar, { backgroundColor: isDark ? '#2A2A2A' : '#eef2ec' }]}>
                    <View style={[styles.barFill, { width: `${Math.round(t.progress * 100)}%`, backgroundColor: tone }]} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => navigation.navigate('WeeklyReport')}
          style={({ pressed }) => [styles.suggest, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.suggestIcon}>
            <Sparkles size={18} color="#FFFFFF" strokeWidth={2.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.suggestTitle, { fontFamily: poppins('600') }]}>
              {insightCount ? `${insightCount} insight${insightCount === 1 ? '' : 's'} for this week` : 'Your weekly report'}
            </Text>
            <Text style={[styles.suggestSub, { fontFamily: snPro('400') }]}>Based on your goals, meals and activity</Text>
          </View>
          <View style={styles.suggestArrow}>
            <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('EditGoals')}
          style={[styles.outline, { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#cfe3c7' }]}
        >
          <SlidersHorizontal size={16} color={isDark ? c.text : colors.primaryDark} />
          <Text style={[styles.outlineText, { color: isDark ? c.text : colors.primaryDark, fontFamily: snPro('700') }]}>
            Edit my goals
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  date: { fontSize: 12 },
  trends: { paddingVertical: 12 },
  trendsText: { fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.5%', padding: 14, borderRadius: 20, borderWidth: 1, gap: 3 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tileIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileLbl: { fontSize: 10.5, letterSpacing: 0.8 },
  tileVal: { fontSize: 19, lineHeight: 25 },
  tileSub: { fontSize: 11.5, lineHeight: 15, minHeight: 30 },
  bar: { height: 5, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1e5e24',
  },
  suggestIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  suggestSub: { color: '#d7f0c9', fontSize: 12 },
  outline: {
    height: 48,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineText: { fontSize: 14 },
});
