import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react-native';
import { FONT, snPro } from '../../config/fonts';
import { useAuth } from '../../context/AuthContext';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(year, month) {
  return new Date(year, month, 1);
}

function buildMonthCells(year, month) {
  const first = startOfMonth(year, month);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, month, -startPad + i + 1);
    cells.push({ date: d, key: toKey(d), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    cells.push({ date: d, key: toKey(d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, key: toKey(d), inMonth: false });
  }
  return cells;
}

function chunkWeeks(cells) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** Prefer rgba — works on Android APK where 8-digit hex often fails. */
function rgba(hex, alpha) {
  const raw = String(hex || '#26C6DA').replace('#', '');
  const h =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Month calendar for streak / achievement check-ins.
 * Android-safe layout: measured cell widths + week rows (no % flexWrap).
 */
export default function StreakCalendar({
  completedKeys = [],
  streakCount = 0,
  accent = '#2ECC71',
  brandPrimary,
  headerColor,
  isDark = false,
  theme,
  title = 'Streak calendar',
  subtitle = 'Keep logging to grow your streak',
  minKey: minKeyProp,
}) {
  const { user } = useAuth();
  const joined = minKeyProp ?? user?.joined;
  const minKey = /^\d{4}-\d{2}-\d{2}$/.test(joined || '') ? joined : '';
  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);
  const completed = useMemo(() => new Set(completedKeys), [completedKeys]);
  const [gridWidth, setGridWidth] = useState(0);

  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );
  const weeks = useMemo(() => chunkWeeks(cells), [cells]);

  const canGoNext =
    cursor.year < today.getFullYear() ||
    (cursor.year === today.getFullYear() && cursor.month < today.getMonth());
  // Nothing exists before signup: stop at the joined month and fade the days before it.
  const minYear = minKey ? Number(minKey.slice(0, 4)) : null;
  const minMonth = minKey ? Number(minKey.slice(5, 7)) - 1 : null;
  const canGoBack =
    !minKey || cursor.year > minYear || (cursor.year === minYear && cursor.month > minMonth);

  const shiftMonth = (delta) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const onGridLayout = useCallback((e) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w > 0 && w !== gridWidth) setGridWidth(w);
  }, [gridWidth]);

  const cellW = gridWidth > 0 ? Math.floor(gridWidth / 7) : 0;
  const c = theme || {};
  /** Web UI uses solid dark accent header (not light gradient). */
  const head = headerColor || brandPrimary || accent;
  const todayMark = brandPrimary || accent;
  const footerBg = isDark ? '#1A1A24' : rgba(head, 0.1);
  const footerBorder = isDark ? c.border || '#2A2A32' : rgba(head, 0.22);
  const cardBorder = isDark ? c.border || '#2A2A32' : '#E8ECF0';

  const renderDay = (cell) => {
    const done = completed.has(cell.key);
    const isToday = cell.key === todayKey;
    const isFuture = cell.date > today && cell.inMonth;
    const beforeJoin = !!minKey && cell.key < minKey;
    const muted = !cell.inMonth || beforeJoin;

    let markBg = isDark ? '#2A2A32' : '#EEF0F3';
    let markBorder = markBg;
    let showCheck = false;

    if (done && cell.inMonth) {
      markBg = isToday ? todayMark : accent;
      markBorder = markBg;
      showCheck = true;
    } else if (isToday && cell.inMonth) {
      markBg = 'transparent';
      markBorder = todayMark;
    } else if (isFuture || muted) {
      markBg = 'transparent';
      markBorder = isDark ? '#2A2A32' : '#E4E7EC';
    }

    return (
      <View key={cell.key} style={[styles.cell, cellW ? { width: cellW } : styles.cellFlex]}>
        <View
          style={[
            styles.mark,
            {
              backgroundColor: markBg,
              borderColor: markBorder,
              borderWidth: 1.5,
            },
          ]}
        >
          {showCheck ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
        <Text
          style={[
            styles.dayNum,
            {
              color: muted
                ? isDark
                  ? '#4A4A52'
                  : '#D0D5DD'
                : isToday
                  ? todayMark
                  : c.text || '#101828',
              fontFamily: snPro(isToday ? '800' : '600'),
            },
          ]}
        >
          {cell.date.getDate()}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.card,
        Platform.OS === 'android' ? styles.cardAndroid : styles.cardIos,
        {
          backgroundColor: c.cardBg || (isDark ? '#16161A' : '#FFFFFF'),
          borderColor: cardBorder,
        },
      ]}
    >
      {/* Solid header like web UI image 3 */}
      <View style={[styles.header, { backgroundColor: head }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerIcon}>
            {/* White: the header takes the achievement's accent, which is often this same orange. */}
            <Flame size={18} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { fontFamily: FONT.nova }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.headerSub, { fontFamily: snPro('500') }]} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Flame size={12} color="#FFB020" />
            <Text style={[styles.streakBadgeText, { fontFamily: snPro('800') }]}>
              {streakCount}d
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => canGoBack && shiftMonth(-1)}
            hitSlop={10}
            disabled={!canGoBack}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark ? '#22222A' : '#F2F4F7',
                opacity: canGoBack ? 1 : 0.35,
              },
            ]}
          >
            <ChevronLeft size={18} color={c.text || '#101828'} />
          </Pressable>
          <Text style={[styles.monthLbl, { color: c.text || '#101828', fontFamily: snPro('700') }]}>
            {MONTHS[cursor.month]} {cursor.year}
          </Text>
          <Pressable
            onPress={() => canGoNext && shiftMonth(1)}
            hitSlop={10}
            disabled={!canGoNext}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark ? '#22222A' : '#F2F4F7',
                opacity: canGoNext ? 1 : 0.35,
              },
            ]}
          >
            <ChevronRight size={18} color={c.text || '#101828'} />
          </Pressable>
        </View>

        <View style={styles.weekHead} onLayout={onGridLayout}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={[styles.weekCell, cellW ? { width: cellW } : styles.cellFlex]}>
              <Text style={[styles.weekLbl, { color: c.muted || '#98A2B3', fontFamily: snPro('700') }]}>
                {d}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={`w-${wi}`} style={styles.weekRow}>
              {week.map(renderDay)}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: footerBg, borderTopColor: footerBorder }]}>
        <View style={[styles.footerIcon, { backgroundColor: isDark ? rgba(head, 0.28) : '#FFFFFF' }]}>
          <Trophy size={16} color={head} />
        </View>
        <View style={styles.footerText}>
          <Text style={[styles.footerTitle, { color: head, fontFamily: snPro('800') }]}>
            Keep it up!
          </Text>
          <Text style={[styles.footerBody, { color: c.muted || '#667085', fontFamily: snPro('500') }]}>
            {streakCount > 0
              ? `You're on a ${streakCount}-day streak. Come back tomorrow to continue.`
              : 'Log today to start your streak on the calendar.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Days to tick on the calendar. Every live achievement (utils/streak.js, utils/achievements.js)
 * provides its real goal days in `calendarKeys`; without them nothing is ticked — no made-up days.
 */
export function buildAchievementCalendarKeys(achievement) {
  return Array.isArray(achievement?.calendarKeys) ? achievement.calendarKeys : [];
}

/**
 * Real run of consecutive goal days ending today — or yesterday, so an unfinished today doesn't
 * break it — from the achievement's `calendarKeys` (days the goal was actually met).
 */
export function resolveStreakDays(achievement, now = new Date()) {
  if (!achievement) return 0;
  if (achievement.id === 'streak') return Math.max(0, Number(achievement.progress) || 0);
  const done = new Set(Array.isArray(achievement.calendarKeys) ? achievement.calendarKeys : []);
  if (!done.size) return 0;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!done.has(toKey(day))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (done.has(toKey(day))) {
    count += 1;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
  },
  /** Keep elevation low — high elevation + nested rgba footer can wash out on APK. */
  cardAndroid: {
    elevation: 1,
  },
  cardIos: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 72,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerTitle: { fontSize: 17, color: '#FFFFFF', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 3, lineHeight: 15 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  streakBadgeText: { fontSize: 11, color: '#FFFFFF', marginLeft: 4 },
  body: {
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 6,
    width: '100%',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLbl: { fontSize: 15 },
  weekHead: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  weekCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekLbl: { fontSize: 9, letterSpacing: 0.3, textAlign: 'center' },
  grid: { width: '100%' },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
  },
  cellFlex: { flex: 1 },
  cell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: 8,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayNum: { fontSize: 11, textAlign: 'center', includeFontPadding: false },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  footerText: { flex: 1, minWidth: 0 },
  footerTitle: { fontSize: 13 },
  footerBody: { fontSize: 12, lineHeight: 17, marginTop: 2 },
});
