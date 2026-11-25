import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Footprints,
  MapPin,
  Flame,
  Target,
  Trophy,
  HeartPulse,
  Smartphone,
  Settings2,
} from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ScreenHeader from '../../components/common/ScreenHeader';
import ProgressRing from '../../components/common/ProgressRing';
import AppButton from '../../components/common/AppButton';
import { softShadow } from '../../components/common/premiumStyles';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useSteps } from '../../context/StepsContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { summariseSteps, DEFAULT_STEP_GOAL, dateKey } from '../../utils/steps';
import WeekChartCard from '../../components/charts/WeekChartCard';
import { thisMonday, addDays } from '../../components/charts/WeekFilter';
import { openAppSettings } from '../../services/stepsService';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

const SOURCE_TEXT = {
  account: 'Synced from your phone. Open HealthLine on your phone to update today’s steps.',
  'health-connect': 'From Health Connect — your phone, Samsung Health, Google Fit or watch. Updates even when HealthLine is closed.',
  ios: 'From your iPhone’s motion sensor.',
  'phone-sensor': 'Counted by this phone only while HealthLine is open. Connect Health Connect for all-day steps.',
};

/** Where to switch the permission on by hand (Android wording varies a little by brand). */
const SETTINGS_PATH = ['Settings', 'Apps', 'Health line', 'Permissions', 'Physical activity', 'Allow'];
const HC_SETTINGS_PATH = ['Health Connect', 'App permissions', 'Health line', 'Steps', 'Allow'];

/** What to ask the user for, when real numbers aren't flowing yet. */
function setupCopy(hcState, sensorState, sensorCanAsk) {
  if (Platform.OS === 'web') {
    return { title: 'Steps work in the phone app', body: 'Open HealthLine on your Android phone to see your steps.', action: null };
  }
  if (hcState === 'needs-permission') {
    return {
      title: 'Connect your steps',
      body: 'Allow HealthLine to read steps from Health Connect. We only read step counts — nothing is changed or shared.',
      action: 'Allow in Health Connect',
      path: HC_SETTINGS_PATH,
      hcSettings: true,
    };
  }
  if (hcState === 'not-installed' || hcState === 'update-required') {
    return {
      title: hcState === 'update-required' ? 'Update Health Connect' : 'Install Health Connect',
      body: 'Health Connect is Google’s free app that keeps your steps from the phone, Google Fit, Samsung Health and watches.',
      action: hcState === 'update-required' ? 'Update Health Connect' : 'Get Health Connect',
      sensorOption: sensorState !== 'granted' && sensorState !== 'unavailable',
    };
  }
  if (sensorState === 'unavailable') {
    return { title: 'Step counting not available', body: 'This phone has no step sensor HealthLine can use.', action: null };
  }
  if (!sensorCanAsk) {
    // Android stops showing the popup after "Don't allow" twice — only Settings can turn it on now.
    return {
      title: 'Step permission is off',
      body: 'Android blocked the permission popup. Tap below to open Settings and allow Physical activity:',
      action: 'Open phone settings',
      path: SETTINGS_PATH,
    };
  }
  return {
    title: 'Allow step counting',
    body: 'HealthLine needs the Physical activity permission to count your steps. Tap below and choose Allow.',
    action: 'Allow step counting',
    path: SETTINGS_PATH,
  };
}

