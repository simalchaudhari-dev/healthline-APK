import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { ChevronLeft, CalendarDays, Download, FileText } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import AppButton from '../../components/common/AppButton';
import DatePickerModal from '../../components/common/DatePickerModal';
import { addDays, toKey } from '../../components/common/WeekPickerModal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { toast } from '../../utils/toast';
import { downloadHealthReport } from '../../services/healthReportService';
import { formatDate } from '../../utils/formatDate';

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

const fmt = formatDate;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;

const INCLUDED = [
  'Food, calories and macros (protein, carbs, fat)',
  'Water, steps and weight',
  'Exercise minutes, calories burned and type',
  'Lab reports you uploaded',
  'A day-by-day table',
];

/** Download the full health report as a PDF for any dates between signup and today. */
export default function HealthReportDownloadScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { user, accessToken, isSignedIn } = useAuth();
  const today = toKey(new Date());
  const joined = user?.joined && user.joined <= today ? user.joined : '';
  const earliest = joined || addDays(today, -89);
  const [from, setFrom] = useState(earliest);
  const [to, setTo] = useState(today);
  const [picking, setPicking] = useState(null); // 'from' | 'to'
  // "Custom": the user picks any From–To on the calendar.
  const [customMode, setCustomMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const tileBg = isDark ? '#1A2A1A' : colors.primarySoft;

  // A quick range that would start before signup is the same as "Since signup", so it is not shown.
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;
  const presets = [
    { id: 'all', label: joined ? 'Since signup' : 'Last 90 days', from: earliest, to: today },
    { id: '7', label: 'Last 7 days', from: addDays(today, -6), to: today },
    { id: '30', label: 'Last 30 days', from: addDays(today, -29), to: today },
    { id: 'month', label: 'This month', from: monthStart, to: today },
  ].filter((p, i) => i === 0 || p.from > earliest);
  // Previous calendar month — from the signup day if they joined during it; hidden if they joined later.
  if (lastMonthEnd >= earliest) {
    presets.push({
      id: 'lastMonth',
      label: 'Last month',
      from: lastMonthStart < earliest ? earliest : lastMonthStart,
      to: lastMonthEnd,
    });
  }
  // Only one chip is selected: the first one that matches the picked dates, else "Custom".
  const matched = presets.find((p) => from === p.from && to === p.to)?.id;
  const activePreset = customMode || !matched ? 'custom' : matched;

  const download = async () => {
    if (!isSignedIn || !accessToken) {
      toast.warning('Sign in to download your report.');
      return;
    }
    setBusy(true);
    try {
      const res = await downloadHealthReport(accessToken, { from, to, today });
      toast.success(res.opened ? 'Opening your report…' : 'Report downloaded');
    } catch (err) {
      toast.error(err?.message || 'Could not make the report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const dateField = (label, value, which) => (
    <Pressable
      onPress={() => setPicking(which)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${fmt(value)}`}
      style={({ pressed }) => [
        styles.field,
        { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#cfe3c7', opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Text style={[styles.fieldLbl, { color: muted, fontFamily: snPro('700') }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <CalendarDays size={16} color={colors.primary} />
        <Text style={[styles.fieldVal, { color: ink, fontFamily: snPro('700') }]}>{fmt(value)}</Text>
      </View>
    </Pressable>
  );

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
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Health report</Text>
            <Text style={[styles.subtitle, { color: muted, fontFamily: snPro('400') }]}>Download a PDF of everything you logged</Text>
          </View>
        </View>

        <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
          <Text style={[styles.kicker, { color: muted, fontFamily: snPro('700') }]}>QUICK PICK</Text>
          <View style={styles.chips}>
            {[...presets, { id: 'custom', label: 'Custom' }].map((p) => {
              const on = p.id === activePreset;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    if (p.id === 'custom') {
                      // Any range: open the start date, then the end date.
                      setCustomMode(true);
                      setPicking('from');
                      return;
                    }
                    setFrom(p.from);
                    setTo(p.to);
                    setCustomMode(false);
                  }}
                  style={[
                    p.id === 'custom' && styles.customChip,
                    styles.chip,
                    {
                      backgroundColor: on ? colors.primary : c.cardBg,
                      borderColor: on ? colors.primary : isDark ? c.border : '#cfe3c7',
                    },
                  ]}
                >
                  {p.id === 'custom' ? <CalendarDays size={14} color={on ? '#fff' : colors.primary} /> : null}
                  <Text style={[styles.chipTxt, { color: on ? '#fff' : ink, fontFamily: snPro(on ? '700' : '600') }]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.kicker, { color: muted, fontFamily: snPro('700'), marginTop: 14 }]}>OR PICK DATES</Text>
          <View style={styles.fields}>
            {dateField('From', from, 'from')}
            {dateField('To', to, 'to')}
          </View>
          <Text style={[styles.note, { color: muted, fontFamily: snPro('500') }]}>
            {daysBetween(from, to)} days · {joined ? `you joined on ${fmt(joined)}` : 'from your first day in the app'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: tileBg }]}>
          <View style={styles.incHead}>
            <FileText size={18} color={colors.primary} />
            <Text style={[styles.incTitle, { color: ink, fontFamily: poppins('600') }]}>What’s in the report</Text>
          </View>
          {INCLUDED.map((line) => (
            <Text key={line} style={[styles.incLine, { color: ink, fontFamily: snPro('500') }]}>
              • {line}
            </Text>
          ))}
          <Text style={[styles.note, { color: muted, fontFamily: snPro('400'), marginTop: 8 }]}>
            Based on what you logged. Estimates only, not medical advice.
          </Text>
        </View>

        <AppButton label="Download PDF" icon={Download} size="lg" onPress={download} loading={busy} disabled={busy} />
        {Platform.OS !== 'web' ? (
          <Text style={[styles.note, { color: muted, fontFamily: snPro('400'), textAlign: 'center' }]}>
            The PDF opens in your browser, where you can save or share it.
          </Text>
        ) : null}
      </ScrollView>

      <DatePickerModal
        visible={picking != null}
        title={picking === 'to' ? 'Report end date' : 'Report start date'}
        value={picking === 'to' ? to : from}
        minDate={picking === 'to' ? from : earliest}
        maxDate={picking === 'to' ? today : to}
        onSelect={(key) => {
          setCustomMode(true);
          if (picking === 'to') {
            setTo(key);
            setPicking(null);
            return;
          }
          setFrom(key);
          if (key > to) setTo(key);
          // Custom: after the start date, go straight to the end date.
          setPicking(customMode ? 'to' : null);
        }}
        onClose={() => setPicking(null)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  subtitle: { fontSize: 12 },
  card: { borderRadius: 16, padding: 16 },
  kicker: { fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  chipTxt: { fontSize: 13 },
  customChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fields: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12 },
  fieldLbl: { fontSize: 11 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  fieldVal: { fontSize: 14 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  incHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  incTitle: { fontSize: 15 },
  incLine: { fontSize: 13, lineHeight: 20 },
});
