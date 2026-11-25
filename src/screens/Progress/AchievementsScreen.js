import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, ChevronRight, Lock, Check, Sparkles } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useDiary } from '../../context/DiaryContext';
import ScreenHeader from '../../components/common/ScreenHeader';
import { premiumShadow, softShadow } from '../../components/common/premiumStyles';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { ACHIEVEMENTS as CATALOG } from '../../data/achievements';
import { useLiveAchievements } from '../../hooks/useLiveAchievements';

export default function AchievementsScreen({ navigation }) {
  const { diaryLoading } = useDiary();
  const { isDark, themeColors: c, primaryRgba } = useTheme();
  const ACHIEVEMENTS = useLiveAchievements(CATALOG);

  const { unlocked, locked, pct } = useMemo(() => {
    const u = ACHIEVEMENTS.filter((a) => a.earned);
    const l = ACHIEVEMENTS.filter((a) => !a.earned);
    const total = ACHIEVEMENTS.length || 1;
    return {
      unlocked: u,
      locked: l,
      pct: Math.round((u.length / total) * 100),
    };
  }, [ACHIEVEMENTS]);

  // First load after sign-in: show the common loader instead of empty / zero numbers.
  if (diaryLoading) {
    return (
      <ScreenShell>
        <ScreenHeader title="Achievements" onBack={() => navigation.goBack()} theme={c} />
        <LoadingScreen message="Loading your achievements…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Achievements" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.heroCard,
            premiumShadow,
            { borderColor: isDark ? c.border : primaryRgba(0.14) },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ['#1C1C26', '#14141A', '#101014']
                : [primaryRgba(0.12), '#FFFFFF', '#FBFCFD']
            }
            locations={[0, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroInner}
          >
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: isDark ? '#22222A' : colors.primarySoft }]}>
                <Trophy size={24} color={colors.carbs} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroKicker, { color: colors.primary, fontFamily: snPro('800') }]}>
                  COLLECTION
                </Text>
                <Text style={[styles.heroTitle, { color: c.text, fontFamily: FONT.nova }]}>
                  {unlocked.length}
                  <Text style={[styles.heroOf, { color: c.muted }]}> / {ACHIEVEMENTS.length}</Text>
                </Text>
                <Text style={[styles.heroSub, { color: c.muted, fontFamily: snPro('500') }]}>
                  badges unlocked · {locked.length} still waiting
                </Text>
              </View>
              <View style={styles.pctWrap}>
                <Text style={[styles.pctVal, { color: colors.primary, fontFamily: snPro('800') }]}>{pct}%</Text>
                <Text style={[styles.pctLbl, { color: c.muted }]}>done</Text>
              </View>
            </View>

            <View style={[styles.track, { backgroundColor: isDark ? '#2A2A32' : '#E4E7EC' }]}>
              <LinearGradient
                colors={[colors.primary, colors.accent || colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.trackFill, { width: `${pct}%` }]}
              />
            </View>

            <View style={[styles.hintRow, { backgroundColor: isDark ? '#1A1A22' : primaryRgba(0.08) }]}>
              <Sparkles size={14} color={colors.primary} />
              <Text style={[styles.hintText, { color: c.muted, fontFamily: snPro('500') }]}>
                Tap a badge to open its premium detail
              </Text>
            </View>
          </LinearGradient>
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>UNLOCKED</Text>
        {unlocked.map((item) => (
          <AchievementRow
            key={item.id}
            item={item}
            theme={c}
            isDark={isDark}
            onPress={() => navigation.navigate('AchievementDetail', { id: item.id })}
          />
        ))}

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800'), marginTop: 10 }]}>
          LOCKED
        </Text>
        {locked.map((item) => (
          <AchievementRow
            key={item.id}
            item={item}
            theme={c}
            isDark={isDark}
            onPress={() => navigation.navigate('AchievementDetail', { id: item.id })}
          />
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

function AchievementRow({ item, theme, isDark, onPress }) {
  const Icon = item.Icon;
  const pct = Math.min(100, Math.round((item.progress / Math.max(item.goal, 1)) * 100));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        softShadow,
        {
          backgroundColor: theme.cardBg,
          borderColor: item.earned ? `${item.color}33` : theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.iconOuter, { borderColor: `${item.color}40` }]}>
        <LinearGradient colors={[`${item.color}30`, `${item.color}10`]} style={styles.iconWrap}>
          <Icon size={20} color={item.color} />
        </LinearGradient>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.rowTitle, { color: theme.text, fontFamily: snPro('700') }]} numberOfLines={1}>
            {item.label}
          </Text>
          {item.earned ? (
            <View style={[styles.pill, { backgroundColor: `${item.color}22` }]}>
              <Check size={11} color={item.color} strokeWidth={2.8} />
              <Text style={[styles.pillText, { color: item.color, fontFamily: snPro('700') }]}>Earned</Text>
            </View>
          ) : (
            <View style={[styles.pill, { backgroundColor: isDark ? '#1C1C1E' : theme.chip }]}>
              <Lock size={10} color={theme.muted} />
              <Text style={[styles.pillText, { color: theme.muted, fontFamily: snPro('700') }]}>Locked</Text>
            </View>
          )}
        </View>
        <Text style={[styles.rowSub, { color: theme.muted, fontFamily: snPro('500') }]} numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={styles.barRow}>
          <View style={[styles.trackSm, { backgroundColor: isDark ? '#2A2A32' : '#E4E7EC' }]}>
            <View style={[styles.trackFillSm, { width: `${pct}%`, backgroundColor: item.color }]} />
          </View>
          <Text style={[styles.pctSm, { color: item.color, fontFamily: snPro('700') }]}>{pct}%</Text>
        </View>
      </View>
      <ChevronRight size={18} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 44 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  heroInner: { padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: { fontSize: 10, letterSpacing: 1.2 },
  heroTitle: { fontSize: 32, letterSpacing: -0.6, marginTop: 2 },
  heroOf: { fontSize: 18 },
  heroSub: { fontSize: 13, marginTop: 2 },
  pctWrap: { alignItems: 'flex-end' },
  pctVal: { fontSize: 22 },
  pctLbl: { fontSize: 11, marginTop: 2 },
  track: { height: 8, borderRadius: 99, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 99 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hintText: { fontSize: 12, flex: 1 },
  section: { fontSize: 10, letterSpacing: 1.2, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  iconOuter: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  iconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowTitle: { fontSize: 15, flex: 1 },
  rowSub: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackSm: { flex: 1, height: 6, borderRadius: 99, overflow: 'hidden' },
  trackFillSm: { height: '100%', borderRadius: 99 },
  pctSm: { fontSize: 11, minWidth: 32, textAlign: 'right' },
});
