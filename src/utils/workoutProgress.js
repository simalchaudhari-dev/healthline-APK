import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiSaveUserData } from '../services/authService';

/**
 * Home workouts the user left half-way today — one per routine (or single exercise) — so each
 * can be continued from the same move and second. Saved on this phone and on the signed-in
 * account (`PUT /api/user-data` → workoutProgress). A session is removed when it finishes;
 * all of them go when a new day starts.
 *
 * Stored shape: { date, sessions: [session], closed: [logId] }
 * session: { routineId?, exerciseId?, logId, title, index, remaining, spent: number[], total, updatedAt }
 * closed: diary ids of today's sessions that were finished or started over. They sync too, so
 * another phone's stale half-done copy of one is dropped instead of coming back as "Continue".
 */
const KEY = 'healthline.workoutProgress.v1';
const SAVE_DEBOUNCE_MS = 2000;
const MAX_SESSIONS = 10;
const MAX_CLOSED = 50;

/** { date, sessions } for today, or null. */
let current = null;
let loaded = false;
let loadGen = 0;
let loadPromise = null;
/** Account id this phone's copy belongs to, so a different sign-in cannot upload it. */
let ownerId = null;
const listeners = new Set();

/** Account the in-memory sessions belong to. Null while signed out. */
let accountToken = null;
let accountReady = false;
let revision = 0;
let acked = 0;
let latest = null;
let latestRev = 0;
let saveTimer = null;
let sending = false;

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sessionKey(p) {
  return `${p?.routineId || ''}|${p?.exerciseId || ''}`;
}

function emit() {
  listeners.forEach((fn) => fn(current));
}

function validSession(s) {
  return s && Array.isArray(s.spent) && s.spent.some((n) => Number(n) > 0);
}

/** Today's { date, sessions, closed } from any stored shape (older builds kept one session). */
function fresh(value) {
  if (!value || value.date !== dayKey()) return null;
  const closed = Array.isArray(value.closed) ? value.closed.filter(Boolean) : [];
  const list = Array.isArray(value.sessions) ? value.sessions : validSession(value) ? [value] : [];
  const sessions = list
    .filter(validSession)
    .filter((s) => !s.logId || !closed.includes(s.logId))
    .map((s) => ({ ...s, date: value.date }));
  return sessions.length || closed.length ? { date: value.date, sessions, closed } : null;
}

function closedIds(state) {
  return state?.closed || [];
}

