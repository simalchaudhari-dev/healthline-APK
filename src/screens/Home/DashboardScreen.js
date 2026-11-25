import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Image } from 'react-native';
import {
  ScanLine,
  Droplets,
  Flame,
  ChevronRight,
  Plus,
  Footprints,
  Armchair,
  Sparkles,
  CalendarDays,
  GraduationCap,
  HeartPulse,
  UtensilsCrossed,
  Dumbbell,
  Mic,
  Bell,
  FileText,
} from 'lucide-react-native';
import { useInbox } from '../../context/InboxContext';
import { useSteps } from '../../context/StepsContext';
import { DEFAULT_STEP_GOAL } from '../../utils/steps';
import { routineMinutes, workoutPlanFor } from '../../data/homeExercises';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ProgressRing from '../../components/common/ProgressRing';
import HabitProgressCard from '../../components/common/HabitProgressCard';
import ContinueWorkoutButton from '../../components/common/ContinueWorkoutButton';
import { softShadow } from '../../components/common/premiumStyles';
import useFoodImages from '../../hooks/useFoodImages';
import useDailyGoals from '../../hooks/useDailyGoals';
import ProfileMenu from '../../components/Home/ProfileMenu';
import AvatarInitial from '../../components/common/AvatarInitial';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { useFeatureCatalog } from '../../context/FeatureCatalogContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { toast } from '../../utils/toast';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';

const MEAL_KEYS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

