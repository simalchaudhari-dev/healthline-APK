import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { ChevronLeft, Award, Armchair } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ProgressRing from '../../components/common/ProgressRing';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useDiary, todayKey } from '../../context/DiaryContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { buildExerciseReport, EXERCISE_TYPES } from '../../utils/exerciseReport';
import WeekChartCard from '../../components/charts/WeekChartCard';
import WeekFilter, { thisMonday, addDays } from '../../components/charts/WeekFilter';
import { formatDayDate, formatRange } from '../../utils/formatDate';

/** Same orange as the admin exercise chart for calories. */
const KCAL_COLOR = '#f59e0b';
const TYPE_COLOR = Object.fromEntries(EXERCISE_TYPES.map((t) => [t.id, t.color]));
const SOFT_TILES = ['#fff1dc', '#e2f2dc', '#e0f4f7'];
const ROW_LINE = '#eef2ec';

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

function Header({ subtitle, onBack, c, isDark, ink, muted }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.back, CARD_SHADOW, { backgroundColor: c.cardBg }]}
      >
        <ChevronLeft size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.6} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Exercise report</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: muted, fontFamily: snPro('400') }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/** Weekly exercise summary from the user's diary: minutes, calories, active days, types and sessions. */
export default function ExerciseReportScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { days, syncing, diaryLoading } = useDiary();
  const [weekStart, setWeekStart] = useState(thisMonday);

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const line = isDark ? c.border : ROW_LINE;

  const today = todayKey();
  const endKey = addDays(weekStart, 6);
  const r = useMemo(() => buildExerciseReport({ days, endKey, today }), [days, endKey, today]);
  // Day shown under the chart: the tapped day, else today (this week) or the best day.
  const [pickedDay, setPickedDay] = useState(null);
  const dayInfo = useMemo(() => {
    const key =
      (pickedDay && r.days.some((d) => d.key === pickedDay) && pickedDay) ||
      (r.days.some((d) => d.key === today) ? today : null) ||
      [...r.days].sort((a, b) => b.minutes - a.minutes)[0]?.key;
    const d = r.days.find((x) => x.key === key);
    if (!d) return null;
    const daySessions = r.sessions.filter((x) => x.key === key);
    // Split the day by type (e.g. home 27 min + walk 30 min = 57), so the day total is easy to check.
    const byType = EXERCISE_TYPES.map((t) => {
      const list = daySessions.filter((x) => x.type === t.id);
      return {
        id: t.id,
        label: t.label,
        color: t.color,
        minutes: list.reduce((s, x) => s + x.minutes, 0),
        calories: list.reduce((s, x) => s + x.calories, 0),
      };
    }).filter((t) => t.minutes || t.calories);
    return { ...d, sessions: daySessions.length, byType };
  }, [pickedDay, r, today]);
  const vsPrev = r.prevMinutes || r.minutes ? r.minutes - r.prevMinutes : null;
  const goBack = () => navigation.goBack();

  // First load after sign-in: show the common loader instead of empty / zero numbers.
  if (diaryLoading) {
    return (
      <ScreenShell>
        <View style={styles.loadingHead}>
          <Header onBack={goBack} c={c} isDark={isDark} ink={ink} muted={muted} />
        </View>
        <LoadingScreen message="Loading your exercise…" />
      </ScreenShell>
    );
  }

  const rangeLabel = formatRange(r.startKey, r.endKey);

  const stats = [
    { key: 'sessions', label: 'Sessions', value: `${r.sessionsCount}` },
    { key: 'minutes', label: 'Active min', value: `${r.minutes}` },
    { key: 'days', label: 'Active days', value: `${r.activeDays}/7` },
  ];

  const extras = [
    { key: 'kcal', label: 'Calories burned', value: `${r.calories} kcal`, hint: 'this week' },
    {
      key: 'avg',
      label: 'Per active day',
      value: `${r.avgPerActiveDay} min`,
      hint: r.best ? `best ${r.best.label}: ${r.best.minutes} min` : 'no sessions',
    },
    {
      key: 'streak',
      label: 'Streak',
      value: r.streak == null ? '—' : `${r.streak} day${r.streak === 1 ? '' : 's'}`,
      hint: r.streak == null ? 'shown for this week' : 'in a row with exercise',
    },
  ];

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header subtitle={rangeLabel} onBack={goBack} c={c} isDark={isDark} ink={ink} muted={muted} />

        {/* Week filter with calendar (shared with every bar chart) — drives the whole report */}
        <WeekFilter
          weekStart={weekStart}
          onChange={setWeekStart}
          style={[styles.segment, CARD_SHADOW, { backgroundColor: c.cardBg }]}
        />

        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.syncText, { color: muted, fontFamily: snPro('400') }]}>Updating from your account…</Text>
          </View>
        ) : null}

        {/* Stat tiles */}
        <View style={styles.statRow}>
          {stats.map((s) => (
            <View key={s.key} style={[styles.stat, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
              <Text style={[styles.statVal, { color: ink, fontFamily: FONT.heading }]} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </Text>
              <Text style={[styles.statLbl, { color: muted, fontFamily: snPro('400') }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly guideline */}
        <View style={[styles.card, styles.goalCard, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: ink, fontFamily: poppins('600') }]}>Active minutes</Text>
            <Text style={[styles.goalVal, { color: ink, fontFamily: FONT.heading }]}>
              {r.minutes}
              <Text style={[styles.goalOf, { color: muted, fontFamily: snPro('500') }]}> / {r.weeklyGoalMinutes} min</Text>
            </Text>
            <Text style={[styles.meta, { color: muted, fontFamily: snPro('400') }]}>weekly guideline</Text>
            {vsPrev != null ? (
              <Text style={[styles.meta, { color: muted, fontFamily: snPro('400') }]}>
                {vsPrev === 0 ? 'Same as' : `${Math.abs(vsPrev)} min ${vsPrev > 0 ? 'more' : 'less'} than`} the week before
              </Text>
            ) : null}
          </View>
          <ProgressRing
            progress={r.goalProgress}
            color={colors.primary}
            trackColor={isDark ? '#2A2A2A' : '#e2f0dc'}
            size={76}
            stroke={8}
          >
            <Text style={[styles.ringPct, { color: ink, fontFamily: FONT.heading }]}>{Math.round(r.goalProgress * 100)}%</Text>
          </ProgressRing>
        </View>

        {/* Minutes / calories by day — shared week bar chart */}
        <WeekChartCard
          title="Workout by day"
          subtitle={`Each bar is one day · week total ${r.minutes} min · ${r.calories} kcal`}
          right={
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendTxt, { color: muted, fontFamily: snPro('700') }]}>Min</Text>
              <View style={[styles.legendDot, { backgroundColor: KCAL_COLOR }]} />
              <Text style={[styles.legendTxt, { color: muted, fontFamily: snPro('700') }]}>Kcal</Text>
            </View>
          }
          days={r.days.map((d) => ({ key: d.key, label: d.label, value: d.minutes, value2: d.calories }))}
          secondary={{ color: KCAL_COLOR }}
          todayKey={today}
          fillFor={(d, { isToday }) => (!isToday && d.value >= 30 ? colors.primary : null)}
          selectedKey={dayInfo?.key}
          onDayPress={(d) => setPickedDay(d.key)}
          style={{ marginBottom: 0 }}
        >
          {dayInfo ? (
            <View style={[styles.dayBox, { backgroundColor: isDark ? c.track : '#f2f8ef' }]}>
              <Text style={[styles.dayTitle, { color: ink, fontFamily: snPro('800') }]}>
                {formatDayDate(dayInfo.key)}
                {dayInfo.key === today ? ' · today' : ''}
              </Text>
              <View style={styles.dayStats}>
                <Text style={[styles.dayStat, { color: colors.primary, fontFamily: FONT.heading }]}>
                  {dayInfo.minutes} <Text style={[styles.dayUnit, { fontFamily: snPro('600') }]}>min</Text>
                </Text>
                <Text style={[styles.dayStat, { color: KCAL_COLOR, fontFamily: FONT.heading }]}>
                  {dayInfo.calories} <Text style={[styles.dayUnit, { fontFamily: snPro('600') }]}>kcal</Text>
                </Text>
                <Text style={[styles.dayStat, { color: ink, fontFamily: FONT.heading }]}>
                  {dayInfo.sessions}{' '}
                  <Text style={[styles.dayUnit, { fontFamily: snPro('600') }]}>
                    session{dayInfo.sessions === 1 ? '' : 's'}
                  </Text>
                </Text>
              </View>
              {dayInfo.byType.length > 1 ? (
                <View style={styles.dayTypes}>
                  {dayInfo.byType.map((t) => (
                    <View key={t.id} style={styles.dayTypeRow}>
                      <View style={[styles.legendDot, { backgroundColor: t.color, marginLeft: 0 }]} />
                      <Text style={[styles.dayTypeTxt, { color: ink, fontFamily: snPro('600') }]} numberOfLines={1}>
                        {t.label}
                      </Text>
                      <Text style={[styles.dayTypeVal, { color: muted, fontFamily: snPro('700') }]}>
                        {t.minutes} min · {t.calories} kcal
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={[styles.dayHint, { color: muted, fontFamily: snPro('400') }]}>Tap a day to see its numbers.</Text>
            </View>
          ) : null}
        </WeekChartCard>

        {/* Secondary metrics */}
        <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg, paddingVertical: 4 }]}>
          {extras.map((x, i) => (
            <View key={x.key} style={[styles.row, i < extras.length - 1 && { borderBottomWidth: 1, borderBottomColor: line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: ink, fontFamily: snPro('700') }]}>{x.label}</Text>
                <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('400') }]}>{x.hint}</Text>
              </View>
              <Text style={[styles.rowVal, { color: ink, fontFamily: FONT.heading }]}>{x.value}</Text>
            </View>
          ))}
        </View>

        {/* By type */}
        {r.byType.length ? (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
            <Text style={[styles.cardTitle, { color: ink, fontFamily: poppins('600'), marginBottom: 2 }]}>By type</Text>
            <Text style={[styles.typeNote, { color: muted, fontFamily: snPro('500') }]}>
              Whole week, all days added up · {r.minutes} min · {r.calories} kcal
            </Text>
            <View style={styles.typeGrid}>
              {r.byType.map((t, i) => (
                <View
                  key={t.id}
                  style={[styles.typeTile, { backgroundColor: isDark ? c.chip : SOFT_TILES[i % SOFT_TILES.length] }]}
                >
                  <View style={styles.typeHead}>
                    <View style={[styles.dot, { backgroundColor: t.color }]} />
                    <Text style={[styles.typeName, { color: ink, fontFamily: snPro('700') }]} numberOfLines={1}>
                      {t.label}
                    </Text>
                  </View>
                  <Text style={[styles.typeVal, { color: ink, fontFamily: FONT.heading }]}>{t.minutes} min</Text>
                  <Text style={[styles.typeSub, { color: muted, fontFamily: snPro('500') }]}>
                    {t.sessions}× · {t.calories} kcal
                  </Text>
                  <View style={[styles.typeTrack, { backgroundColor: isDark ? c.track : 'rgba(255,255,255,0.75)' }]}>
                    <View
                      style={[
                        styles.typeFill,
                        { backgroundColor: t.color, width: `${r.minutes ? Math.max(4, (t.minutes / r.minutes) * 100) : 0}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Sessions */}
        {r.sessions.length ? (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg, paddingBottom: 6 }]}>
            <Text style={[styles.cardTitle, { color: ink, fontFamily: poppins('600'), marginBottom: 4 }]}>Sessions</Text>
            {r.sessions.map((s, i) => (
              <View
                key={s.id}
                style={[styles.row, i < r.sessions.length - 1 && { borderBottomWidth: 1, borderBottomColor: line }]}
              >
                <View style={[styles.dot, styles.sessionDot, { backgroundColor: TYPE_COLOR[s.type] || colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: ink, fontFamily: snPro('700') }]}>{s.name}</Text>
                  <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('400') }]}>
                    {s.key === today ? 'Today' : formatDayDate(s.key)}
                    {s.completed === false ? (
                      <Text style={{ color: '#d97706', fontFamily: snPro('700') }}>  · Not finished</Text>
                    ) : null}
                  </Text>
                  {(s.moves || []).map((m, mi) => (
                    <Text key={`${s.id}-${mi}`} style={[styles.moveLine, { color: muted, fontFamily: snPro('400') }]}>
                      {m.name} · {m.times}× · {m.calories} kcal
                    </Text>
                  ))}
                </View>
                <View style={styles.sessionRight}>
                  <Text style={[styles.rowVal, { color: ink, fontFamily: snPro('700') }]}>{s.minutes} min</Text>
                  <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('400') }]}>{s.calories} kcal</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Insights */}
        <View style={[styles.insight, { backgroundColor: isDark ? '#1A2A1A' : colors.primarySoft }]}>
          <Award size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.insightTitle, { color: ink, fontFamily: poppins('600') }]}>Insights</Text>
            {r.insights.map((ln) => (
              <Text key={ln} style={[styles.insightBody, { color: muted, fontFamily: snPro('400') }]}>
                • {ln}
              </Text>
            ))}
          </View>
        </View>

        {weekStart === thisMonday() ? (
          <AppButton label="Start an exercise at home" icon={Armchair} onPress={() => navigation.navigate('HomeExercises')} />
        ) : null}

        <Text style={[styles.disclaimer, { color: muted, fontFamily: snPro('400') }]}>
          Based on exercise logged in your diary. Calories are estimates. The 150-minute weekly guideline is general
          advice — ask your doctor what is right for you.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  loadingHead: { paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  subtitle: { fontSize: 12 },
  segment: { padding: 4 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncText: { fontSize: 12 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
  statVal: { fontSize: 18, lineHeight: 24 },
  statLbl: { fontSize: 12, marginTop: 2, textAlign: 'center' },
  card: { borderRadius: 16, padding: 16 },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, lineHeight: 22, marginBottom: 10 },
  goalVal: { fontSize: 26, lineHeight: 32 },
  goalOf: { fontSize: 13 },
  meta: { fontSize: 12, marginTop: 2 },
  ringPct: { fontSize: 14 },
  typeNote: { fontSize: 12, marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  legendTxt: { fontSize: 11 },
  dayBox: { marginTop: 12, borderRadius: 14, padding: 12 },
  dayTitle: { fontSize: 13 },
  dayStats: { flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' },
  dayStat: { fontSize: 18, lineHeight: 24 },
  dayUnit: { fontSize: 12 },
  dayHint: { fontSize: 11, marginTop: 4 },
  dayTypes: { marginTop: 8, gap: 4 },
  dayTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayTypeTxt: { flex: 1, fontSize: 12 },
  dayTypeVal: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowName: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowVal: { fontSize: 14 },
  moveLine: { fontSize: 12, marginTop: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sessionDot: { marginTop: 5, alignSelf: 'flex-start' },
  sessionRight: { alignItems: 'flex-end', alignSelf: 'flex-start' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  typeTile: { width: '48.5%', borderRadius: 14, padding: 12 },
  typeHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  typeName: { flex: 1, fontSize: 13 },
  typeVal: { fontSize: 16, lineHeight: 22 },
  typeSub: { fontSize: 12 },
  typeTrack: { height: 6, borderRadius: 99, overflow: 'hidden', marginTop: 8 },
  typeFill: { height: '100%', borderRadius: 99 },
  insight: { flexDirection: 'row', borderRadius: 16, padding: 14 },
  insightTitle: { fontSize: 16, lineHeight: 22, marginBottom: 4 },
  insightBody: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  disclaimer: { fontSize: 11, marginTop: 2, textAlign: 'center', lineHeight: 16 },
});
