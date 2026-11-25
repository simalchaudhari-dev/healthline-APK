import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Coffee,
  Utensils,
  Moon,
  Cookie,
  CalendarDays,
  Lock,
} from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import MealSection from '../../components/Diary/MealSection';
import DateCalendarModal from '../../components/Diary/DateCalendarModal';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { colors, themeColors } from '../../config/colors';
import { FONT } from '../../config/fonts';
import { formatDayDate } from '../../utils/formatDate';

const MEALS = [
  { key: 'breakfast', title: 'Breakfast', Icon: Coffee, accent: '#E68A00' },
  { key: 'lunch', title: 'Lunch', Icon: Utensils, accent: colors.primary },
  { key: 'dinner', title: 'Dinner', Icon: Moon, accent: '#6C5CE7' },
  { key: 'snacks', title: 'Snacks', Icon: Cookie, accent: colors.protein },
];

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  android: { elevation: 2 },
  default: {},
});

export default function DiaryScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { days, removeFood, profile, diaryLoading, today, loadDay } = useDiary();
  const { user } = useAuth();
  // Signup day: the diary cannot go before it (nothing was logged earlier).
  const minKey = /^\d{4}-\d{2}-\d{2}$/.test(user?.joined || '') ? user.joined : '';
  const [dateKey, setDateKey] = useState(() => localTodayKey());
  const canEdit = dateKey === localTodayKey();
  // Only the last 90 days come with sign-in; an older day is fetched when it is opened.
  useEffect(() => {
    loadDay(dateKey);
  }, [dateKey, loadDay]);
  // Past midnight with the diary open on "today": move to the new day.
  const prevTodayRef = useRef(today);
  useEffect(() => {
    const prev = prevTodayRef.current;
    prevTodayRef.current = today;
    if (today && prev && prev !== today) setDateKey((key) => (key === prev ? today : key));
  }, [today]);
  const { meals, exercise, totals, burned, remaining } = useMemo(
    () => viewForDate(days, dateKey, profile.calories),
    [days, dateKey, profile.calories],
  );
  const { confirm } = useConfirm();

  const handleRemoveFood = async (mealKey, logId, foodName) => {
    const ok = await confirm({
      title: 'Delete food?',
      message: `Remove “${foodName || 'this item'}” from your diary? This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (ok) removeFood(mealKey, logId);
  };

  const canGoBack = !minKey || dateKey > minKey;
  const shiftDay = (delta) => {
    if (delta < 0 && !canGoBack) return;
    // Stay in local time end to end: toISOString() reads the date in UTC, which is a day
    // off in time zones of UTC+12 or more.
    const [y, m, day] = dateKey.split('-').map(Number);
    const d = new Date(y, m - 1, day + delta);
    setDateKey(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  };

  const isToday = dateKey === localTodayKey();
  const [calendarOpen, setCalendarOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setDateKey(localTodayKey());
      setCalendarOpen(false);
    }, []),
  );

  // First load after sign-in: show the common loader instead of empty / zero numbers.
  if (diaryLoading) {
    return (
      <ScreenShell>
        <LoadingScreen message="Loading your diary…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <DateCalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedKey={dateKey}
        onSelectDate={setDateKey}
        minKey={minKey}
      />
      <View style={styles.head}>
        <Pressable
          onPress={() => shiftDay(-1)}
          disabled={!canGoBack}
          hitSlop={10}
          accessibilityLabel="Previous day"
          style={[styles.navBtn, { backgroundColor: c.chip, borderColor: c.border, opacity: canGoBack ? 1 : 0.35 }]}
        >
          <ChevronLeft size={20} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => setCalendarOpen(true)}
          hitSlop={6}
          style={({ pressed }) => [styles.dateTap, pressed && styles.dateTapPressed]}
        >
          <Text style={[styles.title, { color: c.text }]}>Diary</Text>
          <View
            style={[
              styles.datePill,
              {
                backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft,
                borderColor: isToday ? colors.primary : c.border,
              },
            ]}
          >
            <CalendarDays size={14} color={isToday ? colors.primary : c.muted} />
            <Text style={[styles.date, { color: isToday ? colors.primary : c.text }]}>
              {isToday ? 'Today · ' : ''}{formatDate(dateKey)}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => shiftDay(1)}
          hitSlop={10}
          style={[styles.navBtn, { backgroundColor: c.chip, borderColor: c.border }]}
        >
          <ChevronRight size={20} color={c.text} />
        </Pressable>
      </View>

      <View style={[styles.summaryWrap, cardShadow, { borderColor: isDark ? c.border : 'rgba(0,112,224,0.12)' }]}>
        <LinearGradient
          colors={isDark ? ['#141414', '#121212'] : ['#FFFFFF', '#F3F8FF']}
          style={styles.summary}
        >
          <StatChip label="Goal" value={profile.calories} theme={c} isDark={isDark} />
          <StatChip label="Food" value={totals.calories} theme={c} isDark={isDark} accent={colors.primary} />
          <StatChip label="Exercise" value={burned} theme={c} isDark={isDark} accent={colors.exercise} />
          <StatChip label="Left" value={Math.max(0, remaining)} theme={c} isDark={isDark} accent={colors.primary} strong />
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!canEdit ? (
          <View style={[styles.readOnlyBar, { backgroundColor: isDark ? '#1C1C1E' : c.chip, borderColor: c.border }]}>
            <Lock size={14} color={c.muted} />
            <Text style={[styles.readOnlyText, { color: c.muted }]}>
              {dateKey < localTodayKey()
                ? 'Past day · view only. You can only add or remove entries for today.'
                : 'Future day · you can only log for today.'}
            </Text>
            <Pressable onPress={() => setDateKey(localTodayKey())} hitSlop={8}>
              <Text style={[styles.readOnlyLink, { color: colors.primary }]}>Today</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.section, { color: c.muted }]}>MEALS</Text>

        {MEALS.map((m) => (
          <MealSection
            key={m.key}
            title={m.title}
            icon={m.Icon}
            accent={m.accent}
            items={meals[m.key]}
            theme={c}
            isDark={isDark}
            readOnly={!canEdit}
            onAdd={() => navigation.navigate('AddFood', { meal: m.key })}
            onRemove={(logId) => {
              const item = (meals[m.key] || []).find((f) => f.logId === logId);
              handleRemoveFood(m.key, logId, item?.name);
            }}
          />
        ))}

        <Text style={[styles.section, { color: c.muted, marginTop: 4 }]}>ACTIVITY</Text>

        <View style={[styles.exCard, cardShadow, { borderColor: isDark ? c.border : 'rgba(52,199,89,0.18)' }]}>
          <LinearGradient
            colors={isDark ? ['#141414', '#121212'] : ['#FFFFFF', '#F0FFF5']}
            style={styles.exInner}
          >
            <View style={styles.exHead}>
              <View style={styles.exHeadLeft}>
                <View style={[styles.exIcon, { backgroundColor: isDark ? '#1C1C1E' : colors.accentSoft }]}>
                  <Flame size={16} color={colors.exercise} />
                </View>
                <View>
                  <Text style={[styles.exTitle, { color: c.text }]}>Exercise</Text>
                  <Text style={[styles.exSub, { color: c.muted }]}>{(exercise || []).length} workout{(exercise || []).length !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              <View style={[styles.exCalBadge, { backgroundColor: isDark ? '#1C1C1E' : colors.accentSoft }]}>
                <Text style={[styles.exCalNum, { color: colors.exercise }]}>{burned}</Text>
                <Text style={[styles.exCalLbl, { color: c.muted }]}>kcal</Text>
              </View>
            </View>
            {(exercise || []).map((item) => (
              <View key={item.logId} style={[styles.exRow, { borderTopColor: c.border }]}>
                <View style={[styles.exDot, { backgroundColor: colors.exercise }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exName, { color: c.text }]}>{item.name}</Text>
                  <Text style={[styles.exMeta, { color: c.muted }]}>{item.minutes} min · {item.calories} kcal burned</Text>
                </View>
              </View>
            ))}
          </LinearGradient>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function StatChip({ label, value, theme, isDark, accent, strong }) {
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
          borderColor: strong ? colors.primary : isDark ? theme.border : 'rgba(0,112,224,0.1)',
        },
      ]}
    >
      <Text style={[styles.chipVal, { color: accent || theme.text }]}>{value}</Text>
      <Text style={[styles.chipLbl, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function viewForDate(days, key, calorieGoal) {
  const day = days?.[key] || {};
  const raw = day.meals || {};
  const meals = {
    breakfast: Array.isArray(raw.breakfast) ? raw.breakfast : [],
    lunch: Array.isArray(raw.lunch) ? raw.lunch : [],
    dinner: Array.isArray(raw.dinner) ? raw.dinner : [],
    snacks: Array.isArray(raw.snacks) ? raw.snacks : [],
  };
  const exercise = Array.isArray(day.exercise) ? day.exercise : [];
  const totals = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks].reduce(
    (acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      carbs: acc.carbs + (Number(item.carbs) || 0),
      protein: acc.protein + (Number(item.protein) || 0),
      fat: acc.fat + (Number(item.fat) || 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 },
  );
  const burned = exercise.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  return {
    meals,
    exercise,
    totals,
    burned,
    remaining: (Number(calorieGoal) || 0) - totals.calories + burned,
  };
}

function localTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Mon, 19 Oct 2026 */
function formatDate(key) {
  return formatDayDate(key);
}

const styles = StyleSheet.create({
  readOnlyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  readOnlyText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  readOnlyLink: { fontSize: 13, fontWeight: '800' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '400', fontFamily: FONT.nova, letterSpacing: -0.3 },
  dateTap: { alignItems: 'center' },
  dateTapPressed: { opacity: 0.82 },
  datePill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  summaryWrap: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
  },
  chipVal: { fontSize: 15, fontWeight: '800' },
  chipLbl: { fontSize: 9, marginTop: 3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 2,
  },
  scroll: { padding: 16, paddingBottom: 28 },
  exCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  exInner: { padding: 14 },
  exHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exTitle: { fontSize: 16, fontWeight: '700' },
  exSub: { fontSize: 11, marginTop: 2 },
  exCalBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  exCalNum: { fontSize: 18, fontWeight: '800' },
  exCalLbl: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  exDot: { width: 8, height: 8, borderRadius: 99 },
  exName: { fontSize: 14, fontWeight: '600' },
  exMeta: { fontSize: 12, marginTop: 2 },
});