function sorted(state) {
  return [...(state?.sessions || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function pack(progress) {
  const spent = Array.isArray(progress?.spent) ? progress.spent : [];
  return {
    date: dayKey(),
    routineId: progress?.routineId || null,
    exerciseId: progress?.exerciseId || null,
    // Diary entry already written for this session (updated, not added again, when it continues).
    logId: progress?.logId || null,
    // Started from a program: finishing it later (via Continue) still ticks that session.
    programId: progress?.programId || null,
    programSessionId: progress?.programSessionId || null,
    title: progress?.title || '',
    index: progress?.index || 0,
    remaining: progress?.remaining || 0,
    spent,
    total: progress?.total || spent.length,
    updatedAt: Date.now(),
  };
}

function spentSum(p) {
  return (p?.spent || []).reduce((s, n) => s + (Number(n) || 0), 0);
}

function writeLocal(next) {
  if (next) AsyncStorage.setItem(KEY, JSON.stringify({ userId: ownerId, progress: next })).catch(() => {});
  else AsyncStorage.removeItem(KEY).catch(() => {});
}

function readStored(raw) {
  const parsed = JSON.parse(raw);
  if (parsed && (Array.isArray(parsed.spent) || Array.isArray(parsed.sessions)) && parsed.date) {
    return { userId: null, progress: parsed };
  }
  return { userId: parsed?.userId || null, progress: parsed?.progress || null };
}

async function load() {
  if (loaded) return current;
  if (!loadPromise) {
    const gen = ++loadGen;
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (gen !== loadGen || loaded) return current;
        if (raw) {
          const stored = readStored(raw);
          ownerId = stored.userId;
          current = fresh(stored.progress);
        } else {
          current = null;
        }
      } catch {
        if (gen !== loadGen || loaded) return current;
        current = null;
      }
      if (gen === loadGen && !loaded) {
        loaded = true;
        emit();
      }
      return current;
    })().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

function commit(next) {
  loadGen += 1;
  loaded = true;
  current = next ? fresh(next) : null;
}

function kickSave() {
  if (sending || !accountToken || !accountReady) return;
  if (latestRev === acked) return;
  const token = accountToken;
  const body = latest;
  const rev = latestRev;
  sending = true;
  apiSaveUserData(token, { workoutProgress: body })
    .then(() => {
      if (accountToken === token && rev === revision) acked = rev;
    })
    .catch(() => {})
    .finally(() => {
      sending = false;
      if (accountToken === token && latestRev !== acked && !saveTimer) kickSave();
    });
}

function queueSave(immediate) {
  if (!accountToken || !accountReady) return;
  if (saveTimer) {
    if (!immediate) return;
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (immediate) {
    kickSave();
    return;
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    kickSave();
  }, SAVE_DEBOUNCE_MS);
}

function markDirty(snapshot, immediate) {
  revision += 1;
  latest = snapshot;
  latestRev = revision;
  queueSave(immediate);
}

function setSessions(sessions, immediate, closed = closedIds(fresh(current))) {
  const keepClosed = closed.slice(-MAX_CLOSED);
  const next =
    sessions.length || keepClosed.length
      ? { date: dayKey(), sessions: sessions.slice(0, MAX_SESSIONS), closed: keepClosed }
      : null;
  commit(next);
  writeLocal(current);
  markDirty(current, immediate);
}

/**
 * The unfinished session for this routine / exercise (`{ routineId, exerciseId }`), or —
 * with no argument — the one used most recently.
 */
export function getWorkoutProgress(match) {
  const today = fresh(current);
  if (!today) return null;
  if (match) return today.sessions.find((s) => sessionKey(s) === sessionKey(match)) || null;
  return sorted(today)[0] || null;
}

/** All of today's unfinished sessions, most recent first. */
export function getWorkoutSessions() {
  return sorted(fresh(current));
}

export function saveWorkoutProgress(progress) {
  const next = pack(progress);
  // Finished (or started over) already, maybe on another phone: do not bring it back.
  if (next.logId && closedIds(fresh(current)).includes(next.logId)) return;
  const key = sessionKey(next);
  const prev = getWorkoutProgress(next);
  const others = (fresh(current)?.sessions || []).filter((s) => sessionKey(s) !== key);
  setSessions([next, ...others], false);
  const resumeChanged = !prev || prev.index !== next.index || prev.total !== next.total || prev.title !== next.title;
  if (resumeChanged) emit();
}

/** Remove one session (finished or started over). With no argument, remove all of them. */
export function clearWorkoutProgress(match) {
  const today = fresh(current);
  if (!today) return;
  const rest = match ? today.sessions.filter((s) => sessionKey(s) !== sessionKey(match)) : [];
  if (rest.length === today.sessions.length) return;
  // Remember which ones ended, so a stale copy on another phone cannot bring them back.
  const ended = today.sessions.filter((s) => !rest.includes(s)).map((s) => s.logId).filter(Boolean);
  setSessions(rest, true, [...new Set([...closedIds(today), ...ended])]);
  emit();
}

/**
 * Same session on both sides: keep the copy with more seconds done. A session either side
 * has closed (finished / started over) is dropped.
 */
function mergeSessions(a, b) {
  const closed = [...new Set([...closedIds(a), ...closedIds(b)])].slice(-MAX_CLOSED);
  const map = new Map();
  [...(a?.sessions || []), ...(b?.sessions || [])].forEach((s) => {
    if (s.logId && closed.includes(s.logId)) return;
    const key = sessionKey(s);
    const had = map.get(key);
    if (!had || spentSum(s) > spentSum(had) || (spentSum(s) === spentSum(had) && (s.updatedAt || 0) > (had.updatedAt || 0))) {
      map.set(key, s);
    }
  });
  const sessions = [...map.values()].sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
  return sessions.length || closed.length ? { date: dayKey(), sessions, closed } : null;
}

/**
 * Merge the account's unfinished sessions with this phone's copy.
 * Called after GET /api/user-data. Local edits that have not reached the server win.
 */
export async function applyServerWorkoutProgress(serverProgress, token, userId) {
  await load();
  if (!token) {
    resetWorkoutProgressAccount();
    return;
  }
  if (ownerId && userId && ownerId !== userId) {
    commit(null);
    writeLocal(null);
    revision += 1;
    acked = revision;
    latest = null;
    latestRev = revision;
    emit();
  }
  ownerId = userId || ownerId;
  accountToken = token;
  const server = fresh(serverProgress);
  const local = fresh(current);

  if (revision !== acked) {
    // This phone's unsent edits win, but sessions the server knows were finished elsewhere
    // are still dropped (and that list is kept), so they do not come back.
    const serverClosed = closedIds(server);
    let mine = local;
    if (serverClosed.length) {
      const closed = [...new Set([...closedIds(local), ...serverClosed])].slice(-MAX_CLOSED);
      const sessions = (local?.sessions || []).filter((s) => !s.logId || !closed.includes(s.logId));
      mine = { date: dayKey(), sessions, closed };
      const removed = sessions.length !== (local?.sessions || []).length;
      commit(mine);
      writeLocal(current);
      mine = current;
      if (removed) emit();
    }
    accountReady = true;
    latest = mine;
    latestRev = revision;
    queueSave(true);
    return;
  }

  const chosen = mergeSessions(server, local);
  accountReady = true;
  const changed = JSON.stringify(chosen || null) !== JSON.stringify(local || null);
  commit(chosen);
  if (changed) {
    writeLocal(chosen);
    emit();
  }
  if (JSON.stringify(chosen || null) !== JSON.stringify(server || null)) {
    markDirty(chosen, true);
  }
}

/** Signed out: drop this phone's copy so the next account cannot upload it. */
export function resetWorkoutProgressAccount() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  accountToken = null;
  accountReady = false;
  ownerId = null;
  revision += 1;
  acked = revision;
  latest = null;
  latestRev = revision;
  const had = current != null;
  commit(null);
  writeLocal(null);
  if (had) emit();
}

/** The most recent unfinished session (or null), kept in sync across screens. */
export function useWorkoutProgress() {
  const [value, setValue] = useState(() => getWorkoutProgress());
  useEffect(() => {
    const fn = () => setValue(getWorkoutProgress());
    listeners.add(fn);
    load().then(fn);
    return () => listeners.delete(fn);
  }, []);
  return value;
}

/** All of today's unfinished sessions, most recent first. */
export function useWorkoutSessions() {
  const [value, setValue] = useState(() => getWorkoutSessions());
  useEffect(() => {
    const fn = () => setValue(getWorkoutSessions());
    listeners.add(fn);
    load().then(fn);
    return () => listeners.delete(fn);
  }, []);
  return value;
}
