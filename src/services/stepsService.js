import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pedometer } from 'expo-sensors';
import { STEPS_LOCAL_KEY } from '../config/storageKeys';
import { dateKey, dayStart } from '../utils/steps';
import { IS_EXPO_GO } from './notificationsService';

/**
 * Real step data, best source first:
 *  1. Android → Health Connect: daily totals from the phone's step counter, Samsung Health, Google Fit,
 *     watches… works even when HealthLine is closed.
 *  2. iOS → Core Motion (Pedometer.getStepCountAsync): history from the phone.
 *  3. Fallback → phone sensor live count while the app is open, saved per day on this device.
 */

const HC_PLAY_URL = 'market://details?id=com.google.android.apps.healthdata';
const HC_WEB_URL = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const STEPS_PERMISSION = [{ accessType: 'read', recordType: 'Steps' }];
const LOCAL_DAYS_KEPT = 30;

// Loaded lazily: the native module throws at import time where it doesn't exist (web, iOS, Expo Go).
let hcModule;
function hc() {
  if (Platform.OS !== 'android' || IS_EXPO_GO) return null;
  if (hcModule === undefined) {
    try {
      // eslint-disable-next-line global-require
      hcModule = require('react-native-health-connect');
    } catch {
      hcModule = null;
    }
  }
  return hcModule;
}

/**
 * Health Connect state without prompting the user:
 * 'ready' | 'needs-permission' | 'not-installed' | 'update-required' | 'unsupported'
 */
export async function getHealthConnectState() {
  const HC = hc();
  if (!HC) return 'unsupported';
  try {
    const status = await HC.getSdkStatus();
    if (status === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'not-installed';
    if (status === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update-required';
    if (status !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return 'not-installed';
    await HC.initialize();
    const granted = await HC.getGrantedPermissions();
    const canRead = (granted || []).some((p) => p.recordType === 'Steps' && p.accessType === 'read');
    return canRead ? 'ready' : 'needs-permission';
  } catch {
    // Native module missing (e.g. an APK built before Health Connect was added) — treat as unsupported.
    return 'unsupported';
  }
}

/** Shows the Health Connect permission sheet. Returns true when steps can be read. */
export async function connectHealthConnect() {
  const HC = hc();
  if (!HC) return false;
  await HC.initialize();
  const granted = await HC.requestPermission(STEPS_PERMISSION);
  return (granted || []).some((p) => p.recordType === 'Steps' && p.accessType === 'read');
}

/** Install / update Health Connect from the Play Store, or open its settings when installed. */
export async function openHealthConnect(state) {
  const HC = hc();
  if (HC && state === 'ready') {
    HC.openHealthConnectSettings();
    return;
  }
  try {
    await Linking.openURL(HC_PLAY_URL);
  } catch {
    await Linking.openURL(HC_WEB_URL);
  }
}

/** Daily step totals for the last `count` days from Health Connect, oldest → newest. */
async function readHealthConnectDays(count) {
  const HC = hc();
  const now = new Date();
  const ranges = Array.from({ length: count }, (_, i) => {
    const daysAgo = count - 1 - i;
    const start = dayStart(daysAgo, now);
    const end = daysAgo === 0 ? now : dayStart(daysAgo - 1, now);
    return { key: dateKey(start), start, end };
  });
  const totals = await Promise.all(
    ranges.map((r) =>
      HC.aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: r.start.toISOString(), endTime: r.end.toISOString() },
      })
        .then((res) => Number(res?.COUNT_TOTAL) || 0)
        .catch(() => 0),
    ),
  );
  return ranges.map((r, i) => ({ key: r.key, steps: totals[i] }));
}

/** iOS: Core Motion keeps ~7 days of history. */
async function readIosDays(count) {
  const now = new Date();
  return Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const daysAgo = count - 1 - i;
      const start = dayStart(daysAgo, now);
      const end = daysAgo === 0 ? now : dayStart(daysAgo - 1, now);
      try {
        const { steps } = await Pedometer.getStepCountAsync(start, end);
        return { key: dateKey(start), steps: steps || 0 };
      } catch {
        return { key: dateKey(start), steps: 0 };
      }
    }),
  );
}

