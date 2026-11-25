import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, Pencil, Trash2, ChartLine } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useConfirm } from '../../context/ConfirmContext';
import { colors } from '../../config/colors';
import { snPro, poppins } from '../../config/fonts';
import { deleteReport, getReport, getReportFileUrl } from '../../services/reportsService';
import { toast } from '../../utils/toast';
import {
  CARD_SHADOW,
  Badge,
  FLAG_LABEL,
  FLAG_TONE,
  HeaderIcon,
  ReportHeader,
  countValues,
  formatDate,
  rangeBarLayout,
  rangeText,
  reportDate,
  reportPalette,
  valueFlag,
  valueText,
} from './reportUi';

/** Horizontal lab-range bar: green band = normal range, dot = this value. */
function RangeBar({ value, p }) {
  const layout = rangeBarLayout(value);
  if (!layout) return null;
  const outside = ['low', 'high'].includes(valueFlag(value));
  return (
    <View style={[styles.track, { backgroundColor: p.track }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.band, { left: `${layout.bandLeft}%`, right: `${layout.bandRight}%`, backgroundColor: p.band }]} />
      {layout.dot != null ? (
        <View
          style={[
            styles.dot,
            { left: `${layout.dot}%`, backgroundColor: outside ? p.redDot : colors.primary, borderColor: p.card },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Canvas "Report results": each value against the lab's own range. */
export default function ReportResultScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  const { confirm } = useConfirm();
  const id = route?.params?.id || route?.params?.report?.id;
  const [report, setReport] = useState(route?.params?.report?.values ? route.params.report : null);
  const [loading, setLoading] = useState(!report);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(null);
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fresh copy whenever the screen is shown (also after editing).
  const paramReport = route?.params?.report;
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (paramReport?.values) setReport(paramReport);
      if (!id) {
        setLoading(false);
        setError('This report was not found.');
        return undefined;
      }
      getReport(id)
        .then((r) => {
          if (!alive) return;
          setReport(r);
          setError('');
        })
        .catch((e) => {
          if (alive) setError(e?.message || 'Could not load this report.');
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [id, paramReport]),
  );

  const values = useMemo(() => (Array.isArray(report?.values) ? report.values : []), [report]);
  const counts = useMemo(() => countValues(values), [values]);
  const activeTab = tab || (counts.outside > 0 ? 'outside' : 'all');
  const shown = activeTab === 'outside' ? values.filter((v) => ['low', 'high'].includes(valueFlag(v))) : values;

  const openFile = async () => {
    if (!id) return;
    setOpening(true);
    try {
      const f = await getReportFileUrl(id);
      await Linking.openURL(f.url);
    } catch (e) {
      toast.error(e?.message || 'Could not open the original file.');
    } finally {
      setOpening(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this report?',
      message: 'The report, its values and the original file will be removed. This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteReport(id);
      toast.success('Report deleted');
      navigation.goBack();
    } catch (e) {
      toast.error(e?.message || 'Could not delete the report.');
      setDeleting(false);
    }
  };

  const subtitle = [formatDate(reportDate(report)), report?.labName].filter(Boolean).join(' · ');

  if (loading && !report) {
    return (
      <ScreenShell>
        <View style={styles.scroll}>
          <ReportHeader navigation={navigation} title="Report results" />
        </View>
        <LoadingScreen message="Loading report…" />
      </ScreenShell>
    );
  }

  if (!report) {
    return (
      <ScreenShell>
        <View style={styles.scroll}>
          <ReportHeader navigation={navigation} title="Report results" />
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg, padding: 16 }]}>
            <Text style={[styles.note, { color: p.muted, fontFamily: snPro('400') }]}>{error || 'This report was not found.'}</Text>
          </View>
        </View>
      </ScreenShell>
    );
  }

  const allGood = counts.known > 0 && counts.outside === 0;

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ReportHeader
          navigation={navigation}
          title={report.title || 'Lab report'}
          subtitle={subtitle}
          right={
            <View style={styles.actions}>
              {report.hasFile ? <HeaderIcon Icon={FileText} label="View original file" onPress={openFile} disabled={opening} /> : null}
              <HeaderIcon Icon={Pencil} label="Edit report" onPress={() => navigation.navigate('ReportReview', { mode: 'edit', report })} />
              <HeaderIcon Icon={Trash2} label="Delete report" onPress={remove} disabled={deleting} />
            </View>
          }
        />

        {counts.known > 0 ? (
          <View
            style={[
              styles.summary,
              allGood
                ? { backgroundColor: p.greenBg, borderColor: isDark ? 'rgba(46,125,50,0.45)' : '#c7e6b8' }
                : { backgroundColor: p.amberBg, borderColor: p.amberBorder },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: p.ink, fontFamily: poppins('600') }]}>
              {allGood
                ? `All ${counts.known} values are within the lab's range`
                : `${counts.inRange} of ${counts.known} values are within the lab's range`}
            </Text>
            <Text style={[styles.note, { color: p.body, fontFamily: snPro('400') }]}>
              {allGood
                ? 'Keep up your routine and share the report with your doctor at your next visit.'
                : `${counts.outside} ${counts.outside === 1 ? 'is' : 'are'} outside it. That doesn't automatically mean something is wrong, but ${counts.outside === 1 ? "it's" : "they're"} worth discussing with your doctor.`}
            </Text>
          </View>
        ) : values.length ? (
          <View style={[styles.summary, { backgroundColor: p.greySoft, borderColor: p.line }]}>
            <Text style={[styles.note, { color: p.body, fontFamily: snPro('400') }]}>
              This report has no lab ranges we could compare against. Your doctor can tell you what the values mean for you.
            </Text>
          </View>
        ) : null}

        {values.length ? (
          <>
            <View style={[styles.seg, { backgroundColor: c.cardBg }]} accessibilityRole="tablist">
              {[
                { key: 'outside', label: `Outside range (${counts.outside})` },
                { key: 'all', label: 'All values' },
              ].map((s) => {
                const on = activeTab === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setTab(s.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.segBtn, on && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.segText, { color: on ? '#FFFFFF' : p.body, fontFamily: snPro('700') }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.card, styles.list, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
              {!shown.length ? (
                <Text style={[styles.note, { color: p.muted, fontFamily: snPro('400'), paddingVertical: 14 }]}>
                  No values are outside the lab's range.
                </Text>
              ) : null}
              {shown.map((v, i) => {
                const flag = valueFlag(v);
                const range = rangeText(v.low, v.high);
                return (
                  <View key={`${v.name}-${i}`} style={[styles.vRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.line }]}>
                    <View style={styles.vHead}>
                      <Text style={[styles.vName, { color: p.ink, fontFamily: snPro('700') }]} numberOfLines={2}>
                        {v.name}
                      </Text>
                      <Badge label={FLAG_LABEL[flag]} tone={FLAG_TONE[flag]} />
                    </View>
                    <Text style={[styles.vMeta, { color: p.muted, fontFamily: snPro('400') }]}>
                      <Text style={[styles.vValue, { color: p.ink, fontFamily: poppins('700') }]}>{valueText(v)}</Text>
                      {v.unit ? ` ${v.unit}` : ''}
                      {range ? ` · lab range ${range}` : ''}
                    </Text>
                    <RangeBar value={v} p={p} />
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg, padding: 16 }]}>
            <Text style={[styles.note, { color: p.muted, fontFamily: snPro('400') }]}>
              No values saved for this report. Tap edit to add them.
            </Text>
          </View>
        )}

        {values.length ? (
          <AppButton label="Explain my report" onPress={() => navigation.navigate('ReportExplain', { id, report })} style={{ marginTop: 4 }} />
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('ReportCompare', { id })}
          style={[styles.outline, { backgroundColor: c.cardBg, borderColor: p.softBorder }]}
          accessibilityRole="button"
        >
          <ChartLine size={16} color={isDark ? c.text : colors.primaryDark} />
          <Text style={[styles.outlineText, { color: isDark ? c.text : colors.primaryDark, fontFamily: snPro('700') }]}>
            Compare with earlier reports
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  actions: { flexDirection: 'row', gap: 6 },
  card: { borderRadius: 16 },
  summary: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, gap: 4 },
  summaryTitle: { fontSize: 15, lineHeight: 21 },
  note: { fontSize: 13, lineHeight: 19 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 99, gap: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: 99, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segText: { fontSize: 13 },
  list: { paddingHorizontal: 16, paddingVertical: 4 },
  vRow: { paddingVertical: 12 },
  vHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vName: { flex: 1, fontSize: 14, lineHeight: 19 },
  vMeta: { marginTop: 2, fontSize: 13 },
  vValue: { fontSize: 16 },
  track: { position: 'relative', marginTop: 10, height: 6, borderRadius: 6 },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 6 },
  dot: { position: 'absolute', top: -4, width: 14, height: 14, marginLeft: -7, borderRadius: 7, borderWidth: 2 },
  outline: {
    height: 48,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  outlineText: { fontSize: 14 },
});
