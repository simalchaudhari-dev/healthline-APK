import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import WeekPickerModal, { mondayOf, addDays, fromKey } from '../common/WeekPickerModal';
import { useAuth } from '../../context/AuthContext';
import { formatDayMonth, formatRange } from '../../utils/formatDate';

/** 19 Oct — kept for older imports. */
export const shortDate = (key) => formatDayMonth(key);

/** The diary syncs ~90 days from the server, so weeks go back 12 by default. */
export const MAX_WEEKS_BACK = 12;
export { mondayOf, addDays };

/** Monday of this week — the default `weekStart` for every chart. */
export const thisMonday = () => mondayOf(new Date());

/**
 * Week switcher used by every bar chart: ‹ [This week · 12 Oct – 18 Oct] ›.
 * Tapping the pill opens the calendar (pick any day → its Monday–Sunday week), like the admin panel.
 */
export default function WeekFilter({ weekStart, onChange, maxWeeksBack = MAX_WEEKS_BACK, style }) {
  const { isDark, themeColors: c } = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const maxMonday = thisMonday();
  // No data before signup: stop at the signup week (and grey out the days before it).
  const joined = /^\d{4}-\d{2}-\d{2}$/.test(user?.joined || '') ? user.joined : '';
  const backLimit = addDays(maxMonday, -7 * maxWeeksBack);
  const joinedMonday = joined ? mondayOf(fromKey(joined)) : '';
  const minMonday = joinedMonday && joinedMonday > backLimit ? joinedMonday : backLimit;
  const canPrev = weekStart > minMonday;
  const canNext = weekStart < maxMonday;
  const arrow = isDark ? c.text : colors.primaryDark;

  return (
    <View style={[styles.segment, { backgroundColor: isDark ? c.track : '#eef6ea' }, style]}>
      <Pressable
        onPress={() => onChange(addDays(weekStart, -7))}
        disabled={!canPrev}
        hitSlop={6}
        style={[styles.segBtn, { opacity: canPrev ? 1 : 0.3 }]}
        accessibilityLabel="Previous week"
      >
        <ChevronLeft size={18} color={arrow} strokeWidth={2.4} />
      </Pressable>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose a week"
        style={[styles.segActive, { backgroundColor: colors.primary }]}
      >
        <CalendarDays size={15} color="#fff" strokeWidth={2.2} />
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.segText, { fontFamily: snPro('700') }]} numberOfLines={1}>
            {weekStart === maxMonday ? 'This week' : 'Selected week'}
          </Text>
          <Text style={[styles.segSub, { fontFamily: snPro('500') }]} numberOfLines={1}>
            {formatRange(weekStart, addDays(weekStart, 6))}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onChange(addDays(weekStart, 7))}
        disabled={!canNext}
        hitSlop={6}
        style={[styles.segBtn, { opacity: canNext ? 1 : 0.3 }]}
        accessibilityLabel="Next week"
      >
        <ChevronRight size={18} color={arrow} strokeWidth={2.4} />
      </Pressable>
      <WeekPickerModal
        visible={open}
        weekStart={weekStart}
        minMonday={minMonday}
        minDay={joined}
        maxMonday={maxMonday}
        onSelect={(monday) => {
          onChange(monday);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', alignItems: 'center', borderRadius: 99, padding: 3, gap: 4 },
  segBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segActive: {
    flex: 1,
    minHeight: 40,
    borderRadius: 99,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  segText: { color: '#FFFFFF', fontSize: 13, lineHeight: 17 },
  segSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, lineHeight: 14 },
});
