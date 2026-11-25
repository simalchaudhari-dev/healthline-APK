import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import useDailyGoals from '../../hooks/useDailyGoals';
import { dailyGoalsSentence } from '../../utils/dailyGoals';
import { formatDayDate } from '../../utils/formatDate';

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

const BADGE = {
  Done: { bg: '#e2f2dc', fg: '#1e5e24', bar: '#2e7d32' },
  'On track': { bg: '#e3eafb', fg: '#1e3a8a', bar: '#3e9b3f' },
  Behind: { bg: '#fff1dc', fg: '#92400e', bar: '#d97706' },
  Over: { bg: '#fde4e1', fg: '#9b2c1f', bar: '#c0392b' },
};

function todayLabel() {
  return formatDayDate(new Date());
}

/** Canvas "Daily summary": goals completed + each target with a bar and status. */
export default function DailySummaryScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { addWater } = useDiary();
  const { goals, doneCount } = useDailyGoals();

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const line = isDark ? c.border : '#eef2ec';

  const open = (route) => {
    if (route === 'water') addWater();
    else if (route === 'Diary') navigation.navigate('Main', { screen: 'Diary' });
    else if (route) navigation.navigate(route);
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
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Daily summary</Text>
            <Text style={[styles.date, { color: muted, fontFamily: snPro('400') }]}>{todayLabel()}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.heroKicker, { fontFamily: snPro('400') }]}>Goals completed</Text>
          <View style={styles.heroCount}>
            <Text style={[styles.heroNum, { fontFamily: FONT.heading }]}>{doneCount}</Text>
            <Text style={[styles.heroOf, { fontFamily: snPro('400') }]}>of {goals.length}</Text>
          </View>
          <View style={styles.segments}>
            {goals.map((g) => (
              <View key={g.id} style={[styles.segment, { backgroundColor: g.done ? '#a8dd8f' : 'rgba(255,255,255,0.25)' }]} />
            ))}
          </View>
          <Text style={[styles.heroText, { fontFamily: snPro('400') }]}>{dailyGoalsSentence(goals)}</Text>
        </View>

        <Text style={[styles.section, { color: ink, fontFamily: poppins('600') }]}>Targets</Text>
        <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
          {goals.map((g, i) => {
            const tone = BADGE[g.status] || BADGE.Behind;
            return (
              <Pressable
                key={g.id}
                onPress={() => open(g.route)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: line }]}
                accessibilityLabel={`${g.label}, ${g.value}, ${g.status}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowLabel, { color: ink, fontFamily: snPro('700') }]}>{g.label}</Text>
                    <Text style={[styles.rowValue, { color: muted, fontFamily: snPro('400') }]}>{g.value}</Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: isDark ? c.track : '#eef2ec' }]}>
                    <View style={[styles.fill, { width: `${g.pct}%`, backgroundColor: tone.bar }]} />
                  </View>
                </View>
                <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.badgeText, { color: tone.fg, fontFamily: snPro('700') }]}>{g.status}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  date: { fontSize: 12 },
  hero: { padding: 18, borderRadius: 20, backgroundColor: '#1e5e24' },
  heroKicker: { color: '#d7f0c9', fontSize: 13 },
  heroCount: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroNum: { color: '#FFFFFF', fontSize: 40, lineHeight: 50 },
  heroOf: { color: '#d7f0c9', fontSize: 16 },
  segments: { flexDirection: 'row', gap: 6, marginTop: 8 },
  segment: { flex: 1, height: 8, borderRadius: 8 },
  heroText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginTop: 12 },
  section: { fontSize: 16, marginTop: 4 },
  card: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 13, flexShrink: 1, textAlign: 'right' },
  track: { height: 6, borderRadius: 6, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  badge: { width: 74, alignItems: 'center', paddingVertical: 4, borderRadius: 99 },
  badgeText: { fontSize: 11 },
});
