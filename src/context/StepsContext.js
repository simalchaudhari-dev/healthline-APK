import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  getHealthConnectState,
  connectHealthConnect,
  openHealthConnect,
  getSensorState,
  requestSensor,
  openAppSettings,
  startLiveCounting,
  readStepDays,
} from '../services/stepsService';
import { IS_EXPO_GO } from '../services/notificationsService';
import { apiSaveSteps } from '../services/authService';
import { dateKey, dayStart } from '../utils/steps';
import { useAuth } from './AuthContext';
import { useDiary } from './DiaryContext';

/** Wait this long after the last change before saving steps to the account. */
const SAVE_DEBOUNCE_MS = 4000;
const REAL_SOURCES = ['health-connect', 'ios', 'phone-sensor'];

/** Last 7 days of steps saved on the account (diary days synced from the server), oldest → newest. */
function accountDays(diaryDays) {
  const now = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const key = dateKey(dayStart(DAYS - 1 - i, now));
    return { key, steps: Number(diaryDays?.[key]?.steps) || 0 };
  });
}

const StepsContext = createContext(null);
const DAYS = 7;

/**
 * Web and Expo Go can't read the phone's step sensor, so they show the steps the phone app saved to
 * the user's account (real data only — zeros until the phone has synced).
 */
export const STEPS_PREVIEW = Platform.OS === 'web' || IS_EXPO_GO;

/**
 * Real step data for Home + Steps screen. Re-reads whenever the app comes back to the foreground.
 * Permission popups are only shown from the Steps screen: once automatically when it opens (`askOnce`),
 * then whenever the user taps the button (`connect`).
 */
