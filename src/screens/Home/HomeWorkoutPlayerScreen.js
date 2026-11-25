import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { Pause, Play, SkipBack, SkipForward, CircleCheck, Square, ChevronLeft, Volume2, VolumeX } from 'lucide-react-native';
import useWorkoutSounds from '../../hooks/useWorkoutSounds';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import AppButton from '../../components/common/AppButton';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useTheme } from '../../context/ThemeContext';
import { useExerciseCatalog, useExerciseCatalogStatus } from '../../context/ExerciseCatalogContext';
import { useDiary } from '../../context/DiaryContext';
import { FONT, snPro, poppins } from '../../config/fonts';
import { toast } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';
import { setSessionDone } from '../../utils/programProgress';
import { getExercise, getRoutine, routineExercises, burnedMoves, levelOf } from '../../data/homeExercises';
import ExerciseDemo, { hasExerciseDemo } from '../../components/common/ExerciseDemo';
import WavyProgressRing from '../../components/common/WavyProgressRing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWorkoutProgress, saveWorkoutProgress, clearWorkoutProgress } from '../../utils/workoutProgress';

function mmss(total) {
  const s = Math.max(0, Math.ceil(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Per level: rest between moves, safety banner and text size. */
const LEVEL_UI = {
  gentle: {
    badge: 'GENTLE',
    badgeColor: '#4A8245',
    rest: 20,
    restTitle: 'Take a breather',
    tip: 'Move slowly and hold a chair or wall for support. Stop if you feel dizzy or out of breath.',
    big: true,
  },
  active: {
    badge: 'ACTIVE',
    badgeColor: '#FF3B30',
    rest: 15,
    restTitle: 'Rest',
    tip: 'Push hard but keep good form. Breathe out on the effort and sip water between rounds.',
    big: false,
  },
};

/**
 * Session state. `spent` = seconds actually exercised per move (only counts while a move runs,
 * not during rest), so ending early or skipping logs real time, not the planned time.
 */
function reducer(state, action) {
  const { moves } = state;
  const goTo = (index) => ({ ...state, resting: false, index, remaining: moves[index].seconds });
  switch (action.type) {
    case 'tick': {
      if (!state.running || state.finished) return state;
      if (state.resting) {
        // Rest only counts down — the next move starts when the user taps "Next exercise".
        const remaining = Math.max(0, state.remaining - 1);
        return { ...state, remaining, running: remaining > 0 };
      }
      const spent = [...state.spent];
      spent[state.index] += 1;
      const remaining = state.remaining - 1;
      if (remaining > 0) return { ...state, spent, remaining };
      if (state.index + 1 < moves.length) {
        // Move done → rest screen and wait for the user (no auto-start of the next move).
        return { ...state, spent, resting: true, remaining: state.rest, running: state.rest > 0 };
      }
      return { ...state, spent, remaining: 0, running: false, finished: true };
    }
    case 'toggle':
      return state.finished ? state : { ...state, running: !state.running };
    case 'next':
      if (state.index + 1 >= moves.length) return { ...state, running: false, finished: true };
      return { ...goTo(state.index + 1), running: false }; // skipped move waits for Play
    case 'startNext': // "Next exercise" on the rest screen — the user is ready, start right away
      if (state.index + 1 >= moves.length) return { ...state, running: false, finished: true };
      return { ...goTo(state.index + 1), running: true };
    case 'prev':
      return { ...goTo(state.resting ? state.index : Math.max(0, state.index - 1)), running: false };
    case 'finish': // "End workout" before the last move
      return { ...state, running: false, finished: true, endedEarly: true };
    case 'restart': // "Start over" on a continued session
      return {
        ...state,
        index: 0,
        remaining: moves[0]?.seconds || 0,
        running: false,
        finished: false,
        resting: false,
        endedEarly: false,
        resumed: false,
        spent: moves.map(() => 0),
      };
    default:
      return state;
  }
}

/**
 * Waits for the exercise catalog before starting the player. "Continue exercise" can open this
 * screen from saved progress alone, before the catalog has loaded (first launch, slow server).
 * The player reads its moves once when it opens, so it only opens when they exist.
 */
export default function HomeWorkoutPlayerScreen(props) {
  const { navigation, route } = props;
  const { themeColors: c } = useTheme();
  const catalog = useExerciseCatalog();
  const { status, refresh } = useExerciseCatalogStatus();
  const routineParam = route.params?.routineId;
  const exerciseParam = route.params?.exerciseId;
  const found = useMemo(
    () => Boolean(getRoutine(routineParam) || getExercise(exerciseParam)),
    // `catalog` changes when the list arrives or the admin edits it.
    [routineParam, exerciseParam, catalog],
  );

  if (!found && status === 'loading') {
    return <LoadingScreen message="Loading exercises…" />;
  }
  if (!found && status === 'error') {
    return (
      <ScreenShell>
        <ScreenHeader title="Session" onBack={() => navigation.goBack()} theme={c} />
        <View style={{ padding: 20 }}>
          <Text style={{ color: c.muted, marginBottom: 16 }}>
            Exercises could not load. Check your internet connection and try again.
          </Text>
          <AppButton label="Try again" onPress={refresh} />
        </View>
      </ScreenShell>
    );
  }
  // A new key opens a fresh player once the moves arrive (a newer catalog can add them).
  return <WorkoutPlayer key={found ? 'play' : 'empty'} {...props} />;
}

function WorkoutPlayer({ navigation, route }) {
  useKeepAwake(); // screen stays on during the session
  const { colors, isDark, themeColors: c } = useTheme();
  const { upsertExercise, profile } = useDiary();
  const { accessToken } = useAuth();
  const [saved, setSaved] = useState(false);
  const insets = useSafeAreaInsets();

  const { title, moves, level, perRound, rounds } = useMemo(() => {
    const routine = getRoutine(route.params?.routineId);
    if (routine) {
      return {
        title: routine.name,
        moves: routineExercises(routine),
        level: levelOf(routine),
        perRound: routine.exercises.length,
        rounds: Math.max(1, Number(routine.rounds) || 1),
      };
    }
    const single = getExercise(route.params?.exerciseId);
    return {
      title: single?.name || 'Exercise',
      moves: single ? [single] : [],
      level: levelOf(single),
      perRound: 1,
      rounds: 1,
    };
  }, [route.params?.routineId, route.params?.exerciseId]);
  const ui = LEVEL_UI[level] || LEVEL_UI.gentle;

  const routineId = route.params?.routineId || null;
  const exerciseId = routineId ? null : route.params?.exerciseId || null;

  const [state, dispatch] = useReducer(reducer, null, () => {
    const base = {
      moves,
      index: 0,
      remaining: moves[0]?.seconds || 0,
      running: false,
      finished: false,
      resting: false,
      rest: moves.length > 1 ? ui.rest : 0,
      spent: moves.map(() => 0),
    };
    // Today's unfinished run of this same routine / exercise: continue it (from Continue or from the list).
    // Each routine keeps its own, so leaving two routines half-way keeps both.
    const saved = getWorkoutProgress({ routineId, exerciseId });
    if (saved && saved.spent.length === moves.length && moves[saved.index]) {
      return {
        ...base,
        index: saved.index,
        remaining: saved.remaining || moves[saved.index].seconds,
        spent: saved.spent,
        logId: saved.logId || null,
        programId: saved.programId || null,
        programSessionId: saved.programSessionId || null,
        resumed: true,
      };
    }
    return base;
  });

  // One diary entry per session: written when the user pauses / leaves (marked not finished)
  // and replaced when they finish, so what they did is never lost or counted twice.
  const logIdRef = useRef(state.logId || `ex-${Date.now()}`);
  // Program session this run belongs to: from the program screen, or kept with a saved run
  // that is continued later (Continue on Home / Exercises opens the player without it).
  const programRef = useRef(
    route.params?.programId && route.params?.programSessionId
      ? { programId: route.params.programId, programSessionId: route.params.programSessionId }
      : state.programId && state.programSessionId
        ? { programId: state.programId, programSessionId: state.programSessionId }
        : null,
  );

  useEffect(() => {
    if (!state.running) return undefined;
    const t = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(t);
  }, [state.running]);

  // Remember where the user is, so they can continue later today (Home + Exercises screens).
  const latest = useRef(state);
  latest.current = state;
  const remember = useCallback(() => {
    const s = latest.current;
    if (s.finished || !s.spent.some((v) => v > 0)) return;
    const index = s.resting ? s.index + 1 : s.index;
    if (!s.moves[index]) return;
    saveWorkoutProgress({
      routineId,
      exerciseId,
      logId: logIdRef.current,
      programId: programRef.current?.programId || null,
      programSessionId: programRef.current?.programSessionId || null,
      title,
      index,
      remaining: s.resting ? s.moves[index].seconds : s.remaining,
      spent: s.spent,
      total: s.moves.length,
    });
  }, [routineId, exerciseId, title]);
  useEffect(() => {
    remember();
  }, [state.index, state.remaining, state.running, state.resting, remember]);
  useEffect(() => remember, [remember]); // also on leaving the screen
  useEffect(() => {
    if (state.finished) clearWorkoutProgress({ routineId, exerciseId });
  }, [state.finished, routineId, exerciseId]);

  /**
   * Start a continued session again from move 1. What was done before stays in the diary
   * ("not finished"); the new run gets its own entry.
   */
  const startOver = () => {
    clearWorkoutProgress({ routineId, exerciseId });
    logIdRef.current = `ex-${Date.now()}`;
    dispatch({ type: 'restart' });
  };

  const totalSpent = state.spent.reduce((s, v) => s + v, 0);
  const doneMoves = useMemo(
    () => burnedMoves(moves, state.spent, profile.weight),
    [moves, state.spent, profile.weight],
  );
  const kcal = doneMoves.reduce((s, m) => s + m.calories, 0);
  const minutes = Math.max(1, Math.round(totalSpent / 60));

  /**
   * Write (or update) this session's diary entry from what was really done: 30 s or more of movement.
   * `moves` is only the exercises that were actually done, with how many times and their calories.
   * completed=false → stopped early (End workout, back, pause); it still counts in the totals.
   */
  const logSession = useCallback(
    (s, completed) => {
      const seconds = s.spent.reduce((sum, v) => sum + v, 0);
      if (seconds < 30) return false;
      const done = burnedMoves(moves, s.spent, profile.weight);
      upsertExercise({
        logId: logIdRef.current,
        name: `${title} (home)`,
        minutes: Math.max(1, Math.round(seconds / 60)),
        calories: done.reduce((sum, m) => sum + m.calories, 0),
        moves: done,
        ...(completed ? null : { completed: false }),
      });
      return true;
    },
    [moves, profile.weight, title, upsertExercise],
  );

  // Session over (last move done, skipped to the end, or "End workout").
  useEffect(() => {
    if (!state.finished || saved) return;
    const completed = !state.endedEarly;
    if (logSession(latest.current, completed)) {
      // Part of a program session (now or when first started): tick it only when finished.
      const program = programRef.current;
      if (completed && program) {
        setSessionDone(program.programId, program.programSessionId, true, accessToken);
      }
      toast.success(completed ? 'Saved to your diary' : 'Saved what you did to your diary');
    }
    setSaved(true);
  }, [state.finished, state.endedEarly, saved, logSession, accessToken]);

  // Paused mid-session: save the time so far (not finished). It is updated again later.
  const wasRunning = useRef(state.running);
  useEffect(() => {
    if (wasRunning.current && !state.running && !state.finished) logSession(latest.current, false);
    wasRunning.current = state.running;
  }, [state.running, state.finished, logSession]);

  // Left the screen without finishing (back button / swipe): keep what was done.
  const logSessionRef = useRef(logSession);
  logSessionRef.current = logSession;
  useEffect(
    () => () => {
      if (!latest.current.finished) logSessionRef.current(latest.current, false);
    },
    [],
  );

  // ---- Sound cues (only watch the state — the timer logic above is unchanged) ----
  //  • 3, 2, 1 left on a running move or rest → "bip"
  //  • the countdown runs out (move → rest, rest → 0, last move → done) → whistle
  //  • a move starts (Start / Resume / "Start: next") → whistle. Pausing is silent.
  const { soundOn, toggleSound, playBip, playWhistle } = useWorkoutSounds();
  const prevCue = useRef({
    remaining: state.remaining,
    running: state.running,
    resting: state.resting,
    index: state.index,
    finished: state.finished,
  });
  useEffect(() => {
    const prev = prevCue.current;
    prevCue.current = {
      remaining: state.remaining,
      running: state.running,
      resting: state.resting,
      index: state.index,
      finished: state.finished,
    };

    // The last second ran out on its own (a tick, not a button).
    const timeUp =
      prev.running &&
      prev.remaining === 1 &&
      (state.remaining === 0 || state.resting !== prev.resting || state.index !== prev.index || state.finished);
    if (timeUp) {
      playWhistle();
      return;
    }
    // A move began: Start / Resume / "Start: next exercise".
    if (!prev.running && state.running && !state.resting && !state.finished) {
      playWhistle();
      return;
    }
    if (state.running && state.remaining !== prev.remaining && state.remaining >= 1 && state.remaining <= 3) {
      playBip();
    }
  }, [state.remaining, state.running, state.resting, state.index, state.finished, playBip, playWhistle]);

  if (!moves.length) {
    return (
      <ScreenShell>
        <ScreenHeader title="Session" onBack={() => navigation.goBack()} theme={c} />
        <Text style={{ padding: 20, color: c.muted }}>Nothing to play.</Text>
      </ScreenShell>
    );
  }

  if (state.finished) {
    return (
      <ScreenShell>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} theme={c} />
        <View style={styles.doneWrap}>
          <CircleCheck size={64} color={colors.primary} />
          <Text style={[styles.doneTitle, { color: c.text, fontFamily: FONT.heading }]}>Well done!</Text>
          <Text style={[styles.doneSub, { color: c.muted, fontFamily: snPro('500') }]}>
            {mmss(totalSpent)} of movement · about {kcal} kcal
          </Text>
          {totalSpent >= 30 ? (
            <View style={[styles.savedPill, { backgroundColor: isDark ? '#1A2A1A' : colors.primarySoft }]}>
              <CircleCheck size={15} color={colors.primary} />
              <Text style={[styles.savedText, { color: colors.primary, fontFamily: snPro('700') }]}>
                {saved ? 'Saved to your diary' : 'Saving…'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.doneSub, { color: c.muted, marginTop: 16 }]}>
              Less than 30 seconds — not saved.
            </Text>
          )}
          <AppButton
            label="Done"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 24, alignSelf: 'stretch' }}
          />
        </View>
      </ScreenShell>
    );
  }

  const resting = state.resting;
  // While resting, show the move that comes next so the user can get ready.
  const move = resting ? moves[state.index + 1] : moves[state.index];
  const next = resting ? null : moves[state.index + 1];
  const total = resting ? state.rest : move.seconds;
  const progress = total ? 1 - state.remaining / total : 0;
  const hasDemo = hasExerciseDemo(move.id);
  const posInRound = (state.index % perRound) + 1;
  const round = Math.floor(state.index / perRound) + 1;
  const counter =
    moves.length <= 1
      ? 'EXERCISE'
      : rounds > 1
        ? `ROUND ${round} OF ${rounds} · MOVE ${posInRound} OF ${perRound}`
        : `MOVE ${state.index + 1} OF ${moves.length}`;
  const barColor = resting ? '#26C6DA' : colors.primary;
  const big = ui.big;
  const nowIdx = resting ? state.index + 1 : state.index;
  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const cardBg = isDark ? c.cardBg : '#FFFFFF';
  const rowLine = isDark ? c.border : '#eef2ec';
  const endColor = isDark ? colors.danger : '#9b2c1f';
  const statusText = resting
    ? state.remaining > 0
      ? 'rest'
      : 'ready?'
    : state.running
      ? 'keep going'
      : totalSpent
        ? 'paused'
        : 'tap start';

  const accent = resting ? '#26C6DA' : colors.primary;
  const ringTrack = isDark ? '#242424' : '#e7f1e3';
  const tint = isDark ? 'rgba(124,196,127,0.16)' : colors.primarySoft;
  const tintText = isDark ? '#8fd192' : '#1e5e24';
  const pageBg = c.pageBg || (isDark ? '#000000' : '#F8F9FA');

  return (
    <ScreenShell>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, CARD_SHADOW, { backgroundColor: cardBg }]}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color={ink} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: ink, fontFamily: poppins('600') }]}>
          {title}
        </Text>
        <Pressable
          onPress={toggleSound}
          style={[styles.backBtn, CARD_SHADOW, { backgroundColor: cardBg }]}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityState={{ checked: soundOn }}
          accessibilityLabel={soundOn ? 'Sound on — tap to mute' : 'Sound off — tap to turn on'}
        >
          {soundOn ? <Volume2 size={18} color={ink} /> : <VolumeX size={18} color={muted} />}
        </Pressable>
        {totalSpent > 0 ? (
          <Pressable
            onPress={() => dispatch({ type: 'finish' })}
            style={[styles.endPill, CARD_SHADOW, { backgroundColor: cardBg }]}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Square size={12} color={endColor} />
            <Text style={[styles.endText, { color: endColor, fontFamily: snPro('700') }]}>End</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 132 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* One session card: progress, timer and the move together */}
        <View style={[styles.sessionCard, CARD_SHADOW, { backgroundColor: cardBg, borderColor: rowLine }]}>
          <View style={styles.metaRow}>
            <View style={[styles.levelBadge, { backgroundColor: `${ui.badgeColor}1A` }]}>
              <Text style={[styles.levelBadgeText, { color: ui.badgeColor, fontFamily: snPro('800') }]}>{ui.badge}</Text>
            </View>
            <Text style={[styles.counter, { color: muted, fontFamily: snPro('700') }]} numberOfLines={1}>
              {counter}
            </Text>
          </View>

          {moves.length > 1 ? (
            <View style={styles.segments}>
              {moves.map((m, i) => (
                <View
                  key={`seg-${m.id}-${i}`}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: i < nowIdx ? colors.primary : i === nowIdx ? accent : ringTrack,
                      opacity: i === nowIdx ? 0.55 : 1,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}

          {state.resumed && !state.running ? (
            <View style={[styles.resumeBar, { backgroundColor: tint }]}>
              <Text style={[styles.resumeText, { color: ink, fontFamily: snPro('600') }]} numberOfLines={1}>
                Continuing from move {nowIdx + 1} of {moves.length}
              </Text>
              <Pressable onPress={startOver} hitSlop={8} accessibilityRole="button" accessibilityLabel="Start over">
                <Text style={[styles.resumeLink, { color: colors.primary, fontFamily: snPro('800') }]}>Start over</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.heroRow}>
            {/* Material 3 expressive style: the wave keeps drifting the whole time */}
            <WavyProgressRing
              size={136}
              stroke={10}
              progress={Math.min(1, Math.max(0, progress))}
              color={accent}
              trackColor={ringTrack}
              waves={12}
              amplitude={3}
              animate
            >
              <Text style={[styles.time, { color: ink, fontFamily: FONT.heading }]}>{mmss(state.remaining)}</Text>
              <Text
                style={[styles.timeSub, styles.ringSub, { color: muted, fontFamily: snPro('600') }]}
                numberOfLines={1}
              >
                {statusText}
              </Text>
            </WavyProgressRing>
            <View style={styles.heroText}>
              <View style={[styles.nowPill, { backgroundColor: resting ? 'rgba(38,198,218,0.14)' : tint }]}>
                <Text style={[styles.nowPillText, { color: resting ? '#1ba5b8' : tintText, fontFamily: snPro('800') }]}>
                  {resting ? `${ui.restTitle.toUpperCase()} · UP NEXT` : 'NOW'}
                </Text>
              </View>
              <Text
                style={[styles.moveName, big && styles.moveNameBig, { color: ink, fontFamily: poppins('600') }]}
                numberOfLines={3}
              >
                {move.name}
              </Text>
              <Text style={[styles.moveTime, { color: muted, fontFamily: snPro('600') }]} numberOfLines={1}>
                {mmss(move.seconds)}
                {next ? `  ·  Next: ${next.name}` : ''}
              </Text>
            </View>
          </View>

          {hasDemo ? (
            <View style={[styles.demo, { opacity: resting ? 0.6 : 1 }]}>
              <ExerciseDemo exerciseId={move.id} size={170} />
            </View>
          ) : null}
        </View>

        {state.index === 0 && !totalSpent && !resting ? (
          <View style={[styles.tip, { backgroundColor: `${ui.badgeColor}14`, borderColor: `${ui.badgeColor}40` }]}>
            <Text style={[styles.tipText, big && { fontSize: 15, lineHeight: 22 }, { color: ink, fontFamily: snPro('600') }]}>
              {ui.tip}
            </Text>
          </View>
        ) : null}

        {/* How to do the move */}
        <View style={[styles.moveCard, CARD_SHADOW, { backgroundColor: cardBg, borderColor: rowLine }]}>
          <Text style={[styles.queueTitle, { color: ink, fontFamily: poppins('600'), paddingVertical: 0 }]}>
            How to do it
          </Text>
          <View style={styles.steps}>
            {move.how.map((step, i) => (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepNum, { backgroundColor: tint }]}>
                  <Text style={[styles.stepNumText, { color: tintText, fontFamily: snPro('800') }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, big && styles.stepBig, { color: ink, fontFamily: snPro('500') }]}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
          {move.safety ? (
            <View
              style={[
                styles.safetyBox,
                {
                  backgroundColor: isDark ? 'rgba(255,180,0,0.10)' : '#FFF7E6',
                  borderColor: isDark ? 'rgba(255,180,0,0.30)' : '#F5D9A6',
                },
              ]}
            >
              <Text style={[styles.safetyText, { color: isDark ? '#FFD58A' : '#8a5a00', fontFamily: snPro('600') }]}>
                ⚠ {move.safety}
              </Text>
            </View>
          ) : null}
        </View>

        {moves.length > 1 ? (
          <View style={[styles.queueCard, CARD_SHADOW, { backgroundColor: cardBg }]}>
            <Text style={[styles.queueTitle, { color: ink, fontFamily: poppins('600') }]}>
              Workout plan · {moves.length} moves
            </Text>
            {moves.map((m, i) => {
              const done = i < nowIdx;
              const now = i === nowIdx;
              const circleBg = done ? tint : now ? colors.primary : isDark ? '#2A2A2A' : '#eef2ec';
              const circleText = done ? tintText : now ? '#FFFFFF' : muted;
              return (
                <View
                  key={`${m.id}-${i}`}
                  style={[
                    styles.queueRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: rowLine },
                    now && { backgroundColor: isDark ? 'rgba(124,196,127,0.06)' : '#f7fcf5' },
                  ]}
                >
                  <View style={[styles.qCircle, { backgroundColor: circleBg }]}>
                    {done ? (
                      <CircleCheck size={15} color={tintText} />
                    ) : (
                      <Text style={[styles.qNum, { color: circleText, fontFamily: FONT.heading }]}>{i + 1}</Text>
                    )}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.qName,
                      { color: done ? muted : ink, fontFamily: snPro(now ? '800' : '600') },
                      done && styles.qDone,
                    ]}
                  >
                    {m.name}
                  </Text>
                  {next && i === state.index + 1 ? (
                    <Text style={[styles.qTag, { color: colors.primary, fontFamily: snPro('800') }]}>NEXT</Text>
                  ) : null}
                  <Text style={[styles.qTime, { color: muted, fontFamily: FONT.heading }]}>{mmss(m.seconds)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* Controls stay on screen — no scrolling to find Pause */}
      <View
        style={[
          styles.footer,
          { backgroundColor: pageBg, borderTopColor: rowLine, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {resting ? (
          <View>
            <AppButton
              label={`Start: ${move.name}`}
              icon={Play}
              size="lg"
              onPress={() => dispatch({ type: 'startNext' })}
            />
            <Pressable onPress={() => dispatch({ type: 'prev' })} style={styles.redoBtn} hitSlop={8}>
              <SkipBack size={14} color={muted} />
              <Text style={[styles.redoText, { color: muted, fontFamily: snPro('700') }]} numberOfLines={1}>
                Repeat {moves[state.index].name}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.controls}>
            <Pressable
              onPress={() => dispatch({ type: 'prev' })}
              disabled={state.index === 0}
              style={[styles.ctrl, CARD_SHADOW, { backgroundColor: cardBg, opacity: state.index === 0 ? 0.35 : 1 }]}
              accessibilityLabel="Previous exercise"
            >
              <SkipBack size={20} color={ink} />
            </Pressable>
            <AppButton
              label={state.running ? 'Pause' : totalSpent ? 'Resume' : 'Start'}
              icon={state.running ? Pause : Play}
              size="lg"
              onPress={() => dispatch({ type: 'toggle' })}
              style={styles.mainBtn}
              accessibilityLabel={state.running ? 'Pause' : 'Start'}
            />
            <Pressable
              onPress={() => dispatch({ type: 'next' })}
              style={[styles.ctrl, CARD_SHADOW, { backgroundColor: cardBg }]}
              accessibilityLabel="Next exercise"
            >
              <SkipForward size={20} color={ink} />
            </Pressable>
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16 },
  resumeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resumeText: { flex: 1, fontSize: 13 },
  resumeLink: { fontSize: 13 },
  endPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 9 },
  endText: { fontSize: 13 },
  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 14 },
  timerBlock: { alignItems: 'center', paddingVertical: 4 },
  sessionCard: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 12 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' },
  /** Status under the time — one short line that stays inside the ring. */
  ringSub: { maxWidth: 96, textAlign: 'center', fontSize: 11.5, textTransform: 'capitalize' },
  ringLabel: { fontSize: 10.5, letterSpacing: 1.2 },
  levelBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  levelBadgeText: { fontSize: 10, letterSpacing: 1 },
  time: { fontSize: 34, lineHeight: 40 },
  counter: { fontSize: 11, letterSpacing: 1, textAlign: 'center' },
  timeSub: { fontSize: 12, marginTop: 2 },
  bar: { alignSelf: 'stretch', height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  tip: { borderRadius: 14, borderWidth: 1, padding: 12 },
  tipText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  moveCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
  moveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nowPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  nowPillText: { fontSize: 10.5, letterSpacing: 1 },
  moveTime: { fontSize: 13 },
  moveName: { fontSize: 21, lineHeight: 26 },
  moveNameBig: { fontSize: 28, lineHeight: 34 },
  demo: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  steps: { marginTop: 12, gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 12 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  stepBig: { fontSize: 18, lineHeight: 27 },
  safetyBox: { marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 12 },
  safetyText: { fontSize: 13, lineHeight: 19 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  redoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  redoText: { fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctrl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  mainBtn: { flex: 1 },
  queueCard: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
  queueTitle: { fontSize: 15, paddingVertical: 8 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10 },
  qDone: { textDecorationLine: 'line-through' },
  qCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  qNum: { fontSize: 12 },
  qName: { flex: 1, fontSize: 14 },
  qTag: { fontSize: 10, letterSpacing: 1 },
  qTime: { fontSize: 12 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  doneTitle: { fontSize: 30, marginTop: 14 },
  doneSub: { fontSize: 15, marginTop: 8, textAlign: 'center' },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 18,
  },
  savedText: { fontSize: 14 },
});