/** Soft card shadow from the design canvas. */
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export default function DashboardScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { profile, totals, remaining, burned, water, addWater, exercise, meals, diaryLoading } = useDiary();
  const { user } = useAuth();
  const { unread } = useInbox();
  const { today: stepsToday, connected: stepsConnected, isAccountView: stepsFromAccount, hasSteps } = useSteps();
  const { isActive, getFeature } = useFeatureCatalog();
  const [menuOpen, setMenuOpen] = useState(false);
  const { doneCount: goalsDone, goals: dailyGoals } = useDailyGoals();
  const topExercise = exercise?.[0];

  const imageForMeal = useFoodImages();

  // Sessions from "Exercises at home" are logged as "<routine> (home)".
  const homeMinutes = (exercise || [])
    .filter((e) => /\(home\)$/.test(String(e?.name || '')))
    .reduce((s, e) => s + (Number(e.minutes) || 0), 0);
  useExerciseCatalog(); // re-render after an admin change
  const workoutPlan = workoutPlanFor(profile);
  const workoutChosen = ['gentle', 'active'].includes(profile?.workoutLevel);
  const workoutGoal = Math.max(1, routineMinutes(workoutPlan.routine));
  const eaten = Math.round(totals.calories);
  const goal = profile.calories;
  const left = Math.max(0, Math.round(remaining));
  const progress = goal > 0 ? Math.min(1, eaten / goal) : 0;
  const waterGoal = profile.waterGoal || 8;

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const card = c.cardBg;

  const openFeature = (route, params) => {
    if (!isActive({ route })) {
      const label = getFeature({ route })?.label || 'This feature';
      toast.warning(`${label} is currently unavailable`);
      return;
    }
    navigation.navigate(route, params);
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.displayName ||
    profile.name ||
    'there';
  const photoUri = user?.photoURL || '';

  // First load after sign-in: show the common loader instead of empty / zero numbers.
  if (diaryLoading) {
    return (
      <ScreenShell>
        <LoadingScreen message="Loading your day…" />
      </ScreenShell>
    );
  }

  const tiles = [
    { label: 'Water', value: `${water}`, sub: `of ${waterGoal} glasses`, tone: '#1e3a8a', onPress: addWater },
    {
      label: 'Steps',
      value: Number(stepsToday || 0).toLocaleString('en-IN'),
      sub: `of ${DEFAULT_STEP_GOAL.toLocaleString('en-IN')}`,
      tone: '#1e5e24',
      onPress: () => navigation.navigate('Steps'),
    },
    {
      label: 'Workout',
      value: `${homeMinutes} min`,
      sub: homeMinutes >= workoutGoal ? 'goal met' : `of ${workoutGoal} min`,
      tone: '#3b2b8f',
      onPress: () => navigation.navigate('HomeExercises'),
    },
    {
      label: 'Burned',
      value: `${Math.round(burned)}`,
      sub: 'kcal',
      tone: '#9b2c1f',
      onPress: () => openFeature('LogExercise'),
    },
  ];

  const quick = [
    { Icon: UtensilsCrossed, label: 'Add food', route: 'AddFood', params: { meal: 'breakfast' } },
    { Icon: ScanLine, label: 'Scan', route: 'ScanFood', params: { meal: 'lunch' } },
    { Icon: Mic, label: 'Voice', route: 'VoiceLog', params: { meal: 'snacks' } },
    { Icon: Dumbbell, label: 'Exercise', route: 'LogExercise' },
  ].filter((a) => isActive({ route: a.route }));

  const tools = [
    { Icon: CalendarDays, label: 'Meal plan', route: 'MealPlan' },
    { Icon: GraduationCap, label: 'Programs', route: 'Programs' },
    { Icon: HeartPulse, label: 'Health tracks', route: 'HealthTracks', always: true },
    { Icon: FileText, label: 'Health reports', route: 'HealthRecords', always: true },
    { Icon: HeartPulse, label: 'Medicare', route: 'Medicare' },
    { Icon: Dumbbell, label: 'Workout AI', route: 'WorkoutAi', aiKey: 'workoutAi' },
  ].filter((t) => t.always || (t.aiKey ? isActive({ aiKey: t.aiKey }) : isActive({ route: t.route })));

  const coachTip =
    totals.calories <= 0
      ? { title: 'Log your first meal', sub: 'The coach tailors tips to what you eat' }
      : totals.protein < profile.protein * 0.6
        ? {
            title: `Protein is at ${Math.round(totals.protein)} of ${profile.protein} g`,
            sub: 'Ask the coach for a protein-rich snack',
          }
        : { title: 'You are on track today', sub: 'Ask the coach for dinner ideas that fit' };

  return (
    <ScreenShell>
      <ProfileMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />
      {/* Header (fixed, does not scroll) */}
      <View style={[styles.headerRow, styles.headerFixed]}>
          <AvatarInitial
            name={displayName}
            uri={photoUri}
            size={46}
            backgroundColor={colors.primary}
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Open menu"
          />
          <View style={styles.headerText}>
            <Text style={[styles.helloSub, { color: muted, fontFamily: snPro('400') }]}>{greeting()}</Text>
            <Text style={[styles.helloName, { color: ink, fontFamily: FONT.heading }]} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          {user ? (
            <Pressable
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              style={[styles.bellBtn, CARD_SHADOW, { backgroundColor: card }]}
            >
              <Bell size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.2} />
              {unread ? (
                <View style={[styles.bellBadge, { backgroundColor: colors.danger, borderColor: card }]}>
                  <Text style={[styles.bellBadgeText, { fontFamily: snPro('800') }]}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
      </View>
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <Pressable
          onPress={() => navigation.navigate('DailySummary')}
          style={[styles.summary, CARD_SHADOW, { backgroundColor: card }]}
          accessibilityLabel={`${eaten} of ${goal} calories eaten. ${goalsDone} of ${dailyGoals.length} goals done. Open daily summary`}
        >
          <View style={styles.summaryHead}>
            <Text style={[styles.summaryTitle, { color: ink, fontFamily: poppins('600') }]}>Today</Text>
            <View style={styles.summaryLinkRow}>
              <Text style={[styles.summaryLink, { color: colors.primary, fontFamily: snPro('700') }]}>View summary</Text>
              <ChevronRight size={14} color={colors.primary} strokeWidth={2.6} />
            </View>
          </View>

          <View style={styles.summaryMain}>
            <ProgressRing
              progress={progress}
              color={isDark ? '#8BD843' : '#3e9b3f'}
              trackColor={isDark ? 'rgba(255,255,255,0.12)' : '#e2f0dc'}
              size={108}
              stroke={11}
            >
              <Text style={[styles.ringNum, { color: ink, fontFamily: FONT.heading }]}>{eaten.toLocaleString('en-IN')}</Text>
              <Text style={[styles.ringSub, { color: muted, fontFamily: snPro('400') }]}>
                of {Number(goal || 0).toLocaleString('en-IN')} kcal
              </Text>
            </ProgressRing>

            <View style={styles.summaryBody}>
              <Text style={[styles.leftNum, { color: colors.primary, fontFamily: FONT.heading }]}>
                {left.toLocaleString('en-IN')}
                <Text style={[styles.leftUnit, { color: muted, fontFamily: snPro('600') }]}> kcal left</Text>
              </Text>
              {[
                { key: 'P', label: 'Protein', cur: totals.protein, goal: profile.protein, color: colors.protein },
                { key: 'C', label: 'Carbs', cur: totals.carbs, goal: profile.carbs, color: colors.carbs },
                { key: 'F', label: 'Fat', cur: totals.fat, goal: profile.fat, color: colors.fat },
              ].map((m) => {
                const pct = m.goal > 0 ? Math.min(1, m.cur / m.goal) : 0;
                return (
                  <View key={m.key} style={styles.macroLine}>
                    <View style={styles.macroLabels}>
                      <Text style={[styles.macroName, { color: ink, fontFamily: snPro('600') }]}>{m.label}</Text>
                      <Text style={[styles.macroVal, { color: muted, fontFamily: snPro('400') }]}>
                        {Math.round(m.cur)}/{Math.round(m.goal || 0)} g
                      </Text>
                    </View>
                    <View style={[styles.macroBar, { backgroundColor: isDark ? c.track : `${m.color}22` }]}>
                      <View style={[styles.macroBarFill, { width: `${pct * 100}%`, backgroundColor: m.color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.goalStrip, { backgroundColor: isDark ? c.chip : '#f2f8ef' }]}>
            <View style={styles.goalDots}>
              {dailyGoals.map((g) => (
                <View
                  key={g.id}
                  style={[styles.goalDot, { backgroundColor: g.done ? colors.primary : isDark ? c.border : '#cfe3c7' }]}
                />
              ))}
            </View>
            <Text style={[styles.goalText, { color: ink, fontFamily: snPro('700') }]}>
              {goalsDone}/{dailyGoals.length} daily goals done
            </Text>
          </View>
        </Pressable>

        {/* Stat tiles */}
        <View style={styles.tiles}>
          {tiles.map((t) => (
            <Pressable key={t.label} onPress={t.onPress} style={[styles.tile, CARD_SHADOW, { backgroundColor: card }]}>
              <Text style={[styles.tileLbl, { color: muted, fontFamily: snPro('400') }]}>{t.label}</Text>
              <Text
                style={[styles.tileVal, { color: isDark ? c.text : t.tone, fontFamily: FONT.heading }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t.value}
              </Text>
              <Text style={[styles.tileSub, { color: muted, fontFamily: snPro('400') }]} numberOfLines={1}>
                {t.sub}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Quick actions */}
        {quick.length ? (
          <View style={styles.quickRow}>
            {quick.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => openFeature(a.route, a.params)}
                style={[styles.quick, CARD_SHADOW, { backgroundColor: card }]}
              >
                <View style={[styles.quickIcon, { backgroundColor: isDark ? c.chip : colors.primarySoft }]}>
                  <a.Icon size={20} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.quickLbl, { color: ink, fontFamily: snPro('700') }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Habits */}
        <View>
          <Text style={[styles.section, { color: c.text, fontFamily: snPro('800') }]}>Daily habits</Text>
          <HabitProgressCard
            icon={Droplets}
            title="Drink water"
            subtitle="Stay hydrated"
            current={water}
            goal={profile.waterGoal}
            unit="glasses"
            color="#26C6DA"
            onPress={addWater}
            right={<Plus size={16} color="#26C6DA" strokeWidth={2.5} />}
          />
          <HabitProgressCard
            icon={Flame}
            title="Exercise"
            subtitle={topExercise ? `${topExercise.name} · ${topExercise.minutes} min` : 'Log a workout'}
            current={burned}
            goal={Math.max(burned, 300)}
            unit="kcal"
            color={colors.exercise}
            onPress={() => openFeature('LogExercise')}
            right={<ChevronRight size={16} color={c.muted} />}
          />
          <HabitProgressCard
            icon={Footprints}
            title="Steps"
            subtitle={
              stepsFromAccount
                ? hasSteps
                  ? 'Synced from your phone'
                  : 'Not synced from your phone yet'
                : stepsConnected
                  ? 'Today'
                  : 'Tap to connect step tracking'
            }
            current={stepsToday}
            goal={DEFAULT_STEP_GOAL}
            unit="steps"
            color={colors.primary}
            onPress={() => navigation.navigate('Steps')}
            right={<ChevronRight size={16} color={c.muted} />}
          />
          <HabitProgressCard
            icon={Armchair}
            title="Today's workout"
            subtitle={
              homeMinutes >= workoutGoal
                ? `${workoutPlan.routine?.name} done — great job`
                : workoutChosen
                  ? `${workoutPlan.routine?.name} · tap to start`
                  : 'Older or younger adult? Tap to choose'
            }
            current={homeMinutes}
            goal={workoutGoal}
            unit="min"
            color={colors.primaryDark}
            onPress={() => navigation.navigate('HomeExercises')}
            right={<ChevronRight size={16} color={c.muted} />}
          />
          <ContinueWorkoutButton navigation={navigation} style={{ marginTop: 10 }} />
        </View>

        {/* Meals — compact rows */}
        <View>
          <View style={styles.sectionRow}>
            <Text style={[styles.section, styles.sectionInline, { color: c.text, fontFamily: snPro('800') }]}>
              Today&apos;s meals
            </Text>
            <Pressable onPress={() => navigation.navigate('Diary')} hitSlop={8}>
              <Text style={[styles.sectionLink, { color: colors.primary, fontFamily: snPro('700') }]}>Diary</Text>
            </Pressable>
          </View>
          <View style={styles.mealList}>
            {MEAL_KEYS.map((row) => {
              const items = meals[row.key] || [];
              const cals = items.reduce((s, f) => s + (f.calories || 0), 0);
              const thumbs = items.slice(0, 2);
              return (
                <View key={row.key} style={[styles.mealCard, softShadow, { backgroundColor: c.cardBg }]}>
                  <Pressable
                    onPress={() => navigation.navigate('Diary')}
                    style={styles.mealBody}
                    accessibilityLabel={row.label}
                  >
                    <Text style={[styles.mealTitle, { color: c.text, fontFamily: snPro('700') }]}>{row.label}</Text>
                    <View style={styles.mealCalRow}>
                      <Flame size={13} color={colors.primary} />
                      <Text style={[styles.mealSub, { color: c.muted, fontFamily: snPro('500') }]}>
                        {cals ? `${Math.round(cals)} kcal` : 'Add a meal'}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.mealRight}>
                    {thumbs.map((item, index) => {
                      const photo = imageForMeal(item);
                      const stack = {
                        marginLeft: index ? -16 : 0,
                        zIndex: index + 1,
                        borderColor: c.cardBg,
                      };
                      return photo ? (
                        <Image
                          key={item.logId || `${row.key}-${index}`}
                          source={{ uri: photo }}
                          style={[styles.mealThumb, stack]}
                        />
                      ) : (
                        <View
                          key={item.logId || `${row.key}-${index}`}
                          style={[
                            styles.mealThumb,
                            styles.mealThumbFallback,
                            stack,
                            { backgroundColor: colors.primarySoft },
                          ]}
                        >
                          <Text style={[styles.mealThumbLetter, { color: colors.primary, fontFamily: snPro('700') }]}>
                            {(item.name || '?').slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      );
                    })}
                    <Pressable
                      onPress={() => openFeature('AddFood', { meal: row.key })}
                      hitSlop={6}
                      accessibilityLabel={`Add ${row.label}`}
                      style={[styles.mealAdd, { backgroundColor: isDark ? c.chip : colors.primarySoft }]}
                    >
                      <Plus size={16} color={colors.primary} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Coach */}
        <Pressable onPress={() => openFeature('Coach')} style={[styles.coach, { backgroundColor: '#1e5e24' }]}>
          <Sparkles size={22} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.coachTitle, { fontFamily: poppins('600') }]}>{coachTip.title}</Text>
            <Text style={[styles.coachSub, { fontFamily: snPro('400') }]}>{coachTip.sub}</Text>
          </View>
          <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>

        {/* More tools */}
        {tools.length ? (
          <View style={styles.tools}>
            {tools.map((t) => (
              <Pressable
                key={t.label}
                onPress={() => (t.always ? navigation.navigate(t.route) : openFeature(t.route))}
                style={[styles.tool, { backgroundColor: card, borderColor: isDark ? c.border : '#cfe3c7' }]}
              >
                <t.Icon size={15} color={isDark ? c.text : colors.primaryDark} />
                <Text style={[styles.toolLbl, { color: isDark ? c.text : colors.primaryDark, fontFamily: snPro('700') }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Health overview */}
        <Pressable
          onPress={() => navigation.navigate('HealthOverview')}
          style={[styles.overviewBtn, { backgroundColor: card, borderColor: isDark ? c.border : '#cfe3c7' }]}
        >
          <Text style={[styles.overviewText, { color: isDark ? c.text : colors.primaryDark, fontFamily: snPro('700') }]}>
            See your health overview
          </Text>
          <ChevronRight size={15} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.4} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerFixed: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0 },
  helloSub: { fontSize: 13 },
  helloName: { fontSize: 20, lineHeight: 26 },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 10 },
  summary: { borderRadius: 20, padding: 16, gap: 14 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { fontSize: 16 },
  summaryLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  summaryLink: { fontSize: 13 },
  summaryMain: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringNum: { fontSize: 22, lineHeight: 27 },
  ringSub: { fontSize: 11 },
  summaryBody: { flex: 1, minWidth: 0, gap: 8 },
  leftNum: { fontSize: 22, lineHeight: 28 },
  leftUnit: { fontSize: 13 },
  macroLine: { gap: 4 },
  macroLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  macroName: { fontSize: 12 },
  macroVal: { fontSize: 12 },
  macroBar: { height: 6, borderRadius: 6, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 6 },
  goalStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  goalDots: { flexDirection: 'row', gap: 4 },
  goalDot: { width: 14, height: 6, borderRadius: 3 },
  goalText: { flex: 1, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 14, padding: 10 },
  tileLbl: { fontSize: 11 },
  tileVal: { fontSize: 15, lineHeight: 21 },
  tileSub: { fontSize: 10 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quick: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 6 },
  quickIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  quickLbl: { fontSize: 12 },
  section: { fontSize: 17, marginBottom: 10, letterSpacing: -0.2 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionInline: { marginBottom: 0 },
  sectionLink: { fontSize: 13 },
  mealList: { gap: 10 },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mealBody: { flex: 1, minWidth: 0 },
  mealTitle: { fontSize: 15 },
  mealCalRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  mealSub: { fontSize: 12 },
  mealRight: { flexDirection: 'row', alignItems: 'center' },
  mealThumb: { width: 38, height: 38, borderRadius: 18, borderWidth: 3 },
  mealThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  mealThumbLetter: { fontSize: 11 },
  mealAdd: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  coach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  coachTitle: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  coachSub: { color: '#d7f0c9', fontSize: 12, lineHeight: 17 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  toolLbl: { fontSize: 13 },
  overviewBtn: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overviewText: { fontSize: 14 },
});
