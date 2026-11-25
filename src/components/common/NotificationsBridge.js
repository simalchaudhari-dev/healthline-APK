import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useDiary } from '../../context/DiaryContext';
import { useReminderCatalog } from '../../context/ReminderCatalogContext';
import { apiRegisterPushToken } from '../../services/authService';
import {
  initNotifications,
  syncReminders,
  getPushToken,
  addNotificationTapListener,
} from '../../services/notificationsService';
import { openWhenReady, setSignedIn } from '../../navigation/navigationRef';
import { routeForNotification } from '../../navigation/notificationRoutes';
import { PUSH_TOKEN_KEY } from '../../config/storageKeys';

initNotifications();

/**
 * Renders nothing. Keeps device reminders in sync with the admin reminder list + user toggles
 * and registers the push token with AdminPanel once the user is signed in.
 */
export default function NotificationsBridge() {
  const { accessToken, isSignedIn } = useAuth();
  const { hydrated, reminders } = useDiary();
  const { catalog, ready: catalogReady } = useReminderCatalog();
  const registeredFor = useRef(null);

  // Tapping a notification opens its screen (after login if the user is signed out).
  useEffect(() => addNotificationTapListener((data) => openWhenReady(routeForNotification(data))), []);
  useEffect(() => {
    setSignedIn(isSignedIn);
  }, [isSignedIn]);

  useEffect(() => {
    if (!hydrated || !catalogReady) return;
    syncReminders(reminders, catalog).catch((err) =>
      console.warn('Reminder sync failed', err?.message || err),
    );
  }, [hydrated, catalogReady, reminders, catalog]);

  useEffect(() => {
    if (!accessToken || registeredFor.current === accessToken) return;
    let cancelled = false;
    (async () => {
      const pushToken = await getPushToken();
      if (!pushToken || cancelled) return;
      try {
        await apiRegisterPushToken(accessToken, pushToken);
        registeredFor.current = accessToken;
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
      } catch (err) {
        console.warn('Push token register failed', err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return null;
}
