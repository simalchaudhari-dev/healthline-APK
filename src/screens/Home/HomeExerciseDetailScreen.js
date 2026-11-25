import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { ChevronLeft, Heart, TriangleAlert } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { CATEGORIES, LEVELS, levelOf, getExercise } from '../../data/homeExercises';
import ExerciseDemo, { hasExerciseDemo } from '../../components/common/ExerciseDemo';
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

/** How to do one home exercise: steps, benefits and safety, with a button to start it. */
export default function HomeExerciseDetailScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  useExerciseCatalog(); // re-render after an admin change
  const ex = getExercise(route.params?.id);

  if (!ex) {
    return (
      <ScreenShell>
        <ScreenHeader title="Exercise" onBack={() => navigation.goBack()} theme={c} />
        <Text style={{ padding: 20, color: c.muted }}>Exercise not found.</Text>
      </ScreenShell>
    );
  }

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const accent = isDark ? c.text : colors.primaryDark;

  const cat = CATEGORIES.find((x) => x.id === ex.category);
  const minutes = Math.round(ex.seconds / 60) || 1;
  const level = LEVELS.find((l) => l.id === levelOf(ex));
  const meta = [cat?.label || 'Exercise', ex.target, ex.chair ? 'Seated / chair' : null].filter(Boolean).join(' · ');

  const stats = [
    { key: 'time', value: `${minutes}`, label: 'min' },
    ex.met ? { key: 'met', value: `${ex.met}`, label: 'MET effort' } : null,
    level ? { key: 'level', value: level.label, label: 'Level' } : null,
  ].filter(Boolean);

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
            <ChevronLeft size={20} color={accent} strokeWidth={2.6} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]} numberOfLines={2}>
              {ex.name}
            </Text>
            <Text style={[styles.subtitle, { color: muted, fontFamily: snPro('400') }]}>{meta}</Text>
          </View>
        </View>

        {hasExerciseDemo(ex.id) ? (
          <View style={[styles.media, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
            <ExerciseDemo exerciseId={ex.id} size={220} />
          </View>
        ) : null}

        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.key} style={[styles.stat, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
              <Text
                style={[styles.statVal, { color: ink, fontFamily: poppins('600') }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {s.value}
              </Text>
              <Text style={[styles.statLbl, { color: muted, fontFamily: snPro('400') }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
          <Text style={[styles.cardTitle, { color: ink, fontFamily: poppins('600') }]}>How to do it</Text>
          {ex.how.map((step, i) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={[styles.stepNumText, { fontFamily: poppins('600') }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: ink, fontFamily: snPro('500') }]}>{step}</Text>
            </View>
          ))}
        </View>

        {ex.benefits ? (
          <View style={[styles.card, { backgroundColor: isDark ? '#16301a' : '#e2f2dc' }]}>
            <View style={styles.headRow}>
              <Heart size={16} color={isDark ? c.text : colors.primary} />
              <Text style={[styles.cardTitle, styles.noGap, { color: ink, fontFamily: poppins('600') }]}>Benefits</Text>
            </View>
            <Text style={[styles.body, { color: ink, fontFamily: snPro('400') }]}>{ex.benefits}</Text>
          </View>
        ) : null}

        {ex.safety ? (
          <View style={[styles.card, { backgroundColor: isDark ? '#3a1d1a' : '#fde4e1' }]}>
            <View style={styles.headRow}>
              <TriangleAlert size={16} color={isDark ? '#f4a29a' : '#c0392b'} />
              <Text style={[styles.cardTitle, styles.noGap, { color: ink, fontFamily: poppins('600') }]}>Be safe</Text>
            </View>
            <Text style={[styles.body, { color: ink, fontFamily: snPro('400') }]}>{ex.safety}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.outline, { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#cfe3c7' }]}
          >
            <Text style={[styles.outlineText, { color: accent, fontFamily: snPro('700') }]}>Back</Text>
          </Pressable>
          <View style={{ flex: 2 }}>
            <AppButton
              label="Start this exercise"
              onPress={() => navigation.navigate('HomeWorkoutPlayer', { exerciseId: ex.id })}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  subtitle: { fontSize: 12, lineHeight: 16 },
  media: { borderRadius: 16, padding: 12, alignItems: 'center', overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 20, lineHeight: 26 },
  statLbl: { fontSize: 12, marginTop: 2 },
  card: { borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 16, lineHeight: 22, marginBottom: 12 },
  noGap: { marginBottom: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  step: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFF', fontSize: 13 },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  outline: {
    flex: 1,
    height: 52,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontSize: 14 },
});
