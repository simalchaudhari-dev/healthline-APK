import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Platform } from 'react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader, { SaveButton } from '../../components/common/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { colors, themeColors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import AppButton from '../../components/common/AppButton';
import {
  onlyNumbers,
  validateFoodName,
  validateText,
  validateInteger,
  validateMacroGrams,
} from '../../utils/validation';

export default function ManualFoodScreen({ navigation, route }) {
  const meal = route.params?.meal || 'breakfast';
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { addCustomFood, addFood } = useDiary();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('Custom');
  const [serving, setServing] = useState('1 serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');
  const [errors, setErrors] = useState({});

  const validateAll = () => {
    const next = {
      name: validateFoodName(name),
      brand: validateText(brand, 'Brand', { min: 1, max: 60 }),
      serving: validateText(serving, 'Serving', { min: 1, max: 40 }),
      calories: validateInteger(calories, 'Calories', { min: 0, max: 5000 }),
      protein: validateMacroGrams(protein || '0', 'Protein', { min: 0, max: 500 }),
      carbs: validateMacroGrams(carbs || '0', 'Carbs', { min: 0, max: 500 }),
      fat: validateMacroGrams(fat || '0', 'Fat', { min: 0, max: 500 }),
      fiber: fiber.trim() ? validateMacroGrams(fiber, 'Fiber', { min: 0, max: 200 }) : '',
      sugar: sugar.trim() ? validateMacroGrams(sugar, 'Sugar', { min: 0, max: 200 }) : '',
      sodium: sodium.trim() ? validateInteger(sodium, 'Sodium', { min: 0, max: 10000 }) : '',
    };
    // Require at least calories filled (including 0 is ok but empty is not)
    if (!String(calories).trim()) next.calories = 'Calories is required.';
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const save = (alsoLog) => {
    if (!validateAll()) return;
    const food = addCustomFood({
      name: name.trim(),
      brand: brand.trim() || 'Custom',
      serving: serving.trim() || '1 serving',
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Math.max(0, Math.round(Number(protein) || 0)),
      carbs: Math.max(0, Math.round(Number(carbs) || 0)),
      fat: Math.max(0, Math.round(Number(fat) || 0)),
      fiber: Math.max(0, Math.round(Number(fiber) || 0)),
      sugar: Math.max(0, Math.round(Number(sugar) || 0)),
      sodium: Math.max(0, Math.round(Number(sodium) || 0)),
    });
    if (alsoLog) {
      addFood(meal, food);
      navigation.navigate('Main', { screen: 'Diary' });
      return;
    }
    navigation.goBack();
  };

  return (
    <ScreenShell>
      <ScreenHeader
        title="Create food"
        onBack={() => navigation.goBack()}
        theme={c}
        right={<SaveButton onPress={() => save(false)} label="Save" />}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('500') }]}>
          Manual entry for {meal}. Values are per serving.
        </Text>

        <Field
          label="Food name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (errors.name) setErrors((p) => ({ ...p, name: validateFoodName(v) }));
          }}
          theme={c}
          placeholder="e.g. Homemade dal"
          error={errors.name}
        />
        <Field
          label="Brand"
          value={brand}
          onChangeText={(v) => {
            setBrand(v);
            if (errors.brand) setErrors((p) => ({ ...p, brand: validateText(v, 'Brand', { min: 1, max: 60 }) }));
          }}
          theme={c}
          error={errors.brand}
        />
        <Field
          label="Serving"
          value={serving}
          onChangeText={(v) => {
            setServing(v);
            if (errors.serving) {
              setErrors((p) => ({ ...p, serving: validateText(v, 'Serving', { min: 1, max: 40 }) }));
            }
          }}
          theme={c}
          error={errors.serving}
        />

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>MACROS</Text>
        <View style={styles.row2}>
          <Field
            label="Calories"
            value={calories}
            onChangeText={setCalories}
            theme={c}
            keyboardType="number-pad"
            half
            error={errors.calories}
          />
          <Field
            label="Protein (g)"
            value={protein}
            onChangeText={setProtein}
            theme={c}
            keyboardType="number-pad"
            half
            error={errors.protein}
          />
        </View>
        <View style={styles.row2}>
          <Field
            label="Carbs (g)"
            value={carbs}
            onChangeText={setCarbs}
            theme={c}
            keyboardType="number-pad"
            half
            error={errors.carbs}
          />
          <Field
            label="Fat (g)"
            value={fat}
            onChangeText={setFat}
            theme={c}
            keyboardType="number-pad"
            half
            error={errors.fat}
          />
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>OPTIONAL MICROS</Text>
        <View style={styles.row2}>
          <Field
            label="Fiber (g)"
            value={fiber}
            onChangeText={setFiber}
            theme={c}
            keyboardType="number-pad"
            half
            error={errors.fiber}
          />
          <Field
            label="Sugar (g)"
            value={sugar}
            onChangeText={setSugar}
            theme={c}
            keyboardType="number-pad"
            half
            error={errors.sugar}
          />
        </View>
        <Field
          label="Sodium (mg)"
          value={sodium}
          onChangeText={setSodium}
          theme={c}
          keyboardType="number-pad"
          error={errors.sodium}
        />

        <AppButton
          label={`Save & log to ${meal}`}
          onPress={() => save(true)}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </ScreenShell>
  );
}

function Field({ label, value, onChangeText, theme, placeholder, keyboardType, half, error }) {
  const decimal = keyboardType === 'decimal-pad';
  const numeric = decimal || keyboardType === 'number-pad' || keyboardType === 'numeric';
  return (
    <View style={[styles.field, half && styles.half]}>
      <Text style={[styles.lbl, { color: theme.muted, fontFamily: snPro('600') }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(next) => onChangeText(numeric ? onlyNumbers(next, { decimal }) : next)}
        placeholder={placeholder || ''}
        placeholderTextColor={theme.placeholder}
        keyboardType={keyboardType || 'default'}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.cardBg,
            borderColor: error ? colors.danger : theme.border,
            fontFamily: snPro('500'),
          },
          Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : null,
        ]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 13, marginBottom: 14, textTransform: 'capitalize' },
  section: { fontSize: 10, letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  row2: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 10 },
  half: { flex: 1 },
  lbl: { fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { fontSize: 12, marginTop: 4 },
});
