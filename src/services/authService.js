import { apiBase } from '../config/env';
import { Platform } from 'react-native';
import { cleanAiError } from '../utils/aiErrors';

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorMessage(data, fallback) {
  if (data && typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  return fallback;
}

const REQUEST_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 60000;

/** User-facing messages — no server/config jargon. `code` lets callers tell offline from real errors. */
export const NETWORK_ERROR = 'Can’t connect right now. Check your internet connection and try again.';
const TIMEOUT_ERROR = 'This is taking too long. Check your internet connection and try again.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again in a moment.';

function networkError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** fetch with a timeout, so a weak connection fails with a clear message instead of spinning forever. */
function fetchWithTimeout(url, init, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ok) resolve(value);
      else reject(value);
    };
    const timer = setTimeout(() => finish(false, networkError(TIMEOUT_ERROR, 'timeout')), timeoutMs);
    fetch(url, init).then(
      (res) => finish(true, res),
      () => finish(false, networkError(NETWORK_ERROR, 'offline')),
    );
  });
}

async function request(path, { method = 'GET', body, token, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const base = apiBase();
  if (!base) {
    throw new Error('API address is not configured.');
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(
    `${base}${path}`,
    { method, headers, body: body != null ? JSON.stringify(body) : undefined },
    timeoutMs,
  );

  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(errorMessage(data, res.status >= 500 ? SERVER_ERROR : `Request failed (${res.status})`));
    // Lets callers tell "signed out" (401) from a server or network problem.
    err.status = res.status;
    // A signed-in call the server refuses: account deleted, sign-in expired, or blocked.
    if (token && (res.status === 401 || (res.status === 403 && /blocked/i.test(err.message)))) {
      notifyAuthRejected(err.message, token);
    }
    throw err;
  }
  return data;
}

// ---- "This session is no longer valid" → AuthContext signs out ----

const authRejectedListeners = new Set();

/** `fn(message, token)` when the server refuses a signed-in request. Returns an unsubscribe. */
export function onAuthRejected(fn) {
  authRejectedListeners.add(fn);
  return () => authRejectedListeners.delete(fn);
}

function notifyAuthRejected(message, token) {
  authRejectedListeners.forEach((fn) => {
    try {
      fn(message, token);
    } catch {
      // a listener's error must not break the request flow
    }
  });
}

export async function apiSignUp({ email, password, firstName, lastName, phoneNumber, profile }) {
  return request('/api/auth/sign-up', {
    method: 'POST',
    body: {
      email,
      password,
      firstName,
      lastName,
      phoneNumber: phoneNumber || undefined,
      profile: profile || undefined,
    },
  });
}

export async function apiSignIn({ email, password }) {
  return request('/api/auth/sign-in', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * Google sign-in: send Google's ID token (Android) or access token (web). The server verifies it,
 * then signs in the matching account or creates one. `profile` (onboarding answers) is only used
 * when a new account is made. Returns { accessToken, user, isNew }.
 */
export async function apiGoogleSignIn({ idToken, accessToken, profile, firstName, lastName, phoneNumber }) {
  return request('/api/auth/google', {
    method: 'POST',
    body: {
      idToken: idToken || undefined,
      googleAccessToken: accessToken || undefined,
      profile: profile || undefined,
      // Names typed in onboarding win over Google's (new accounts only).
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phoneNumber: phoneNumber || undefined,
    },
  });
}

/** Does this Google account already have an account? { exists, google: { email, firstName, ... } } */
export async function apiGoogleCheck({ idToken, accessToken }) {
  return request('/api/auth/google', {
    method: 'POST',
    body: {
      idToken: idToken || undefined,
      googleAccessToken: accessToken || undefined,
      checkOnly: true,
    },
  });
}

export async function apiMe(token) {
  return request('/api/auth/me', { method: 'GET', token });
}

/** A still-valid login token → a new one with a fresh expiry. { accessToken, user } */
export async function apiRefreshToken(token) {
  return request('/api/auth/refresh', { method: 'POST', token });
}

export async function apiUpdateMe(token, payload) {
  return request('/api/auth/me', {
    method: 'PUT',
    token,
    body: payload,
  });
}

async function uriToDataUrl(uri, mimeType) {
  if (String(uri || '').startsWith('data:image/')) return uri;
  const blobRes = await fetch(uri);
  const blob = await blobRes.blob();
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : mimeType;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.includes(',')) {
        reject(new Error('Could not read the photo.'));
        return;
      }
      if (result.startsWith('data:image/')) {
        resolve(result);
        return;
      }
      resolve(`data:${type};base64,${result.split(',')[1]}`);
    };
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.readAsDataURL(blob);
  });
}

