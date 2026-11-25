import { Linking, Platform } from 'react-native';
import { apiBase } from '../config/env';
import { NETWORK_ERROR } from './authService';

const TIMEOUT_MS = 60000;

async function readMessage(res, fallback) {
  try {
    const data = await res.json();
    if (data?.message) return String(data.message);
  } catch {
    // not JSON
  }
  return fallback;
}

function withTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('This is taking too long. Check your internet connection and try again.')), TIMEOUT_MS),
    ),
  ]);
}

/**
 * Download the full health report PDF (food, water, exercise, steps, weight, lab reports)
 * for `from`–`to` (YYYY-MM-DD). The server keeps the range between signup and today.
 * Web: saves the file. Phone: opens a short-lived download link in the browser.
 */
export async function downloadHealthReport(token, { from, to, today }) {
  const base = apiBase();
  if (!base) throw new Error('API address is not configured.');
  const fileName = `health-report-${from}-to-${to}.pdf`;

  if (Platform.OS === 'web') {
    const qs = new URLSearchParams({ from, to, today });
    let res;
    try {
      res = await withTimeout(fetch(`${base}/api/health-report?${qs}`, { headers: { Authorization: `Bearer ${token}` } }));
    } catch (err) {
      throw err?.message ? err : new Error(NETWORK_ERROR);
    }
    if (!res.ok) throw new Error(await readMessage(res, 'Could not make the report. Please try again.'));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { fileName };
  }

  let res;
  try {
    res = await withTimeout(
      fetch(`${base}/api/health-report`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from, to, today }),
      }),
    );
  } catch (err) {
    throw err?.message ? err : new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw new Error(await readMessage(res, 'Could not make the report. Please try again.'));
  const data = await res.json();
  if (!data?.url) throw new Error('Could not make the report. Please try again.');
  await Linking.openURL(data.url);
  return { fileName, opened: true };
}
