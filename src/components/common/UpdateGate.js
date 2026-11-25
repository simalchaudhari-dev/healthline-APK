import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Download, PackageCheck, RotateCw, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { poppins, snPro } from '../../config/fonts';

const CHECK_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 60000;
/** The updating screen stays at least this long, so it never just flashes. */
const MIN_SHOW_MS = 2200;
const JUST_UPDATED_KEY = 'healthline.justUpdated';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/**
 * On launch: checks for an OTA update in the background. The app opens normally while it checks;
 * only when an update is found does the full-screen "Updating" screen appear, then the app restarts
 * on the new version and shows an "App updated" card once.
 */
export default function UpdateGate({ children }) {
  const enabled = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
  if (!enabled) return children;
  return <NativeUpdateGate>{children}</NativeUpdateGate>;
}

const STEPS = [
  { key: 'downloading', label: 'Downloading', Icon: Download },
  { key: 'installing', label: 'Installing', Icon: PackageCheck },
  { key: 'restarting', label: 'Restarting', Icon: RotateCw },
];

/** Native release builds only (the updates hook is not used on web / in dev). */
function NativeUpdateGate({ children }) {
  const { downloadProgress } = Updates.useUpdates();
  const [phase, setPhase] = useState('idle'); // idle | downloading | installing | restarting
  const [justUpdated, setJustUpdated] = useState(false);
  const started = useRef(false);

  // Shown once after the restart that applied an update.
  useEffect(() => {
    AsyncStorage.getItem(JUST_UPDATED_KEY)
      .then((v) => {
        if (!v) return;
        AsyncStorage.removeItem(JUST_UPDATED_KEY).catch(() => {});
        setJustUpdated(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_TIMEOUT_MS);
        if (!check?.isAvailable) return;
        const shownAt = Date.now();
        setPhase('downloading');
        const result = await withTimeout(Updates.fetchUpdateAsync(), DOWNLOAD_TIMEOUT_MS);
        if (!result?.isNew) {
          setPhase('idle');
          return;
        }
        setPhase('installing');
        await wait(Math.max(700, MIN_SHOW_MS - (Date.now() - shownAt)));
        setPhase('restarting');
        await AsyncStorage.setItem(JUST_UPDATED_KEY, String(Date.now())).catch(() => {});
        await wait(600);
        await Updates.reloadAsync();
      } catch {
        // Offline, slow network or server error: keep running the current version.
        setPhase('idle');
      }
    })();
  }, []);

  return (
    <View style={styles.fill}>
      {children}
      {phase !== 'idle' ? <UpdatingScreen phase={phase} downloadProgress={downloadProgress} /> : null}
      {justUpdated && phase === 'idle' ? <UpdatedCard onDone={() => setJustUpdated(false)} /> : null}
    </View>
  );
}

