import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { Scale } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { colors, themeColors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import AppButton from '../../components/common/AppButton';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { onlyNumbers, validateWeightKg } from '../../utils/validation';
import { formatDateTime, formatDayDate } from '../../utils/formatDate';
import { weightHistory } from '../../utils/weightLogs';

export default function LogWeightScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { profile, weightLogs, addWeightLog } = useDiary();
  const { ready, allowed } = useFeatureGate(navigation, { route: 'LogWeight', key: 'weight' });
  const [weight, setWeight] = useState(String(profile.weight));
  const [error, setError] = useState('');
  const history = useMemo(() => weightHistory(weightLogs), [weightLogs]);

  if (!ready || !allowed) {
    return <LoadingScreen fullScreen message="Checking feature..." />;
  }

  const save = () => {
    const err = validateWeightKg(weight);
    setError(err);
    if (err) return;
    addWeightLog(weight);
    navigation.goBack();
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Log weight" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={[styles.icon, { backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft }]}>
            <Scale size={22} color={colors.primary} />
          </View>
          <Text style={[styles.currentLbl, { color: c.muted, fontFamily: snPro('600') }]}>Current</Text>
          <Text style={[styles.currentVal, { color: c.text, fontFamily: FONT.nova }]}>{profile.weight} kg</Text>
          <Text style={[styles.goalHint, { color: colors.accent, fontFamily: snPro('600') }]}>
            Goal {profile.goalWeight} kg
          </Text>
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>TODAY'S WEIGH-IN</Text>
        <View
          style={[
            styles.inputCard,
            { backgroundColor: c.cardBg, borderColor: error ? colors.danger : c.border },
          ]}
        >
          <TextInput
            value={weight}
            onChangeText={(v) => {
              const next = onlyNumbers(v, { decimal: true });
              setWeight(next);
              if (error) setError(validateWeightKg(next));
            }}
            keyboardType="decimal-pad"
            style={[styles.input, { color: c.text, fontFamily: snPro('800') }]}
            placeholder="0.0"
            placeholderTextColor={c.placeholder}
          />
          <Text style={[styles.unit, { color: c.muted }]}>kg</Text>
        </View>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <AppButton label="Save weight" onPress={save} style={{ marginTop: error ? 8 : 0 }} />

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800'), marginTop: 20 }]}>HISTORY</Text>
        {/* Every update, newest first, with the day and time it was saved. */}
        {history.length ? (
          history.map((log) => (
            <View
              key={log.id || `${log.date}-${log.at || ''}`}
              style={[styles.row, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <View>
                <Text style={[styles.rowDate, { color: c.text, fontFamily: snPro('600') }]}>
                  {formatDate(log.date)}
                </Text>
                {log.at ? (
                  <Text style={[styles.rowTime, { color: c.muted, fontFamily: snPro('500') }]}>
                    {formatTime(log.at)}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.rowVal, { color: c.text, fontFamily: snPro('700') }]}>{log.weight} kg</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.rowTime, { color: c.muted, fontFamily: snPro('500') }]}>
            No weight saved yet.
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

/** Mon, 19 Oct 2026 */
function formatDate(key) {
  return formatDayDate(key);
}

/** 10:35 am */
function formatTime(iso) {
  const text = formatDateTime(iso);
  return text ? text.split(', ').pop() : '';
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  currentLbl: { fontSize: 12 },
  currentVal: { fontSize: 36, marginTop: 4 },
  goalHint: { fontSize: 13, marginTop: 6 },
  section: { fontSize: 10, letterSpacing: 1, marginBottom: 10 },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 6,
  },
  input: { flex: 1, fontSize: 24 },
  unit: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 12, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  rowDate: { fontSize: 13 },
  rowTime: { fontSize: 12, marginTop: 2 },
  rowVal: { fontSize: 15 },
});
