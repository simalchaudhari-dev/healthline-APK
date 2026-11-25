import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Upload, FileText, ChevronRight } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro, poppins } from '../../config/fonts';
import { listReports } from '../../services/reportsService';
import {
  CARD_SHADOW,
  Badge,
  BusyOverlay,
  ReportHeader,
  UploadSourceSheet,
  formatDate,
  reportDate,
  reportPalette,
  useReportUpload,
} from './reportUi';

/** Canvas "Health records": upload a lab report and see saved ones. */
export default function HealthRecordsScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listReports();
      setReports(list);
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load your reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onExtracted = useCallback(
    ({ draft, file, local }) => {
      navigation.navigate('ReportReview', { mode: 'new', draft, file, local: { name: local?.name, size: local?.size, type: local?.type } });
    },
    [navigation],
  );
  const { busy, pickFile, takePhoto } = useReportUpload(onExtracted);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScreenShell>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <ReportHeader navigation={navigation} title="Health records" subtitle="Your lab reports in one place" />

        <Pressable
          onPress={() => setSheet(true)}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.upload, { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#9cc98a' }]}
        >
          <View style={[styles.uploadIcon, { backgroundColor: isDark ? c.chip : '#fde4e1' }]}>
            <Upload size={24} color={isDark ? c.text : '#9b2c1f'} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.uploadTitle, { color: p.ink, fontFamily: poppins('600') }]}>Upload a lab report</Text>
            <Text style={[styles.uploadSub, { color: p.muted, fontFamily: snPro('400') }]}>
              PDF, photo, Excel or Word · we'll read the values for you to check
            </Text>
          </View>
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: p.ink, fontFamily: poppins('600') }]}>Lab reports</Text>
          {reports.length ? (
            <Pressable onPress={() => navigation.navigate('ReportCompare')} hitSlop={8} style={{ paddingVertical: 8 }}>
              <Text style={[styles.link, { color: colors.primary, fontFamily: snPro('700') }]}>Compare over time</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <LoadingScreen message="Loading your reports…" />
        ) : error && !reports.length ? (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg, padding: 16, gap: 12 }]}>
            <Text style={[styles.empty, { color: p.muted, fontFamily: snPro('400') }]}>{error}</Text>
            <AppButton variant="secondary" label="Try again" onPress={() => { setLoading(true); load(); }} />
          </View>
        ) : !reports.length ? (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg, padding: 20, alignItems: 'center', gap: 6 }]}>
            <FileText size={28} color={p.muted} />
            <Text style={[styles.emptyTitle, { color: p.ink, fontFamily: snPro('700') }]}>No reports yet</Text>
            <Text style={[styles.empty, { color: p.muted, fontFamily: snPro('400') }]}>
              Upload a lab report to see your results in plain language and track them over time.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {reports.map((r) => {
              const total = Number(r?.counts?.total) || 0;
              const out = Number(r?.counts?.outOfRange) || 0;
              const meta = [formatDate(reportDate(r)), r.labName || 'Lab report', total ? `${total} value${total === 1 ? '' : 's'}` : '']
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={r.id}
                  onPress={() => navigation.navigate('ReportResult', { id: r.id, report: r })}
                  style={[styles.row, CARD_SHADOW, { backgroundColor: c.cardBg }]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: p.greySoft }]}>
                    <FileText size={22} color={p.muted} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowTitle, { color: p.ink, fontFamily: poppins('600') }]} numberOfLines={1}>
                      {r.title || 'Lab report'}
                    </Text>
                    <Text style={[styles.rowMeta, { color: p.muted, fontFamily: snPro('400') }]} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                  {out > 0 ? (
                    <Badge label={`${out} to review`} tone="review" />
                  ) : total > 0 ? (
                    <Badge label="In range" tone="normal" />
                  ) : (
                    <Badge label="Saved" tone="plain" />
                  )}
                  <ChevronRight size={16} color={p.muted} />
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.footer, { color: p.muted, fontFamily: snPro('400') }]}>
          Your reports are private. Explanations help you understand results; they are not a diagnosis.
        </Text>
      </ScrollView>

      <UploadSourceSheet visible={sheet} onClose={() => setSheet(false)} onPickFile={pickFile} onTakePhoto={takePhoto} />
      {busy ? <BusyOverlay /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  upload: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed' },
  uploadIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: 15, lineHeight: 21 },
  uploadSub: { fontSize: 12, lineHeight: 17 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 16 },
  link: { fontSize: 13 },
  card: { borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, lineHeight: 20 },
  rowMeta: { fontSize: 12 },
  emptyTitle: { fontSize: 15 },
  empty: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  footer: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 12 },
});
