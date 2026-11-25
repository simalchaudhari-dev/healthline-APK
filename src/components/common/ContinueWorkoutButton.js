import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Play, RotateCcw } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import { softShadow } from './premiumStyles';
import { routineMinutes } from '../../data/homeExercises';
import { useWorkoutProgress } from '../../utils/workoutProgress';

/**
 * "Continue exercise" — resumes today's unfinished home workout at the same move.
 * With nothing to resume it starts `fallbackRoutine` (the user's daily routine), or renders
 * nothing when no fallback is given.
 */
export default function ContinueWorkoutButton({ navigation, fallbackRoutine, style }) {
  const { themeColors: c } = useTheme();
  const progress = useWorkoutProgress();

  if (!progress && !fallbackRoutine) return null;

  const resume = Boolean(progress);
  const title = resume ? 'Continue exercise' : 'Start today’s workout';
  const sub = resume
    ? `${progress.title} · move ${progress.index + 1} of ${progress.total}`
    : `${fallbackRoutine.name} · ${routineMinutes(fallbackRoutine)} min`;

  const open = () => {
    if (resume) {
      navigation.navigate('HomeWorkoutPlayer', {
        routineId: progress.routineId || undefined,
        exerciseId: progress.exerciseId || undefined,
        resume: true,
      });
    } else {
      navigation.navigate('HomeWorkoutPlayer', { routineId: fallbackRoutine.id });
    }
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.btn,
        softShadow,
        { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.icon}>
        {resume ? <RotateCcw size={18} color={colors.primary} /> : <Play size={18} color={colors.primary} fill={colors.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { fontFamily: snPro('800') }]}>{title}</Text>
        <Text style={[styles.sub, { fontFamily: snPro('500') }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Play size={16} color="#FFF" fill="#FFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
});
