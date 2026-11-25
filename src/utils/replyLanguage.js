import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiSaveUserData } from '../services/authService';
import { LANGUAGE_KEY } from '../config/storageKeys';
import { APP_LANGUAGES } from '../config/languages';

/** Same list as the app language — one language for the whole app (saved in user-data.replyLanguage). */
export const REPLY_LANGUAGES = APP_LANGUAGES.map((l) => ({ id: l.id, label: l.id === 'hinglish' ? 'Hinglish' : l.english }));

const KEY = 'healthline.replyLanguage.v1';
const IDS = new Set(REPLY_LANGUAGES.map((item) => item.id));

let current = 'en';
let accountReady = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(current));
}

export function normalizeReplyLanguage(value) {
  const id = String(value || '').trim();
  return IDS.has(id) ? id : 'en';
}

/** Keep the onboarding language key in step, so there is only one language in the app. */
function persist() {
  AsyncStorage.multiSet([
    [KEY, current],
    [LANGUAGE_KEY, current],
  ]).catch(() => {});
}

// Phone copy until the account loads; older installs only had the onboarding key.
AsyncStorage.multiGet([KEY, LANGUAGE_KEY])
  .then(([[, saved], [, onboarding]]) => {
    const value = IDS.has(saved) ? saved : IDS.has(onboarding) ? onboarding : null;
    if (accountReady || !value) return;
    current = value;
    emit();
  })
  .catch(() => {});

export function getReplyLanguage() {
  return current;
}

/** Server value wins. A missing value keeps the phone copy and uploads it. */
export function applyServerReplyLanguage(value, token) {
  accountReady = true;
  if (value == null || value === '') {
    if (token && current !== 'en') {
      apiSaveUserData(token, { replyLanguage: current }).catch(() => {});
    }
    return;
  }
  current = normalizeReplyLanguage(value);
  persist();
  emit();
}

export function resetReplyLanguageAccount() {
  current = 'en';
  accountReady = false;
  AsyncStorage.multiRemove([KEY, LANGUAGE_KEY]).catch(() => {});
  emit();
}

export async function selectReplyLanguage(id, token) {
  current = normalizeReplyLanguage(id);
  accountReady = true;
  emit();
  persist();
  if (token) await apiSaveUserData(token, { replyLanguage: current });
}

export function useReplyLanguage() {
  const [lang, setLang] = useState(current);
  useEffect(() => {
    const onChange = (value) => setLang(value);
    listeners.add(onChange);
    setLang(current);
    return () => listeners.delete(onChange);
  }, []);
  return lang;
}