// ---------- Fallback: live sensor count while the app is open (saved per day on this device) ----------

async function loadLocal() {
  try {
    const raw = await AsyncStorage.getItem(STEPS_LOCAL_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

async function saveLocal(map) {
  const keys = Object.keys(map).sort().slice(-LOCAL_DAYS_KEPT);
  const trimmed = Object.fromEntries(keys.map((k) => [k, map[k]]));
  await AsyncStorage.setItem(STEPS_LOCAL_KEY, JSON.stringify(trimmed)).catch(() => {});
}

async function readLocalDays(count) {
  const map = await loadLocal();
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const key = dateKey(dayStart(count - 1 - i, now));
    return { key, steps: Number(map[key]) || 0 };
  });
}

/**
 * Physical-activity permission for the phone sensor — never prompts.
 * status: 'granted' | 'denied' | 'undetermined' | 'unavailable'
 * canAskAgain: Android reports 'denied' even before the first ask; the popup can still be shown while
 * this is true. It becomes false after the user picks "Don't allow" twice — then only Settings works.
 */
export async function getSensorState() {
  if (Platform.OS === 'web') return { status: 'unavailable', canAskAgain: false };
  try {
    if (!(await Pedometer.isAvailableAsync())) return { status: 'unavailable', canAskAgain: false };
    const { status, canAskAgain } = await Pedometer.getPermissionsAsync();
    return { status, canAskAgain: canAskAgain !== false };
  } catch {
    return { status: 'unavailable', canAskAgain: false };
  }
}

/** Shows the Android "Allow physical activity?" popup. */
export async function requestSensor() {
  try {
    const { status, canAskAgain } = await Pedometer.requestPermissionsAsync();
    return { status, canAskAgain: canAskAgain !== false };
  } catch {
    return { status: 'denied', canAskAgain: false };
  }
}

/** Opens this app's page in phone Settings (Permissions live there). */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch {
    // Some launchers block it — the screen also shows the path in text.
  }
}

/**
 * Counts steps while the app is open and adds them to today's saved total.
 * Returns an unsubscribe function. `onChange(todaySteps)` fires after each update.
 */
export function startLiveCounting(onChange) {
  let lastReading = 0;
  let queue = Promise.resolve();
  const sub = Pedometer.watchStepCount(({ steps }) => {
    const delta = Math.max(0, (steps || 0) - lastReading);
    lastReading = steps || 0;
    if (!delta) return;
    // Serialise writes so quick updates don't overwrite each other.
    queue = queue.then(async () => {
      const map = await loadLocal();
      const key = dateKey();
      map[key] = (Number(map[key]) || 0) + delta;
      await saveLocal(map);
      onChange?.(map[key]);
    });
  });
  return () => sub?.remove();
}

/**
 * Last `count` days of steps from the best available source.
 * Returns { source: 'health-connect' | 'ios' | 'phone-sensor', days, healthConnectEmpty? }.
 */
export async function readStepDays(count, { healthConnectReady }) {
  if (Platform.OS === 'android' && healthConnectReady) {
    const hcDays = await readHealthConnectDays(count);
    if (hcDays.some((d) => d.steps > 0)) return { source: 'health-connect', days: hcDays };
    // Health Connect only stores steps that another app writes (Google Fit, Samsung Health, a
    // watch…). Nothing there for the whole week → no such app: count with the phone sensor instead.
    // When step data starts arriving in Health Connect, the next refresh switches back.
    return { source: 'phone-sensor', days: await readLocalDays(count), healthConnectEmpty: true };
  }
  if (Platform.OS === 'ios') {
    return { source: 'ios', days: await readIosDays(count) };
  }
  return { source: 'phone-sensor', days: await readLocalDays(count) };
}
