import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBase } from '../config/env';
import { applyProgramCatalog } from '../data/programs';

const CACHE_KEY = 'healthline_program_catalog_v1';
const TIMEOUT_MS = 15000;

/** Last programs list saved on this phone. */
export async function loadCachedPrograms() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? applyProgramCatalog(JSON.parse(raw)) : false;
  } catch {
    return false;
  }
}

/** Latest programs from the server. Keeps the current list when offline or on an error. */
export async function refreshPrograms() {
  const base = apiBase();
  if (!base) return false;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), TIMEOUT_MS);
    const res = await fetch(`${base}/api/programs`, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return false;
    const data = await res.json();
    if (!applyProgramCatalog(data)) return false;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}
