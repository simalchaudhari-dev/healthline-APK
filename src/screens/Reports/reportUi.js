import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { ChevronLeft, FolderOpen, Camera, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { extractReport, newReportChargeId } from '../../services/reportsService';
import { emitTokenBalance } from '../../utils/tokenBalanceBus';
import { toast } from '../../utils/toast';

export const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(30,94,36,0.06)' },
  default: {
    shadowColor: '#1e5e24',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

export const REPORT_FILE_TYPES = [
  'application/pdf',
  'image/*',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/** Shared colours for the report screens (light canvas look, readable dark mode). */
export function reportPalette(isDark, c) {
  return {
    ink: isDark ? c.text : '#0d1b2a',
    muted: isDark ? c.muted : '#4b5563',
    body: isDark ? c.text : '#1f2937',
    card: c.cardBg,
    line: isDark ? c.border : '#eef2ec',
    softBorder: isDark ? c.border : '#cfe3c7',
    track: isDark ? c.track : '#eef2ec',
    band: isDark ? 'rgba(46,125,50,0.45)' : '#c7e6b8',
    greySoft: isDark ? c.elevated : '#f6f8f5',
    amberBg: isDark ? 'rgba(217,119,6,0.16)' : '#fff4e5',
    amberBorder: isDark ? 'rgba(217,119,6,0.45)' : '#f6d7a7',
    amberInk: isDark ? '#f5c27a' : '#92400e',
    amberStrong: '#d97706',
    greenBg: isDark ? 'rgba(46,125,50,0.18)' : '#e2f2dc',
    violetBg: isDark ? 'rgba(108,92,231,0.18)' : '#ebe7fb',
    blueBg: isDark ? 'rgba(59,91,219,0.18)' : '#e3eafb',
    blueInk: isDark ? '#a5b8f3' : '#1e2a5a',
    redDot: '#c0392b',
  };
}

/** Badge colours by tone: low | high | normal | review | plain. */
export function badgeTone(tone, isDark) {
  const map = {
    low: isDark ? ['rgba(59,91,219,0.22)', '#a5b8f3'] : ['#e3eafb', '#1e3a8a'],
    high: isDark ? ['rgba(220,38,38,0.2)', '#f4a79d'] : ['#fde4e1', '#9b2c1f'],
    normal: isDark ? ['rgba(46,125,50,0.25)', '#a7d79a'] : ['#e2f2dc', '#1e5e24'],
    review: isDark ? ['rgba(217,119,6,0.2)', '#f5c27a'] : ['#fff1dc', '#92400e'],
    plain: isDark ? ['#2A2A32', '#D1D5DB'] : ['#eef2ec', '#374151'],
  };
  const [bg, fg] = map[tone] || map.plain;
  return { bg, fg };
}

export function Badge({ label, tone }) {
  const { isDark } = useTheme();
  const t = badgeTone(tone, isDark);
  return (
    <View style={[ui.badge, { backgroundColor: t.bg }]}>
      <Text style={[ui.badgeText, { color: t.fg, fontFamily: snPro('700') }]}>{label}</Text>
    </View>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' (or ISO) → '12 Oct 2026'. */
export function formatDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** 'YYYY-MM-DD' → "Oct '26" for chart labels. */
export function shortDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1] || ''} '${m[1].slice(2)}`;
}

/** The report's own date, or the day it was saved. */
export function reportDate(report) {
  return report?.testDate || String(report?.createdAt || '').slice(0, 10);
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function formatNumber(v) {
  const n = num(v);
  if (n == null) return '';
  return String(Math.round(n * 1000) / 1000);
}

export function rangeText(low, high) {
  const lo = num(low);
  const hi = num(high);
  if (lo != null && hi != null) return `${formatNumber(lo)}–${formatNumber(hi)}`;
  if (hi != null) return `below ${formatNumber(hi)}`;
  if (lo != null) return `above ${formatNumber(lo)}`;
  return '';
}

/** low | normal | high | unknown — uses the lab range when the value is a number. */
export function valueFlag(v) {
  const value = num(v?.value);
  const lo = num(v?.low);
  const hi = num(v?.high);
  if (value != null && (lo != null || hi != null)) {
    if (lo != null && value < lo) return 'low';
    if (hi != null && value > hi) return 'high';
    return 'normal';
  }
  const f = String(v?.flag || '').toLowerCase();
  return ['low', 'normal', 'high'].includes(f) ? f : 'unknown';
}

export const FLAG_LABEL = { low: 'Low', high: 'High', normal: 'Normal', unknown: 'No range' };
export const FLAG_TONE = { low: 'low', high: 'high', normal: 'normal', unknown: 'plain' };

/** Display text for a value: the number, or the lab's own text (e.g. "Negative"). */
export function valueText(v) {
  const n = formatNumber(v?.value);
  return n || String(v?.text || '').trim() || '—';
}

/**
 * Where the value and normal band sit on a 0–100 track.
 * Returns null when there is no range to draw.
 */
export function rangeBarLayout(v) {
  const value = num(v?.value);
  const lo = num(v?.low);
  const hi = num(v?.high);
  if (lo == null && hi == null) return null;
  let min;
  let max;
  let bandFrom;
  let bandTo;
  if (lo != null && hi != null && hi > lo) {
    const span = hi - lo;
    min = lo - span * 0.6;
    max = hi + span * 0.6;
    bandFrom = lo;
    bandTo = hi;
  } else if (hi != null) {
    min = Math.min(0, value ?? 0);
    max = hi * 1.5 || 1;
    bandFrom = min;
    bandTo = hi;
  } else {
    min = Math.min(0, value ?? 0);
    max = lo * 2 || 1;
    bandFrom = lo;
    bandTo = max;
  }
  if (value != null) {
    if (value > max) max = value + (max - min) * 0.05;
    if (value < min) min = value - (max - min) * 0.05;
  }
  const pct = (x) => Math.max(0, Math.min(100, ((x - min) / (max - min || 1)) * 100));
  return {
    bandLeft: pct(bandFrom),
    bandRight: 100 - pct(bandTo),
    dot: value == null ? null : pct(value),
  };
}

/** Counts from the values themselves (used when the list endpoint's counts are missing). */
export function countValues(values) {
  const list = Array.isArray(values) ? values : [];
  let known = 0;
  let outside = 0;
  list.forEach((v) => {
    const f = valueFlag(v);
    if (f === 'unknown') return;
    known += 1;
    if (f !== 'normal') outside += 1;
  });
  return { total: list.length, known, outside, inRange: known - outside };
}

/** Round back button + title/subtitle, like the Home screens. */
export function ReportHeader({ navigation, title, subtitle, right }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  return (
    <View style={ui.header}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[ui.back, CARD_SHADOW, { backgroundColor: c.cardBg }]}
      >
        <ChevronLeft size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.6} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ui.title, { color: p.ink, fontFamily: FONT.heading }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[ui.subtitle, { color: p.muted, fontFamily: snPro('400') }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || null}
    </View>
  );
}

/** Small round icon action for headers. */
export function HeaderIcon({ Icon, label, onPress, disabled }) {
  const { isDark, themeColors: c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[ui.iconBtn, CARD_SHADOW, { backgroundColor: c.cardBg, opacity: disabled ? 0.5 : 1 }]}
    >
      <Icon size={18} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Keeps the shown token balance in step after an AI call. */
export function useApplyTokenCharge() {
  const { user } = useAuth();
  const balance = user?.tokenBalance;
  return useCallback(
    (result) => {
      if (!result) return;
      if (result.tokenBalance != null) return; // already emitted by the service
      const charged = Number(result.tokensCharged) || 0;
      if (charged > 0 && balance != null) emitTokenBalance(Math.max(0, Number(balance) - charged));
    },
    [balance],
  );
}

/**
 * Pick a file or take a photo, then read it on the server.
 * `onDone({ draft, file, local })` runs after a successful extract.
 */
export function useReportUpload(onDone) {
  const [busy, setBusy] = useState(false);
  const applyCharge = useApplyTokenCharge();

  const run = useCallback(
    async (local) => {
      setBusy(true);
      try {
        const result = await extractReport(local, newReportChargeId());
        applyCharge(result);
        onDone?.({ draft: result.draft, file: result.file, local });
      } catch (e) {
        toast.error(e?.message || 'We couldn’t read this report. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [applyCharge, onDone],
  );

  const pickFile = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: REPORT_FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      await run({
        uri: a.uri,
        name: a.name || 'report',
        type: a.mimeType || a.file?.type || 'application/octet-stream',
        size: a.size || a.file?.size || 0,
        webFile: a.file || null,
      });
    } catch (e) {
      toast.error('Could not open that file. Please try another one.');
    }
  }, [run]);

  const takePhoto = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.error('Camera permission denied. Enable camera access in Settings.');
          return;
        }
      }
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (shot.canceled || !shot.assets?.[0]?.uri) return;
      const asset = shot.assets[0];
      // Keep text readable but stay around 1 MB or less.
      const actions = Number(asset.width) > 1600 ? [{ resize: { width: 1600 } }] : [];
      const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.65,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      await run({
        uri: out.uri,
        name: `report_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: 0,
        webFile: null,
      });
    } catch (e) {
      toast.error('Could not take the photo. Please try again.');
    }
  }, [run]);

  return { busy, pickFile, takePhoto };
}

/** Full-screen state while the server reads the report. */
export function BusyOverlay({ title = 'Reading your report…', subtitle = 'This can take up to a minute. Please keep the app open.' }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  return (
    <View style={[StyleSheet.absoluteFill, ui.busy, { backgroundColor: c.pageBg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[ui.busyTitle, { color: p.ink, fontFamily: FONT.heading }]}>{title}</Text>
      <Text style={[ui.busySub, { color: p.muted, fontFamily: snPro('400') }]}>{subtitle}</Text>
    </View>
  );
}

/** Bottom sheet: choose a file or take a photo. */
export function UploadSourceSheet({ visible, onClose, onPickFile, onTakePhoto }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  const options = [
    { key: 'file', Icon: FolderOpen, title: 'Choose a file', sub: 'PDF, photo, Excel, Word, CSV or text', onPress: onPickFile },
    { key: 'photo', Icon: Camera, title: 'Take a photo', sub: 'Lay the report flat in good light', onPress: onTakePhoto },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[ui.overlay, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable style={[ui.sheet, { backgroundColor: c.cardBg }]} onPress={() => {}}>
          <View style={ui.sheetHead}>
            <Text style={[ui.sheetTitle, { color: p.ink, fontFamily: poppins('600') }]}>Add a lab report</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={p.muted} />
            </Pressable>
          </View>
          {options.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => {
                onClose?.();
                setTimeout(() => o.onPress?.(), 250);
              }}
              style={[ui.option, { borderColor: p.softBorder }]}
            >
              <View style={[ui.optionIcon, { backgroundColor: p.greenBg }]}>
                <o.Icon size={20} color={isDark ? c.text : colors.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ui.optionTitle, { color: p.ink, fontFamily: snPro('700') }]}>{o.title}</Text>
                <Text style={[ui.optionSub, { color: p.muted, fontFamily: snPro('400') }]}>{o.sub}</Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ui = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  subtitle: { fontSize: 12 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, flexShrink: 0 },
  badgeText: { fontSize: 11 },
  busy: { zIndex: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 6 },
  busyTitle: { fontSize: 20, lineHeight: 26, marginTop: 10, textAlign: 'center' },
  busySub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontSize: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  optionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 14 },
  optionSub: { fontSize: 12 },
});
