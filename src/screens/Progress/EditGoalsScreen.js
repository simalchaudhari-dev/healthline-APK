import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader, { SaveButton } from '../../components/common/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { colors, themeColors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import {
  onlyNumbers,
  validateDailyCalories,
  validateMacroGrams,
  validateWaterGlasses,
  validateWeightKg,
} from '../../utils/validation';

const GOALS = [
  { key: 'lose', label: 'Lose weight' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain', label: 'Gain muscle' },
];

export default function EditGoalsScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { profile, updateProfile, goal, setGoal } = useDiary();
  const { isSignedIn, updateHealthProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const [calories, setCalories] = useState(String(profile.calories));
  const [protein, setProtein] = useState(String(profile.protein));
  const [carbs, setCarbs] = useState(String(profile.carbs));
  const [fat, setFat] = useState(String(profile.fat));
  const [waterGoal, setWaterGoal] = useState(String(profile.waterGoal));
  const [goalWeight, setGoalWeight] = useState(String(profile.goalWeight));
  const [selectedGoal, setSelectedGoal] = useState(goal);
  const [errors, setErrors] = useState({});

  const save = async () => {
    const next = {
      calories: validateDailyCalories(calories),
      protein: validateMacroGrams(protein, 'Protein', { min: 20, max: 400 }),
      carbs: validateMacroGrams(carbs, 'Carbs', { min: 20, max: 800 }),
      fat: validateMacroGrams(fat, 'Fat', { min: 10, max: 300 }),
      waterGoal: validateWaterGlasses(waterGoal),
      goalWeight: validateWeightKg(goalWeight, 'Goal weight'),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const changes = {
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      waterGoal: Number(waterGoal),
      goalWeight: Number(goalWeight),
    };

    setSaving(true);
    try {
      if (isSignedIn) {
        const res = await updateHealthProfile({ ...changes, goal: selectedGoal });
        if (!res.ok) return;
      }
      updateProfile(changes);
      setGoal(selectedGoal);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader
        title="Nutrition goals"
        onBack={() => navigation.goBack()}
        theme={c}
        right={<SaveButton onPress={save} disabled={saving} />}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>GOAL TYPE</Text>
        <View style={styles.goalRow}>
          {GOALS.map((g) => {
            const on = selectedGoal === g.key;
            return (
              <Pressable
                key={g.key}
                onPress={() => setSelectedGoal(g.key)}
                style={[
                  styles.goalChip,
                  {
                    backgroundColor: on ? colors.primary : isDark ? '#1C1C1E' : c.chip,
                    borderColor: on ? colors.primary : c.border,
                  },
                ]}
              >
                <Text style={[styles.goalChipText, { color: on ? '#FFF' : c.text, fontFamily: snPro('700') }]}>
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>DAILY TARGETS</Text>
        <Field
          label="Calories"
          value={calories}
          onChangeText={(v) => {
            setCalories(v);
            if (errors.calories) setErrors((p) => ({ ...p, calories: validateDailyCalories(v) }));
          }}
          suffix="kcal"
          theme={c}
          isDark={isDark}
          error={errors.calories}
        />
        <Field
          label="Protein"
          value={protein}
          onChangeText={(v) => {
            setProtein(v);
            if (errors.protein) {
              setErrors((p) => ({ ...p, protein: validateMacroGrams(v, 'Protein', { min: 20, max: 400 }) }));
            }
          }}
          suffix="g"
          theme={c}
          isDark={isDark}
          error={errors.protein}
        />
        <Field
          label="Carbs"
          value={carbs}
          onChangeText={(v) => {
            setCarbs(v);
            if (errors.carbs) {
              setErrors((p) => ({ ...p, carbs: validateMacroGrams(v, 'Carbs', { min: 20, max: 800 }) }));
            }
          }}
          suffix="g"
          theme={c}
          isDark={isDark}
          error={errors.carbs}
        />
        <Field
          label="Fat"
          value={fat}
          onChangeText={(v) => {
            setFat(v);
            if (errors.fat) {
              setErrors((p) => ({ ...p, fat: validateMacroGrams(v, 'Fat', { min: 10, max: 300 }) }));
            }
          }}
          suffix="g"
          theme={c}
          isDark={isDark}
          error={errors.fat}
        />
        <Field
          label="Water glasses"
          value={waterGoal}
          onChangeText={(v) => {
            setWaterGoal(v);
            if (errors.waterGoal) setErrors((p) => ({ ...p, waterGoal: validateWaterGlasses(v) }));
          }}
          suffix="cups"
          theme={c}
          isDark={isDark}
          error={errors.waterGoal}
        />
        <Field
          label="Goal weight"
          value={goalWeight}
          onChangeText={(v) => {
            setGoalWeight(v);
            if (errors.goalWeight) setErrors((p) => ({ ...p, goalWeight: validateWeightKg(v, 'Goal weight') }));
          }}
          suffix="kg"
          theme={c}
          isDark={isDark}
          error={errors.goalWeight}
        />
      </ScrollView>
    </ScreenShell>
  );
}

function Field({ label, value, onChangeText, suffix, theme, isDark, error }) {
  return (
    <View style={[styles.field, { backgroundColor: theme.cardBg, borderColor: error ? colors.danger : theme.border }]}>
      <Text style={[styles.fieldLbl, { color: theme.text, fontFamily: snPro('600') }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={(next) => onChangeText(onlyNumbers(next, { decimal: true }))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: isDark ? '#1C1C1E' : theme.chip,
              fontFamily: snPro('700'),
            },
          ]}
        />
        <Text style={[styles.suffix, { color: theme.muted }]}>{suffix}</Text>
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  section: { fontSize: 10, letterSpacing: 1, marginBottom: 10 },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },
  goalChip: {
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  goalChipText: { fontSize: 13 },
  field: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  fieldLbl: { fontSize: 12, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  suffix: { marginLeft: 10, fontSize: 13, fontWeight: '600', minWidth: 40 },
  error: { fontSize: 12, marginTop: 6 },
});
