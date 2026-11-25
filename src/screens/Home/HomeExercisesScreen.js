import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, TextInput } from 'react-native';
import {
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Armchair,
  ChartColumn,
  Activity,
  Search,
  X,
} from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import SelectField from '../../components/common/SelectField';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { useExerciseCatalog, useExerciseCatalogStatus } from '../../context/ExerciseCatalogContext';
import LoadingScreen from '../../components/common/LoadingScreen';
import { Image } from 'expo-image';
import { useWorkoutProgress, useWorkoutSessions } from '../../utils/workoutProgress';
import {
  CATEGORIES,
  EXERCISES,
  LEVELS,
  ROUTINES,
  levelOf,
  routineMinutes,
  BODY_PARTS,
  EQUIPMENT,
  bodyPartsOf,
  equipmentOf,
  suggestedLevel,
  workoutPlanFor,
} from '../../data/homeExercises';

const ALL = 'all';

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

const SAFETY = {
  gentle:
    'Gentle moves for older adults and beginners — most can be done seated or holding a chair. Go slowly, breathe normally, and stop if you feel pain, dizziness or chest discomfort. Check with your doctor if you have a health condition.',
  active:
    'Higher-effort cardio, strength and core for young and fit users. Warm up first, keep good form, drink water, and stop if you feel pain, dizziness or chest discomfort.',
};