function UpdatingScreen({ phase, downloadProgress }) {
  const { colors, isDark, themeColors: c } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const [shownPct, setShownPct] = useState(0);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    const p = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    const s = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
    );
    p.start();
    s.start();
    return () => {
      p.stop();
      s.stop();
    };
  }, [fade, pulse, spin]);

  // Real download % when the platform reports it; otherwise a gentle creep so it never looks stuck.
  const real = typeof downloadProgress === 'number' && downloadProgress > 0 ? Math.min(1, downloadProgress) : null;
  const target = phase === 'downloading' ? Math.min(0.85, real != null ? real * 0.85 : 0.6) : phase === 'installing' ? 0.94 : 1;

  useEffect(() => {
    Animated.timing(bar, {
      toValue: target,
      duration: phase === 'downloading' && real == null ? 1600 : 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [bar, target, phase, real]);

  useEffect(() => {
    const id = bar.addListener(({ value }) => setShownPct(Math.round(value * 100)));
    return () => bar.removeListener(id);
  }, [bar]);

  const stepIndex = STEPS.findIndex((s) => s.key === phase);
  const ring = (delay) => ({
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45 - delay * 0.2, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55 + delay * 0.25] }) }],
  });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const gradient = isDark ? [c.pageBg, '#0F2A1A', c.pageBg] : ['#FFFFFF', '#EAF7EE', '#FFFFFF'];

  return (
    <Animated.View style={[styles.overlay, { opacity: fade }]} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />

      <View style={styles.logoWrap}>
        <Animated.View style={[styles.ring, { borderColor: colors.primary }, ring(0)]} />
        <Animated.View style={[styles.ring, { borderColor: colors.primary }, ring(1)]} />
        <View style={[styles.logoCircle, { backgroundColor: isDark ? c.cardBg : '#FFFFFF', shadowColor: colors.primary }]}>
          <Image source={require('../../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.badge, { backgroundColor: isDark ? `${colors.primary}26` : colors.primarySoft }]}>
        <Sparkles size={13} color={colors.primary} strokeWidth={2.4} />
        <Text style={[styles.badgeText, { color: colors.primary, fontFamily: snPro('800') }]}>NEW VERSION</Text>
      </View>

      <Text style={[styles.title, { color: c.text, fontFamily: poppins('700') }]}>
        {phase === 'restarting' ? 'Almost there' : 'Updating Health line'}
      </Text>
      <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('500') }]}>
        {phase === 'restarting'
          ? 'Opening the latest version for you'
          : 'Adding the latest improvements. This only takes a moment.'}
      </Text>

      <View style={styles.progressBlock}>
        <View style={[styles.track, { backgroundColor: isDark ? '#FFFFFF1A' : '#0000000F' }]}>
          <Animated.View
            style={[
              styles.barFill,
              { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark || colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <Text style={[styles.pct, { color: c.text, fontFamily: snPro('800') }]}>{shownPct}%</Text>
      </View>

      <View style={[styles.steps, { backgroundColor: isDark ? c.cardBg : '#FFFFFFCC', borderColor: c.border }]}>
        {STEPS.map(({ key, label, Icon }, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          const tone = done || active ? colors.primary : c.muted;
          return (
            <View key={key} style={styles.step}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: done ? colors.primary : active ? (isDark ? `${colors.primary}26` : colors.primarySoft) : 'transparent',
                    borderColor: done || active ? colors.primary : c.border,
                  },
                ]}
              >
                {done ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : active ? (
                  <Animated.View style={{ transform: [{ rotate: key === 'restarting' ? rotate : '0deg' }] }}>
                    <Icon size={14} color={colors.primary} strokeWidth={2.4} />
                  </Animated.View>
                ) : (
                  <Icon size={14} color={c.muted} strokeWidth={2} />
                )}
              </View>
              <Text style={[styles.stepLabel, { color: tone, fontFamily: snPro(active ? '800' : '600') }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.note, { color: c.muted, fontFamily: snPro('500') }]}>Please keep the app open</Text>
    </Animated.View>
  );
}

function UpdatedCard({ onDone }) {
  const { colors, isDark, themeColors: c } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.4)).current;
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(close, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.overlay, styles.dim, { opacity: fade }]} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      <Animated.View
        style={[styles.card, { backgroundColor: isDark ? c.cardBg : '#FFFFFF', transform: [{ scale: pop }] }]}
      >
        <View style={[styles.checkOuter, { backgroundColor: isDark ? `${colors.primary}26` : colors.primarySoft }]}>
          <View style={[styles.checkInner, { backgroundColor: colors.primary }]}>
            <Check size={34} color="#FFFFFF" strokeWidth={3.2} />
          </View>
        </View>
        <Text style={[styles.cardTitle, { color: c.text, fontFamily: poppins('700') }]}>App updated!</Text>
        <Text style={[styles.cardSub, { color: c.muted, fontFamily: snPro('500') }]}>
          You are on the latest version of Health line with new improvements and fixes.
        </Text>
        <Pressable
          onPress={close}
          style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, { fontFamily: snPro('800') }]}>Continue</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  logoWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  ring: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 2 },
  logoCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logo: { width: 104, height: 104 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: { fontSize: 11, letterSpacing: 1.2 },
  title: { fontSize: 24, textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center', maxWidth: 300 },
  progressBlock: { width: '100%', maxWidth: 340, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 30 },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
  pct: { width: 44, fontSize: 14, textAlign: 'right' },
  steps: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { fontSize: 12 },
  note: { fontSize: 12, marginTop: 22 },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  checkOuter: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  checkInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 22, textAlign: 'center' },
  cardSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  cta: { alignSelf: 'stretch', height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  ctaText: { color: '#FFFFFF', fontSize: 16 },
});
