import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiSaveUserData } from '../services/authService';

/**
 * The user's programs progress, saved on the phone and on the account (user-data.programProgress):
 * { active: programKey | '', programs: { [programKey]: { startedAt, done: [sessionId] } } }
 * The server copy wins once the account loads, unless the phone has a change the server has
 * not received yet (a tick made offline): then the phone copy is kept and uploaded again.
 */
const KEY = 'healthline.programProgress.v1';
/** '1' while the latest change on this phone has not reached the server. */
const PENDING_KEY = 'healthline.programProgress.pending.v1';
const EMPTY = { active: '', programs: {} };

let current = EMPTY;
let accountReady = false;
let pending = false;
// Bumps on every local change, so an older upload finishing late does not clear `pending`.
let version = 0;
const listeners = new Set();

function setPending(value) {
  pending = value;
  if (value) AsyncStorage.setItem(PENDING_KEY, '1').catch(() => {});
  else AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
}

function emit() {
  listeners.forEach((fn) => fn(current));
}

function normalize(value) {
  if (!value || typeof value !== 'object') return EMPTY;
  const programs = value.programs && typeof value.programs === 'object' ? value.programs : {};
  const active = value.active && programs[value.active] ? value.active : '';
  return { active, programs };
}

AsyncStorage.multiGet([KEY, PENDING_KEY])
  .then(([[, raw], [, unsent]]) => {
    if (unsent === '1') pending = true;
    if (accountReady || !raw) return;
    current = normalize(JSON.parse(raw));
    emit();
  })
  .catch(() => {});

// One upload at a time: with two quick ticks, an older upload finishing last could overwrite
// the newer copy on the server. A change made while one is in flight is sent right after it.
let sending = false;
let sendAgain = null;

function upload(token) {
  if (!token) return;
  if (sending) {
    sendAgain = token;
    return;
  }
  sending = true;
  const sent = version;
  apiSaveUserData(token, { programProgress: current })
    .then(() => {
      if (sent === version) setPending(false);
    })
    .catch(() => {
      // Stays pending: kept over the server copy and sent again when the account reloads.
    })
    .finally(() => {
      sending = false;
      const next = sendAgain;
      sendAgain = null;
      if (next && pending) upload(next);
    });
}

/** A change made on this phone: save it here, mark it unsent, and try to upload it. */
function persist(token) {
  version += 1;
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
  setPending(true);
  upload(token);
}

/**
 * Server value wins, except over a phone change that never reached the server (offline tick,
 * or a tick while the account was still loading): that one is kept and uploaded again.
 */
export function applyServerProgramProgress(value, token) {
  accountReady = true;
  if (pending) {
    upload(token);
    return;
  }
  if (value == null) {
    if (token && Object.keys(current.programs).length) persist(token);
    return;
  }
  current = normalize(value);
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
  emit();
}

export function resetProgramProgressAccount() {
  current = EMPTY;
  accountReady = false;
  version += 1;
  setPending(false);
  AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

export function getProgramProgress() {
  return current;
}

/** Start (or switch to) a program. Earlier progress on it is kept. */
export function startProgram(programKey, token) {
  const existing = current.programs[programKey];
  current = {
    active: programKey,
    programs: {
      ...current.programs,
      [programKey]: existing || { startedAt: new Date().toISOString(), done: [] },
    },
  };
  emit();
  persist(token);
}

/** Stop following the active program (its ticks stay). */
export function leaveProgram(token) {
  current = { ...current, active: '' };
  emit();
  persist(token);
}

/** Tick / untick one session. Starting a session also starts its program. */
export function setSessionDone(programKey, sessionId, done, token) {
  const record = current.programs[programKey] || { startedAt: new Date().toISOString(), done: [] };
  const set = new Set(record.done);
  if (done) set.add(sessionId);
  else set.delete(sessionId);
  current = {
    active: current.active || programKey,
    programs: { ...current.programs, [programKey]: { ...record, done: [...set] } },
  };
  emit();
  persist(token);
}

export function useProgramProgress() {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    setValue(current);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}
