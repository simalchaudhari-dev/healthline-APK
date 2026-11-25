import React from 'react';
import { View, Text, ScrollView, Switch, StyleSheet, Pressable } from 'react-native';
import { Bell, Coffee, Utensils, Moon, Droplets, Scale, Cookie, Dumbbell, NotebookPen, CalendarDays } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import { softShadow } from '../../components/common/premiumStyles';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { useReminderCatalog } from '../../context/ReminderCatalogContext';
import { isReminderOn, reminderScheduleText } from '../../services/remindersService';

/** Icon + tint per reminder key; text and times come from AdminPanel. */
const LOOK = {
  breakfast: { Icon: Coffee, color: '#FF9500' },
  lunch: { Icon: Utensils, color: '#0070E0' },
  dinner: { Icon: Moon, color: '#AF52DE' },
  snack: { Icon: Cookie, color: '#6C5CE7' },
  water: { Icon: Droplets, color: '#26C6DA' },
  exercise: { Icon: Dumbbell, color: '#34C759' },
  foodLog: { Icon: NotebookPen, color: '#0070E0' },
  mealPlan: { Icon: CalendarDays, color: '#00B67A' },
  weighIn: { Icon: Scale, color: '#00B67A' },
};
const DEFAULT_LOOK = { Icon: Bell, color: '#0070E0' };

export default function RemindersScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { reminders, updateReminder } = useDiary();
  const { catalog } = useReminderCatalog();
  const { ready, allowed } = useFeatureGate(navigation, { route: 'Reminders', key: 'reminders' });
  const onCount = catalog.filter((item) => isReminderOn(reminders, item)).length;

  if (!ready || !allowed) {
    return <LoadingScreen fullScreen message="Checking feature..." />;
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Reminders" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.banner, softShadow, { backgroundColor: isDark ? '#1A1A28' : colors.primarySoft, borderColor: c.border }]}>
          <Bell size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: c.text, fontFamily: snPro('700') }]}>
              {onCount} smart reminders on
            </Text>
            <Text style={[styles.bannerText, { color: c.muted, fontFamily: snPro('400') }]}>
              Short nudges on this phone · allow notifications when asked
            </Text>
          </View>
        </View>

        {catalog.map((item) => {
          const { key, label, body: nudge } = item;
          const { Icon, color } = LOOK[key] || DEFAULT_LOOK;
          const on = isReminderOn(reminders, item);
          return (
          <Pressable
            key={key}
            onPress={() => updateReminder(key, !on)}
            style={({ pressed }) => [
              styles.row,
              softShadow,
              { backgroundColor: c.cardBg, borderColor: c.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: `${color}22` }]}>
              <Icon size={18} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text, fontFamily: snPro('700') }]}>{label}</Text>
              <Text style={[styles.nudge, { color: c.muted, fontFamily: snPro('400') }]}>{nudge}</Text>
              <Text style={[styles.sub, { color: colors.primary, fontFamily: snPro('600') }]}>
                {reminderScheduleText(item)}
              </Text>
            </View>
            <Switch
              value={on}
              pointerEvents="none"
              trackColor={{ false: isDark ? '#3A3A3C' : '#D1D5DB', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </Pressable>
          );
        })}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 14 },
  bannerText: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 15 },
  nudge: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  sub: { fontSize: 11, marginTop: 4 },
});