export async function apiUploadImage(
  token,
  {
    uri,
    mimeType = 'image/jpeg',
    fileName = 'avatar.jpg',
    base64 = '',
    replacePublicId = '',
    replaceUrl = '',
  } = {}
) {
  const base = apiBase();
  if (!base) {
    throw new Error('API address is not configured.');
  }
  if (!token) {
    throw new Error('Not signed in.');
  }

  // JSON data URL matches the upload API the admin panel uses, and avoids
  // the web FormData drop that left photoURL empty in the database.
  let dataUrl = '';
  const rawBase64 = String(base64 || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  if (rawBase64) {
    dataUrl = `data:${mimeType || 'image/jpeg'};base64,${rawBase64}`;
  } else if (Platform.OS === 'web' && uri) {
    dataUrl = await uriToDataUrl(uri, mimeType || 'image/jpeg');
  }

  let res;
  if (dataUrl) {
    res = await fetchWithTimeout(
      `${base}/api/upload/image`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          file: dataUrl,
          folder: 'healthline/users',
          replacePublicId,
          replaceUrl,
        }),
      },
      UPLOAD_TIMEOUT_MS,
    );
  } else {
    const form = new FormData();
    form.append('folder', 'healthline/users');
    if (replacePublicId) form.append('replacePublicId', replacePublicId);
    if (replaceUrl) form.append('replaceUrl', replaceUrl);
    form.append('file', {
      uri,
      name: fileName,
      type: mimeType,
    });

    res = await fetchWithTimeout(
      `${base}/api/upload/image`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: form,
      },
      UPLOAD_TIMEOUT_MS,
    );
  }

  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(data, res.status >= 500 ? SERVER_ERROR : `Upload failed (${res.status})`));
  }
  return data;
}

export async function apiForgotPassword({ email }) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export async function apiVerifyResetOtp({ email, otp }) {
  return request('/api/auth/verify-otp', {
    method: 'POST',
    body: { email, otp },
  });
}

export async function apiResetPassword({ email, resetToken, password }) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: { email, resetToken, password },
  });
}

/** Daily app-open check-in. `date` is the device's local YYYY-MM-DD. */
export async function apiStreakCheckIn(token, { date }) {
  return request('/api/streak/check-in', {
    method: 'POST',
    token,
    body: { date },
  });
}

/** Signed-in user's diary days between `from` and `to` (YYYY-MM-DD, inclusive). */
export async function apiFetchDiary(token, { from, to, today } = {}) {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  if (today) qs.set('today', today);
  return request(`/api/diary?${qs.toString()}`, { method: 'GET', token });
}

export async function apiFetchDiaryDay(token, date) {
  return request(`/api/diary/${date}`, { method: 'GET', token });
}

/** Replace today's diary. The server rejects any date other than the user's today. */
export async function apiSaveDiaryDay(token, date, { today, meals, exercise, water }) {
  return request(`/api/diary/${date}`, {
    method: 'PUT',
    token,
    timeoutMs: 45000,
    body: { today, meals, exercise, water },
  });
}

