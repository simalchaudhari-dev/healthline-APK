import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

const BIP = require('../../assets/audio/bip.mp3');
const WHISTLE = require('../../assets/audio/whistle.mp3');

/** Remembered on/off for workout sounds (per device). */
const SOUND_KEY = 'healthline.workoutSoundOn';

let audioModeSet = false;

/**
 * Workout sound cues: a short "bip" for the 3-2-1 countdown and a PT whistle for start / time up.
 * Sounds play over the user's music (ducking it briefly) and never throw — a failed sound is
 * simply skipped, so the timer keeps working.
 */
export default function useWorkoutSounds() {
  const bip = useAudioPlayer(BIP);
  const whistle = useAudioPlayer(WHISTLE);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  soundOnRef.current = soundOn;

  useEffect(() => {
    AsyncStorage.getItem(SOUND_KEY)
      .then((v) => {
        if (v === '0') setSoundOn(false);
      })
      .catch(() => {});
    if (!audioModeSet) {
      audioModeSet = true;
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      }).catch(() => {});
    }
  }, []);

  const playFromStart = useCallback((player) => {
    if (!soundOnRef.current || !player) return;
    try {
      // Restart from the beginning so quick repeats (3-2-1) each play in full.
      player.seekTo(0)?.catch?.(() => {});
      player.play();
    } catch {
      // ignore — a missed cue must never break the workout
    }
  }, []);

  const playBip = useCallback(() => playFromStart(bip), [playFromStart, bip]);
  const playWhistle = useCallback(() => playFromStart(whistle), [playFromStart, whistle]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      AsyncStorage.setItem(SOUND_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  return { soundOn, toggleSound, playBip, playWhistle };
}
