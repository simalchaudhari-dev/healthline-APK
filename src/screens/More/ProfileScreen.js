import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, Platform } from 'react-native';
import {
  Bell,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Dumbbell,
  FileDown,
  Flame,
  Globe,
  HeartPulse,
  Moon,
  Receipt,
  Sun,
  Target,
  User,
  Utensils,
} from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import AvatarInitial from '../../components/common/AvatarInitial';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { FONT, snPro, poppins } from '../../config/fonts';
import { APP_NAME } from '../../config/brandContent';
import { LEVELS } from '../../data/homeExercises';
import { useReplyLanguage } from '../../utils/replyLanguage';
import { languageById } from '../../config/languages';

const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snack' };
const GOAL_LABEL = { lose: 'Lose weight', maintain: 'Maintain', gain: 'Gain muscle' };

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

const has = (v) => v !== undefined && v !== null && v !== '';

export default function ProfileScreen({ navigation }) {
  const { isDark, toggleTheme, colors, themeColors: c } = useTheme();
  const { totals, meals, profile, goal } = useDiary();
  const { user } = useAuth();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.displayName || 'Health line user';
  const displayEmail = user?.email || profile?.email || '';
  const planLabel =
    user?.plan === 'Plus' ? `${APP_NAME} Plus` : user?.plan === 'Family' ? `${APP_NAME} Family` : user?.plan || 'Free';

  const healthValue =
    has(profile?.weight) && has(profile?.heightCm) ? `${profile.weight} kg · ${profile.heightCm} cm` : null;
  const goalValue = GOAL_LABEL[goal] || null;
  const workoutValue = LEVELS.find((l) => l.id === profile?.workoutLevel)?.label || null;
  // The one app language (saved to the account).
  const languageValue = languageById(useReplyLanguage()).native;

  const todayMeals = useMemo(() => {
    const lists = meals || {};
    return ['breakfast', 'lunch', 'dinner', 'snacks'].flatMap((key) =>
      (lists[key] || []).map((item, index) => ({
        id: item.logId || `${key}-${index}-${item.name}`,
        name: item.name || 'Meal',
        meal: MEAL_LABEL[key],
        calories: Math.round(Number(item.calories) || 0),
      })),
    );
  }, [meals]);

  const t = {
    card: isDark ? c.cardBg : '#FFFFFF',
    ink: isDark ? c.text : '#0d1b2a',
    muted: isDark ? c.muted : '#4b5563',
    chev: isDark ? c.muted : '#6b7280',
    divider: isDark ? c.border : '#eef2ec',
    tile: isDark ? c.chip : colors.primarySoft,
    icon: colors.primary,
  };
  const goMeals = () => navigation.navigate('Main', { screen: 'Diary' });

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backBtn, CARD_SHADOW, { backgroundColor: t.card, opacity: pressed ? 0.85 : 1 }]}
          >
            <ChevronLeft size={20} color={colors.primaryDark} strokeWidth={2.6} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.ink, fontFamily: FONT.heading }]} numberOfLines={1}>
            Profile and settings
          </Text>
        </View>

        <View style={[styles.profileCard, CARD_SHADOW, { backgroundColor: t.card }]}>
          <AvatarInitial name={displayName} uri={user?.photoURL} size={56} backgroundColor={colors.primary} />
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: t.ink, fontFamily: poppins('600') }]} numberOfLines={1}>
              {displayName}
            </Text>
            {displayEmail ? (
              <Text style={[styles.profileEmail, { color: t.muted, fontFamily: snPro('500') }]} numberOfLines={1}>
                {displayEmail}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => navigation.navigate('Subscription')}
            accessibilityLabel={`Plan: ${planLabel}`}
            style={({ pressed }) => [styles.planPill, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.planPillText, { fontFamily: snPro('700') }]} numberOfLines={1}>
              {planLabel}
            </Text>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <StatTile icon={Flame} label="Calories" value={`${Math.round(Number(totals?.calories) || 0)} kcal`} t={t} />
          <StatTile icon={Utensils} label="Meals" value={String(todayMeals.length)} t={t} />
        </View>

        <Section title="Account" t={t}>
          <Row icon={User} title="Personal details" t={t} onPress={() => navigation.navigate('ProfileEdit')} />
          <Row
            icon={HeartPulse}
            title="Health profile"
            value={healthValue}
            t={t}
            onPress={() => navigation.navigate('HealthProfile')}
          />
          <Row
            icon={Target}
            title="Goals and food preferences"
            value={goalValue}
            t={t}
            onPress={() => navigation.navigate('EditGoals')}
          />
          <Row
            icon={Receipt}
            title="Plan and billing"
            value={planLabel}
            t={t}
            onPress={() => navigation.navigate('PaymentHistory')}
          />
          <Row
            icon={CreditCard}
            title="Payment method"
            t={t}
            onPress={() => navigation.navigate('Subscription')}
          />
          <Row
            icon={FileDown}
            title="Download health report"
            value="PDF"
            t={t}
            last
            onPress={() => navigation.navigate('HealthReportDownload')}
          />
        </Section>

        <Section title="Preferences" t={t}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: t.divider }]}>
            <View style={[styles.rowIcon, { backgroundColor: t.tile }]}>
              {isDark ? <Moon size={16} color={t.icon} /> : <Sun size={16} color={t.icon} />}
            </View>
            <Text style={[styles.rowTitle, { color: t.ink, fontFamily: snPro('700') }]} numberOfLines={1}>
              {isDark ? 'Dark mode' : 'Light mode'}
            </Text>
            <Switch
              value={!isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: isDark ? '#3A3A3C' : '#D5D8D2', true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={isDark ? '#3A3A3C' : '#D5D8D2'}
            />
          </View>
          <Row
            icon={Globe}
            title="Language"
            value={languageValue}
            t={t}
            onPress={() => navigation.navigate('Language')}
          />
          <Row
            icon={Dumbbell}
            title="Workout preference"
            value={workoutValue}
            t={t}
            onPress={() => navigation.navigate('WorkoutPreference')}
          />
          <Row
            icon={Bell}
            title="Notifications and reminders"
            t={t}
            onPress={() => navigation.navigate('Reminders')}
          />
          <Row
            icon={ChartLine}
            title="Progress and trends"
            t={t}
            last
            onPress={() => navigation.navigate('Main', { screen: 'Progress' })}
          />
        </Section>

        <Section title="Recent meals" t={t}>
          {todayMeals.length ? (
            todayMeals.slice(0, 6).map((item, index, list) => (
              <Pressable
                key={item.id}
                onPress={goMeals}
                style={({ pressed }) => [
                  styles.mealRow,
                  index !== list.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.divider },
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: t.tile }]}>
                  <Utensils size={16} color={t.icon} />
                </View>
                <View style={styles.mealText}>
                  <Text style={[styles.mealName, { color: t.ink, fontFamily: snPro('700') }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.mealMeta, { color: t.muted, fontFamily: snPro('500') }]} numberOfLines={1}>
                    {`${item.meal} · ${item.calories} kcal`}
                  </Text>
                </View>
                <ChevronRight size={14} color={t.chev} />
              </Pressable>
            ))
          ) : (
            <Text style={[styles.empty, { color: t.muted, fontFamily: snPro('500') }]}>No meals logged today</Text>
          )}
        </Section>
      </ScrollView>
    </ScreenShell>
  );
}