/** Save this device's Expo push token so AdminPanel campaigns reach it. */
export async function apiRegisterPushToken(token, pushToken) {
  return request('/api/push-token', {
    method: 'POST',
    token,
    body: { token: pushToken, platform: Platform.OS },
  });
}

export async function apiUnregisterPushToken(token, pushToken) {
  return request('/api/push-token', { method: 'DELETE', token, body: { token: pushToken } });
}

/** Weight log, grocery list, meal plan and unfinished home workout (each null until first saved). */
export async function apiFetchUserData(token) {
  return request('/api/user-data', { method: 'GET', token });
}

/** Nearby saves of different fields become one PUT, so a screen does not hit user-data twice. */
let userDataBatch = null;

function flushUserDataBatch() {
  const batch = userDataBatch;
  if (!batch) return;
  userDataBatch = null;
  request('/api/user-data', { method: 'PUT', token: batch.token, body: batch.changes }).then(
    (data) => batch.waiters.forEach((waiter) => waiter.resolve(data)),
    (error) => batch.waiters.forEach((waiter) => waiter.reject(error)),
  );
}

/** Save any of { weightLogs, grocery, mealPlan, workoutProgress, replyLanguage, aiChats }. Only the fields sent are replaced. */
export function apiSaveUserData(token, changes) {
  if (userDataBatch && userDataBatch.token !== token) flushUserDataBatch();
  if (!userDataBatch) {
    userDataBatch = { token, changes: { ...changes }, waiters: [], timer: null };
  } else {
    userDataBatch.changes = { ...userDataBatch.changes, ...changes };
  }

  return new Promise((resolve, reject) => {
    userDataBatch.waiters.push({ resolve, reject });
    clearTimeout(userDataBatch.timer);
    userDataBatch.timer = setTimeout(flushUserDataBatch, 80);
  });
}

/** App feedback for the admin Support list. */
export async function apiSubmitFeedback(token, { category, message, appVersion }) {
  return request('/api/feedback', {
    method: 'POST',
    token,
    body: { category, message, appVersion },
  });
}

/** One AI call for the admin usage counters. Does not send the chat text. */
export async function apiReportAiUsage(token, { feature, ok }) {
  return request('/api/ai-usage', { method: 'POST', token, body: { feature, ok } });
}

/** Chat completion via Admin Panel. The OpenRouter key never leaves the server. */
export async function apiAiChat(token, body) {
  try {
    return await request('/api/ai/chat', { method: 'POST', token, body, timeoutMs: 60000 });
  } catch (err) {
    // Provider errors can name the model or endpoint — show users a plain message instead.
    throw cleanAiError(err);
  }
}

/** Daily step totals counted by this phone: days = [{ date: 'YYYY-MM-DD', steps }]. */
export async function apiSaveSteps(token, { today, days }) {
  return request('/api/steps', { method: 'PUT', token, body: { today, days } });
}

/** Admin campaigns sent to this user: { items: [{ id, title, body, sentAt, read }], unread }. */
export async function apiFetchInbox(token) {
  return request('/api/notifications/inbox', { method: 'GET', token });
}

/** Mark one notification read (`id`), or all of them (no id). */
export async function apiMarkInboxRead(token, id) {
  return request('/api/notifications/inbox/read', { method: 'POST', token, body: id ? { id } : {} });
}

/** Remove one notification from this user's inbox (`id`), or all of them (no id). */
export async function apiClearInbox(token, id) {
  return request('/api/notifications/inbox/clear', { method: 'POST', token, body: id ? { id } : {} });
}

export async function apiFetchFavorites(token) {
  return request('/api/favorites', { method: 'GET', token });
}

/** Only the food id is stored; the server returns full details from the foods catalog. */
export async function apiAddFavorite(token, foodId) {
  return request('/api/favorites', { method: 'POST', token, body: { foodId } });
}

export async function apiRemoveFavorite(token, foodId) {
  return request(`/api/favorites?foodId=${encodeURIComponent(foodId)}`, { method: 'DELETE', token });
}
