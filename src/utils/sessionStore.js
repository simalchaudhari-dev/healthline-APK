import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { AUTH_KEY } from '../config/storageKeys';

const TOKEN_KEY = 'healthline_access_token_v1';

function secureOptions() {
  if (Platform.OS !== 'ios') return {};
  return { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
}

function webStore() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}

async function writeToken(token) {
  if (Platform.OS === 'web') {
    const store = webStore();
    if (!token) store?.removeItem(TOKEN_KEY);
    else store?.setItem(TOKEN_KEY, token);
    return;
  }
  if (!token) {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Already removed.
    }
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, secureOptions());
}

async function readToken() {
  if (Platform.OS === 'web') return webStore()?.getItem(TOKEN_KEY) || '';
  const value = await SecureStore.getItemAsync(TOKEN_KEY, secureOptions());
  return value || '';
}

async function writeUser(user) {
  if (!user) {
    await AsyncStorage.removeItem(AUTH_KEY);
    return;
  }
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ user }));
}

/** Profile stays in app storage. The login token stays in the phone keystore. */
export async function saveSession(token, user) {
  await writeToken(token || '');
  await writeUser(user || null);
}

export async function clearSession() {
  await writeToken('');
  await AsyncStorage.removeItem(AUTH_KEY);
}

export async function readSession() {
  let raw = null;
  try {
    raw = await AsyncStorage.getItem(AUTH_KEY);
  } catch {
    raw = null;
  }
  let saved = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }

  let token = '';
  try {
    token = await readToken();
  } catch {
    token = '';
  }

  if (!token && saved?.accessToken) {
    try {
      await writeToken(String(saved.accessToken));
      token = String(saved.accessToken);
      if (saved.user) await writeUser(saved.user);
      else await AsyncStorage.removeItem(AUTH_KEY);
    } catch {
      token = String(saved.accessToken);
    }
  }

  return { token, user: saved?.user || null };
}

export async function readAccessToken() {
  try {
    const session = await readSession();
    return session.token || '';
  } catch {
    return '';
  }
}
