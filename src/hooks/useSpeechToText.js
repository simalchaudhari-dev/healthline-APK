import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { IS_EXPO_GO } from '../services/notificationsService';

/**
 * Speech → text with expo-speech-recognition.
 *  - Android / iOS app: the phone's own speech service (free, supports en / hi / gu).
 *  - Web: the browser's Web Speech API (Chrome, Edge).
 *  - Expo Go: not available (native module missing) → `available` is false and the screen offers typing.
 *
 * Text is appended to `baseText` so the user can speak several times and edit in between.
 */

let speechModule;
/** The native module, or null where it can't load. Loaded lazily — importing it in Expo Go crashes. */
function speech() {
  if (speechModule !== undefined) return speechModule;
  if (Platform.OS !== 'web' && IS_EXPO_GO) {
    speechModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line global-require
    speechModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule || null;
  } catch {
    speechModule = null;
  }
  return speechModule;
}

const ERROR_TEXT = {
  'no-speech': "Didn't catch that — tap the mic and speak a little closer.",
  'speech-timeout': "Didn't catch that — tap the mic and speak a little closer.",
  'audio-capture': 'The microphone is busy or not working. Close other apps using it and try again.',
  network: 'Voice needs an internet connection on this phone. Check your connection or type instead.',
  'language-not-supported': 'This language isn’t available on your phone. Try English or type instead.',
  'service-not-allowed':
    'Speech recognition is turned off on this phone. Install or enable the Google app, or type instead.',
  busy: 'Voice is busy — wait a second and try again.',
};

export const SPEECH_LANGUAGES = [
  { id: 'en-IN', label: 'English' },
  { id: 'hi-IN', label: 'हिंदी' },
  { id: 'gu-IN', label: 'ગુજરાતી' },
];

export function useSpeechToText({ text, onText }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  /** true once the user has blocked mic/speech permission ("Don't allow" twice) — only Settings helps. */
  const [blocked, setBlocked] = useState(false);
  const baseRef = useRef('');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const M = speech();
  let available = false;
  try {
    available = !!M && (M.isRecognitionAvailable ? M.isRecognitionAvailable() : true);
  } catch {
    available = false;
  }

  useEffect(() => {
    if (!M) return undefined;
    const subs = [
      M.addListener('result', (event) => {
        const spoken = (event?.results?.[0]?.transcript || '').trim();
        if (!spoken) return;
        const base = baseRef.current;
        onTextRef.current?.(base ? `${base} ${spoken}` : spoken);
      }),
      M.addListener('end', () => setListening(false)),
      M.addListener('error', (event) => {
        setListening(false);
        if (event?.error === 'aborted') return;
        if (event?.error === 'not-allowed') {
          setError('Microphone permission is off.');
          return;
        }
        setError(ERROR_TEXT[event?.error] || event?.message || 'Voice input failed. You can type instead.');
      }),
    ];
    return () => {
      subs.forEach((s) => s?.remove?.());
      try {
        M.abort();
      } catch {
        // not running
      }
    };
  }, [M]);

  const start = useCallback(
    async (lang = 'en-IN') => {
      if (!M) return;
      setError('');
      // The browser shows its own mic prompt on web (and the module only logs a warning there).
      if (Platform.OS !== 'web') {
        const perm = await M.requestPermissionsAsync();
        if (!perm?.granted) {
          setBlocked(perm?.canAskAgain === false);
          setError('Allow the microphone to log meals by voice.');
          return;
        }
      }
      setBlocked(false);
      baseRef.current = String(text || '').trim();
      M.start({ lang, interimResults: true, continuous: false, addsPunctuation: true });
      setListening(true);
    },
    [M, text],
  );

  const stop = useCallback(() => {
    try {
      M?.stop();
    } catch {
      // already stopped
    }
    setListening(false);
  }, [M]);

  return { available, listening, error, blocked, start, stop, clearError: () => setError('') };
}
