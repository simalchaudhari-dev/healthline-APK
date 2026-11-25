import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARD_KEY, PUSH_TOKEN_KEY } from '../config/storageKeys';
import { clearSession, readSession, saveSession } from '../utils/sessionStore';
import { PASSWORD_MIN, PASSWORD_MAX } from '../utils/validation';
import { toast } from '../utils/toast';
import { loader } from '../utils/loader';
import { localDateKey } from '../utils/streak';
import { onTokenBalance } from '../utils/tokenBalanceBus';
import {
  apiForgotPassword,
  apiGoogleCheck,
  apiGoogleSignIn,
  apiMe,
  onAuthRejected,
  apiRefreshToken,
  apiResetPassword,
  apiSignIn,
  apiSignUp,
  apiStreakCheckIn,
  apiUnregisterPushToken,
  apiUpdateMe,
  apiUploadImage,
  apiVerifyResetOtp,
} from '../services/authService';
import { getGoogleCredential } from '../utils/googleSignIn';
import {
  BIOMETRIC_SUPPORTED,
  authenticateBiometric,
  clearBiometricLogin,
  getBiometricInfo,
  readBiometricLogin,
  saveBiometricLogin,
} from '../utils/biometric';

const AuthContext = createContext(null);

const DAY_MS = 24 * 60 * 60 * 1000;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** { iat, exp } in ms from a login token's payload, or null. Not a check that it is genuine. */
function tokenTimes(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    let bits = 0;
    let value = 0;
    let text = '';
    for (let i = 0; i < b64.length; i += 1) {
      const n = B64.indexOf(b64[i]);
      if (n < 0) continue;
      value = (value << 6) | n;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        text += String.fromCharCode((value >> bits) & 0xff);
      }
    }
    const payload = JSON.parse(text);
    const iat = Number(payload?.iat) * 1000;
    const exp = Number(payload?.exp) * 1000;
    return Number.isFinite(iat) && Number.isFinite(exp) ? { iat, exp } : null;
  } catch {
    return null;
  }
}

const isSignedOutError = (err) => err?.status === 401 || err?.status === 403;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/**
 * Signup day on this phone's calendar. The server's `joined` is the UTC date, which is a day
 * off for some time zones (an evening signup west of UTC would be "tomorrow"). Never after today.
 */
function joinedDay(user) {
  const at = Date.parse(user?.createdAt || '');
  const key = Number.isFinite(at) ? localDateKey(new Date(at)) : String(user?.joined || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const today = localDateKey();
  return key > today ? today : key;
}

function mapUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: user.displayName || user.name || '',
    role: user.role || 'user',
    plan: user.plan || 'Free',
    tokenBalance: Math.max(0, Number(user.tokenBalance) || 0),
    status: user.status || 'Active',
    subscription: user.subscription && typeof user.subscription === 'object' ? user.subscription : null,
    photoURL: user.photoURL || '',
    photoPublicId: user.photoPublicId || '',
    phoneNumber: user.phoneNumber || '',
    profile: user.profile && typeof user.profile === 'object' ? user.profile : null,
    streak: user.streak && typeof user.streak === 'object' ? user.streak : null,
    /** Signup day (YYYY-MM-DD) — the earliest date a health report can start from. */
    joined: joinedDay(user),
  };
}

