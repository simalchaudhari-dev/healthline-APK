import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { gcm } from '@noble/ciphers/aes.js';

import { DIARY_STATE_KEY } from '../config/storageKeys';

const KEY_NAME = 'healthline_diary_key_v1';

function secureOptions() {
  if (Platform.OS !== 'ios') return {};
  return { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
}

function webStore() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function readKeyHex() {
  if (Platform.OS === 'web') return webStore()?.getItem(KEY_NAME) || '';
  return (await SecureStore.getItemAsync(KEY_NAME, secureOptions())) || '';
}

async function writeKeyHex(hex) {
  if (Platform.OS === 'web') {
    webStore()?.setItem(KEY_NAME, hex);
    return;
  }
  await SecureStore.setItemAsync(KEY_NAME, hex, secureOptions());
}

async function ensureKey() {
  const existing = await readKeyHex();
  if (existing && existing.length === 64) return hexToBytes(existing);
  const bytes = await Crypto.getRandomBytesAsync(32);
  await writeKeyHex(bytesToHex(bytes));
  return bytes;
}

function isPlainDiary(value) {
  return Boolean(value && typeof value === 'object' && (value.days || value.profile || value.weightLogs));
}

/** Offline diary copy. The key stays in the phone keystore; the file is ciphertext. */
export async function readDiaryState() {
  const raw = await AsyncStorage.getItem(DIARY_STATE_KEY);
  if (!raw) return null;
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed?.v === 1 && parsed.iv && parsed.ct) {
    const hex = await readKeyHex();
    if (!hex) return null;
    try {
      const plain = gcm(hexToBytes(hex), hexToBytes(parsed.iv)).decrypt(hexToBytes(parsed.ct));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch {
      return null;
    }
  }
  return isPlainDiary(parsed) ? parsed : null;
}

export async function writeDiaryState(payload) {
  const key = await ensureKey();
  const iv = await Crypto.getRandomBytesAsync(12);
  const ct = gcm(key, iv).encrypt(new TextEncoder().encode(JSON.stringify(payload)));
  await AsyncStorage.setItem(
    DIARY_STATE_KEY,
    JSON.stringify({ v: 1, iv: bytesToHex(iv), ct: bytesToHex(ct) })
  );
}
