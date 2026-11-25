/**
 * Which screen a tapped notification opens. Pure (no React Native) so it can be tested in Node.
 *
 * Notification `data` comes from:
 *  - AdminPanel push campaigns → { notificationId }            (src/lib/expo-push.js on the server)
 *  - Local reminders           → { tag: 'healthline-reminder', reminder: '<key>' } (notificationsService)
 */

/** Reminder key → screen. Tabs live inside the 'Main' navigator. */
const REMINDER_ROUTES = {
  breakfast: { name: 'Main', params: { screen: 'Diary' } },
  lunch: { name: 'Main', params: { screen: 'Diary' } },
  dinner: { name: 'Main', params: { screen: 'Diary' } },
  snack: { name: 'Main', params: { screen: 'Diary' } },
  foodLog: { name: 'Main', params: { screen: 'Diary' } },
  water: { name: 'Main', params: { screen: 'Dashboard' } },
  exercise: { name: 'HomeExercises' },
  weighIn: { name: 'LogWeight' },
  mealPlan: { name: 'MealPlan' },
};

/** `{ name, params? }` to navigate to, or null to just open the app where it was. */
export function routeForNotification(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.notificationId) {
    return { name: 'Notifications', params: { highlightId: String(data.notificationId) } };
  }
  if (data.reminder && REMINDER_ROUTES[data.reminder]) {
    return REMINDER_ROUTES[data.reminder];
  }
  // Unknown reminder keys (added later in AdminPanel) still land somewhere useful.
  if (data.tag === 'healthline-reminder') return { name: 'Main', params: { screen: 'Dashboard' } };
  return null;
}
