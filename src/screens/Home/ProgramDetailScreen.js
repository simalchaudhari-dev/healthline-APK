import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Check, Play } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import LoadingScreen from '../../components/common/LoadingScreen';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';
import { colors, themeColors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { usePrograms } from '../../hooks/usePrograms';
import { getRoutine } from '../../data/homeExercises';
import { getProgramById, programMeta, programProgress } from '../../data/programs';
import { leaveProgram, setSessionDone, startProgram, useProgramProgress } from '../../utils/programProgress';
import { toast } from '../../utils/toast';

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

/** One program: start / continue it, play each session's routine, and tick sessions off. */
export default function ProgramDetailScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { accessToken } = useAuth();
  const { status } = usePrograms();
  useExerciseCatalog(); // routines can arrive after this screen opens
  const progress = useProgramProgress();
  const program = getProgramById(route.params?.id);

  if (!program) {
    return (
      <ScreenShell>
        <ScreenHeader title="Program" onBack={() => navigation.goBack()} theme={c} />
        {status === 'loading' ? (
          <LoadingScreen message="Loading program…" />
        ) : (
          <Text style={{ padding: 20, color: c.muted }}>This program is no longer available.</Text>
        )}
      </ScreenShell>
    );
  }

  const record = progress.programs[program.id];
  const pr = programProgress(program, record);
  const isActive = progress.active === program.id;
  const doneIds = new Set(record?.done || []);
  const sessions = program.sessions || [];
  const weeks = [...new Set(sessions.map((s) => s.week))].sort((a, b) => a - b);
  const tileBg = isDark ? c.chip : colors.primarySoft;

  const play = (s) => {
    const routine = s.routine ? getRoutine(s.routine) : null;
    if (!routine) {
      toast.warning('This session has no guided workout yet. Tick it off when you have done it.');
      return;
    }
    if (!isActive) startProgram(program.id, accessToken);
    navigation.navigate('HomeWorkoutPlayer', {
      routineId: routine.id,
      programId: program.id,
      programSessionId: s.id,
    });
  };

  const toggle = (s) => setSessionDone(program.id, s.id, !doneIds.has(s.id), accessToken);

  const mainAction = () => {
    if (!isActive) {
      startProgram(program.id, accessToken);
      toast.success(pr.started ? 'Program resumed' : 'Program started');
      return;
    }
    if (pr.next) play(pr.next);
  };

  return (
    <ScreenShell>
      <ScreenHeader title={program.title} onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { backgroundColor: tileBg }]}>
          {program.coverUrl ? (
            <Image source={{ uri: program.coverUrl }} style={styles.coverImg} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <Play size={32} color={colors.primary} fill={colors.primary} />
          )}
        </View>

        <Text style={[styles.headline, { color: c.text, fontFamily: FONT.nova }]}>{program.title}</Text>
        <Text style={[styles.sub, { color: c.muted }]}>{programMeta(program)}</Text>
        {program.description ? (
          <Text style={[styles.desc, { color: c.text, fontFamily: snPro('400') }]}>{program.description}</Text>
        ) : null}

        {sessions.length ? (
          <>
            <View style={[styles.track, { backgroundColor: isDark ? c.track : '#e2f0dc' }]}>
              <View style={[styles.trackFill, { width: `${Math.round(pr.pct * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.progressLbl, { color: c.muted }]}>
              {pr.finished
                ? `All ${pr.total} sessions done 🎉`
                : `${pr.done} of ${pr.total} sessions done${isActive && pr.next ? ` · week ${pr.week} of ${program.weeks}` : ''}`}
            </Text>

            {!pr.finished ? (
              <AppButton
                label={!isActive ? (pr.started ? 'Resume program' : 'Start program') : pr.next ? `Play next: ${pr.next.title}` : 'Continue'}
                icon={Play}
                size="lg"
                onPress={mainAction}
              />
            ) : null}
            {isActive ? (
              <Pressable onPress={() => leaveProgram(accessToken)} hitSlop={8} style={styles.leave}>
                <Text style={[styles.leaveTxt, { color: c.muted, fontFamily: snPro('600') }]}>Pause this program</Text>
              </Pressable>
            ) : null}

            {weeks.map((week) => (
              <View key={week}>
                <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>WEEK {week}</Text>
                {sessions
                  .filter((s) => s.week === week)
                  .map((s) => {
                    const done = doneIds.has(s.id);
                    const routine = s.routine ? getRoutine(s.routine) : null;
                    const isNext = pr.next?.id === s.id;
                    return (
                      <View
                        key={s.id}
                        style={[
                          styles.session,
                          CARD_SHADOW,
                          { backgroundColor: c.cardBg, borderColor: isNext ? colors.primary : 'transparent' },
                        ]}
                      >
                        <Pressable
                          onPress={() => toggle(s)}
                          hitSlop={8}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: done }}
                          accessibilityLabel={`${s.title} done`}
                          style={[
                            styles.tick,
                            {
                              backgroundColor: done ? colors.primary : 'transparent',
                              borderColor: done ? colors.primary : isDark ? c.border : '#cfe3c7',
                            },
                          ]}
                        >
                          {done ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                        </Pressable>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.sessionTitle,
                              { color: c.text, fontFamily: snPro('700'), opacity: done ? 0.6 : 1 },
                            ]}
                          >
                            {s.title}
                          </Text>
                          <Text style={[styles.sessionMeta, { color: c.muted }]}>
                            {s.minutes} min{routine ? ` · ${routine.name}` : ''}
                            {isNext ? ' · next' : ''}
                          </Text>
                          {s.note ? <Text style={[styles.sessionMeta, { color: c.muted }]}>{s.note}</Text> : null}
                        </View>
                        {routine ? (
                          <Pressable
                            onPress={() => play(s)}
                            accessibilityRole="button"
                            accessibilityLabel={`Play ${s.title}`}
                            style={[styles.playBtn, { backgroundColor: tileBg }]}
                          >
                            <Play size={14} color={colors.primary} fill={colors.primary} />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.empty, { color: c.muted }]}>Sessions coming soon for this program.</Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  cover: { height: 150, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%' },
  headline: { fontSize: 24 },
  sub: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  desc: { fontSize: 14, marginTop: 10, lineHeight: 20 },
  track: { height: 6, borderRadius: 99, overflow: 'hidden', marginTop: 16 },
  trackFill: { height: '100%', borderRadius: 99 },
  progressLbl: { fontSize: 12, marginTop: 6, marginBottom: 14 },
  leave: { alignSelf: 'center', marginTop: 10 },
  leaveTxt: { fontSize: 12 },
  section: { fontSize: 10, letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  empty: { fontSize: 13, marginTop: 16 },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { fontSize: 14 },
  sessionMeta: { fontSize: 11.5, marginTop: 2 },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
