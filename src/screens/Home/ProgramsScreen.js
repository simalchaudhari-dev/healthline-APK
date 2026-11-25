import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Play, Check } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import LoadingScreen from '../../components/common/LoadingScreen';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { colors, themeColors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { usePrograms } from '../../hooks/usePrograms';
import { useProgramProgress } from '../../utils/programProgress';
import { getProgramById, programMeta, programProgress } from '../../data/programs';

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

/** Programs from the admin panel; the user's started program and ticks come from their account. */
export default function ProgramsScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { groups, status, refresh } = usePrograms();
  const progress = useProgramProgress();

  const active = progress.active ? getProgramById(progress.active) : null;
  const activeProgress = active ? programProgress(active, progress.programs[active.id]) : null;
  const tileBg = isDark ? c.chip : colors.primarySoft;

  const statusOf = (p) => {
    const pr = programProgress(p, progress.programs[p.id]);
    if (pr.finished) return { label: 'Completed', color: colors.primary };
    if (progress.active === p.id) return { label: `In progress · ${pr.done}/${pr.total}`, color: colors.primary };
    if (pr.started) return { label: `Paused · ${pr.done}/${pr.total}`, color: c.muted };
    if (!p.sessions?.length) return { label: 'Coming soon', color: c.muted };
    return { label: p.badge || 'Start', color: p.badge ? colors.primary : c.muted };
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Programs" onBack={() => navigation.goBack()} theme={c} />
      {!groups.length ? (
        status === 'error' ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: c.text, fontFamily: FONT.heading }]}>Programs could not load</Text>
            <Text style={[styles.sub, { color: c.muted, textAlign: 'center' }]}>
              Check your internet connection and try again.
            </Text>
            <AppButton label="Try again" onPress={refresh} style={{ marginTop: 12, alignSelf: 'stretch' }} />
          </View>
        ) : status === 'loading' ? (
          <LoadingScreen message="Loading programs…" />
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.sub, { color: c.muted, textAlign: 'center' }]}>No programs yet.</Text>
          </View>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.headline, { color: c.text, fontFamily: FONT.nova }]}>Programs</Text>
          <Text style={[styles.sub, { color: c.muted }]}>
            Step-by-step plans. Start one, play each session, and tick it off as you go.
          </Text>

          {active && activeProgress ? (
            <Pressable
              onPress={() => navigation.navigate('ProgramDetail', { id: active.id })}
              style={[styles.hero, { backgroundColor: isDark ? '#163a1a' : '#1e5e24' }]}
            >
              <Text style={styles.heroKicker}>{activeProgress.finished ? 'COMPLETED' : 'IN PROGRESS'}</Text>
              <Text style={styles.heroTitle}>{active.title}</Text>
              <Text style={styles.heroSub}>
                {activeProgress.finished
                  ? `All ${activeProgress.total} sessions done`
                  : activeProgress.next
                    ? `Week ${activeProgress.week} of ${active.weeks} · next: ${activeProgress.next.title}, ${activeProgress.next.minutes} min`
                    : 'Sessions coming soon'}
              </Text>
              <View style={styles.heroTrack}>
                <View style={[styles.heroFill, { width: `${Math.round(activeProgress.pct * 100)}%` }]} />
              </View>
              <Text style={styles.heroCount}>
                {activeProgress.done} of {activeProgress.total} sessions
              </Text>
            </Pressable>
          ) : null}

          {groups.map((group) => (
            <View key={group.id} style={styles.group}>
              <Text style={[styles.groupTitle, { color: c.text, fontFamily: snPro('700') }]}>{group.title}</Text>
              {group.subtitle ? <Text style={[styles.groupSub, { color: c.muted }]}>{group.subtitle}</Text> : null}
              {group.programs.map((p) => {
                const st = statusOf(p);
                const done = st.label === 'Completed';
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => navigation.navigate('ProgramDetail', { id: p.id })}
                    style={({ pressed }) => [
                      styles.card,
                      CARD_SHADOW,
                      { backgroundColor: c.cardBg, opacity: pressed ? 0.92 : 1 },
                      isDark ? { borderWidth: 1, borderColor: c.border } : null,
                    ]}
                  >
                    <View style={[styles.thumb, { backgroundColor: tileBg }]}>
                      {p.coverUrl ? (
                        <Image source={{ uri: p.coverUrl }} style={styles.thumbImg} contentFit="cover" cachePolicy="memory-disk" />
                      ) : done ? (
                        <Check size={18} color={colors.primary} strokeWidth={3} />
                      ) : (
                        <Play size={16} color={colors.primary} fill={colors.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: c.text, fontFamily: snPro('700') }]}>{p.title}</Text>
                      <Text style={[styles.cardMeta, { color: c.muted }]}>{programMeta(p)}</Text>
                      <Text style={[styles.status, { color: st.color, fontFamily: snPro('700') }]}>{st.label}</Text>
                    </View>
                    <ChevronRight size={18} color={c.muted} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  headline: { fontSize: 26 },
  sub: { fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80, gap: 4 },
  emptyTitle: { fontSize: 20, textAlign: 'center' },
  hero: { borderRadius: 20, padding: 18, marginBottom: 20 },
  heroKicker: { color: '#d7f0c9', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  heroTrack: { height: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)', marginTop: 14, overflow: 'hidden' },
  heroFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 99 },
  heroCount: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5, marginTop: 6 },
  group: { marginBottom: 20 },
  groupTitle: { fontSize: 15 },
  groupSub: { fontSize: 12, marginTop: 3, marginBottom: 10, lineHeight: 17 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, marginBottom: 10 },
  thumb: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  cardTitle: { fontSize: 14 },
  cardMeta: { fontSize: 11.5, marginTop: 2 },
  status: { fontSize: 11, marginTop: 4 },
});
