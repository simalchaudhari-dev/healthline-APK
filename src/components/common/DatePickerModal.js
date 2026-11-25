import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { addDays, fromKey, mondayOf, toKey } from './WeekPickerModal';

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

/** Six Monday-first week rows covering the month. */
function monthGrid(year, month) {
  const first = mondayOf(new Date(year, month, 1));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (__, i) => addDays(first, w * 7 + i)));
}

/** Calendar popup for one date (YYYY-MM-DD) between `minDate` and `maxDate`. */
export default function DatePickerModal({ visible, title = 'Choose a date', value, minDate, maxDate, onSelect, onClose }) {
  const { isDark, themeColors: c } = useTheme();
  const [view, setView] = useState(() => fromKey(value || toKey(new Date())));

  useEffect(() => {
    if (visible) setView(fromKey(value || toKey(new Date())));
  }, [visible, value]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const todayKey = toKey(new Date());
  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const firstOfMonth = toKey(new Date(year, month, 1));
  const firstOfNext = toKey(new Date(year, month + 1, 1));
  const canPrev = !minDate || addDays(firstOfMonth, -1) >= minDate;
  const canNext = !maxDate || firstOfNext <= maxDate;
  const outside = (key) => (minDate && key < minDate) || (maxDate && key > maxDate);
  const shift = (n) => setView(new Date(year, month + n, 1));
  const arrow = isDark ? c.text : colors.primaryDark;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.cardBg }]} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={muted} />
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shift(-1)}
              disabled={!canPrev}
              hitSlop={8}
              style={[styles.monthBtn, { opacity: canPrev ? 1 : 0.3 }]}
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={18} color={arrow} strokeWidth={2.4} />
            </Pressable>
            <Text style={[styles.monthLbl, { color: ink, fontFamily: snPro('700') }]}>
              {MONTHS[month]} {year}
            </Text>
            <Pressable
              onPress={() => shift(1)}
              disabled={!canNext}
              hitSlop={8}
              style={[styles.monthBtn, { opacity: canNext ? 1 : 0.3 }]}
              accessibilityLabel="Next month"
            >
              <ChevronRight size={18} color={arrow} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.row}>
            {DOW.map((d, i) => (
              <Text key={`${d}${i}`} style={[styles.dow, { color: muted, fontFamily: snPro('700') }]}>
                {d}
              </Text>
            ))}
          </View>

          {monthGrid(year, month).map((week) => (
            <View key={week[0]} style={styles.row}>
              {week.map((key) => {
                const d = fromKey(key);
                const inMonth = d.getMonth() === month;
                const selected = key === value;
                const disabled = outside(key);
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    disabled={disabled}
                    onPress={() => onSelect(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={key}
                    style={styles.cell}
                  >
                    <View
                      style={[
                        styles.dot,
                        selected && { backgroundColor: colors.primary },
                        isToday && !selected && { borderWidth: 1.5, borderColor: colors.primary },
                        disabled && { opacity: 0.3 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayTxt,
                          {
                            color: selected ? '#fff' : inMonth ? ink : muted,
                            opacity: inMonth || selected ? 1 : 0.5,
                            fontFamily: snPro(selected || isToday ? '800' : '500'),
                          },
                        ]}
                      >
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 17 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthLbl: { fontSize: 15 },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontSize: 11, paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayTxt: { fontSize: 13 },
});