export function AuthProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  const persist = useCallback(async (token, user) => {
    if (!token || !user) {
      await clearSession();
      return;
    }
    await saveSession(token, user);
  }, []);

  const applyAuth = useCallback(
    async (token, user) => {
      const mapped = mapUser(user);
      setAccessToken(token);
      setSession(mapped);
      await persist(token, mapped);
      return mapped;
    },
    [persist]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await readSession();
        if (cancelled) return;
        const token = saved.token;
        const cachedUser = mapUser(saved.user);

        if (!token) return;

        setAccessToken(token);
        if (cachedUser) setSession(cachedUser);

        try {
          const data = await apiMe(token);
          if (cancelled) return;
          const mapped = mapUser(data?.user);
          // A 200 with no usable user is a server glitch, not a sign-out: keep the cached session
          // (set above) and try again next launch, like any other /me error.
          if (!mapped) return;
          if (mapped.status === 'Blocked') {
            setAccessToken(null);
            setSession(null);
            await clearSession();
            return;
          }
          setSession(mapped);
          await persist(token, mapped);

          // Login tokens last a few days. A token older than a day is swapped for a new one at
          // start-up, so someone who opens the app stays signed in instead of hitting errors.
          const times = tokenTimes(token);
          if (times && Date.now() - times.iat > DAY_MS) {
            const fresh = await apiRefreshToken(token).catch((err) => {
              if (isSignedOutError(err)) throw err;
              return null; // offline / server down: try again next time
            });
            if (cancelled) return;
            if (fresh?.accessToken) {
              const user = mapUser(fresh.user) || mapped;
              setAccessToken(fresh.accessToken);
              setSession(user);
              await persist(fresh.accessToken, user);
            }
          }
        } catch (err) {
          if (cancelled) return;
          if (isSignedOutError(err)) {
            // Expired or not valid any more: say so and show sign-in, instead of a signed-in
            // screen where nothing can load or save.
            setAccessToken(null);
            setSession(null);
            await clearSession();
            toast.info(
              err.status === 403 ? err.message : 'Your sign-in has expired. Please sign in again.',
            );
          }
          // Otherwise (offline, server starting): keep the cached session and try next time.
        }
      } catch {
        // defaults
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  // Daily streak: one check-in per local day whenever the app opens or returns to the foreground.
  const lastCheckInRef = useRef('');
  const checkInStreak = useCallback(async () => {
    if (!accessToken) return;
    const date = localDateKey();
    const key = `${accessToken}:${date}`;
    if (lastCheckInRef.current === key) return;
    lastCheckInRef.current = key;
    try {
      const data = await apiStreakCheckIn(accessToken, { date });
      if (!data?.streak) return;
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, streak: data.streak };
        persist(accessToken, next);
        return next;
      });
    } catch {
      // Offline / server down — retry on the next open.
      lastCheckInRef.current = '';
    }
  }, [accessToken, persist]);

  useEffect(() => {
    if (!hydrated || !accessToken) return undefined;
    checkInStreak();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkInStreak();
    });
    return () => sub.remove();
  }, [hydrated, accessToken, checkInStreak]);

  // App left open for days: when it comes back and the token ends within two days, renew it.
  // (Start-up already renews; this only covers an app that is never closed.)
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const refreshingRef = useRef(false);
  const renewIfEnding = useCallback(async () => {
    const token = accessToken;
    const times = tokenTimes(token);
    if (!token || !times || refreshingRef.current) return;
    if (times.exp - Date.now() > 2 * DAY_MS) return;
    refreshingRef.current = true;
    try {
      const fresh = await apiRefreshToken(token);
      if (fresh?.accessToken) {
        const user = mapUser(fresh.user) || sessionRef.current;
        setAccessToken(fresh.accessToken);
        setSession(user);
        await persist(fresh.accessToken, user);
      }
    } catch (err) {
      // onAuthRejected (from the request itself) has already signed out and told the person.
      if (isSignedOutError(err) && forcedOutRef.current !== token) {
        setAccessToken(null);
        setSession(null);
        await clearSession();
        toast.info('Your sign-in has expired. Please sign in again.');
      }
    } finally {
      refreshingRef.current = false;
    }
  }, [accessToken, persist]);

  useEffect(() => {
    if (!hydrated || !accessToken) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') renewIfEnding();
    });
    return () => sub.remove();
  }, [hydrated, accessToken, renewIfEnding]);

  // ---- Account deleted / blocked / expired while the app is open → sign out at once ----
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;
  /** Token already signed out by the server — so one rejection gives one toast, not several. */
  const forcedOutRef = useRef('');

  useEffect(
    () =>
      onAuthRejected(async (message, token) => {
        // Start-up has its own handling; and only the current session counts.
        if (!hydratedRef.current || !token || token !== accessTokenRef.current) return;
        if (forcedOutRef.current === token) return;
        forcedOutRef.current = token;
        const goneUserId = sessionRef.current?.id;
        setAccessToken(null);
        setSession(null);
        await clearSession();
        await AsyncStorage.removeItem(ONBOARD_KEY).catch(() => {});
        // Deleted / blocked / expired: the saved fingerprint sign-in for this account can't work.
        const saved = await readBiometricLogin();
        if (saved && saved.userId === goneUserId) {
          await clearBiometricLogin();
          setBiometricUser(null);
        }
        toast.info(message || 'Your sign-in has expired. Please sign in again.');
      }),
    [],
  );

  // ---- Fingerprint / face sign-in (this phone only; the phone checks the finger or face) ----
  const [biometricInfo, setBiometricInfo] = useState({ available: false, label: 'Fingerprint' });
  /** Account saved for fingerprint sign-in on this phone: { userId, email, name } or null. */
  const [biometricUser, setBiometricUser] = useState(null);

  useEffect(() => {
    if (!BIOMETRIC_SUPPORTED) return undefined;
    getBiometricInfo().then(setBiometricInfo).catch(() => {});
    readBiometricLogin()
      .then((saved) => setBiometricUser(saved ? { userId: saved.userId, email: saved.email, name: saved.name } : null))
      .catch(() => {});
    // A fingerprint / face added in phone Settings while the app was in the background:
    // check again on return, so the toggle and the Sign In card appear without a restart.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getBiometricInfo().then(setBiometricInfo).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Keep the saved sign-in current: every new token (sign-in, daily renew) replaces the old one,
  // so fingerprint sign-in keeps working after logout until the token itself runs out.
  useEffect(() => {
    if (!accessToken || !session?.id || !biometricUser || biometricUser.userId !== session.id) return;
    saveBiometricLogin({ token: accessToken, user: session }).catch(() => {});
  }, [accessToken, session, biometricUser]);

  /** Turn on for the signed-in account (asks for the finger / face first). */
  const enableBiometric = useCallback(async () => {
    const token = accessTokenRef.current;
    const user = sessionRef.current;
    if (!token || !user?.id) return { ok: false, error: 'Sign in first.' };
    const info = await getBiometricInfo();
    setBiometricInfo(info);
    if (!info.available) {
      const msg = 'Set up a fingerprint or face unlock in your phone settings first.';
      toast.warning(msg);
      return { ok: false, error: msg };
    }
    const check = await authenticateBiometric(`Turn on ${info.label} sign-in`);
    if (!check.ok) return { ok: false, cancelled: check.cancelled, error: '' };
    try {
      await saveBiometricLogin({ token, user });
      const saved = await readBiometricLogin();
      setBiometricUser(saved ? { userId: saved.userId, email: saved.email, name: saved.name } : null);
    } catch {
      // The phone's secure storage refused the write — say so instead of failing silently.
      const msg = 'Could not turn on fingerprint sign-in on this phone. Please try again.';
      toast.error(msg);
      return { ok: false, error: msg };
    }
    toast.success(`${info.label} sign-in is on for this phone`);
    return { ok: true };
  }, []);

  const disableBiometric = useCallback(async () => {
    await clearBiometricLogin();
    setBiometricUser(null);
    toast.info('Fingerprint sign-in turned off');
  }, []);

  /** Sign in with the saved account after the finger / face check. Same result shape as signIn. */
  const signInWithBiometric = useCallback(async () => {
    const saved = await readBiometricLogin();
    if (!saved) return { ok: false, error: 'Fingerprint sign-in is not set up on this phone.' };
    const check = await authenticateBiometric(`Sign in as ${saved.name || saved.email}`);
    if (!check.ok) return { ok: false, cancelled: check.cancelled, error: '' };
    try {
      loader.show('Signing in...');
      // Swap the saved token for a fresh one — this also proves the account still exists.
      const fresh = await apiRefreshToken(saved.token);
      if (!fresh?.accessToken) throw new Error('Could not sign in. Please try again.');
      if (fresh.user?.status === 'Blocked') {
        await clearBiometricLogin();
        setBiometricUser(null);
        toast.error('This account has been blocked.');
        return { ok: false, error: 'This account has been blocked.' };
      }
      const user = await applyAuth(fresh.accessToken, fresh.user);
      await saveBiometricLogin({ token: fresh.accessToken, user });
      toast.success('Signed in');
      return { ok: true, user };
    } catch (err) {
      if (isSignedOutError(err)) {
        // Too long since the last sign-in (or the account is gone): one normal sign-in needed.
        await clearBiometricLogin();
        setBiometricUser(null);
        const msg = 'Please sign in with email or Google once more, then turn fingerprint sign-in on again.';
        toast.info(msg);
        return { ok: false, error: msg };
      }
      const msg = err?.message || 'Could not sign in. Please try again.';
      toast.error(msg);
      return { ok: false, error: msg };
    } finally {
      loader.hide();
    }
  }, [applyAuth]);

  // A deleted account makes no API call fail until the person does something — so check the
  // session every minute while the app is open, and whenever it comes back to the front.
  useEffect(() => {
    if (!hydrated || !accessToken) return undefined;
    const check = () => {
      if (AppState.currentState && AppState.currentState !== 'active') return;
      apiMe(accessToken).catch(() => {}); // a 401/blocked reply signs out via onAuthRejected
    };
    const timer = setInterval(check, 60000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [hydrated, accessToken]);

  useEffect(() => {
    return onTokenBalance((balance) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, tokenBalance: balance };
        if (accessToken) persist(accessToken, next);
        return next;
      });
    });
  }, [accessToken, persist]);

  const signUp = useCallback(
    async ({ email, password, firstName, lastName, phoneNumber, profile }) => {
      const key = normalizeEmail(email);
      if (!key || !key.includes('@')) {
        toast.error('Enter a valid email address.');
        return { ok: false, error: 'Enter a valid email address.' };
      }
      if (!password || String(password).length < PASSWORD_MIN) {
        const msg = `Password must be at least ${PASSWORD_MIN} characters.`;
        toast.warning(msg);
        return { ok: false, error: msg };
      }
      if (String(password).length > PASSWORD_MAX) {
        const msg = `Password must be at most ${PASSWORD_MAX} characters.`;
        toast.warning(msg);
        return { ok: false, error: msg };
      }

      try {
        loader.show('Creating account...');
        const data = await apiSignUp({
          email: key,
          password,
          firstName: String(firstName || '').trim(),
          lastName: String(lastName || '').trim(),
          phoneNumber: String(phoneNumber || '').trim(),
          profile: profile || undefined,
        });
        const user = await applyAuth(data.accessToken, data.user);
        toast.success('Account created');
        return { ok: true, user };
      } catch (err) {
        const msg = err.message || 'Unable to create account.';
        toast.error(msg);
        return { ok: false, error: msg };
      } finally {
        loader.hide();
      }
    },
    [applyAuth]
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      const key = normalizeEmail(email);
      if (!key || !key.includes('@')) {
        toast.error('Enter a valid email address.');
        return { ok: false, error: 'Enter a valid email address.' };
      }
      const pwd = String(password || '');
      if (pwd.length < PASSWORD_MIN) {
        const msg = `Password must be at least ${PASSWORD_MIN} characters.`;
        toast.warning(msg);
        return { ok: false, error: msg };
      }
      if (pwd.length > PASSWORD_MAX) {
        const msg = `Password must be at most ${PASSWORD_MAX} characters.`;
        toast.warning(msg);
        return { ok: false, error: msg };
      }

      try {
        loader.show('Signing in...');
        const data = await apiSignIn({ email: key, password: pwd });
        if (data?.user?.status === 'Blocked') {
          toast.error('This account has been blocked.');
          return { ok: false, error: 'This account has been blocked.' };
        }
        const user = await applyAuth(data.accessToken, data.user);
        toast.success('Signed in');
        return { ok: true, user };
      } catch (err) {
        const msg = err.message || 'Unable to sign in.';
        toast.error(msg);
        return { ok: false, error: msg };
      } finally {
        loader.hide();
      }
    },
    [applyAuth]
  );

  /**
   * "Continue with Google": pick a Google account, then the server signs in that account or
   * creates one (using `profile` from onboarding for a new account). Same result shape as signIn.
   */
  /** Opens Google's chooser. { ok, credential } or { ok: false, cancelled?, error }. */
  const pickGoogleAccount = useCallback(async () => {
    try {
      return { ok: true, credential: await getGoogleCredential() };
    } catch (err) {
      if (err?.code === 'cancelled') return { ok: false, cancelled: true, error: '' };
      if (err?.code === 'unavailable') {
        // Expo Go / iOS: no Google sign-in there (Android app and web only).
        toast.info(err.message);
        return { ok: false, cancelled: true, error: '' };
      }
      const msg = err?.message || 'Could not sign in with Google.';
      toast.error(msg);
      return { ok: false, error: msg };
    }
  }, []);

  /**
   * Step 1 of Google sign-up: pick an account and ask the server whether it already exists.
   * Nothing is created. Returns { ok, exists, credential, google: { email, firstName, lastName } }.
   */
  const checkGoogleAccount = useCallback(async () => {
    const picked = await pickGoogleAccount();
    if (!picked.ok) return picked;
    try {
      loader.show('Checking your Google account...');
      const data = await apiGoogleCheck(picked.credential);
      return {
        ok: true,
        exists: !!data?.exists,
        credential: picked.credential,
        google: data?.google || {},
      };
    } catch (err) {
      const msg = err.message || 'Could not sign in with Google.';
      toast.error(msg);
      return { ok: false, error: msg };
    } finally {
      loader.hide();
    }
  }, [pickGoogleAccount]);

  /**
   * Sign in (or create the account) with Google. Pass `credential` from checkGoogleAccount to
   * skip the chooser; if it has expired (Google tokens last ~1 hour) the chooser opens again.
   */
  const signInWithGoogle = useCallback(
    async ({ profile, credential: given, firstName, lastName, phoneNumber } = {}) => {
      let credential = given;
      if (!credential) {
        const picked = await pickGoogleAccount();
        if (!picked.ok) return picked;
        credential = picked.credential;
      }

      try {
        loader.show('Signing in with Google...');
        let data;
        try {
          data = await apiGoogleSignIn({ ...credential, profile, firstName, lastName, phoneNumber });
        } catch (err) {
          if (!given || err?.status !== 401) throw err;
          // The saved Google token expired while onboarding — ask Google again, then retry once.
          loader.hide();
          const picked = await pickGoogleAccount();
          if (!picked.ok) return picked;
          loader.show('Signing in with Google...');
          data = await apiGoogleSignIn({ ...picked.credential, profile, firstName, lastName, phoneNumber });
        }
        if (data?.user?.status === 'Blocked') {
          toast.error('This account has been blocked.');
          return { ok: false, error: 'This account has been blocked.' };
        }
        const user = await applyAuth(data.accessToken, data.user);
        toast.success(data?.isNew ? 'Account created' : 'Signed in');
        return { ok: true, user, isNew: !!data?.isNew };
      } catch (err) {
        const msg = err.message || 'Could not sign in with Google.';
        toast.error(msg);
        return { ok: false, error: msg };
      } finally {
        loader.hide();
      }
    },
    [applyAuth, pickGoogleAccount]
  );

  const signOut = useCallback(async () => {
    // Best effort: stop AdminPanel pushes reaching this device for the old account.
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null);
    if (accessToken && pushToken) {
      apiUnregisterPushToken(accessToken, pushToken).catch(() => {});
      AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
    }
    try {
      setSession(null);
      setAccessToken(null);
      await clearSession();
      await AsyncStorage.removeItem(ONBOARD_KEY);
      toast.info('Signed out');
    } catch (err) {
      console.warn('signOut failed', err);
      setSession(null);
      setAccessToken(null);
      toast.info('Signed out');
    }
  }, [accessToken]);

  const updateUser = useCallback(
    async ({ firstName, lastName, email, photoURL, phoneNumber, profile }) => {
      if (!session || !accessToken) {
        toast.error('Not signed in.');
        return { ok: false, error: 'Not signed in.' };
      }

      const nextFirst = String(firstName ?? session.firstName ?? '').trim();
      const nextLast = String(lastName ?? session.lastName ?? '').trim();
      const nextEmail = normalizeEmail(email ?? session.email);
      if (!nextEmail || !nextEmail.includes('@')) {
        toast.error('Enter a valid email address.');
        return { ok: false, error: 'Enter a valid email address.' };
      }

      try {
        loader.show(photoURL && typeof photoURL === 'object' && photoURL.uri ? 'Uploading photo...' : 'Saving profile...');
        let nextPhoto = session.photoURL || '';
        let nextPhotoPublicId = session.photoPublicId || '';
        if (photoURL && typeof photoURL === 'object' && photoURL.uri) {
          const uploaded = await apiUploadImage(accessToken, {
            uri: photoURL.uri,
            mimeType: photoURL.mimeType || 'image/jpeg',
            fileName: photoURL.fileName || 'avatar.jpg',
            base64: photoURL.base64 || '',
            replacePublicId: session.photoPublicId || '',
            replaceUrl: session.photoURL || '',
          });
          if (!uploaded?.url) {
            throw new Error('Photo upload did not return a link.');
          }
          nextPhoto = uploaded.url;
          nextPhotoPublicId = uploaded.publicId || '';
        } else if (typeof photoURL === 'string') {
          nextPhoto = photoURL;
        }

        const data = await apiUpdateMe(accessToken, {
          firstName: nextFirst,
          lastName: nextLast,
          email: nextEmail,
          photoURL: nextPhoto,
          photoPublicId: nextPhotoPublicId,
          ...(phoneNumber !== undefined ? { phoneNumber } : {}),
          ...(profile ? { profile } : {}),
        });
        const user = mapUser(data?.user);
        setSession(user);
        await persist(accessToken, user);
        toast.success(
          photoURL && typeof photoURL === 'object' && photoURL.uri ? 'Photo uploaded' : 'Profile updated',
        );
        return { ok: true, user };
      } catch (err) {
        const msg = err.message || 'Unable to update profile.';
        toast.error(msg);
        return { ok: false, error: msg };
      } finally {
        loader.hide();
      }
    },
    [session, accessToken, persist]
  );

  /** Save health / goal fields (partial is fine) to the account. Local diary is updated by the caller. */
  const updateHealthProfile = useCallback(
    async (profile) => {
      if (!session || !accessToken) return { ok: false, error: 'Not signed in.' };
      try {
        loader.show('Saving...');
        const data = await apiUpdateMe(accessToken, { profile });
        const user = mapUser(data?.user);
        setSession(user);
        await persist(accessToken, user);
        return { ok: true, user };
      } catch (err) {
        const msg = err.message || 'Unable to save your details.';
        toast.error(msg);
        return { ok: false, error: msg };
      } finally {
        loader.hide();
      }
    },
    [session, accessToken, persist]
  );

  const setAccount = useCallback(
    async (user) => {
      const mapped = mapUser(user);
      setSession(mapped);
      if (accessToken && mapped) await persist(accessToken, mapped);
      return mapped;
    },
    [accessToken, persist]
  );

  const requestPasswordReset = useCallback(async ({ email }) => {
    const key = normalizeEmail(email);
    if (!key || !key.includes('@')) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
    try {
      const data = await apiForgotPassword({ email: key });
      return {
        ok: true,
        email: key,
        resendInSeconds: Number(data?.resendInSeconds) || 60,
        expiresInMinutes: Number(data?.expiresInMinutes) || 10,
      };
    } catch (err) {
      // Toast as well as the message under the field (e.g. "This account uses Google sign-in…").
      const msg = err.message || 'Unable to send code.';
      toast.error(msg);
      return { ok: false, error: msg };
    }
  }, []);

  const verifyResetOtp = useCallback(async ({ email, otp }) => {
    try {
      const data = await apiVerifyResetOtp({ email: normalizeEmail(email), otp: String(otp || '').trim() });
      return { ok: true, resetToken: data.resetToken };
    } catch (err) {
      return { ok: false, error: err.message || 'Unable to verify code.' };
    }
  }, []);

  const resetPassword = useCallback(async ({ email, resetToken, password }) => {
    try {
      await apiResetPassword({ email: normalizeEmail(email), resetToken, password });
      toast.success('Password updated. Please sign in.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Unable to reset password.' };
    }
  }, []);

  const clearAuthForTesting = useCallback(async () => {
    setSession(null);
    setAccessToken(null);
    await clearSession();
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      user: session,
      accessToken,
      isSignedIn: !!session && !!accessToken,
      signUp,
      signIn,
      signInWithGoogle,
      checkGoogleAccount,
      signOut,
      updateUser,
      updateHealthProfile,
      setAccount,
      requestPasswordReset,
      verifyResetOtp,
      resetPassword,
      clearAuthForTesting,
      /** { available, label, user: { userId, email, name } | null } — fingerprint / face sign-in */
      biometric: { ...biometricInfo, user: biometricUser },
      enableBiometric,
      disableBiometric,
      signInWithBiometric,
    }),
    [
      hydrated,
      session,
      accessToken,
      biometricInfo,
      biometricUser,
      enableBiometric,
      disableBiometric,
      signInWithBiometric,
      signUp,
      signIn,
      signInWithGoogle,
      checkGoogleAccount,
      signOut,
      updateUser,
      updateHealthProfile,
      setAccount,
      requestPasswordReset,
      verifyResetOtp,
      resetPassword,
      clearAuthForTesting,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
