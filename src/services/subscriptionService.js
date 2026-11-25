import { apiBase } from '../config/env';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

/** Plan payments go through Razorpay. This no longer sends a card. */
export async function apiPurchaseSubscription() {
  throw new Error('Payments go through Razorpay.');
}

/** This user's saved payments, newest first. */
export async function apiListMyPayments(token) {
  const base = apiBase();
  if (!base) return [];

  const { res, data } = await fetchJson(`${base}/api/subscriptions`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeoutMs: 20000,
  });

  if (!res.ok) return [];
  return Array.isArray(data?.payments) ? data.payments : [];
}

/** Stop future renewals. The paid period stays active until its end date. */
export async function apiCancelAutoPay(token) {
  const base = apiBase();
  if (!base) throw new Error('API is not configured.');

  const { res, data } = await fetchJson(`${base}/api/subscriptions`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ autoPay: false }),
    timeoutMs: 20000,
  });

  if (!res.ok) {
    throw new Error(data?.message || 'Unable to cancel auto-pay.');
  }
  return data;
}

/** Token packs go through Razorpay. This no longer sends a card. */
export async function apiPurchaseTokenPack() {
  throw new Error('Payments go through Razorpay.');
}

/** Active token packs shown on Buy tokens. */
export async function apiFetchTokenPacks() {
  const base = apiBase();
  if (!base) return [];

  const { res, data } = await fetchJson(`${base}/api/token-packs`, {
    method: 'GET',
    headers: await authHeaders(),
    timeoutMs: 20000,
  });

  if (!res.ok) return [];
  return Array.isArray(data?.packs) ? data.packs : [];
}

/** Creates a Razorpay order. The Key Secret stays on the server. */
export async function apiCreateRazorpayOrder(token, payload) {
  const base = apiBase();
  if (!base) throw new Error('API is not configured.');

  const { res, data } = await fetchJson(`${base}/api/razorpay/order`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    timeoutMs: 20000,
  });

  if (!res.ok) {
    throw new Error(data?.message || 'Unable to start Razorpay checkout.');
  }
  const started = data?.mode === 'subscription' ? data?.subscriptionId : data?.orderId;
  if (!data?.keyId || !started) {
    throw new Error('Razorpay checkout did not start.');
  }
  return data;
}

export async function apiConfirmRazorpayPayment(token, payload) {
  const base = apiBase();
  if (!base) throw new Error('API is not configured.');

  const { res, data } = await fetchJson(`${base}/api/razorpay/confirm`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    timeoutMs: 20000,
  });

  if (!res.ok) {
    throw new Error(data?.message || 'Unable to save the payment.');
  }
  return data;
}
