import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Check, Lock, Award, Sparkles } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import ProgressRing from '../../components/common/ProgressRing';
import AppButton from '../../components/common/AppButton';
import StreakCalendar, {
  buildAchievementCalendarKeys,
  resolveStreakDays,
} from '../../components/common/StreakCalendar';
import { useTheme } from '../../context/ThemeContext';
import { FONT, snPro } from '../../config/fonts';
import { getAchievement } from '../../data/achievements';
import { useLiveAchievements } from '../../hooks/useLiveAchievements';

/** Android-safe tint — 8-digit hex often fails on APK. */
function rgba(hex, alpha) {
  const raw = String(hex || '#26C6DA').replace('#', '');
  const h =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Match web Achievement detail on Android + web. */
export default function AchievementDetailScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  const catalogItem = useMemo(() => {
    const found = getAchievement(route.params?.id);
    return found ? [found] : [];
  }, [route.params?.id]);
  const achievement = useLiveAchievements(catalogItem)[0] || null;

  const calendarKeys = useMemo(
    () => (achievement ? buildAchievementCalendarKeys(achievement) : []),
    [achievement],
  );
  const streakDays = useMemo(
    () => (achievement ? resolveStreakDays(achievement) : 0),
    [achievement],
  );

  if (!achievement) {
    return (
      <ScreenShell>
        <ScreenHeader title="Achievement" onBack={() => navigation.goBack()} theme={c} />
        <Text style={{ padding: 20, color: c.muted }}>Achievement not found.</Text>
      </ScreenShell>
    );
  }

  const Icon = achievement.Icon;
  const pct = Math.min(1, achievement.progress / Math.max(achievement.goal, 1));
  const pctLabel = Math.round(pct * 100);
  const remaining = Math.max(0, achievement.goal - achievement.progress);
  const accent = achievement.color;
  const doneDays = achievement.history.filter((h) => h.done).length;
  const locked = !achievement.earned && achievement.status === 'Locked';
  const border = isDark ? c.border : '#E8ECF0';
  /** Slightly stronger alpha so tint stays visible on Android screens. */
  const softTint = isDark ? rgba(accent, 0.2) : rgba(accent, 0.12);
  const softBorder = isDark ? c.border : rgba(accent, 0.28);
  const chipBg = isDark ? rgba(accent, 0.22) : rgba(accent, 0.12);

  return (
    <ScreenShell>
      <ScreenHeader title="Achievement" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      >
        {/* Hero */}
        <View style={[styles.card, shadow, { backgroundColor: c.cardBg, borderColor: border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.iconChip, { backgroundColor: chipBg }]}>
              <Icon size={18} color={accent} strokeWidth={2.2} />
            </View>
            <Text style={[styles.kicker, { color: accent, fontFamily: snPro('800') }]}>
              {achievement.earned ? 'BADGE UNLOCKED' : 'CHALLENGE'}
            </Text>
          </View>

          <Text style={[styles.title, { color: c.text, fontFamily: FONT.nova }]}>
            {achievement.title}
          </Text>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: locked ? (isDark ? '#22222A' : '#EEF0F3') : chipBg,
                borderColor: locked ? border : softBorder,
              },
            ]}
          >
            {locked || !achievement.earned ? (
              <Lock size={13} color={c.muted} />
            ) : (
              <Check size={14} color={accent} strokeWidth={2.6} />
            )}
            <Text
              style={[
                styles.statusText,
                {
                  color: locked || !achievement.earned ? c.muted : accent,
                  fontFamily: snPro('700'),
                },
              ]}
            >
              {achievement.status}
            </Text>
          </View>

          <Text style={[styles.summary, { color: c.muted, fontFamily: snPro('500') }]}>
            {achievement.summary}
          </Text>
        </View>

        {/* Progress */}
        <View style={[styles.card, shadow, { backgroundColor: c.cardBg, borderColor: border, marginTop: 12 }]}>
          <View style={styles.progressTop}>
            <View style={styles.ringBox}>
              <ProgressRing
                progress={pct}
                color={accent}
                trackColor={isDark ? '#2A2A32' : '#E8EDF3'}
                size={112}
                stroke={10}
              >
                <Text style={[styles.ringPct, { color: c.text, fontFamily: snPro('800') }]}>
                  {pctLabel}%
                </Text>
              </ProgressRing>
            </View>

            <View style={styles.progressMeta}>
              <Text style={[styles.progressLbl, { color: accent, fontFamily: snPro('800') }]}>
                YOUR PROGRESS
              </Text>
              <Text style={[styles.progressVal, { color: c.text, fontFamily: FONT.nova }]}>
                {formatProgress(achievement.progress)}
                <Text style={[styles.progressGoal, { color: c.muted }]}>
                  {' '}
                  / {formatProgress(achievement.goal)}
                </Text>
              </Text>
              <Text style={[styles.progressUnit, { color: c.muted, fontFamily: snPro('500') }]}>
                {achievement.unit}
              </Text>
              {remaining > 0 ? (
                <View style={styles.remainRow}>
                  <View style={[styles.remainDot, { backgroundColor: accent }]} />
                  <Text style={[styles.remainText, { color: accent, fontFamily: snPro('700') }]}>
                    {formatProgress(remaining)} to go
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={[styles.statRow, { borderTopColor: isDark ? c.border : '#EEF0F3' }]}>
            <MiniStat label="Complete" value={`${pctLabel}%`} color={accent} theme={c} />
            <MiniStat
              label={achievement.history.length === 7 ? 'This week' : 'Done'}
              value={`${doneDays}/${achievement.history.length}`}
              color={accent}
              theme={c}
            />
            <MiniStat
              label="Status"
              value={achievement.earned ? 'Earned' : locked ? 'Locked' : 'Active'}
              color={accent}
              theme={c}
            />
          </View>
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>STREAK RECORD</Text>
        <StreakCalendar
          completedKeys={calendarKeys}
          streakCount={streakDays}
          accent={accent}
          headerColor={accent}
          isDark={isDark}
          theme={c}
          title={`${achievement.label} streak`}
          subtitle="Check days you hit this goal — keep the chain alive"
        />

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>HOW TO EARN</Text>
        <View style={[styles.card, shadow, { backgroundColor: c.cardBg, borderColor: border }]}>
          {achievement.how.map((line, i) => {
            const last = i === achievement.how.length - 1;
            return (
              <View key={line} style={[styles.timelineRow, last && styles.timelineLast]}>
                <View style={[styles.timelineDot, { backgroundColor: accent }]}>
                  <Text style={[styles.timelineNum, { fontFamily: snPro('800') }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.timelineText, { color: c.text, fontFamily: snPro('500') }]}>{line}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>PRO TIPS</Text>
        {/* No Android elevation — elevation forces opaque white and kills soft tint on APK. */}
        <View style={[styles.card, styles.softCard, { backgroundColor: softTint, borderColor: softBorder }]}>
          <View style={styles.tipsHead}>
            <Sparkles size={16} color={accent} />
            <Text style={[styles.tipsHeadText, { color: c.text, fontFamily: snPro('700') }]}>
              Level up faster
            </Text>
          </View>
          {achievement.tips.map((tip) => (
            <View key={tip} style={styles.tipLine}>
              <View style={[styles.tipBullet, { backgroundColor: accent }]} />
              <Text style={[styles.tipText, { color: c.muted, fontFamily: snPro('500') }]}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Reward — soft tint; no elevation so APK matches web */}
        <View
          style={[
            styles.rewardCard,
            styles.softCard,
            {
              backgroundColor: softTint,
              borderColor: softBorder,
            },
          ]}
        >
          <View
            style={[
              styles.rewardIcon,
              {
                backgroundColor: isDark ? rgba(accent, 0.28) : '#FFFFFF',
                borderColor: softBorder,
              },
            ]}
          >
            <Award size={18} color={accent} strokeWidth={2.2} />
          </View>
          <View style={styles.rewardText}>
            <Text style={[styles.rewardKicker, { color: accent, fontFamily: snPro('800') }]}>REWARD</Text>
            <Text style={[styles.rewardBody, { color: c.text, fontFamily: snPro('600') }]}>
              {achievement.reward}
            </Text>
          </View>
        </View>

        <AppButton
          label="Browse all achievements"
          onPress={() => navigation.navigate('Achievements')}
          style={styles.browseBtn}
        />
      </ScrollView>
    </ScreenShell>
  );
}

function MiniStat({ label, value, color, theme }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniLbl, { color: theme.muted, fontFamily: snPro('600') }]}>{label}</Text>
      <Text style={[styles.miniVal, { color, fontFamily: snPro('800') }]}>{value}</Text>
    </View>
  );
}

function formatProgress(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

/** Light elevation — web-like; avoid heavy Android elevation that changes look. */
const shadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: {
    elevation: 1,
  },
  default: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 56,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  /** Tinted panels — never pair with Android elevation. */
  softCard: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  kicker: { fontSize: 10, letterSpacing: 1.2 },
  title: { fontSize: 28, letterSpacing: -0.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  statusText: { fontSize: 12, marginLeft: 6 },
  summary: { fontSize: 14, lineHeight: 21, marginTop: 14 },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringBox: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: { fontSize: 20 },
  progressMeta: { flex: 1, marginLeft: 16, minWidth: 0 },
  progressLbl: { fontSize: 10, letterSpacing: 1 },
  progressVal: { fontSize: 26, marginTop: 4, letterSpacing: -0.4 },
  progressGoal: { fontSize: 17 },
  progressUnit: { fontSize: 13, marginTop: 2 },
  remainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  remainDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },
  remainText: { fontSize: 12 },
  statRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  miniStat: { flex: 1, alignItems: 'center' },
  miniLbl: { fontSize: 10, letterSpacing: 0.3, marginBottom: 4 },
  miniVal: { fontSize: 15 },
  section: { fontSize: 10, letterSpacing: 1.2, marginTop: 18, marginBottom: 10 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  timelineLast: { marginBottom: 0 },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineNum: { fontSize: 12, color: '#FFFFFF', includeFontPadding: false },
  timelineText: { flex: 1, fontSize: 14, lineHeight: 21, paddingTop: 2 },
  tipsHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tipsHeadText: { fontSize: 14, marginLeft: 8 },
  tipLine: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  tipBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 10 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginTop: 18,
    marginBottom: 14,
    width: '100%',
    overflow: 'hidden',
    elevation: 0,
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rewardText: { flex: 1, minWidth: 0 },
  rewardKicker: { fontSize: 10, letterSpacing: 1 },
  rewardBody: { fontSize: 15, lineHeight: 21, marginTop: 4 },
  browseBtn: { marginTop: 2, marginBottom: 8 },
});