export default function StepsScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { profile, days: diaryDays } = useDiary();
  const [weekStart, setWeekStart] = useState(thisMonday);
  const {
    days,
    source,
    hcState,
    sensorState,
    sensorCanAsk,
    healthConnectEmpty,
    connected,
    isAccountView,
    hasSteps,
    loading,
    error,
    refresh,
    askOnce,
    connect,
    useSensorInstead,
    openSettings,
  } = useSteps();

  // First visit this session: show the permission popup straight away; later visits just refresh.
  useFocusEffect(
    useCallback(() => {
      askOnce().then(refresh);
    }, [askOnce, refresh]),
  );

  const goal = DEFAULT_STEP_GOAL;
  const s = summariseSteps(days, { goal, heightCm: profile.heightCm, weightKg: profile.weight });
  // Chart week (Monday–Sunday, like the admin panel): live device days first, then steps saved on the account.
  const todayKey = dateKey();
  const weekDays = useMemo(() => {
    const device = Object.fromEntries((days || []).map((d) => [d.key, d.steps]));
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(weekStart, i);
      return { key, steps: device[key] ?? (Number(diaryDays?.[key]?.steps) || 0) };
    });
  }, [days, diaryDays, weekStart]);
  // Averages and best day only count days up to today (future days of this week are just placeholders).
  const w = summariseSteps(
    weekDays.filter((d) => d.key <= todayKey),
    { goal },
  );
  w.days = summariseSteps(weekDays, { goal }).days;
  // Nothing read yet (first check of Health Connect / sensor) → common loader, not the setup card.
  const firstLoad = loading && !days.length;
  const setup = connected || firstLoad ? null : setupCopy(hcState, sensorState, sensorCanAsk);
  const noDataYet = connected && source === 'health-connect' && s.weekTotal === 0;

  return (
    <ScreenShell>
      <ScreenHeader title="Steps" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !firstLoad} onRefresh={refresh} colors={[colors.primary]} />}
      >
        {firstLoad ? <LoadingScreen message="Loading your steps…" /> : null}
        {setup ? (
          <View style={[styles.card, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={[styles.setupIcon, { backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft }]}>
              <HeartPulse size={24} color={colors.primary} />
            </View>
            <Text style={[styles.setupTitle, { color: c.text, fontFamily: FONT.nova }]}>{setup.title}</Text>
            <Text style={[styles.setupBody, { color: c.muted, fontFamily: snPro('400') }]}>{setup.body}</Text>
            {setup.action ? <AppButton label={setup.action} onPress={connect} style={{ marginTop: 16 }} /> : null}
            {setup.path ? (
              <View style={[styles.pathBox, { backgroundColor: isDark ? '#1C1C1E' : c.chip, borderColor: c.border }]}>
                <Text style={[styles.pathTitle, { color: c.muted, fontFamily: snPro('700') }]}>
                  OR TURN IT ON YOURSELF
                </Text>
                <Text style={[styles.pathText, { color: c.text, fontFamily: snPro('600') }]}>
                  {setup.path.join('  →  ')}
                </Text>
                <Pressable
                  onPress={setup.hcSettings ? openSettings : openAppSettings}
                  hitSlop={8}
                  style={[styles.altLink, { marginTop: 10, alignSelf: 'flex-start' }]}
                >
                  <Settings2 size={14} color={colors.primary} />
                  <Text style={[styles.altText, { color: colors.primary, fontFamily: snPro('700') }]}>
                    {setup.hcSettings ? 'Open Health Connect' : 'Open phone settings'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {setup.sensorOption ? (
              <Pressable onPress={useSensorInstead} hitSlop={8} style={styles.altLink}>
                <Smartphone size={14} color={colors.primary} />
                <Text style={[styles.altText, { color: colors.primary, fontFamily: snPro('700') }]}>
                  Use phone sensor instead (only while app is open)
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isAccountView && !hasSteps ? (
          <View style={[styles.previewBanner, { backgroundColor: isDark ? '#1A2A1A' : colors.primarySoft, borderColor: c.border }]}>
            <Text style={[styles.previewTitle, { color: colors.primary, fontFamily: snPro('800') }]}>NO STEPS SYNCED YET</Text>
            <Text style={[styles.previewBody, { color: c.text, fontFamily: snPro('500') }]}>
              Steps are counted by the HealthLine app on your Android phone. Open it there and allow step
              tracking — your steps will show here automatically.
            </Text>
          </View>
        ) : null}

        {connected ? (
          <>
            <View style={[styles.hero, softShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <ProgressRing
                progress={s.progress}
                color={colors.primary}
                trackColor={isDark ? '#2A2A2A' : colors.primarySoft}
                size={170}
                stroke={14}
              >
                <Footprints size={20} color={colors.primary} />
                <Text style={[styles.heroVal, { color: c.text, fontFamily: FONT.nova }]}>{fmt(s.today)}</Text>
                <Text style={[styles.heroSub, { color: c.muted, fontFamily: snPro('600') }]}>of {fmt(goal)}</Text>
              </ProgressRing>
              <Text style={[styles.heroMsg, { color: c.text, fontFamily: snPro('700') }]}>
                {s.remaining ? `${fmt(s.remaining)} steps to your goal` : 'Goal reached today 🎉'}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Stat icon={MapPin} label="Distance" value={`${s.distanceKm} km`} theme={c} isDark={isDark} />
              <Stat icon={Flame} label="Calories" value={`${s.calories} kcal`} theme={c} isDark={isDark} />
              <Stat icon={Target} label="Goal days" value={`${s.goalDays}/7`} theme={c} isDark={isDark} />
            </View>

            {noDataYet ? (
              <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('400') }]}>
                Health Connect has no steps yet. Turn on step tracking in Google Fit, Samsung Health or your
                watch app and allow it to write to Health Connect.
              </Text>
            ) : null}

            <WeekChartCard
              title="Steps by day"
              weekStart={weekStart}
              onWeekChange={setWeekStart}
              days={w.days.map((d) => ({ key: d.key, label: d.label, value: d.steps }))}
              goal={goal}
              formatGoal={fmt}
              todayKey={todayKey}
              formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            >
              <View style={styles.weekRow}>
                <Text style={[styles.weekText, { color: c.muted, fontFamily: snPro('500') }]}>
                  Daily average <Text style={{ color: c.text, fontFamily: snPro('800') }}>{fmt(w.weekAverage)}</Text>
                </Text>
                {w.best ? (
                  <View style={styles.bestRow}>
                    <Trophy size={13} color={colors.primary} />
                    <Text style={[styles.weekText, { color: c.muted, fontFamily: snPro('500') }]}>
                      Best {w.best.label} <Text style={{ color: c.text, fontFamily: snPro('800') }}>{fmt(w.best.steps)}</Text>
                    </Text>
                  </View>
                ) : null}
              </View>
            </WeekChartCard>

            <Text style={[styles.source, { color: c.muted, fontFamily: snPro('400') }]}>{SOURCE_TEXT[source] || ''}</Text>
            {source === 'health-connect' ? (
              <Pressable onPress={openSettings} hitSlop={8} style={styles.altLink}>
                <Settings2 size={14} color={colors.primary} />
                <Text style={[styles.altText, { color: colors.primary, fontFamily: snPro('700') }]}>
                  Manage in Health Connect
                </Text>
              </Pressable>
            ) : null}
            {source === 'phone-sensor' && healthConnectEmpty ? (
              <>
                <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('400') }]}>
                  Health Connect is connected but has no steps yet, so your phone is counting them (only while
                  HealthLine is open). For all-day steps, turn on step tracking in Google Fit, Samsung Health or
                  your watch app and let it write to Health Connect.
                </Text>
                <Pressable onPress={openSettings} hitSlop={8} style={styles.altLink}>
                  <Settings2 size={14} color={colors.primary} />
                  <Text style={[styles.altText, { color: colors.primary, fontFamily: snPro('700') }]}>
                    Open Health Connect
                  </Text>
                </Pressable>
              </>
            ) : null}
            {source === 'phone-sensor' && !healthConnectEmpty && hcState !== 'unsupported' ? (
              <Pressable onPress={connect} hitSlop={8} style={styles.altLink}>
                <HeartPulse size={14} color={colors.primary} />
                <Text style={[styles.altText, { color: colors.primary, fontFamily: snPro('700') }]}>
                  Connect Health Connect for all-day steps
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {error ? <Text style={[styles.hint, { color: colors.danger }]}>{error}</Text> : null}
        <Text style={[styles.disclaimer, { color: c.muted }]}>
          Distance and calories are estimates from your height and weight.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

function Stat({ icon: Icon, label, value, theme, isDark }) {
  return (
    <View style={[styles.stat, softShadow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={[styles.statIcon, { backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft }]}>
        <Icon size={15} color={colors.primary} />
      </View>
      <Text style={[styles.statVal, { color: theme.text, fontFamily: snPro('800') }]}>{value}</Text>
      <Text style={[styles.statLbl, { color: theme.muted, fontFamily: snPro('600') }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  setupIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  setupTitle: { fontSize: 20, marginTop: 12 },
  setupBody: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  altLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'center' },
  pathBox: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 14 },
  previewBanner: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 12 },
  previewTitle: { fontSize: 11, letterSpacing: 0.8 },
  previewBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  pathTitle: { fontSize: 10, letterSpacing: 0.8, marginBottom: 6 },
  pathText: { fontSize: 13, lineHeight: 20 },
  altText: { fontSize: 13 },
  hero: { borderRadius: 22, borderWidth: 1, paddingVertical: 22, alignItems: 'center', marginBottom: 12 },
  heroVal: { fontSize: 34, marginTop: 4 },
  heroSub: { fontSize: 12 },
  heroMsg: { fontSize: 15, marginTop: 14 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'flex-start' },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontSize: 16 },
  statLbl: { fontSize: 11, marginTop: 2 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 },
  weekText: { fontSize: 12 },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  disclaimer: { fontSize: 11, marginTop: 16, textAlign: 'center' },
});
