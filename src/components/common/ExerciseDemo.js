import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';
import { snPro } from '../../config/fonts';
import { getExerciseMedia } from '../../data/exerciseMedia';
import { getExercise } from '../../data/homeExercises';

/** True when the exercise has a demo to show: an uploaded GIF (admin panel) or a built-in one. */
export function hasExerciseDemo(exerciseId) {
  return Boolean(getExercise(exerciseId)?.gifUrl || getExerciseMedia(exerciseId));
}

/**
 * Looping demo animation for a home exercise. Renders nothing when the exercise has no GIF.
 * A GIF uploaded in the admin panel wins; otherwise the built-in one is used.
 * expo-image is used because React Native's Image doesn't animate GIFs on Android.
 */
export default function ExerciseDemo({ exerciseId, size = 170 }) {
  const { themeColors: c } = useTheme();
  useExerciseCatalog(); // re-render when the admin changes a GIF
  const exercise = getExercise(exerciseId);
  const media = exercise?.gifUrl
    ? { source: { uri: exercise.gifUrl }, caption: exercise.gifCaption || '' }
    : getExerciseMedia(exerciseId);
  if (!media) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, { width: size, height: size, borderColor: c.border }]}>
        <Image
          source={media.source}
          style={styles.img}
          contentFit="contain"
          autoplay
          cachePolicy="memory-disk"
          accessibilityLabel="Exercise demonstration"
        />
      </View>
      {media.caption ? (
        <Text style={[styles.caption, { color: c.muted, fontFamily: snPro('600') }]}>{media.caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // GIFs have a light background — keep a white frame so they look right in dark mode too.
  frame: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  img: { width: '100%', height: '100%' },
  caption: { fontSize: 12, marginTop: 8, textAlign: 'center' },
});
