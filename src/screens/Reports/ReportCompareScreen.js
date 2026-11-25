import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro, poppins } from '../../config/fonts';
import { listReports } from '../../services/reportsService';
import {
  CARD_SHADOW,
  ReportHeader,
  formatDate,
  rangeText,
  reportDate,
  reportPalette,
  shortDate,
  valueFlag,
  valueText,
} from './reportUi';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const CHART_H = 170;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 136;

/** Every test name across reports â†’ its readings, oldest first. */
function buildSeries(reports) {
  const map = new Map();
  reports.forEach((r) => {
    (Array.isArray(r.values) ? r.values : []).forEach((v) => {
      const key = norm(v?.name);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, name: String(v.name).trim(), points: [] });
      map.get(key).points.push({ report: r, value: v, date: reportDate(r) });
    });
  });
  map.forEach((s) => s.points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
  return map;
}

/** Canvas "Compare over time": one test across reports. */
export default function ReportCompareScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  const currentId = route?.params?.id || null;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await listReports({ withValues: true }));
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load your reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const series = useMemo(() => buildSeries(reports), [reports]);

  // Names in the current report first, then the most repeated tests.
  const tabs = useMemo(() => {
    const current = reports.find((r) => r.id === currentId);
    const first = (current?.values || []).map((v) => norm(v?.name)).filter((k) => series.has(k));
    const seen = new Set(first);
    const rest = [...series.values()]
      .filter((s) => !seen.has(s.key))
      .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name))
      .map((s) => s.key);
    const ordered = [...new Set([...first, ...rest])].map((k) => series.get(k));
    // Tests seen in more than one report are the useful ones to compare.
    return [...ordered.filter((s) => s.points.length > 1), ...ordered.filter((s) => s.points.length <= 1)];
  }, [reports, series, currentId]);

  const active = (picked && series.get(picked)) || tabs[0] || null;

  useEffect(() => {
    setSelected(null);
  }, [active?.key]);

  const chart = useMemo(() => {
    if (!active || !width) return null;
    const pts = active.points.filter((pt) => num(pt.value?.value) != null);
    if (!pts.length) return null;
    const latest = pts[pts.length - 1].value;
    const lo = num(latest?.low);
    const hi = num(latest?.high);
    const vals = pts.map((pt) => Number(pt.value.value));
    let min = Math.min(...vals, ...(lo != null ? [lo] : []), ...(hi != null ? [hi] : []));
    let max = Math.max(...vals, ...(lo != null ? [lo] : []), ...(hi != null ? [hi] : []));
    if (lo == null && hi != null) min = Math.min(min, 0);
    const pad = (max - min) * 0.12 || Math.abs(max) * 0.1 || 1;
    min -= pad;
    max += pad;
    const y = (v) => PLOT_BOTTOM - ((v - min) / (max - min)) * (PLOT_BOTTOM - PLOT_TOP);
    const left = 28;
    const right = width - 28;
    const x = (i) => (pts.length === 1 ? width / 2 : left + (i * (right - left)) / (pts.length - 1));
    const dots = pts.map((pt, i) => ({
      x: x(i),
      y: y(Number(pt.value.value)),
      label: shortDate(pt.date),
      text: `${valueText(pt.value)}${pt.value.unit ? ` ${pt.value.unit}` : ''}`,
      outside: ['low', 'high'].includes(valueFlag(pt.value)),
    }));
    let band = null;
    if (lo != null || hi != null) {
      const top = y(hi != null ? hi : max);
      const bottom = y(lo != null ? lo : min);
      band = { y: Math.max(PLOT_TOP, top), h: Math.max(0, Math.min(PLOT_BOTTOM, bottom) - Math.max(PLOT_TOP, top)) };
    }
    return { dots, band, unit: latest?.unit || '', skipped: active.points.length - pts.length };
  }, [active, width]);

  const rows = active ? [...active.points].reverse() : [];

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ReportHeader navigation={navigation} title="Compare over time" subtitle="Same test, different dates" />

        {loading ? (
          <LoadingScreen message="Loading your reports…" />
        ) : error ? (
          <View style={[styles.card, styles.pad, CARD_SHADOW, { backgroundColor: c.cardBg, gap: 12 }]}>
            <Text style={[styles.body, { color: p.body, fontFamily: snPro('400') }]}>{error}</Text>
            <AppButton variant="secondary" label="Try again" onPress={load} />
          </View>
        ) : !tabs.length ? (
          <View style={[styles.card, styles.pad, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
            <Text style={[styles.body, { color: p.muted, fontFamily: snPro('400') }]}>
              No saved values yet. Upload lab reports to compare the same test across dates.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {tabs.map((t) => {
                const on = active?.key === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setPicked(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.chip,
                      on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: c.cardBg, borderColor: p.softBorder },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: on ? '#FFFFFF' : p.body, fontFamily: snPro('700') }]} numberOfLines={1}>
                      {t.name}
                      {t.points.length > 1 ? ` · ${t.points.length}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {active ? (
              <View style={[styles.card, styles.pad, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
                <View style={styles.chartHead}>
                  <Text style={[styles.chartTitle, { color: p.ink, fontFamily: poppins('600') }]} numberOfLines={1}>
                    {active.name}
                  </Text>
                  {chart?.unit ? <Text style={[styles.small, { color: p.muted, fontFamily: snPro('400') }]}>{chart.unit}</Text> : null}
                </View>
                <View
                  style={{ marginTop: 8 }}
                  onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
                  accessible
                  accessibilityLabel={`${active.name} over time: ${active.points
                    .map((pt) => `${formatDate(pt.date)} ${valueText(pt.value)}`)
                    .join(', ')}`}
                >
                  {chart ? (
                    <Svg width={width} height={CHART_H}>
                      {chart.band ? <Rect x={0} y={chart.band.y} width={width} height={chart.band.h} fill={p.greenBg} /> : null}
                      <Line x1={0} y1={PLOT_BOTTOM + 4} x2={width} y2={PLOT_BOTTOM + 4} stroke={p.line} strokeWidth={1} />
                      {chart.dots.length > 1 ? (
                        <Polyline
                          points={chart.dots.map((d) => `${d.x},${d.y}`).join(' ')}
                          fill="none"
                          stroke={isDark ? '#7EC845' : '#1e5e24'}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null}
                      {chart.dots.map((d, i) => (
                        <React.Fragment key={`d-${i}`}>
                          <Circle
                            cx={d.x}
                            cy={d.y}
                            r={selected === i ? 7 : 5}
                            fill={c.cardBg}
                            stroke={d.outside ? p.redDot : isDark ? '#7EC845' : '#1e5e24'}
                            strokeWidth={3}
                          />
                          {/* Larger invisible hit target for tapping a point. */}
                          <Circle cx={d.x} cy={d.y} r={18} fill="transparent" onPress={() => setSelected(selected === i ? null : i)} />
                          <SvgText x={d.x} y={CHART_H - 4} fontSize={11} fill={p.muted} textAnchor="middle">
                            {d.label}
                          </SvgText>
                        </React.Fragment>
                      ))}
                      {selected != null && chart.dots[selected] ? (
                        <SvgText
                          x={Math.min(Math.max(chart.dots[selected].x, 30), width - 30)}
                          y={Math.max(12, chart.dots[selected].y - 12)}
                          fontSize={12}
                          fontWeight="700"
                          fill={p.ink}
                          textAnchor="middle"
                        >
                          {chart.dots[selected].text}
                        </SvgText>
                      ) : null}
                    </Svg>
                  ) : width ? (
                    <Text style={[styles.body, { color: p.muted, fontFamily: snPro('400'), paddingVertical: 12 }]}>
                      These results are not numbers, so there is no chart. See the list below.
                    </Text>
                  ) : null}
                </View>
                {chart ? (
                  <Text style={[styles.small, { color: p.muted, fontFamily: snPro('400'), marginTop: 4 }]}>
                    {chart.band ? 'Green band: lab range on your latest report. ' : ''}Tap a point to see its value.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.card, styles.list, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
              {rows.map((pt, i) => {
                const range = rangeText(pt.value?.low, pt.value?.high);
                const flag = valueFlag(pt.value);
                return (
                  <Pressable
                    key={`${pt.report.id}-${i}`}
                    onPress={() => navigation.push('ReportResult', { id: pt.report.id })}
                    style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: p.line }]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowDate, { color: p.ink, fontFamily: snPro('700') }]}>
                        {formatDate(pt.date) || 'No date'}
                      </Text>
                      <Text style={[styles.small, { color: p.muted, fontFamily: snPro('400') }]} numberOfLines={1}>
                        {[pt.report.labName || 'Lab report', range ? `range ${range}` : 'no range given'].join(' · ')}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rowValue,
                        { color: ['low', 'high'].includes(flag) ? (isDark ? '#f4a79d' : '#9b2c1f') : p.ink, fontFamily: poppins('700') },
                      ]}
                    >
                      {valueText(pt.value)}
                      {pt.value?.unit ? ` ${pt.value.unit}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
              {active && active.points.length === 1 ? (
                <Text style={[styles.small, { color: p.muted, fontFamily: snPro('400'), paddingBottom: 12 }]}>
                  Only one report has this test so far. Add a newer report to see the change.
                </Text>
              ) : null}
            </View>

            <View style={[styles.noteBox, { backgroundColor: p.blueBg }]}>
              <Text style={[styles.small, { color: p.blueInk, fontFamily: snPro('400') }]}>
                Values are shown in each report's original unit, with that lab's own range. Different labs can give slightly
                different results.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16 },
  pad: { paddingVertical: 14, paddingHorizontal: 16 },
  body: { fontSize: 13, lineHeight: 19 },
  small: { fontSize: 12, lineHeight: 17 },
  chips: { gap: 6, paddingRight: 8 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, justifyContent: 'center', maxWidth: 220 },
  chipText: { fontSize: 13 },
  chartHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  chartTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  list: { paddingHorizontal: 16, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowDate: { fontSize: 14 },
  rowValue: { fontSize: 15, flexShrink: 0 },
  noteBox: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
});
