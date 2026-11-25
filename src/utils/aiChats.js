import { useCallback, useEffect, useState } from 'react';
import { apiSaveUserData } from '../services/authService';

const KINDS = ['coach', 'medicare', 'workout'];
const EMPTY = { coach: [], medicare: [], workout: [] };

let store = { ...EMPTY, coach: [], medicare: [], workout: [] };
let loaded = false;
let dirty = false;
let revision = 0;
let tokenRef = null;
let timer = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(store, loaded));
}

/** Captured when a user-data load starts, so a late reply cannot wipe a newer chat. */
export function aiChatsRevision() {
  return revision;
}

function scheduleSave() {
  dirty = true;
  revision += 1;
  const savingRevision = revision;
  if (!tokenRef) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const token = tokenRef;
    const body = store;
    if (!token) return;
    try {
      await apiSaveUserData(token, { aiChats: body });
      if (savingRevision === revision) dirty = false;
    } catch (err) {
      console.warn('Chat history was not saved', err?.message || err);
    }
  }, 400);
}

export function applyServerAiChats(value, seenRevision) {
  loaded = true;
  if (dirty || (typeof seenRevision === 'number' && seenRevision !== revision)) {
    emit();
    return;
  }
  const src = value && typeof value === 'object' ? value : {};
  store = {
    coach: Array.isArray(src.coach) ? src.coach : [],
    medicare: Array.isArray(src.medicare) ? src.medicare : [],
    workout: Array.isArray(src.workout) ? src.workout : [],
  };
  emit();
}

export function resetAiChatsAccount() {
  clearTimeout(timer);
  store = { coach: [], medicare: [], workout: [] };
  loaded = false;
  dirty = false;
  tokenRef = null;
  emit();
}

export function useAiChats(kind, token) {
  const [snapshot, setSnapshot] = useState({ chats: store, ready: loaded });

  useEffect(() => {
    if (token) tokenRef = token;
    if (token && dirty) scheduleSave();
    const onChange = (next, isReady) => setSnapshot({ chats: next, ready: isReady });
    listeners.add(onChange);
    setSnapshot({ chats: store, ready: loaded });
    return () => listeners.delete(onChange);
  }, [token]);

  const threads = snapshot.chats[kind] || [];

  const saveThread = useCallback((thread) => {
    if (!KINDS.includes(kind) || !thread?.id) return;
    tokenRef = token || tokenRef;
    const rest = (store[kind] || []).filter((item) => item.id !== thread.id);
    store = { ...store, [kind]: [thread, ...rest].slice(0, 20) };
    emit();
    scheduleSave();
  }, [kind, token]);

  const removeThread = useCallback((id) => {
    tokenRef = token || tokenRef;
    store = { ...store, [kind]: (store[kind] || []).filter((item) => item.id !== id) };
    emit();
    scheduleSave();
  }, [kind, token]);

  const clearThreads = useCallback(() => {
    tokenRef = token || tokenRef;
    store = { ...store, [kind]: [] };
    emit();
    scheduleSave();
  }, [kind, token]);

  return { threads, ready: snapshot.ready, saveThread, removeThread, clearThreads };
}
