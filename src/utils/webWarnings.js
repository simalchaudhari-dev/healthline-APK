import { Platform } from 'react-native';

/**
 * react-native-web prints two deprecation warnings for styles that are correct on Android/iOS
 * ("shadow*" → "boxShadow", props.pointerEvents → style.pointerEvents). Changing every shadow would
 * alter how cards look in the APK, so on web only these two exact messages are hidden from the console.
 * Every other warning still shows.
 */
const HIDDEN_WEB_WARNINGS = [
  '"shadow*" style props are deprecated',
  'props.pointerEvents is deprecated',
];

if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const original = console.warn;
  console.warn = (...args) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (HIDDEN_WEB_WARNINGS.some((text) => first.includes(text))) return;
    original(...args);
  };
}
