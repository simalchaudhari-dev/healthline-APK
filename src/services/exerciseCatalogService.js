import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBase } from '../config/env';
import { applyExerciseCatalog } from '../data/homeExercises';

const CACHE_KEY = 'healthline_exercise_catalog_v1';
const TIMEOUT_MS = 15000;

/** Last catalog saved on this phone (so changes from the admin show offline too). */
export async function loadCachedExerciseCatalog() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? applyExerciseCatalog(JSON.parse(raw)) : false;
  } catch {
    return false;
  }
}

/** Latest catalog from the server. Keeps the current one when offline or on an error. */
export async function refreshExerciseCatalog() {
  const base = apiBase();
  if (!base) return false;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
    const res = await fetch(`${base}/api/home-exercises`, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return false;
    const data = await res.json();
    if (!applyExerciseCatalog(data)) return false;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
