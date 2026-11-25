import { Platform } from 'react-native';
import { apiBase } from '../config/env';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';
import { emitTokenBalance } from '../utils/tokenBalanceBus';

const NETWORK_ERROR = 'Can’t connect right now. Check your internet connection and try again.';
const TIMEOUT_ERROR = 'This is taking too long. Check your internet connection and try again.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again in a moment.';

const EXTRACT_TIMEOUT_MS = 70000;
const EXPLAIN_TIMEOUT_MS = 70000;

/** Unique id so a retried AI request is never charged twice (8–80 chars, [A-Za-z0-9_-]). */
export function newReportChargeId() {
  return `rep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function fail(message, status) {
  const err = new Error(message);
  if (status) err.status = status;
  return err;
}

function friendlyStatus(status) {
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 402) return 'You don’t have enough tokens for this. Buy more tokens and try again.';
  if (status === 404) return 'This report was not found. It may have been deleted.';
  if (status === 413) return 'This file is too large. Try a smaller file or a clearer photo.';
  if (status === 415) return 'This file type is not supported. Use a PDF, photo, Excel, Word, CSV or text file.';
  if (status === 422) return 'We couldn’t read this report. Try a clearer photo or another file.';
  if (status >= 500) return SERVER_ERROR;
  return `Request failed (${status})`;
}

async function call(path, { method = 'GET', body, form, timeoutMs = 15000 } = {}) {
  const base = apiBase();
  if (!base) throw fail(NETWORK_ERROR);

  const extra = form ? {} : body != null ? { 'Content-Type': 'application/json' } : {};
  let result;
  try {
    result = await fetchJson(`${base}${path}`, {
      method,
      headers: await authHeaders(extra),
      body: form || (body != null ? JSON.stringify(body) : undefined),
      timeoutMs,
    });
  } catch (e) {
    throw fail(e?.code === 'TIMEOUT' || e?.name === 'AbortError' ? TIMEOUT_ERROR : NETWORK_ERROR);
  }

  const { res, data } = result;
  if (!res.ok) {
    const serverMsg = typeof data?.message === 'string' ? data.message.trim() : '';
    // Server messages for these are written for users; prefer them.
    const useServer = serverMsg && res.status < 500;
    throw fail(useServer ? serverMsg : friendlyStatus(res.status), res.status);
  }
  if (data?.tokenBalance != null) emitTokenBalance(data.tokenBalance);
  return data || {};
}

/**
 * Read a lab report file. `file` = { uri, name, type, webFile? } (webFile: the File/Blob on web).
 * Returns { draft, file, tokensCharged }.
 */
export async function extractReport(file, chargeId = newReportChargeId()) {
  if (!file?.uri && !file?.webFile) throw fail('Pick a file first.');
  const form = new FormData();
  const name = file.name || 'report';
  const type = file.type || 'application/octet-stream';

  if (Platform.OS === 'web') {
    let blob = file.webFile;
    if (!blob && file.uri) {
      blob = await fetch(file.uri).then((r) => r.blob());
    }
    form.append('file', blob, name);
  } else {
    form.append('file', { uri: file.uri, name, type });
  }
  form.append('chargeId', chargeId);

  const data = await call('/api/reports/extract', { method: 'POST', form, timeoutMs: EXTRACT_TIMEOUT_MS });
  if (!data?.draft) throw fail('We couldn’t read this report. Try a clearer photo or another file.');
  return {
    draft: data.draft,
    file: data.file || null,
    tokensCharged: Number(data.tokensCharged) || 0,
    tokenBalance: data.tokenBalance ?? null,
  };
}

export async function listReports({ withValues = false } = {}) {
  const data = await call(`/api/reports${withValues ? '?withValues=1' : ''}`);
  return Array.isArray(data?.reports) ? data.reports : [];
}

export async function getReport(id) {
  const data = await call(`/api/reports/${encodeURIComponent(id)}`);
  if (!data?.report) throw fail('This report was not found. It may have been deleted.');
  return data.report;
}

/** body: { title, labName, testDate, values, fileToken, usedForPlan } */
export async function createReport(body) {
  const data = await call('/api/reports', { method: 'POST', body });
  if (!data?.report) throw fail(SERVER_ERROR);
  return data.report;
}

/** body: { title, labName, testDate, values, usedForPlan } */
export async function updateReport(id, body) {
  const data = await call(`/api/reports/${encodeURIComponent(id)}`, { method: 'PUT', body });
  if (!data?.report) throw fail(SERVER_ERROR);
  return data.report;
}

export async function deleteReport(id) {
  await call(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

/** Short-lived link to the original file: { url, fileName, mimeType, expiresAt }. */
export async function getReportFileUrl(id) {
  const data = await call(`/api/reports/${encodeURIComponent(id)}/file`);
  if (!data?.url) throw fail('The original file is not available.');
  return data;
}

/** Returns { report, tokensCharged }. `force` re-runs even when an explanation is saved. */
export async function explainReport(id, { force = false, chargeId = newReportChargeId() } = {}) {
  const data = await call(`/api/reports/${encodeURIComponent(id)}/explain`, {
    method: 'POST',
    body: { chargeId, ...(force ? { force: true } : {}) },
    timeoutMs: EXPLAIN_TIMEOUT_MS,
  });
  if (!data?.report) throw fail(SERVER_ERROR);
  return {
    report: data.report,
    tokensCharged: Number(data.tokensCharged) || 0,
    tokenBalance: data.tokenBalance ?? null,
  };
}
