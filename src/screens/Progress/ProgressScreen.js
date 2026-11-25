import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Scale,
  Flame,
  Droplets,
  Trophy,
  Target,
  Dumbbell,
  Award,
  ChevronRight,
} from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ProgressRing from '../../components/common/ProgressRing';
import MacroPieChart from '../../components/common/MacroPieChart';
import WeightLineChart from '../../components/common/WeightLineChart';
import HabitProgressCard from '../../components/common/HabitProgressCard';
import { premiumShadow, softShadow } from '../../components/common/premiumStyles';
import { useTheme } from '../../context/ThemeContext';
import { useDiary, todayKey } from '../../context/DiaryContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { getFeaturedAchievements } from '../../data/achievements';
import { useLiveAchievements } from '../../hooks/useLiveAchievements';
import { buildWeeklyReport } from '../../utils/weeklyReport';
import { dailyWeights } from '../../utils/weightLogs';
import WeekBarChart, { calorieFill, goalLegend } from '../../components/charts/WeekBarChart';
import WeekFilter, { thisMonday, addDays } from '../../components/charts/WeekFilter';
import { formatDayMonth } from '../../utils/formatDate';

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHART_TABS = [
  { id: 'weight', label: 'Weight' },
  { id: 'calories', label: 'Calories' },
  { id: 'macros', label: 'Macros' },
];

function shiftDateKey(key, deltaDays) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function dowLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return DOW_LABELS[new Date(y, m - 1, d).getDay()];
}

/** Chart axis label: 19 Oct (day first, like everywhere else). */
function formatShortDate(key) {
  return formatDayMonth(key);
}

function dayCalories(day) {
  if (!day?.meals) return 0;
  return Object.values(day.meals)
    .flatMap((list) => (Array.isArray(list) ? list : []))
    .reduce((s, item) => s + (item?.calories || 0), 0);
}

const GOAL_LABEL = {
  lose: 'Lose weight',
  maintain: 'Maintain',
  gain: 'Gain muscle',
};

