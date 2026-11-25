import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Check, RefreshCw } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useConfirm } from '../../context/ConfirmContext';
import { snPro, poppins } from '../../config/fonts';
import { explainReport, newReportChargeId } from '../../services/reportsService';
import {
  CARD_SHADOW,
  Badge,
  FLAG_TONE,
  HeaderIcon,
  ReportHeader,
  reportPalette,
  useApplyTokenCharge,
  valueFlag,
  valueText,
} from './reportUi';

const EXPLAIN_FLAG = { low: 'Below range', high: 'Above range', normal: 'In range' };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function hasExplanation(report) {
  const ex = report?.explanation;
  return !!ex && (Boolean(ex.summary) || (Array.isArray(ex.items) && ex.items.length > 0));
}

/** Canvas "Explain my report": plain-language notes and questions for the doctor. */
export default function ReportExplainScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  const { confirm } = useConfirm();
  const applyCharge = useApplyTokenCharge();
  const start = route?.params?.report || null;
  const id = route?.params?.id || start?.id;

  const [report, setReport] = useState(start);
  const [loading, setLoading] = useState(!hasExplanation(start));
  const [error, setError] = useState('');
  const [checked, setChecked] = useState({});
  const chargeRef = useRef(newReportChargeId());

  const run = useCallback(
    async (force = false) => {
      if (!id) {
        setError('This report was not found.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await explainReport(id, { force, chargeId: chargeRef.current });
        applyCharge(result);
        setReport(result.report);
        setChecked({});
        chargeRef.current = newReportChargeId();
      } catch (e) {
        setError(e?.message || 'Could not explain this report. Please try again.');
        // A 402/4xx is final for this attempt; a fresh id lets the user retry cleanly.
        if (e?.status && e.status < 500) chargeRef.current = newReportChargeId();
      } finally {
        setLoading(false);
      }
    },
    [id, applyCharge],
  );

  useEffect(() => {
    if (!hasExplanation(start)) run(false);
    // Only on first open; Refresh re-runs on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    const ok = await confirm({
      title: 'Refresh explanation?',
      message: 'This writes a new explanation for your report and uses tokens.',
      confirmLabel: 'Refresh',
      destructive: false,
    });
    if (ok) run(true);
  };

  const explanation = report?.explanation || null;
  const valuesByName = useMemo(() => {
    const map = new Map();
    (Array.isArray(report?.values) ? report.values : []).forEach((v) => map.set(norm(v.name), v));
    return map;
  }, [report]);

  const items = Array.isArray(explanation?.items) ? explanation.items : [];
  const questions = Array.isArray(explanation?.questions) ? explanation.questions.filter(Boolean) : [];

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ReportHeader
          navigation={navigation}
          title="Explain my report"
          subtitle="In plain language"
          right={
            hasExplanation(report) && !loading ? <HeaderIcon Icon={RefreshCw} label="Refresh explanation" onPress={refresh} /> : null
          }
        />

        {loading ? (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
            <LoadingScreen message="Explaining your report in plain language… This can take up to a minute." />
          </View>
        ) : error ? (
          <View style={[styles.card, styles.pad, CARD_SHADOW, { backgroundColor: c.cardBg, gap: 12 }]}>
            <Text style={[styles.body, { color: p.body, fontFamily: snPro('400') }]}>{error}</Text>
            <AppButton variant="secondary" label="Try again" onPress={() => run(hasExplanation(report))} />
          </View>
        ) : !explanation ? (
          <View style={[styles.card, styles.pad, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
            <Text style={[styles.body, { color: p.muted, fontFamily: snPro('400') }]}>No explanation yet.</Text>
          </View>
        ) : (
          <>
            {explanation.summary ? (
              <View style={[styles.card, styles.pad, { backgroundColor: p.greenBg }]}>
                <Text style={[styles.body, { color: p.body, fontFamily: snPro('400') }]}>{explanation.summary}</Text>
              </View>
            ) : null}

            {items.map((x, i) => {
              const v = valuesByName.get(norm(x.name));
              const flag = v ? valueFlag(v) : 'unknown';
              const head = v ? `${x.name} · ${valueText(v)}${v.unit ? ` ${v.unit}` : ''}` : x.name;
              return (
                <View key={`${x.name}-${i}`} style={[styles.card, styles.pad, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
                  <View style={styles.itemHead}>
                    <Text style={[styles.itemName, { color: p.ink, fontFamily: poppins('600') }]}>{head}</Text>
                    {EXPLAIN_FLAG[flag] ? <Badge label={EXPLAIN_FLAG[flag]} tone={FLAG_TONE[flag]} /> : null}
                  </View>
                  {x.meaning ? (
                    <Text style={[styles.body, styles.gapTop, { color: p.body, fontFamily: snPro('400') }]}>
                      <Text style={{ fontFamily: snPro('700') }}>What it measures: </Text>
                      {x.meaning}
                    </Text>
                  ) : null}
                  {x.whatItMeans ? (
                    <Text style={[styles.body, styles.gapTop, { color: p.body, fontFamily: snPro('400') }]}>
                      <Text style={{ fontFamily: snPro('700') }}>What this may mean: </Text>
                      {x.whatItMeans}
                    </Text>
                  ) : null}
                  {x.notCertain ? (
                    <View style={[styles.unsure, { backgroundColor: p.greySoft }]}>
                      <Text style={[styles.small, { color: p.body, fontFamily: snPro('400') }]}>Not certain: {x.notCertain}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {questions.length ? (
              <View style={[styles.card, styles.pad, { backgroundColor: p.violetBg }]}>
                <Text style={[styles.qTitle, { color: p.ink, fontFamily: poppins('600') }]}>Questions to ask your doctor</Text>
                {questions.map((q, i) => {
                  const on = !!checked[i];
                  return (
                    <Pressable
                      key={`q-${i}`}
                      onPress={() => setChecked((prev) => ({ ...prev, [i]: !on }))}
                      style={styles.qRow}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <View
                        style={[
                          styles.box,
                          on ? { backgroundColor: '#3b2b8f', borderColor: '#3b2b8f' } : { borderColor: isDark ? c.border : '#b9b0e6', backgroundColor: c.cardBg },
                        ]}
                      >
                        {on ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                      </View>
                      <Text style={[styles.body, { flex: 1, color: p.body, fontFamily: snPro('400') }]}>{q}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        )}

        <Text style={[styles.disclaimer, { color: p.muted, fontFamily: snPro('400') }]}>
          Health line does not diagnose conditions or recommend medicines. Don't start, stop or change treatment without your doctor.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16 },
  pad: { paddingVertical: 14, paddingHorizontal: 16 },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemName: { flex: 1, fontSize: 15, lineHeight: 21 },
  body: { fontSize: 13, lineHeight: 19 },
  small: { fontSize: 12, lineHeight: 17 },
  gapTop: { marginTop: 6 },
  unsure: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  qTitle: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
  qRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  disclaimer: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