export function StepsProvider({ children }) {
  const [hcState, setHcState] = useState(Platform.OS === 'android' ? 'checking' : 'unsupported');
  const [sensorState, setSensorState] = useState('undetermined');
  const [sensorCanAsk, setSensorCanAsk] = useState(true);
  const [source, setSource] = useState(null);
  /** Health Connect is allowed but holds no steps (no Fit / Samsung Health / watch writing to it). */
  const [hcEmpty, setHcEmpty] = useState(false);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const liveStop = useRef(null);
  const askedThisSession = useRef(false);
  const { accessToken } = useAuth();
  const { days: diaryDays } = useDiary();
  const lastSaved = useRef('');

  // Phone: save the real daily totals to the account so web / other devices / reports see them.
  useEffect(() => {
    if (STEPS_PREVIEW || !accessToken || !REAL_SOURCES.includes(source)) return undefined;
    // Only days with steps — a phone that counted nothing must not wipe another device's numbers.
    const payload = days.filter((d) => d.steps > 0).map((d) => ({ date: d.key, steps: d.steps }));
    const signature = `${accessToken}|${JSON.stringify(payload)}`;
    if (!payload.length || signature === lastSaved.current) return undefined;
    const t = setTimeout(() => {
      apiSaveSteps(accessToken, { today: dateKey(), days: payload })
        .then(() => {
          lastSaved.current = signature;
        })
        .catch(() => {
          // Offline — retried on the next change / refresh.
        });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [days, source, accessToken]);

  const refresh = useCallback(async () => {
    if (STEPS_PREVIEW) {
      setSource('account');
      setLoading(false);
      return { hc: 'unsupported', sensor: { status: 'unavailable', canAskAgain: false } };
    }
    setLoading(true);
    try {
      const hcNow = await getHealthConnectState();
      setHcState(hcNow);
      const sensorNow = await getSensorState();
      setSensorState(sensorNow.status);
      setSensorCanAsk(sensorNow.canAskAgain);
      const result = await readStepDays(DAYS, { healthConnectReady: hcNow === 'ready' });
      setSource(result.source);
      setDays(result.days);
      setHcEmpty(!!result.healthConnectEmpty);
      setError('');
      return { hc: hcNow, sensor: sensorNow, hcEmpty: !!result.healthConnectEmpty };
    } catch (err) {
      setError(err?.message || 'Could not read steps.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Fallback only: count live while the app is open when Health Connect isn't connected.
  useEffect(() => {
    const useSensor = source === 'phone-sensor' && sensorState === 'granted';
    if (!useSensor) return undefined;
    liveStop.current = startLiveCounting((todaySteps) => {
      setDays((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], steps: todaySteps };
        return next;
      });
    });
    return () => {
      liveStop.current?.();
      liveStop.current = null;
    };
  }, [source, sensorState]);

  /** Ask for the best permission we can get right now. Returns after the popup closes. */
  const promptFor = useCallback(async (hc, sensor) => {
    if (hc === 'needs-permission') {
      await connectHealthConnect();
    } else if (sensor.status !== 'granted' && sensor.status !== 'unavailable' && sensor.canAskAgain) {
      await requestSensor();
    }
  }, []);

  /** Called when the Steps screen opens: shows the permission popup once per app session. */
  const askOnce = useCallback(async () => {
    if (askedThisSession.current || STEPS_PREVIEW) return;
    askedThisSession.current = true;
    const state = await refresh();
    if (!state) return;
    // Health Connect allowed but empty → still ask for the phone sensor, which counts instead.
    const connectedNow =
      (state.hc === 'ready' && !state.hcEmpty) || Platform.OS === 'ios' || state.sensor.status === 'granted';
    if (connectedNow) return;
    try {
      await promptFor(state.hc, state.sensor);
    } catch (err) {
      setError(err?.message || 'Could not ask for permission.');
    }
    await refresh();
  }, [refresh, promptFor]);

  /** Main button on the Steps screen. */
  const connect = useCallback(async () => {
    try {
      if (hcState === 'needs-permission') {
        await connectHealthConnect();
      } else if (hcState === 'not-installed' || hcState === 'update-required') {
        await openHealthConnect(hcState);
        return; // user comes back from the Play Store → AppState 'active' refreshes
      } else if (sensorCanAsk) {
        await requestSensor();
      } else {
        await openAppSettings();
        return; // back from Settings → AppState 'active' refreshes
      }
    } catch (err) {
      setError(err?.message || 'Could not connect.');
    }
    await refresh();
  }, [hcState, sensorCanAsk, refresh]);

  /** Health Connect missing: count with the phone sensor instead (popup, or Settings if blocked). */
  const useSensorInstead = useCallback(async () => {
    if (sensorCanAsk) {
      await requestSensor();
      await refresh();
    } else {
      await openAppSettings();
    }
  }, [sensorCanAsk, refresh]);

  const value = useMemo(() => {
    // Web / Expo Go: only the real steps the phone saved to the account (zeros until it syncs).
    const shownDays = STEPS_PREVIEW ? accountDays(diaryDays) : days;
    const shownSource = STEPS_PREVIEW ? 'account' : source;
    const today = shownDays.length ? shownDays[shownDays.length - 1].steps : 0;
    const live =
      shownSource === 'account' ||
      shownSource === 'health-connect' ||
      shownSource === 'ios' ||
      sensorState === 'granted';
    return {
      days: shownDays,
      today,
      source: shownSource,
      hcState,
      sensorState,
      sensorCanAsk,
      /** Health Connect connected but no app writes steps to it — the phone sensor is counting. */
      healthConnectEmpty: !STEPS_PREVIEW && hcEmpty,
      /** true when numbers are flowing (real, or the labelled sample week in preview) */
      connected: live,
      /** Web / Expo Go: showing account steps synced by the phone, not reading the sensor here */
      isAccountView: shownSource === 'account',
      /** true once any step data exists for the shown week */
      hasSteps: shownDays.some((d) => d.steps > 0),
      /** kept for older callers — there is no sample data any more */
      isPreview: false,
      loading,
      error,
      refresh,
      askOnce,
      connect,
      useSensorInstead,
      openAppSettings,
      openSettings: () => openHealthConnect(hcState),
    };
  }, [
    days,
    diaryDays,
    source,
    hcState,
    hcEmpty,
    sensorState,
    sensorCanAsk,
    loading,
    error,
    refresh,
    askOnce,
    connect,
    useSensorInstead,
  ]);

  return <StepsContext.Provider value={value}>{children}</StepsContext.Provider>;
}

export function useSteps() {
  const ctx = useContext(StepsContext);
  if (!ctx) throw new Error('useSteps must be used within StepsProvider');
  return ctx;
}