function Section({ title, t, children }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: t.muted, fontFamily: poppins('600') }]}>{title}</Text>
      <View style={[styles.group, CARD_SHADOW, { backgroundColor: t.card }]}>{children}</View>
    </View>
  );
}

function StatTile({ icon: Icon, label, value, t }) {
  return (
    <View style={[styles.statTile, CARD_SHADOW, { backgroundColor: t.card }]}>
      <View style={[styles.rowIcon, { backgroundColor: t.tile }]}>
        <Icon size={16} color={t.icon} />
      </View>
      <View style={styles.statText}>
        <Text style={[styles.statLabel, { color: t.muted, fontFamily: snPro('600') }]}>{label}</Text>
        <Text style={[styles.statValue, { color: t.ink, fontFamily: snPro('700') }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Row({ icon: Icon, title, value, t, onPress, last }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: t.divider },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: t.tile }]}>
        <Icon size={16} color={t.icon} />
      </View>
      <Text style={[styles.rowTitle, { color: t.ink, fontFamily: snPro('700') }]} numberOfLines={1}>
        {title}
      </Text>
      {value ? (
        <Text style={[styles.rowValue, { color: t.muted, fontFamily: snPro('500') }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <ChevronRight size={14} color={t.chev} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 17 },
  profileEmail: { fontSize: 13, marginTop: 2 },
  planPill: { backgroundColor: '#1e5e24', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, maxWidth: 130 },
  planPillText: { color: '#FFFFFF', fontSize: 12 },
  statRow: { flexDirection: 'row', gap: 12 },
  statTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  statText: { flex: 1 },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 14, marginTop: 1 },
  sectionTitle: { fontSize: 13, marginBottom: 6, marginLeft: 4 },
  group: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 14, paddingVertical: 8, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 14 },
  rowValue: { fontSize: 13, maxWidth: '45%' },
  mealRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  mealText: { flex: 1 },
  mealName: { fontSize: 14 },
  mealMeta: { fontSize: 12, marginTop: 2 },
  empty: { paddingHorizontal: 16, paddingVertical: 18, fontSize: 14 },
});
