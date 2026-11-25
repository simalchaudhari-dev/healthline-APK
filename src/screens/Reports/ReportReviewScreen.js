import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Check, Plus, X } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import AppButton from '../../components/common/AppButton';
import AppInput from '../../components/common/AppInput';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import { createReport, updateReport } from '../../services/reportsService';
import { toast } from '../../utils/toast';
import {
  CARD_SHADOW,
  BusyOverlay,
  ReportHeader,
  UploadSourceSheet,
  formatNumber,
  formatSize,
  reportPalette,
  useReportUpload,
  valueFlag,
} from './reportUi';

const COLLAPSED_COUNT = 8;
const UNCLEAR = /unclear|illegible|could ?n[o']t read|not legible|\?/i;

let rowSeq = 0;
const rowKey = () => `r${Date.now().toString(36)}${(rowSeq += 1)}`;

function toRows(values) {
  return (Array.isArray(values) ? values : []).map((v) => ({
    key: rowKey(),
    source: v,
    name: String(v?.name || ''),
    input: v?.value != null && v.value !== '' ? formatNumber(v.value) : String(v?.text || ''),
    unit: String(v?.unit || ''),
    custom: false,
  }));
}

function isUnclear(row) {
  const v = row.source || {};
  if (row.custom) return !row.input.trim();
  return v.value == null || UNCLEAR.test(`${v.text || ''} ${v.note || ''}`);
}

/** Back to the API shape: number when it parses, otherwise keep the lab's own text. */
function toValue(row) {
  const src = row.source || {};
  const raw = row.input.trim();
  const n = Number(raw.replace(',', '.'));
  const numeric = raw !== '' && Number.isFinite(n);
  const next = {
    name: row.name.trim(),
    value: numeric ? n : null,
    text: raw,
    unit: row.unit.trim(),
    low: src.low ?? null,
    high: src.high ?? null,
    note: String(src.note || ''),
  };
  next.flag = valueFlag(next);
  return next;
}

/** Canvas "Check extracted values": fix anything misread, then save. */
export default function ReportReviewScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  const p = reportPalette(isDark, c);
  const params = route?.params || {};
  const editing = params.mode === 'edit' && params.report;
  const initial = editing ? params.report : params.draft || {};

  const [file, setFile] = useState(editing ? params.report.file || null : params.file || null);
  const [local, setLocal] = useState(params.local || null);
  const [title, setTitle] = useState(String(initial.title || ''));
  const [labName, setLabName] = useState(String(initial.labName || ''));
  const [testDate, setTestDate] = useState(String(initial.testDate || '').slice(0, 10));
  const [rows, setRows] = useState(() => toRows(initial.values));
  const [usedForPlan, setUsedForPlan] = useState(editing ? !!params.report.usedForPlan : true);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dateError, setDateError] = useState('');
  const savedRef = useRef(false);

  const onReplaced = useCallback(({ draft, file: nextFile, local: nextLocal }) => {
    setFile(nextFile || null);
    setLocal(nextLocal ? { name: nextLocal.name, size: nextLocal.size, type: nextLocal.type } : null);
    setTitle(String(draft?.title || ''));
    setLabName(String(draft?.labName || ''));
    setTestDate(String(draft?.testDate || '').slice(0, 10));
    setRows(toRows(draft?.values));
    setShowAll(false);
    savedRef.current = false;
  }, []);
  const { busy, pickFile, takePhoto } = useReportUpload(onReplaced);

  const visibleRows = useMemo(
    () => (showAll || rows.length <= COLLAPSED_COUNT + 2 ? rows : rows.slice(0, COLLAPSED_COUNT)),
    [rows, showAll],
  );

  const setRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key) => setRows((prev) => prev.filter((r) => r.key !== key));
  const addRow = () => {
    setShowAll(true);
    setRows((prev) => [...prev, { key: rowKey(), source: {}, name: '', input: '', unit: '', custom: true }]);
  };

  const fileName = file?.fileName || local?.name || '';
  const mime = String(file?.mimeType || local?.type || '');
  const ext = (fileName.split('.').pop() || '').toUpperCase().slice(0, 4);
  const kind = mime.includes('pdf') ? 'PDF' : mime.startsWith('image/') ? 'IMG' : ext || 'FILE';
  const fileMeta = [formatSize(file?.size || local?.size), `${rows.length} value${rows.length === 1 ? '' : 's'} found`]
    .filter(Boolean)
    .join(' · ');

  const save = async () => {
    // One save per screen: a second tap must never create a duplicate report.
    if (saving || savedRef.current) return;
    const date = testDate.trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setDateError('Use the format YYYY-MM-DD, e.g. 2026-10-12.');
      return;
    }
    setDateError('');
    const values = rows.filter((r) => r.name.trim()).map(toValue);
    const body = {
      title: title.trim() || 'Lab report',
      labName: labName.trim(),
      testDate: date,
      values,
      usedForPlan,
    };
    setSaving(true);
    savedRef.current = true;
    try {
      if (editing) {
        const report = await updateReport(params.report.id, body);
        toast.success('Report updated');
        navigation.navigate({ name: 'ReportResult', params: { id: report.id, report }, merge: true });
      } else {
        const report = await createReport({ ...body, fileToken: file?.token || '' });
        toast.success('Report saved');
        navigation.replace('ReportResult', { id: report.id, report });
      }
    } catch (e) {
      // 409 = this file was already saved; keep blocking so it can't be saved twice.
      if (e?.status !== 409) savedRef.current = false;
      toast.error(e?.message || 'Could not save the report. Please try again.');
      setSaving(false);
    }
  };

  const cellInput = (extra) => [
    styles.cellInput,
    {
      color: p.ink,
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      fontFamily: snPro('600'),
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
    },
    extra,
  ];

  return (
    <ScreenShell>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ReportHeader
            navigation={navigation}
            title={editing ? 'Edit report' : 'Check extracted values'}
            subtitle={editing ? 'Fix names, values or details' : 'Step 2 of 2 · fix anything we misread'}
          />

          {fileName ? (
            <View style={[styles.card, styles.fileChip, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
              <View style={[styles.fileBadge, { backgroundColor: isDark ? c.chip : '#fde4e1' }]}>
                <Text style={[styles.fileBadgeText, { color: isDark ? c.text : '#9b2c1f', fontFamily: snPro('700') }]}>{kind}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.fileName, { color: p.ink, fontFamily: snPro('700') }]} numberOfLines={1}>
                  {fileName}
                </Text>
                {fileMeta ? <Text style={[styles.small, { color: p.muted, fontFamily: snPro('400') }]}>{fileMeta}</Text> : null}
              </View>
              {!editing ? (
                <Pressable onPress={() => setSheet(true)} hitSlop={6} style={styles.replace} accessibilityRole="button">
                  <Text style={[styles.replaceText, { color: colors.primary, fontFamily: snPro('700') }]}>Replace</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <AppInput tone="soft" label="Report name" value={title} onChangeText={setTitle} placeholder="e.g. Complete blood count" autoCapitalize="sentences" style={styles.field} />
          <View style={styles.twoCol}>
            <AppInput tone="soft" label="Lab name" value={labName} onChangeText={setLabName} placeholder="Lab name" autoCapitalize="words" style={[styles.field, { flex: 1 }]} />
            <AppInput
              tone="soft"
              label="Test date"
              value={testDate}
              onChangeText={(t) => {
                setTestDate(t);
                if (dateError) setDateError('');
              }}
              placeholder="YYYY-MM-DD"
              error={dateError}
              style={[styles.field, { flex: 1 }]}
            />
          </View>

          <View style={[styles.card, styles.table, CARD_SHADOW, { backgroundColor: c.cardBg }]}>
            <View style={[styles.tr, styles.th]}>
              <Text style={[styles.colName, styles.thText, { color: p.muted, fontFamily: snPro('700') }]}>Test</Text>
              <Text style={[styles.colValue, styles.thText, { color: p.muted, fontFamily: snPro('700') }]}>Value</Text>
              <Text style={[styles.colUnit, styles.thText, { color: p.muted, fontFamily: snPro('700') }]}>Unit</Text>
            </View>

            {!rows.length ? (
              <Text style={[styles.emptyRows, { color: p.muted, borderTopColor: p.line, fontFamily: snPro('400') }]}>
                No values were found. You can add them below, or save the report as a document.
              </Text>
            ) : null}

            {visibleRows.map((r) => {
              const unclear = isUnclear(r);
              return (
                <View key={r.key} style={[styles.rowWrap, { borderTopColor: p.line }]}>
                  <View style={styles.tr}>
                    {r.custom ? (
                      <TextInput
                        value={r.name}
                        onChangeText={(t) => setRow(r.key, { name: t })}
                        placeholder="Test name"
                        placeholderTextColor={c.placeholder}
                        style={cellInput([styles.colName, { borderColor: p.softBorder }])}
                      />
                    ) : (
                      <Text style={[styles.colName, styles.name, { color: p.ink, fontFamily: snPro('700') }]} numberOfLines={2}>
                        {r.name}
                      </Text>
                    )}
                    <TextInput
                      value={r.input}
                      onChangeText={(t) => setRow(r.key, { input: t })}
                      placeholder="—"
                      placeholderTextColor={c.placeholder}
                      accessibilityLabel={`${r.name || 'Test'} value`}
                      style={cellInput([
                        styles.colValue,
                        unclear ? { borderColor: p.amberStrong, borderWidth: 2 } : { borderColor: p.softBorder },
                      ])}
                    />
                    {r.custom ? (
                      <View style={[styles.colUnit, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <TextInput
                          value={r.unit}
                          onChangeText={(t) => setRow(r.key, { unit: t })}
                          placeholder="Unit"
                          placeholderTextColor={c.placeholder}
                          style={cellInput([{ flex: 1, borderColor: p.softBorder }])}
                        />
                        <Pressable onPress={() => removeRow(r.key)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove value">
                          <X size={16} color={p.muted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={[styles.colUnit, styles.small, { color: p.muted, fontFamily: snPro('400') }]} numberOfLines={2}>
                        {r.unit}
                      </Text>
                    )}
                  </View>
                  {unclear && !r.custom ? (
                    <Text style={[styles.unclear, { color: p.amberInk, fontFamily: snPro('400') }]}>
                      We couldn't read this clearly. Please check it against your report.
                    </Text>
                  ) : null}
                </View>
              );
            })}

            {visibleRows.length < rows.length ? (
              <Pressable onPress={() => setShowAll(true)} style={[styles.footRow, { borderTopColor: p.line }]}>
                <Text style={[styles.link, { color: colors.primary, fontFamily: snPro('700') }]}>Show all {rows.length} values</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={addRow} style={[styles.footRow, styles.addRow, { borderTopColor: p.line }]} accessibilityRole="button">
              <Plus size={16} color={colors.primary} />
              <Text style={[styles.link, { color: colors.primary, fontFamily: snPro('700') }]}>Add a value</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setUsedForPlan((v) => !v)}
            style={styles.check}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: usedForPlan }}
          >
            <View
              style={[
                styles.box,
                usedForPlan ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: p.softBorder, backgroundColor: c.cardBg },
              ]}
            >
              {usedForPlan ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text style={[styles.checkText, { color: p.body, fontFamily: snPro('400') }]}>
              Use this report to personalise my meal plan and AI Assist answers.
            </Text>
          </Pressable>

          <AppButton label={editing ? 'Save changes' : 'Save report'} onPress={save} loading={saving} style={{ marginTop: 6 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <UploadSourceSheet visible={sheet} onClose={() => setSheet(false)} onPickFile={pickFile} onTakePhoto={takePhoto} />
      {busy ? <BusyOverlay /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  fileBadge: { width: 40, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileBadgeText: { fontSize: 10 },
  fileName: { fontSize: 14 },
  small: { fontSize: 12 },
  replace: { height: 40, paddingHorizontal: 8, justifyContent: 'center' },
  replaceText: { fontSize: 13 },
  field: { marginBottom: 0 },
  twoCol: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  table: { paddingHorizontal: 14, paddingVertical: 4 },
  th: { paddingVertical: 8 },
  thText: { fontSize: 11 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colName: { flex: 1.4, minWidth: 0 },
  colValue: { flex: 1, minWidth: 0 },
  colUnit: { flex: 0.9, minWidth: 0 },
  name: { fontSize: 13, lineHeight: 18 },
  cellInput: { height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14 },
  rowWrap: { paddingVertical: 8, borderTopWidth: 1 },
  unclear: { marginTop: 4, fontSize: 12, lineHeight: 16 },
  emptyRows: { fontSize: 13, lineHeight: 19, paddingVertical: 10, borderTopWidth: 1 },
  footRow: { paddingVertical: 12, borderTopWidth: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontSize: 13 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
