import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader, { SaveButton } from '../../components/common/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { colors, themeColors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { toast } from '../../utils/toast';
import { onlyNumbers, validateAge, validateHeightCm, validateWeightKg } from '../../utils/validation';
import {
  FOCUS_GOALS,
  ACTIVITY,
  SEX_OPTS,
  DIET_OPTS,
  DIET_EXCLUSIVE,
  ALLERGENS,
  CONDITIONS,
  CONDITIONS_EXCLUSIVE,
} from '../../config/healthOptions';
import { LEVELS, ROUTINES, levelOf, workoutPlanFor } from '../../data/homeExercises';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';

/** Toggle `value` in a list. The exclusive option ("None" / "No preference") clears the rest, and vice versa. */
function toggleIn(list, value, exclusive) {
  if (exclusive && value === exclusive) return list.includes(value) ? [] : [value];
  const rest = list.filter((v) => v !== exclusive);
  return rest.includes(value) ? rest.filter((v) => v !== value) : [...rest, value];
}

/** Everything the user filled in during sign-up (body, activity, diet, allergies, conditions, focus). */
export default function HealthProfileScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { profile, updateProfile } = useDiary();
  const { isSignedIn, updateHealthProfile } = useAuth();

  const [sex, setSex] = useState(profile.sex || '');
  const [age, setAge] = useState(String(profile.age ?? ''));
  const [height, setHeight] = useState(String(profile.heightCm ?? ''));
  const [weight, setWeight] = useState(String(profile.weight ?? ''));
  const [goalWeight, setGoalWeight] = useState(String(profile.goalWeight ?? ''));
  const [activity, setActivity] = useState(profile.activity || 'Moderate');
  const [focusGoals, setFocusGoals] = useState(profile.focusGoals || []);
  const [diet, setDiet] = useState(profile.diet || []);
  const [allergies, setAllergies] = useState(profile.allergies || []);
  const [conditions, setConditions] = useState(profile.conditions || []);
  useExerciseCatalog(); // re-render after an admin change
  const initialPlan = workoutPlanFor(profile);
  const [workoutLevel, setWorkoutLevel] = useState(initialPlan.level);
  const [workoutRoutine, setWorkoutRoutine] = useState(initialPlan.routine?.id || '');
  const plan = workoutPlanFor({ workoutLevel, workoutRoutine });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = {
      age: validateAge(age),
      height: validateHeightCm(height),
      weight: validateWeightKg(weight, 'Current weight'),
      goalWeight: validateWeightKg(goalWeight, 'Goal weight'),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      toast.warning('Please fix the highlighted fields.');
      return;
    }

    const changes = {
      sex,
      age: Number(age),
      heightCm: Number(height),
      weight: Number(weight),
      goalWeight: Number(goalWeight),
      activity,
      focusGoals,
      diet,
      allergies,
      conditions,
      workoutLevel: plan.level,
      workoutRoutine: plan.routine?.id || '',
    };

    setSaving(true);
    try {
      if (isSignedIn) {
        const res = await updateHealthProfile(changes);
        if (!res.ok) return;
      }
      updateProfile(changes);
      toast.success(isSignedIn ? 'Health details saved' : 'Saved on this device');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const numberField = (label, value, setValue, key, suffix) => (
    <View style={styles.half}>
      <Text style={[styles.fieldLbl, { color: c.muted, fontFamily: snPro('700') }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: c.cardBg, borderColor: errors[key] ? colors.danger : c.border },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={(v) => {
            const next = onlyNumbers(v, { decimal: key !== 'age' });
            setValue(next);
            if (errors[key]) setErrors((p) => ({ ...p, [key]: '' }));
          }}
          keyboardType="decimal-pad"
          style={[styles.input, { color: c.text, fontFamily: snPro('700') }]}
          placeholderTextColor={c.placeholder}
        />
        <Text style={[styles.suffix, { color: c.muted, fontFamily: snPro('600') }]}>{suffix}</Text>
      </View>
      {errors[key] ? <Text style={[styles.error, { color: colors.danger }]}>{errors[key]}</Text> : null}
    </View>
  );

  const chip = (label, on, onPress) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: on ? colors.primary : isDark ? '#1C1C1E' : c.chip,
          borderColor: on ? colors.primary : c.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: on ? '#FFF' : c.text, fontFamily: snPro('700') }]}>{label}</Text>
    </Pressable>
  );

  const section = (title, hint) => (
    <View style={styles.sectionHead}>
      <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('400') }]}>{hint}</Text> : null}
    </View>
  );

  return (
    <ScreenShell>
      <ScreenHeader
        title="Health details"
        onBack={() => navigation.goBack()}
        theme={c}
        right={<SaveButton onPress={save} disabled={saving} />}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {section('SEX')}
        <View style={styles.chips}>
          {SEX_OPTS.map((o) => chip(o.label, sex === o.id, () => setSex(o.id)))}
        </View>

        {section('BODY')}
        <View style={styles.row}>
          {numberField('Age', age, setAge, 'age', 'yrs')}
          {numberField('Height', height, setHeight, 'height', 'cm')}
        </View>
        <View style={styles.row}>
          {numberField('Current weight', weight, setWeight, 'weight', 'kg')}
          {numberField('Goal weight', goalWeight, setGoalWeight, 'goalWeight', 'kg')}
        </View>

        {section('ACTIVITY LEVEL')}
        <View style={styles.chips}>{ACTIVITY.map((a) => chip(a, activity === a, () => setActivity(a)))}</View>

        {section('DAILY WORKOUT', 'Shown on your home screen')}
        <View style={styles.chips}>
          {LEVELS.map((l) =>
            chip(l.label, plan.level === l.id, () => {
              setWorkoutLevel(l.id);
              setWorkoutRoutine('');
            }),
          )}
        </View>
        <View style={[styles.chips, { marginTop: 8 }]}>
          {ROUTINES.filter((r) => levelOf(r) === plan.level).map((r) =>
            chip(r.name, plan.routine?.id === r.id, () => setWorkoutRoutine(r.id)),
          )}
        </View>

        {section('WHAT YOU WANT HELP WITH', 'Pick any')}
        {FOCUS_GOALS.map((g) => {
          const on = focusGoals.includes(g.id);
          return (
            <Pressable
              key={g.id}
              onPress={() => setFocusGoals((prev) => toggleIn(prev, g.id))}
              style={[styles.focusRow, { backgroundColor: c.cardBg, borderColor: on ? colors.primary : c.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.focusLbl, { color: c.text, fontFamily: snPro('700') }]}>{g.label}</Text>
                <Text style={[styles.focusSub, { color: c.muted, fontFamily: snPro('400') }]}>{g.sub}</Text>
              </View>
              <View
                style={[
                  styles.check,
                  { borderColor: on ? colors.primary : c.border, backgroundColor: on ? colors.primary : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}

        {section('DIET', 'Pick any')}
        <View style={styles.chips}>
          {DIET_OPTS.map((d) =>
            chip(d, diet.includes(d), () => setDiet((prev) => toggleIn(prev, d, DIET_EXCLUSIVE))),
          )}
        </View>

        {section('ALLERGIES', 'The AI coach avoids these')}
        <View style={styles.chips}>
          {ALLERGENS.map((a) => chip(a, allergies.includes(a), () => setAllergies((prev) => toggleIn(prev, a))))}
        </View>

        {section('HEALTH CONDITIONS')}
        <View style={styles.chips}>
          {CONDITIONS.map((h) =>
            chip(h, conditions.includes(h), () => setConditions((prev) => toggleIn(prev, h, CONDITIONS_EXCLUSIVE))),
          )}
        </View>

        <View style={[styles.info, { backgroundColor: isDark ? '#1C1C1E' : c.chip }]}>
          <Text style={[styles.infoTitle, { color: c.text, fontFamily: FONT.nova }]}>
            {isSignedIn ? 'Saved to your account' : 'Saved on this device'}
          </Text>
          <Text style={[styles.infoBody, { color: c.muted, fontFamily: snPro('400') }]}>
            Calories and macros don’t change automatically — adjust them in Nutrition goals. This is
            for personalisation only, not medical advice.
          </Text>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 18, marginBottom: 10 },
  section: { fontSize: 10, letterSpacing: 1 },
  hint: { fontSize: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  half: { flex: 1 },
  fieldLbl: { fontSize: 12, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, fontSize: 16 },
  suffix: { fontSize: 13, marginLeft: 6 },
  error: { fontSize: 12, marginTop: 6 },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  focusLbl: { fontSize: 15 },
  focusSub: { fontSize: 12, marginTop: 3 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, marginLeft: 12 },
  info: { marginTop: 24, borderRadius: 14, padding: 14 },
  infoTitle: { fontSize: 16, marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 19 },
});
