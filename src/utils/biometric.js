import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Fingerprint / face sign-in (like Google Pay): the user signs in normally once, then turns this
 * on. The phone checks the finger or face itself — the app never sees or stores biometric data.
 * On success we open this phone's saved sign-in (kept in the Android Keystore via SecureStore).
 * One person per phone: turning it on for a new account replaces the previous one.
 */

export const BIOMETRIC_SUPPORTED = Platform.OS !== 'web';

/** Shown before turning it on: the phone decides who matches, not the app. */
export const BIOMETRIC_NOTE =
  '⚠ Every fingerprint and face saved in this phone’s screen lock will be able to open this account. ' +
  'Turn this on only if the phone’s screen lock has just your own fingerprints / face.';

const BIO_KEY = 'healthline_biometric_login_v1';

let moduleRef;
function la() {
  if (!BIOMETRIC_SUPPORTED) return null;
  if (moduleRef === undefined) {
    try {
      // eslint-disable-next-line global-require
      moduleRef = require('expo-local-authentication');
    } catch {
      moduleRef = null; // an APK built before this package was added
    }
  }
  return moduleRef;
}

/** { available, label } — available only when the phone has a sensor AND a finger/face set up. */
export async function getBiometricInfo() {
  const LA = la();
  if (!LA) return { available: false, label: 'Fingerprint' };
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LA.hasHardwareAsync(),
      LA.isEnrolledAsync(),
      LA.supportedAuthenticationTypesAsync(),
    ]);
    const finger = types?.includes(LA.AuthenticationType.FINGERPRINT);
    const face = types?.includes(LA.AuthenticationType.FACIAL_RECOGNITION);
    const label = finger && face ? 'Fingerprint / Face' : face ? 'Face unlock' : 'Fingerprint';
    return { available: Boolean(hasHardware && enrolled), label };
  } catch {
    return { available: false, label: 'Fingerprint' };
  }
}

/** Shows the phone's fingerprint / face sheet. Returns { ok, cancelled }. */
export async function authenticateBiometric(promptMessage = 'Sign in to Health line') {
  const LA = la();
  if (!LA) return { ok: false, cancelled: false };
  try {
    const res = await LA.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      // Phone PIN / pattern also works if the finger or face isn't read (as in Google Pay).
      disableDeviceFallback: false,
      // 'weak' lets most Android face unlock work too, not only fingerprint.
      biometricsSecurityLevel: 'weak',
    });
    if (res.success) return { ok: true, cancelled: false };
    const cancelled = ['user_cancel', 'system_cancel', 'app_cancel'].includes(res.error);
    return { ok: false, cancelled };
  } catch {
    return { ok: false, cancelled: false };
  }
}

/** Saved sign-in for this phone: { token, userId, email, name } or null. */
export async function readBiometricLogin() {
  if (!BIOMETRIC_SUPPORTED) return null;
  try {
    const raw = await SecureStore.getItemAsync(BIO_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.token && data.userId ? data : null;
  } catch {
    return null;
  }
}

export async function saveBiometricLogin({ token, user }) {
  if (!BIOMETRIC_SUPPORTED || !token || !user?.id) return false;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.displayName || user.email || '';
  await SecureStore.setItemAsync(
    BIO_KEY,
    JSON.stringify({ token, userId: user.id, email: user.email || '', name }),
  );
  return true;
}

export async function clearBiometricLogin() {
  if (!BIOMETRIC_SUPPORTED) return;
  try {
    await SecureStore.deleteItemAsync(BIO_KEY);
  } catch {
    // already gone
  }
}
