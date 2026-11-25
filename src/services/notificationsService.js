import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { isEveryDay, isReminderOn } from './remindersService';

/**
 * Local reminders (scheduled on the device) + Expo push token for AdminPanel campaigns.
 * Web and Expo Go get safe no-ops: since SDK 53, Expo Go on Android throws as soon as
 * expo-notifications is imported ("runtime not ready"), so the module is only loaded in
 * real builds (APK / development build).
 */

const IS_NATIVE = Platform.OS !== 'web';
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const REMINDER_CHANNEL = 'reminders';
export const PUSH_CHANNEL = 'default';

/** Tag on every reminder we schedule, so re-syncing only replaces our own reminders. */
const REMINDER_TAG = 'healthline-reminder';

let notificationsModule;
/** expo-notifications, or null on web / Expo Go. Loaded lazily — importing it in Expo Go crashes the app. */
function notif() {
  if (!IS_NATIVE || IS_EXPO_GO) return null;
  if (notificationsModule === undefined) {
    try {
      // eslint-disable-next-line global-require
      notificationsModule = require('expo-notifications');
    } catch (err) {
      console.warn('Notifications unavailable', err?.message || err);
      notificationsModule = null;
    }
  }
  return notificationsModule;
}

let handlerSet = false;

/** Show notifications as banners even while the app is open. Call once at startup. */
export function initNotifications() {
  const N = notif();
  if (!N || handlerSet) return;
  handlerSet = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Calls `callback(notification)` for pushes that arrive while the app is open. Returns an unsubscribe. */
export function addNotificationReceivedListener(callback) {
  const N = notif();
  if (!N) return () => {};
  const sub = N.addNotificationReceivedListener(callback);
  return () => sub.remove();
}

/**
 * `callback(data)` when the user taps a notification — including the tap that launched the app
 * from a closed state. Returns an unsubscribe.
 */
export function addNotificationTapListener(callback) {
  const N = notif();
  if (!N) return () => {};
  const handled = new Set();
  const handle = (response) => {
    const req = response?.notification?.request;
    const id = `${req?.identifier || ''}:${response?.actionIdentifier || ''}`;
    if (!req || handled.has(id)) return;
    handled.add(id);
    callback(req.content?.data || {});
    // So a later app open doesn't replay the same tap.
    N.clearLastNotificationResponseAsync?.().catch(() => {});
  };
  // Cold start: the app was opened by tapping a notification.
  N.getLastNotificationResponseAsync()
    .then((response) => response && handle(response))
    .catch(() => {});
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

async function ensureChannels(N) {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Reminders',
    importance: N.AndroidImportance.DEFAULT,
  });
  await N.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: 'Updates from HealthLine',
    importance: N.AndroidImportance.HIGH,
  });
}

/** Asks the OS once; returns true when notifications may be shown. */
export async function ensurePermission({ ask = true } = {}) {
  const N = notif();
  if (!N) return false;
  await ensureChannels(N);
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!ask || !current.canAskAgain) return false;
  const next = await N.requestPermissionsAsync();
  return !!next.granted;
}

/**
 * Cancel our old reminders and schedule the ones that are ON. Returns how many were scheduled.
 * `catalog` is the admin's reminder list (remindersService); `reminders` are the user's toggles.
 */
export async function syncReminders(reminders = {}, catalog = []) {
  const N = notif();
  if (!N) return 0;

  const scheduled = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content?.data?.tag === REMINDER_TAG)
      .map((n) => N.cancelScheduledNotificationAsync(n.identifier)),
  );

  const enabled = catalog.filter((item) => isReminderOn(reminders, item));
  if (!enabled.length) return 0;
  if (!(await ensurePermission())) return 0;

  let count = 0;
  for (const item of enabled) {
    const { key, title, body, times, weekdays } = item;
    for (const time of times) {
      const [hour, minute] = time.split(':').map(Number);
      // All 7 days → one DAILY trigger; otherwise one WEEKLY trigger per picked day (1 = Sunday).
      const triggers = isEveryDay(item)
        ? [{ type: N.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: REMINDER_CHANNEL }]
        : weekdays.map((weekday) => ({
            type: N.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour,
            minute,
            channelId: REMINDER_CHANNEL,
          }));
      for (const trigger of triggers) {
        await N.scheduleNotificationAsync({
          content: { title, body, data: { tag: REMINDER_TAG, reminder: key } },
          trigger,
        });
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Expo push token for this install, or null (web, Expo Go, emulator, permission denied,
 * or Android build without Firebase / google-services.json).
 */
export async function getPushToken() {
  const N = notif();
  if (!N || !Device.isDevice) return null;
  if (!(await ensurePermission())) return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch (err) {
    console.warn('Push token unavailable', err?.message || err);
    return null;
  }
}