/** Home exercises in two levels (Gentle / Active). Sessions log to the diary when finished. */
export default function HomeExercisesScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { profile, updateProfile } = useDiary();
  const { isSignedIn, updateHealthProfile } = useAuth();
  const progress = useWorkoutProgress();
  // Every routine left half-way today (each one can be continued on its own).
  const openSessions = useWorkoutSessions();
  const openByRoutine = useMemo(
    () => new Map(openSessions.filter((s) => s.routineId).map((s) => [s.routineId, s])),
    [openSessions],
  );
  // Re-read the lists when the admin changes the catalog.
  const catalog = useExerciseCatalog();
  const { status: catalogStatus, refresh: refreshCatalog } = useExerciseCatalogStatus();
  const plan = useMemo(() => workoutPlanFor(profile), [profile, catalog]);
  // "Older or younger?" is set at sign-up (or in Profile → Workout preference), so only ask
  // when it was never chosen.
  const hasLevel = ['gentle', 'active'].includes(profile?.workoutLevel);
  const [confirmed, setConfirmed] = useState(hasLevel);
  const [draftLevel, setDraftLevel] = useState(plan.level);
  const [level, setLevel] = useState(plan.level);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState(ALL);
  const [equipment, setEquipment] = useState(ALL);

  // Profile loaded later or changed in Workout preference → follow it.
  useEffect(() => {
    if (!hasLevel) return;
    setLevel(profile.workoutLevel);
    setConfirmed(true);
  }, [hasLevel, profile?.workoutLevel]);

  // Daily routine for the level shown right now.
  const levelPlan = useMemo(() => workoutPlanFor({ ...profile, workoutLevel: level }), [profile, level, catalog]);
  const categories = useMemo(() => CATEGORIES.filter((x) => levelOf(x) === level), [level, catalog]);
  // The user's daily routine first.
  const routines = useMemo(
    () =>
      ROUTINES.filter((r) => levelOf(r) === level).sort(
        (a, b) => (b.id === plan.routine?.id) - (a.id === plan.routine?.id),
      ),
    [level, plan.routine?.id, catalog],
  );
  const levelExercises = useMemo(() => EXERCISES.filter((e) => levelOf(e) === level), [level, catalog]);
  // Only offer body parts / equipment this level actually has.
  const bodyParts = useMemo(
    () => BODY_PARTS.filter((b) => levelExercises.some((e) => bodyPartsOf(e).includes(b.id))),
    [levelExercises],
  );
  const equipmentOptions = useMemo(
    () => [
      { id: ALL, label: 'Any' },
      ...EQUIPMENT.filter((q) => levelExercises.some((e) => equipmentOf(e) === q.id)),
    ],
    [levelExercises],
  );
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return levelExercises.filter(
      (e) =>
        (category === ALL || e.category === category) &&
        (bodyPart === ALL || bodyPartsOf(e).includes(bodyPart)) &&
        (equipment === ALL || equipmentOf(e) === equipment) &&
        (!q || `${e.name} ${e.target || ''}`.toLowerCase().includes(q)),
    );
  }, [levelExercises, category, bodyPart, equipment, query]);

  /** Switch level and remember it (device + account) so Home and the player use it too. */
  const pickLevel = (id) => {
    setLevel(id);
    setCategory(ALL);
    setBodyPart(ALL);
    setEquipment(ALL);
    if (id === profile?.workoutLevel) return;
    const changes = {
      workoutLevel: id,
      workoutRoutine: id === plan.level ? plan.routine?.id || '' : '',
    };
    updateProfile(changes);
    if (isSignedIn) updateHealthProfile(changes);
  };
  const catById = useMemo(() => Object.fromEntries(CATEGORIES.map((x) => [x.id, x])), [catalog]);

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const divider = isDark ? c.border : '#eef2ec';
  const tileBg = isDark ? '#1A2A1A' : colors.primarySoft;
  const card = { backgroundColor: c.cardBg, ...(isDark ? { borderWidth: 1, borderColor: c.border } : null) };
  const levelLabel = LEVELS.find((l) => l.id === level)?.label;

  // Today's workout: resume an unfinished session, otherwise start the daily routine.
  const fallbackRoutine = levelPlan.routine;
  const resume = Boolean(progress);
  const showHero = resume || Boolean(fallbackRoutine);
  const openWorkout = () => {
    if (resume) {
      navigation.navigate('HomeWorkoutPlayer', {
        routineId: progress.routineId || undefined,
        exerciseId: progress.exerciseId || undefined,
        resume: true,
      });
    } else if (fallbackRoutine) {
      navigation.navigate('HomeWorkoutPlayer', { routineId: fallbackRoutine.id });
    }
  };

  const header = (subtitle) => (
    <View style={styles.header}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.back, CARD_SHADOW, { backgroundColor: c.cardBg }]}
      >
        <ChevronLeft size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.6} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Exercises at home</Text>
        <Text style={[styles.subtitle, { color: muted, fontFamily: snPro('400') }]}>{subtitle}</Text>
      </View>
    </View>
  );

  const chip = (key, label, on, onPress) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: on ? colors.primary : c.cardBg,
          borderColor: on ? colors.primary : isDark ? c.border : '#cfe3c7',
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: on ? '#FFF' : isDark ? c.text : '#1f2937', fontFamily: snPro(on ? '700' : '600') },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  // Nothing from the server yet (first open): loader, or a retry when it could not be reached.
  if (!EXERCISES.length) {
    return (
      <ScreenShell>
        <View style={styles.scroll}>{header(catalogStatus === 'error' ? 'Could not load' : 'Loading…')}</View>
        {catalogStatus === 'error' ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.askTitle, { color: ink, fontFamily: FONT.heading, textAlign: 'center' }]}>
              Exercises could not load
            </Text>
            <Text style={[styles.askSub, { color: muted, fontFamily: snPro('400'), textAlign: 'center' }]}>
              Check your internet connection and try again.
            </Text>
            <AppButton label="Try again" onPress={refreshCatalog} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          </View>
        ) : (
          <LoadingScreen message="Loading exercises…" />
        )}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      {!confirmed ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {header('Choose who is exercising')}
            <View>
              <Text style={[styles.askTitle, { color: ink, fontFamily: FONT.heading }]}>Who is exercising?</Text>
              <Text style={[styles.askSub, { color: muted, fontFamily: snPro('400') }]}>
                We show different exercises for older and younger adults. Pick one and tap Continue — you can
                change it later in Profile → Workout preference.
              </Text>
            </View>
            {LEVELS.map((l) => {
              const on = draftLevel === l.id;
              const suggested = l.id === suggestedLevel(profile?.age);
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setDraftLevel(l.id)}
                  style={({ pressed }) => [
                    styles.askCard,
                    CARD_SHADOW,
                    {
                      backgroundColor: on ? tileBg : c.cardBg,
                      borderColor: on ? colors.primary : isDark ? c.border : 'transparent',
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <View style={[styles.radio, { borderColor: on ? colors.primary : isDark ? c.border : '#cfe3c7' }]}>
                    {on ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.askCardTitle, { color: ink, fontFamily: poppins('600') }]}>{l.label}</Text>
                    <Text style={[styles.askCardSub, { color: muted, fontFamily: snPro('400') }]}>{l.hint}</Text>
                    {l.id === profile?.workoutLevel ? (
                      <Text style={[styles.tag, { color: colors.primary, fontFamily: snPro('700'), marginTop: 6 }]}>
                        LAST TIME
                      </Text>
                    ) : suggested && Number(profile?.age) ? (
                      <Text style={[styles.tag, { color: colors.primary, fontFamily: snPro('700'), marginTop: 6 }]}>
                        SUGGESTED FOR AGE {profile.age}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.askFooter}>
            <AppButton
              label="Continue"
              size="lg"
              onPress={() => {
                pickLevel(draftLevel);
                setConfirmed(true);
              }}
            />
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {header(`${levelLabel ? `${levelLabel} · ` : ''}${list.length} exercises`)}

          {showHero ? (
            <View style={styles.hero}>
              <Text style={[styles.heroKicker, { fontFamily: snPro('600') }]}>
                {resume ? 'Continue exercise' : 'Today’s workout'}
              </Text>
              <Text style={[styles.heroTitle, { fontFamily: FONT.heading }]} numberOfLines={2}>
                {resume ? progress.title : fallbackRoutine.name}
              </Text>
              <Text style={[styles.heroSub, { fontFamily: snPro('400') }]} numberOfLines={1}>
                {resume
                  ? `Move ${progress.index + 1} of ${progress.total}${
                      openSessions.length > 1
                        ? ` · +${openSessions.length - 1} more unfinished below`
                        : ''
                    }`
                  : `${routineMinutes(fallbackRoutine)} min · ${fallbackRoutine.exercises.length} moves`}
              </Text>
              <Pressable
                onPress={openWorkout}
                accessibilityRole="button"
                accessibilityLabel={resume ? 'Continue exercise' : 'Start today’s workout'}
                style={({ pressed }) => [styles.heroBtn, { opacity: pressed ? 0.9 : 1 }]}
              >
                {resume ? (
                  <RotateCcw size={16} color="#1e5e24" strokeWidth={2.4} />
                ) : (
                  <Play size={16} color="#1e5e24" fill="#1e5e24" />
                )}
                <Text style={[styles.heroBtnText, { fontFamily: poppins('600') }]}>{resume ? 'Continue' : 'Start'}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.safety, { backgroundColor: tileBg }, isDark ? { borderWidth: 1, borderColor: c.border } : null]}>
            <ShieldCheck size={18} color={colors.primary} />
            <Text style={[styles.safetyText, { color: ink, fontFamily: snPro('400') }]}>{SAFETY[level]}</Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('ExerciseReport')}
            style={({ pressed }) => [styles.listCard, styles.singleRow, CARD_SHADOW, card, { opacity: pressed ? 0.92 : 1 }]}
          >
            <View style={[styles.tile, { backgroundColor: tileBg }]}>
              <ChartColumn size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: ink, fontFamily: snPro('700') }]}>My exercise report</Text>
              <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('400') }]}>
                Minutes, active days and sessions this week
              </Text>
            </View>
            <ChevronRight size={14} color={isDark ? c.muted : '#6b7280'} strokeWidth={2.4} />
          </Pressable>

          <Text style={[styles.section, { color: ink, fontFamily: poppins('600') }]}>Guided sessions</Text>
          {routines.length ? (
            <View style={[styles.listCard, CARD_SHADOW, card]}>
              {routines.map((r, i) => {
                const open = openByRoutine.get(r.id);
                return (
                <Pressable
                  key={r.id}
                  onPress={() => navigation.navigate('HomeWorkoutPlayer', { routineId: r.id })}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: 1, borderTopColor: divider },
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={[styles.tile, { backgroundColor: tileBg }]}>
                    {open ? (
                      <RotateCcw size={18} color={colors.primary} strokeWidth={2.4} />
                    ) : (
                      <Play size={18} color={colors.primary} fill={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    {open ? (
                      <Text style={[styles.tag, { color: '#d97706', fontFamily: snPro('800') }]}>
                        CONTINUE · MOVE {open.index + 1} OF {open.total}
                      </Text>
                    ) : r.id === plan.routine?.id ? (
                      <Text style={[styles.tag, { color: colors.primary, fontFamily: snPro('700') }]}>YOUR DAILY ROUTINE</Text>
                    ) : null}
                    <Text style={[styles.rowTitle, { color: ink, fontFamily: snPro('700') }]}>{r.name}</Text>
                    <Text style={[styles.rowDesc, { color: muted, fontFamily: snPro('400') }]}>{r.description}</Text>
                    <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('600') }]}>
                      {routineMinutes(r)} min · {r.exercises.length} moves{r.rounds > 1 ? ` × ${r.rounds} rounds` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={isDark ? c.muted : '#6b7280'} strokeWidth={2.4} />
                </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.section, { color: ink, fontFamily: poppins('600') }]}>All exercises</Text>
          {/* Filters (canvas): search, body part chips, then type / equipment / level */}
          <View style={[styles.search, { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#cfe3c7' }]}>
            <Search size={18} color={muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={isDark ? c.muted : '#6b7280'}
              returnKeyType="search"
              style={[styles.searchInput, { color: ink, fontFamily: snPro('500') }]}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <X size={16} color={muted} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.chipWrap}>
            {chip(ALL, 'All', bodyPart === ALL, () => setBodyPart(ALL))}
            {bodyParts.map((b) => chip(b.id, b.label, bodyPart === b.id, () => setBodyPart(b.id)))}
          </View>
          <View style={styles.selectRow}>
            <SelectField
              label="Type"
              value={category}
              options={[{ id: ALL, label: 'All types' }, ...categories.map((x) => ({ id: x.id, label: x.label }))]}
              onChange={setCategory}
            />
            <SelectField label="Equipment" value={equipment} options={equipmentOptions} onChange={setEquipment} />
          </View>
          <SelectField
            label="Level"
            value={level}
            options={LEVELS.map((l) => ({ id: l.id, label: `${l.label} · ${l.hint.split(' · ')[1] || l.hint}` }))}
            onChange={pickLevel}
          />
          <Text style={[styles.count, { color: muted, fontFamily: snPro('600') }]}>
            {list.length} exercise{list.length === 1 ? '' : 's'}
          </Text>

          {!list.length ? (
            <View style={[styles.listCard, styles.empty, CARD_SHADOW, card]}>
              <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('500'), textAlign: 'center' }]}>
                No exercises match these filters.
              </Text>
              <Pressable
                onPress={() => {
                  setQuery('');
                  setBodyPart(ALL);
                  setEquipment(ALL);
                  setCategory(ALL);
                }}
                hitSlop={8}
              >
                <Text style={[styles.rowTitle, { color: colors.primary, fontFamily: snPro('700') }]}>Clear filters</Text>
              </Pressable>
            </View>
          ) : null}

          {list.length ? (
            <View style={[styles.listCard, CARD_SHADOW, card]}>
              {list.map((e, i) => {
                const cat = catById[e.category];
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => navigation.navigate('HomeExerciseDetail', { id: e.id })}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && { borderTopWidth: 1, borderTopColor: divider },
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={[styles.tile, { backgroundColor: e.gifUrl ? '#F5F5F5' : tileBg }]}>
                      {e.gifUrl ? (
                        // Demo GIF from the admin panel (Cloudinary), shown as a small still-moving thumbnail.
                        <Image
                          source={{ uri: e.gifUrl }}
                          style={styles.thumb}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          autoplay
                          accessibilityIgnoresInvertColors
                        />
                      ) : e.chair ? (
                        <Armchair size={20} color={colors.primary} />
                      ) : (
                        <Activity size={20} color={colors.primary} />
                      )}
                      <View style={[styles.catDot, { backgroundColor: cat?.color || colors.primary, borderColor: tileBg }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: ink, fontFamily: snPro('700') }]}>{e.name}</Text>
                      <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('400') }]}>
                        {e.target} · {EQUIPMENT.find((q) => q.id === equipmentOf(e))?.label} ·{' '}
                        {Math.round(e.seconds / 60) || 1} min
                      </Text>
                    </View>
                    <ChevronRight size={14} color={isDark ? c.muted : '#6b7280'} strokeWidth={2.4} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20 },
  subtitle: { fontSize: 12, marginTop: 1 },
  askTitle: { fontSize: 22, lineHeight: 28, marginTop: 4 },
  askSub: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  askCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
  },
  askCardTitle: { fontSize: 17 },
  askCardSub: { fontSize: 13, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  askFooter: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  kicker: { fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  hero: { backgroundColor: '#1e5e24', borderRadius: 20, padding: 18 },
  heroKicker: { color: '#d7f0c9', fontSize: 12 },
  heroTitle: { color: '#FFF', fontSize: 20, lineHeight: 26, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  heroBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 99,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroBtnText: { color: '#1e5e24', fontSize: 15 },
  safety: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 14 },
  safetyText: { flex: 1, fontSize: 13, lineHeight: 19 },
  section: { fontSize: 16, marginTop: 6 },
  listCard: { borderRadius: 16, paddingHorizontal: 14 },
  singleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '100%', height: '100%', borderRadius: 12 },
  emptyWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  catDot: { position: 'absolute', right: 4, top: 4, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  tag: { fontSize: 10, letterSpacing: 0.8, marginBottom: 2 },
  rowTitle: { fontSize: 14 },
  rowDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  rowSub: { fontSize: 12, marginTop: 2 },
  chips: { gap: 8 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 13 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: {
    height: 48,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  selectRow: { flexDirection: 'row', gap: 10 },
  count: { fontSize: 12 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
});
