import { Platform } from 'react-native';
import { ENV, apiBase } from '../config/env';

/**
 * Google sign-in:
 *   - Android app: native account picker → ID token.
 *   - Web: Google Identity Services popup → access token.
 * The AdminPanel verifies either one (POST /api/auth/google).
 */
export const GOOGLE_SIGN_IN_AVAILABLE = Platform.OS === 'android' || Platform.OS === 'web';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Error with a `code` the caller can switch on: 'cancelled' | 'unavailable' | 'failed'. */
function googleError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// ---------- Client IDs (Admin → Settings → Google) ----------

let configPromise = null;
/** Last config the server gave — read without waiting, so a tap opens the popup at once. */
let cachedConfig = null;

/**
 * { webClientId, androidClientId } from the AdminPanel, so changing a client ID needs no new
 * build. Falls back to ENV if the server can't be reached. Fetched again each time a Google
 * button appears (see preloadGoogleSignIn), so a change in Settings is picked up.
 */
export function loadGoogleConfig({ fresh = false } = {}) {
  if (configPromise && !fresh) return configPromise;
  const fallback = {
    webClientId: ENV.GOOGLE_WEB_CLIENT_ID || '',
    androidClientId: ENV.GOOGLE_ANDROID_CLIENT_ID || '',
  };
  configPromise = fetch(`${apiBase()}/api/auth/google/config`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cachedConfig = {
        webClientId: String(data?.webClientId || '').trim() || fallback.webClientId,
        androidClientId: String(data?.androidClientId || '').trim() || fallback.androidClientId,
      };
      return cachedConfig;
    })
    .catch(() => {
      configPromise = null; // try the server again next time
      return cachedConfig || fallback;
    });
  return configPromise;
}

async function webClientIdOrThrow() {
  const { webClientId } = cachedConfig || (await loadGoogleConfig());
  if (!webClientId) {
    throw googleError('Google sign-in is not set up yet. Please use email for now.', 'failed');
  }
  return webClientId;
}

// ---------- Web (Google Identity Services) ----------

let gisPromise = null;

/** Loads Google's sign-in script once. Call early (button mount) so the click opens the popup at once. */
export function preloadGoogleSignIn() {
  loadGoogleConfig({ fresh: true });
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(googleError('Could not load Google sign-in. Check your internet connection.', 'failed'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

async function getWebAccessToken() {
  // Both are normally ready from the button's mount — then nothing here waits, and the browser
  // still counts the popup as opened by the tap (not blocked).
  const clientId = await webClientIdOrThrow();
  if (!window.google?.accounts?.oauth2) await preloadGoogleSignIn();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw googleError('Could not load Google sign-in. Please try again.', 'failed');

  return new Promise((resolve, reject) => {
    let settled = false;
    let giveUpTimer = null;
    let closedTimer = null;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(giveUpTimer);
      clearTimeout(closedTimer);
      fn(value);
    };

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (res) => {
        if (res?.error) {
          finish(
            reject,
            res.error === 'access_denied'
              ? googleError('Google sign-in was cancelled.', 'cancelled')
              : googleError('Could not sign in with Google. Please try again.', 'failed'),
          );
          return;
        }
        if (!res?.access_token) {
          finish(reject, googleError('Google did not return your account details. Please try again.', 'failed'));
          return;
        }
        finish(resolve, res.access_token);
      },
      error_callback: (err) => {
        if (err?.type === 'popup_failed_to_open') {
          // Some browsers (e.g. Brave) open the popup but still report this. Don't give up —
          // the account choice can still arrive. Stop waiting only if nothing comes back.
          giveUpTimer = setTimeout(
            () => finish(reject, googleError('Allow pop-ups for this site to sign in with Google.', 'failed')),
            120000,
          );
          return;
        }
        if (err?.type === 'popup_closed') {
          // Short grace period: the result can land just after the window closes itself.
          closedTimer = setTimeout(
            () => finish(reject, googleError('Google sign-in was cancelled.', 'cancelled')),
            1500,
          );
          return;
        }
        finish(reject, googleError('Could not sign in with Google. Please try again.', 'failed'));
      },
    });
    // Always show the account chooser so a person can switch Google accounts.
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

// ---------- Android (native module) ----------

let configuredFor = '';

function loadNativeModule() {
  try {
    // Loaded lazily so web and Expo Go don't crash on the missing native module.
    // eslint-disable-next-line global-require
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

async function getAndroidIdToken() {
  const mod = loadNativeModule();
  if (!mod?.GoogleSignin) {
    throw googleError('Google sign-in needs the latest version of the app.', 'unavailable');
  }
  const { GoogleSignin, statusCodes } = mod;

  const webClientId = await webClientIdOrThrow();
  if (configuredFor !== webClientId) {
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
      scopes: ['profile', 'email'],
    });
    configuredFor = webClientId;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the account picker, so a person can switch Google accounts.
    await GoogleSignin.signOut().catch(() => {});
    const res = await GoogleSignin.signIn();
    if (res?.type === 'cancelled') throw googleError('Google sign-in was cancelled.', 'cancelled');
    const idToken = res?.data?.idToken;
    if (!idToken) throw googleError('Google did not return your account details. Please try again.', 'failed');
    return idToken;
  } catch (err) {
    if (err?.code === 'cancelled' || err?.code === 'failed' || err?.code === 'unavailable') throw err;
    if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw googleError('Google sign-in was cancelled.', 'cancelled');
    }
    if (err?.code === statusCodes.IN_PROGRESS) {
      throw googleError('Google sign-in is already open.', 'cancelled');
    }
    if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw googleError('Google Play services is not available on this phone.', 'unavailable');
    }
    throw googleError('Could not sign in with Google. Please try again.', 'failed');
  }
}

/**
 * Opens Google's account chooser. Returns { idToken } (Android) or { accessToken } (web).
 * Throws googleError(...) — code 'cancelled' when the person closes the chooser.
 */
export async function getGoogleCredential() {
  if (Platform.OS === 'web') return { accessToken: await getWebAccessToken() };
  if (Platform.OS === 'android') return { idToken: await getAndroidIdToken() };
  throw googleError('Google sign-in works in the Android app.', 'unavailable');
}
