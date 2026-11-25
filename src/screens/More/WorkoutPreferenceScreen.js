import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { toast } from '../../utils/toast';
import { LEVELS, ROUTINES, levelOf, routineMinutes, suggestedLevel, workoutPlanFor } from '../../data/homeExercises';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(30,94,36,0.06)' },
  default: {
    shadowColor: '#1e5e24',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

/**
 * Who is exercising (older / younger adult) and the daily routine.
 * Set once at sign-up; changed here so Exercises at home doesn't ask every time.
 */
export default function WorkoutPreferenceScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { profile, updateProfile } = useDiary();
  const { isSignedIn, updateHealthProfile } = useAuth();
  useExerciseCatalog(); // re-render after an admin change
  const initial = workoutPlanFor(profile);
  const [level, setLevel] = useState(initial.level);
  const [routineId, setRoutineId] = useState(initial.routine?.id || '');
  const [saving, setSaving] = useState(false);
  const plan = workoutPlanFor({ workoutLevel: level, workoutRoutine: routineId });

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const tileBg = isDark ? '#1A2A1A' : colors.primarySoft;
  const suggested = suggestedLevel(profile?.age);

  const save = async () => {
    const changes = { workoutLevel: plan.level, workoutRoutine: plan.routine?.id || '' };
    setSaving(true);
    try {
      if (isSignedIn) {
        const res = await updateHealthProfile(changes);
        if (!res.ok) return;
      }
      updateProfile(changes);
      toast.success(isSignedIn ? 'Workout preference saved' : 'Saved on this device');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.back, CARD_SHADOW, { backgroundColor: c.cardBg }]}
          >
            <ChevronLeft size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.6} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Workout preference</Text>
            <Text style={[styles.subtitle, { color: muted, fontFamily: snPro('400') }]}>
              Used by Exercises at home and your home screen
            </Text>
          </View>
        </View>

        <Text style={[styles.kicker, { color: muted, fontFamily: snPro('700') }]}>WHO IS EXERCISING</Text>
        {LEVELS.map((l) => {
          const on = level === l.id;
          return (
            <Pressable
              key={l.id}
              onPress={() => {
                setLevel(l.id);
                setRoutineId('');
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.card,
                CARD_SHADOW,
                {
                  backgroundColor: on ? tileBg : c.cardBg,
                  borderColor: on ? colors.primary : isDark ? c.border : 'transparent',
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={[styles.radio, { borderColor: on ? colors.primary : isDark ? c.border : '#cfe3c7' }]}>
                {on ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: ink, fontFamily: poppins('600') }]}>{l.label}</Text>
                <Text style={[styles.cardSub, { color: muted, fontFamily: snPro('400') }]}>{l.hint}</Text>
                {l.id === suggested && Number(profile?.age) ? (
                  <Text style={[styles.tag, { color: colors.primary, fontFamily: snPro('700') }]}>
                    SUGGESTED FOR AGE {profile.age}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        <Text style={[styles.kicker, { color: muted, fontFamily: snPro('700'), marginTop: 10 }]}>DAILY ROUTINE</Text>
        <View style={[styles.list, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
          {ROUTINES.filter((r) => levelOf(r) === plan.level).map((r, i, arr) => {
            const on = plan.routine?.id === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRoutineId(r.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[
                  styles.row,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? c.border : '#eef2ec' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: ink, fontFamily: snPro('700') }]}>{r.name}</Text>
                  <Text style={[styles.rowSub, { color: muted, fontFamily: snPro('400') }]} numberOfLines={2}>
                    {routineMinutes(r)} min · {r.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.check,
                    { borderColor: on ? colors.primary : isDark ? c.border : '#cfe3c7', backgroundColor: on ? colors.primary : 'transparent' },
                  ]}
                >
                  {on ? <Check size={14} color="#FFF" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <AppButton label="Save" size="lg" onPress={save} loading={saving} disabled={saving} style={{ marginTop: 8 }} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  subtitle: { fontSize: 12 },
  kicker: { fontSize: 11, letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  cardSub: { fontSize: 12, marginTop: 2 },
  tag: { fontSize: 10, letterSpacing: 0.8, marginTop: 6 },
  list: { borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowTitle: { fontSize: 14 },
  rowSub: { fontSize: 12, marginTop: 2 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