export default function ProgressScreen({ navigation }) {
  const { isDark, themeColors: c, primaryRgba } = useTheme();
  const { profile, totals, remaining, burned, water, goal, exercise, days, weightLogs, diaryLoading, today } =
    useDiary();
  const [chartTab, setChartTab] = useState('weight');
  const featuredList = useMemo(() => getFeaturedAchievements(), []);
  const featuredAchievements = useLiveAchievements(featuredList);

  // `today` changes at midnight, so an app left open overnight moves on to the new week.
  const weekKeys = useMemo(() => {
    const end = today || todayKey();
    return Array.from({ length: 7 }, (_, i) => shiftDateKey(end, i - 6));
  }, [today]);

  const weekCalories = useMemo(
    () => weekKeys.map((k) => dayCalories(days[k])),
    [weekKeys, days],
  );

  // Same tested maths as the Weekly report: averages over days the user actually logged.
  const week = useMemo(
    () => buildWeeklyReport({ days, profile, weightLogs, endKey: today || todayKey() }),
    [days, profile, weightLogs, today],
  );

  // Calories tab: any Monday–Sunday week picked in the shared week filter.
  const [calWeekStart, setCalWeekStart] = useState(thisMonday);
  const calWeek = useMemo(
    () => buildWeeklyReport({ days, profile, weightLogs, endKey: addDays(calWeekStart, 6) }),
    [days, profile, weightLogs, calWeekStart],
  );
  const calDays = calWeek.days.map((d) => ({ key: d.key, label: d.label, value: d.calories }));

  // Only real weight logs (last 8 days, the day's last update) — no made-up trend.
  const weightPoints = useMemo(
    () =>
      dailyWeights(weightLogs)
        .slice(-8)
        .map((l) => ({ weight: l.weight, date: l.date })),
    [weightLogs],
  );

  const avgCals = week.avgCalories;
  const weekAdherence = week.adherence;
  const exerciseMins = (exercise || []).reduce((s, e) => s + (e.minutes || 0), 0);
  const deltaNum =
    weightPoints.length >= 2
      ? Math.round((weightPoints[weightPoints.length - 1].weight - weightPoints[0].weight) * 10) / 10
      : null;
  const deltaLabel =
    deltaNum == null ? 'Log weight to see a trend' : `${deltaNum <= 0 ? '−' : '+'}${Math.abs(deltaNum)} kg`;

  // First load after sign-in: show the common loader instead of empty / zero numbers.
  if (diaryLoading) {
    return (
      <ScreenShell>
        <LoadingScreen message="Loading your progress…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { color: colors.primary, fontFamily: snPro('800') }]}>PROGRESS</Text>
        <Text style={[styles.title, { color: c.text }]}>Your week at a glance</Text>
        <Text style={[styles.sub, { color: c.muted }]}>
          Track weight, calories, macros, water, and activity from your diary.
        </Text>

        <View style={[styles.heroCard, premiumShadow, { borderColor: isDark ? c.border : primaryRgba(0.14) }]}>
          <LinearGradient
            colors={isDark ? ['#1A1A22', '#121218'] : ['#FFFFFF', colors.primarySoft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroInner}
          >
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroKicker, { color: colors.primary, fontFamily: snPro('700') }]}>
                  WEEKLY AVERAGE
                </Text>
                <Text style={[styles.heroVal, { color: c.text }]}>{avgCals}</Text>
                <Text style={[styles.heroMeta, { color: c.muted }]}>
                  kcal / day · {weekAdherence}% of {profile.calories} goal
                </Text>
              </View>
              <ProgressRing
                progress={Math.min(1, avgCals / profile.calories)}
                color={colors.primary}
                trackColor={isDark ? '#2A2A32' : '#e2f0dc'}
                size={96}
                stroke={10}
              >
                <Text style={[styles.ringPct, { color: c.text, fontFamily: snPro('800') }]}>
                  {/* The ring tops out at full; the line beside it still shows the real % of goal. */}
                  {Math.min(100, weekAdherence)}%
                </Text>
              </ProgressRing>
            </View>

            <View style={styles.dotsRow}>
              {weekKeys.map((key, i) => {
                const cals = weekCalories[i];
                const done = cals > 0;
                const full = cals >= profile.calories * 0.85;
                return (
                  <View key={key} style={styles.dotCol}>
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: full
                            ? colors.accent
                            : done
                              ? colors.primary
                              : isDark
                                ? '#2A2A32'
                                : '#E4E7EC',
                        },
                      ]}
                    />
                    <Text style={[styles.dotLbl, { color: i === 6 ? colors.primary : c.muted }]}>
                      {dowLabel(key)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={[styles.goalPill, { backgroundColor: isDark ? '#22222A' : colors.primarySoft }]}>
              <Target size={14} color={colors.primary} />
              <Text style={[styles.goalPillText, { color: colors.primary, fontFamily: snPro('600') }]}>
                {GOAL_LABEL[goal]} · {profile.goalWeight} kg target
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Weight / Calories / Macros — mockup-style chart card */}
        <View style={styles.segRow}>
          {CHART_TABS.map((tab) => {
            const on = chartTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setChartTab(tab.id)}
                style={[
                  styles.segBtn,
                  {
                    backgroundColor: on ? colors.primary : isDark ? c.chip : '#EEF0F3',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segLbl,
                    {
                      color: on ? '#FFFFFF' : c.muted,
                      fontFamily: snPro(on ? '700' : '600'),
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {chartTab === 'weight' ? (
          <View style={[styles.chartCard, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLbl, { color: c.muted, fontFamily: snPro('600') }]}>Current Weight</Text>
                <Text style={[styles.metricVal, { color: colors.primary, fontFamily: FONT.nova }]}>
                  {profile.weight} kg
                </Text>
              </View>
              <View style={[styles.metricCol, styles.metricRight]}>
                <Text style={[styles.metricLbl, { color: c.muted, fontFamily: snPro('600') }]}>Goal</Text>
                <Text style={[styles.metricVal, { color: c.text, fontFamily: FONT.nova }]}>
                  {profile.goalWeight} kg
                </Text>
              </View>
            </View>

            {weightPoints.length ? (
              <>
                <WeightLineChart
                  points={weightPoints.map((p) => ({
                    value: p.weight,
                    label: formatShortDate(p.date),
                  }))}
                  color={colors.primary}
                  trackColor={isDark ? '#2A2A32' : '#E8EAED'}
                  labelColor={c.muted}
                  height={170}
                  goalValue={profile.goalWeight}
                />
                <Text style={[styles.chartFoot, { color: c.muted, fontFamily: snPro('500') }]}>
                  {deltaNum == null
                    ? `1 entry so far · log again next week to see your trend`
                    : `Trend · ${deltaLabel} · goal ${profile.goalWeight} kg`}
                </Text>
                {/* Weight changes over time: let the user add today's weight from the chart too. */}
                <Pressable
                  onPress={() => navigation.navigate('LogWeight')}
                  accessibilityRole="button"
                  style={[styles.emptyChartBtn, styles.updateWeightBtn, { backgroundColor: colors.primary }]}
                >
                  <Scale size={15} color="#FFFFFF" />
                  <Text style={[styles.emptyChartBtnText, { fontFamily: snPro('700') }]}>Update weight</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.emptyChart}>
                <Scale size={28} color={c.muted} />
                <Text style={[styles.emptyChartText, { color: c.muted, fontFamily: snPro('500') }]}>
                  No weight logged yet. Log your weight to start your trend line.
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('LogWeight')}
                  style={[styles.emptyChartBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.emptyChartBtnText, { fontFamily: snPro('700') }]}>Log weight</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {chartTab === 'calories' ? (
          <View style={[styles.chartCard, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricCol}>
                <Text style={[styles.metricLbl, { color: c.muted, fontFamily: snPro('600') }]}>Week average</Text>
                <Text style={[styles.metricVal, { color: colors.primary, fontFamily: FONT.nova }]}>
                  {calWeek.loggedDays ? calWeek.avgCalories : '—'}
                </Text>
              </View>
              <View style={[styles.metricCol, styles.metricRight]}>
                <Text style={[styles.metricLbl, { color: c.muted, fontFamily: snPro('600') }]}>Goal</Text>
                <Text style={[styles.metricVal, { color: c.text, fontFamily: FONT.nova }]}>
                  {profile.calories}
                </Text>
              </View>
            </View>

            {/* Shared week filter (calendar) + bar chart, same as Steps / Exercise / Weekly report */}
            <WeekFilter weekStart={calWeekStart} onChange={setCalWeekStart} style={{ marginBottom: 14 }} />
            <View style={styles.chartHead}>
              <Text style={[styles.chartTitle, { color: c.text, fontFamily: snPro('700') }]}>Calories by day</Text>
              <Text style={[styles.chartLegend, { color: c.muted, fontFamily: snPro('500') }]}>
                {goalLegend(calDays.map((d) => d.value), profile.calories)}
              </Text>
            </View>
            <WeekBarChart
              days={calDays}
              goal={profile.calories}
              todayKey={todayKey()}
              fillFor={calorieFill(profile.calories)}
            />
            <Text style={[styles.chartFoot, { color: c.muted, fontFamily: snPro('500') }]}>
              {calWeek.loggedDays} of 7 days logged
            </Text>
          </View>
        ) : null}

        {chartTab === 'macros' ? (
          <View style={[styles.chartCard, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Text style={[styles.chartTitle, { color: c.text, fontFamily: snPro('700'), marginBottom: 12 }]}>
              Macro progress today
            </Text>
            <MacroPieChart carbs={totals.carbs} protein={totals.protein} fat={totals.fat} size={152} />
            <View style={styles.macroGoalRow}>
              {[
                { label: 'Protein', cur: totals.protein, goal: profile.protein, color: colors.protein },
                { label: 'Carbs', cur: totals.carbs, goal: profile.carbs, color: colors.carbs },
                { label: 'Fat', cur: totals.fat, goal: profile.fat, color: colors.fat },
              ].map((m) => (
                <View key={m.label} style={styles.macroGoalCol}>
                  <Text style={[styles.macroGoalVal, { color: m.color, fontFamily: snPro('800') }]}>
                    {Math.round(m.cur)}/{m.goal}g
                  </Text>
                  <Text style={[styles.macroGoalLbl, { color: c.muted }]}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.section, { color: c.text, fontFamily: snPro('800') }]}>This week</Text>
        <View style={styles.weekRow}>
          {[
            { label: 'Avg kcal', value: week.loggedDays ? `${avgCals}` : '—', Icon: Flame, color: colors.primary },
            {
              label: 'Avg protein',
              value: week.loggedDays ? `${week.avgProtein}g` : '—',
              Icon: Target,
              color: colors.protein,
            },
            { label: 'Avg water', value: `${week.avgWater}`, Icon: Droplets, color: '#26C6DA' },
            { label: 'Exercise', value: `${week.exerciseMinutes}m`, Icon: Dumbbell, color: colors.exercise },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.weekChip, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <View style={[styles.weekIcon, { backgroundColor: isDark ? `${item.color}22` : `${item.color}18` }]}>
                <item.Icon size={14} color={item.color} />
              </View>
              <Text style={[styles.weekVal, { color: c.text, fontFamily: snPro('800') }]}>{item.value}</Text>
              <Text style={[styles.weekLbl, { color: c.muted, fontFamily: snPro('600') }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { color: c.text, fontFamily: snPro('800') }]}>Today habits</Text>
        <HabitProgressCard
          icon={Droplets}
          title="Drink water"
          subtitle="Today"
          current={water}
          goal={profile.waterGoal}
          unit="glasses"
          color="#26C6DA"
        />
        <HabitProgressCard
          icon={Flame}
          title="Calories logged"
          subtitle={`${Math.max(0, remaining)} kcal left`}
          current={totals.calories}
          goal={profile.calories}
          unit="kcal"
          color={colors.primary}
        />

        <View style={styles.statGrid}>
          <StatCard
            Icon={Scale}
            label="Weight"
            value={`${profile.weight} kg`}
            hint={deltaLabel}
            hintColor={deltaNum == null ? c.muted : deltaNum <= 0 ? colors.accent : colors.carbs}
            theme={c}
            isDark={isDark}
            iconColor={colors.primary}
          />
          <StatCard
            Icon={Dumbbell}
            label="Exercise"
            value={`${exerciseMins} min`}
            hint={`${burned} kcal burned`}
            hintColor={colors.exercise}
            theme={c}
            isDark={isDark}
            iconColor={colors.exercise}
          />
        </View>

        <View style={[styles.card, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Trophy size={16} color={colors.carbs} />
              <Text style={[styles.cardTitleInline, { color: c.text }]}>Achievements</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Achievements')}
              hitSlop={8}
              style={styles.seeAll}
            >
              <Text style={[styles.seeAllText, { color: colors.primary, fontFamily: snPro('700') }]}>See all</Text>
              <ChevronRight size={16} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.badgeRow}>
            {featuredAchievements.map(({ id, label, Icon, color }) => (
              <View key={id} style={styles.badgeWrap}>
                <Pressable
                  onPress={() => navigation.navigate('AchievementDetail', { id })}
                  style={({ pressed }) => [
                    styles.badge,
                    {
                      backgroundColor: isDark ? '#1C1C22' : '#F8FAFC',
                      borderColor: c.border,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <View style={[styles.badgeIcon, { backgroundColor: `${color}22` }]}>
                    <Icon size={16} color={color} />
                  </View>
                  <Text style={[styles.badgeLbl, { color: c.text, fontFamily: snPro('600') }]}>{label}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.insightCard,
            {
              backgroundColor: isDark ? '#1A1A28' : colors.primarySoft,
              borderColor: isDark ? c.border : primaryRgba(0.15),
            },
          ]}
        >
          <Award size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.insightTitle, { color: c.text, fontFamily: snPro('700') }]}>Weekly insight</Text>
            {week.insights.slice(0, 3).map((line) => (
              <Text key={line} style={[styles.insightBody, { color: c.muted }]}>
                • {line}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function StatCard({ Icon, label, value, hint, hintColor, theme, isDark, iconColor }) {
  return (
    <View style={styles.statWrap}>
      <View style={[styles.stat, softShadow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <View style={[styles.statIcon, { backgroundColor: isDark ? '#22222A' : `${iconColor}18` }]}>
          <Icon size={16} color={iconColor} />
        </View>
        <Text style={[styles.statLbl, { color: theme.muted, fontFamily: snPro('600') }]}>{label}</Text>
        <Text style={[styles.statVal, { color: theme.text, fontFamily: snPro('800') }]}>{value}</Text>
        <Text style={[styles.statHint, { color: hintColor, fontFamily: snPro('600') }]}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 36 },
  kicker: { fontSize: 11, letterSpacing: 1 },
  title: { fontSize: 26, marginTop: 4, fontFamily: FONT.nova },
  sub: { fontSize: 14, marginTop: 6, marginBottom: 16, lineHeight: 20 },
  section: { fontSize: 16, marginBottom: 10, marginTop: 8 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroInner: { padding: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroKicker: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroVal: { fontSize: 32, fontFamily: FONT.nova, marginTop: 4 },
  heroMeta: { fontSize: 12, marginTop: 4 },
  ringPct: { fontSize: 16 },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dotCol: { alignItems: 'center', flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 99, marginBottom: 6 },
  dotLbl: { fontSize: 10, fontWeight: '600' },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  goalPillText: { fontSize: 12, marginLeft: 6 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segBtn: {
    flex: 1,
    borderRadius: 99,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segLbl: { fontSize: 13 },
  chartCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  metricRow: { flexDirection: 'row', marginBottom: 16 },
  metricCol: { flex: 1 },
  metricRight: { alignItems: 'flex-end' },
  metricLbl: { fontSize: 12, marginBottom: 4 },
  metricVal: { fontSize: 26, letterSpacing: -0.4 },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartTitle: { fontSize: 16 },
  chartLegend: { fontSize: 11 },
  chartFoot: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  weekRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  weekChip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  weekIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  weekVal: { fontSize: 13 },
  weekLbl: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 6,
    marginTop: 6,
  },
  statWrap: {
    width: '50%',
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  stat: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLbl: { fontSize: 12 },
  statVal: { fontSize: 20, marginTop: 4 },
  statHint: { fontSize: 11, marginTop: 4 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center' },
  cardTitleInline: { fontSize: 16, fontFamily: snPro('700'), marginLeft: 8 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13 },
  macroGoalRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  macroGoalCol: { flex: 1, alignItems: 'center' },
  macroGoalVal: { fontSize: 12 },
  macroGoalLbl: { fontSize: 10, marginTop: 3, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  badgeWrap: { width: '50%', paddingHorizontal: 4, marginBottom: 8 },
  badge: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeLbl: { fontSize: 12 },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  insightTitle: { fontSize: 14, marginBottom: 4 },
  insightBody: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  emptyChart: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyChartText: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 260 },
  emptyChartBtn: { borderRadius: 99, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4 },
  emptyChartBtnText: { color: '#FFFFFF', fontSize: 13 },
  updateWeightBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
});
