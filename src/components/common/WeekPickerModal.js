import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { formatDate } from '../../utils/formatDate';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (key, n) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
/** Monday of the week that contains `date`. A full week is Monday–Sunday (same as the admin panel). */
export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toKey(d);
}

/** Six Monday-first week rows covering the month of `year`/`month`. */
function monthWeeks(year, month) {
  const first = mondayOf(new Date(year, month, 1));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (__, i) => addDays(first, w * 7 + i)));
}

/**
 * Calendar popup for picking a week. Tap any day and the whole Monday–Sunday week is chosen.
 * `minMonday` / `maxMonday` limit which weeks can be picked.
 */
export default function WeekPickerModal({ visible, weekStart, minMonday, maxMonday, minDay, onSelect, onClose }) {
  const { isDark, themeColors: c } = useTheme();
  const [view, setView] = useState(() => fromKey(weekStart));

  useEffect(() => {
    if (visible) setView(fromKey(weekStart));
  }, [visible, weekStart]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const weeks = monthWeeks(year, month);
  const todayKey = toKey(new Date());
  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';

  const firstOfMonth = toKey(new Date(year, month, 1));
  const canPrevMonth = !minMonday || addDays(firstOfMonth, -1) >= minMonday;
  const canNextMonth = !maxMonday || toKey(new Date(year, month + 1, 1)) <= addDays(maxMonday, 6);

  const shiftMonth = (n) => setView(new Date(year, month + n, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.cardBg }]} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Choose a week</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={muted} />
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: muted, fontFamily: snPro('400') }]}>
            Pick any day. The full week, Monday to Sunday, is selected.
            {minDay ? ` You joined on ${formatDate(minDay)}, so earlier weeks are off.` : ''}
          </Text>

          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              disabled={!canPrevMonth}
              hitSlop={8}
              style={[styles.monthBtn, { opacity: canPrevMonth ? 1 : 0.3 }]}
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={18} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.4} />
            </Pressable>
            <Text style={[styles.monthLbl, { color: ink, fontFamily: snPro('700') }]}>
              {MONTHS[month]} {year}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              disabled={!canNextMonth}
              hitSlop={8}
              style={[styles.monthBtn, { opacity: canNextMonth ? 1 : 0.3 }]}
              accessibilityLabel="Next month"
            >
              <ChevronRight size={18} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.week}>
            {DOW.map((d, i) => (
              <Text key={`${d}${i}`} style={[styles.dow, { color: muted, fontFamily: snPro('700') }]}>
                {d}
              </Text>
            ))}
          </View>

          {weeks.map((days) => {
            const monday = days[0];
            const selected = monday === weekStart;
            const disabled = (minMonday && monday < minMonday) || (maxMonday && monday > maxMonday);
            return (
              <Pressable
                key={monday}
                disabled={disabled}
                onPress={() => onSelect(monday)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={`Week of ${monday}`}
                style={[
                  styles.week,
                  styles.weekRow,
                  selected && { backgroundColor: colors.primary },
                  disabled && { opacity: 0.3 },
                ]}
              >
                {days.map((key) => {
                  const d = fromKey(key);
                  const inMonth = d.getMonth() === month;
                  const isToday = key === todayKey;
                  // Before signup / in the future: no data, shown faded.
                  const outside = (minDay && key < minDay) || key > todayKey;
                  return (
                    <View key={key} style={styles.dayCell}>
                      <View style={[styles.dayDot, isToday && !selected && { borderColor: colors.primary, borderWidth: 1.5 }]}>
                        <Text
                          style={[
                            styles.dayTxt,
                            {
                              color: selected ? '#fff' : inMonth ? ink : muted,
                              opacity: outside ? 0.3 : inMonth || selected ? 1 : 0.5,
                              textDecorationLine: outside && minDay && key < minDay ? 'line-through' : 'none',
                              fontFamily: snPro(selected || isToday ? '800' : '500'),
                            },
                          ]}
                        >
                          {d.getDate()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,27,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17 },
  hint: { fontSize: 12, marginTop: 4, marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthLbl: { fontSize: 15 },
  week: { flexDirection: 'row' },
  weekRow: { borderRadius: 99, marginBottom: 2 },
  dow: { flex: 1, textAlign: 'center', fontSize: 11, paddingVertical: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayTxt: { fontSize: 13 },
});
