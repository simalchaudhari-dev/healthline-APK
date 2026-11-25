import { createNavigationContainerRef } from '@react-navigation/native';

/** Lets code outside screens (notification taps) navigate. Attached in App.js. */
export const navigationRef = createNavigationContainerRef();

let pending = null;
let signedIn = false;

function tryNavigate() {
  // Wait for sign-in: every screen sits in one stack, so navigating while signed out would skip login.
  if (!pending || !signedIn || !navigationRef.isReady()) return;
  const { name, params } = pending;
  pending = null;
  navigationRef.navigate(name, params);
}

/** Open `{ name, params }` now, or as soon as the user is signed in and navigation is ready. */
export function openWhenReady(target) {
  if (!target) return;
  pending = target;
  tryNavigate();
}

/** App.js → NavigationContainer onReady (it remounts on sign-in / sign-out). */
export function onNavigationReady() {
  tryNavigate();
}

/** NotificationsBridge keeps this in sync with AuthContext. */
export function setSignedIn(value) {
  signedIn = !!value;
  // Give the signed-in navigator a tick to mount before navigating.
  if (signedIn) setTimeout(tryNavigate, 0);
}
