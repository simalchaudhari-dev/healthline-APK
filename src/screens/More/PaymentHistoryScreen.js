import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Receipt } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { apiCancelAutoPay, apiListMyPayments } from '../../services/subscriptionService';
import { downloadInvoice } from '../../utils/invoiceFile';
import { toast } from '../../utils/toast';
import { formatDate } from '../../utils/formatDate';

const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(30,94,36,0.06)' },
  default: {
    shadowColor: '#1e5e24',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

const HERO_BG = '#1e5e24';
const DANGER_TEXT = '#9b2c1f';

function formatWhen(value) {
  return formatDate(value);
}

export default function PaymentHistoryScreen({ navigation }) {
  const { themeColors: c, isDark, primaryRgba, brand } = useTheme();
  const { accessToken, user, setAccount } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) {
        setLoading(false);
        return undefined;
      }
      let active = true;
      setLoading(true);
      apiListMyPayments(accessToken)
        .then((rows) => {
          if (active) setPayments(rows);
        })
        .catch(() => {
          if (active) setPayments([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [accessToken])
  );

  const cancelAutoPay = async () => {
    if (!accessToken) return;
    setCancelling(true);
    try {
      const data = await apiCancelAutoPay(accessToken);
      if (data?.user) await setAccount(data.user);
      if (Array.isArray(data?.payments)) setPayments(data.payments);
      setConfirmOpen(false);
      toast.success('Auto-pay is off. This period will not renew.');
    } catch (err) {
      toast.error(err.message || 'Unable to cancel auto-pay.');
    } finally {
      setCancelling(false);
    }
  };

  const autoPayOn = payments.some((row) => row.autoPay) || !!user?.subscription?.autoPay;
  const canCancel = autoPayOn && payments.some((row) => row.status !== 'Failed' && row.autoPay);

  const sub = user?.subscription;
  const planName = user?.plan || 'Free';
  const isPaid = planName !== 'Free';
  const billingLabel = sub?.billing === 'yearly' ? 'Yearly' : 'Monthly';
  const endsAt = formatWhen(sub?.endsAt);
  const latestPaid = payments.find((row) => row.status !== 'Failed');
  const pending = sub?.pending;

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const cardBg = c.cardBg;
  const rowBorder = isDark ? c.border : '#eef2ec';
  const pillBorder = isDark ? c.border : '#cfe3c7';
  const pillText = isDark ? c.text : HERO_BG;

  let statusPill = 'Free';
  if (isPaid) statusPill = sub?.autoPay || !endsAt ? 'Active' : `Ends ${endsAt}`;

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.backBtn, { backgroundColor: c.cardBg }, CARD_SHADOW]}
          >
            <ChevronLeft size={20} color={colors.primaryDark} strokeWidth={2.6} />
          </Pressable>
          <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Plan and billing</Text>
        </View>

        <View style={[styles.hero, CARD_SHADOW]}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroTitle, { fontFamily: poppins('700') }]} numberOfLines={2}>
              {isPaid ? `${planName} · ${billingLabel}` : 'Free plan'}
            </Text>
            <View style={styles.statusPill}>
              <Text style={[styles.statusText, { fontFamily: snPro('700') }]}>{statusPill}</Text>
            </View>
          </View>
          {isPaid && latestPaid?.amount ? (
            <Text style={[styles.heroPrice, { fontFamily: snPro('600') }]}>
              {latestPaid.amount} / {sub?.billing === 'yearly' ? 'year' : 'month'}
            </Text>
          ) : null}
          {isPaid && endsAt ? (
            <Text style={[styles.heroMeta, { fontFamily: snPro('500') }]}>
              {sub?.autoPay ? `Renews on ${endsAt}` : `Cancelled · access until ${endsAt}`}
            </Text>
          ) : null}
          {pending?.planName ? (
            <Text style={[styles.heroMeta, { fontFamily: snPro('500') }]}>
              {pending.planName} starts{pending.startsAt ? ` ${formatWhen(pending.startsAt)}` : ' after this period'}
            </Text>
          ) : null}
          <Pressable onPress={() => navigation.navigate('Subscription')} style={styles.heroBtn}>
            <Text style={[styles.heroBtnText, { fontFamily: snPro('700') }]}>Compare plans</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: ink, fontFamily: poppins('600') }]}>Invoices</Text>

        {loading ? <LoadingScreen message="Loading payments…" /> : null}

        {!loading && payments.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                backgroundColor: isDark ? primaryRgba(0.16) : colors.primarySoft,
                borderColor: isDark ? primaryRgba(0.3) : primaryRgba(0.18),
              },
            ]}
          >
            <Receipt size={22} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: ink, fontFamily: snPro('700') }]}>No payments yet</Text>
            <Text style={[styles.emptyText, { color: muted, fontFamily: snPro('400') }]}>
              A Razorpay payment will show up here.
            </Text>
          </View>
        ) : null}

        {!loading && payments.length > 0 ? (
          <View style={[styles.card, { backgroundColor: cardBg }, isDark ? { borderWidth: 1, borderColor: c.border } : null, CARD_SHADOW]}>
            {payments.map((row, index) => (
              <View
                key={row.id}
                style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: rowBorder } : null]}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: ink, fontFamily: snPro('700') }]} numberOfLines={1}>
                    {formatWhen(row.date) || row.plan}
                  </Text>
                  <Text style={[styles.rowMeta, { color: muted, fontFamily: snPro('500') }]}>
                    {row.amount} · {row.status || 'Paid'}
                  </Text>
                  <Text style={[styles.rowMeta, { color: muted, fontFamily: snPro('400') }]}>
                    {row.plan} · {row.billing} · {row.method} · Auto-pay {row.autoPay ? 'on' : 'off'}
                    {row.endsAt ? ` · ends ${formatWhen(row.endsAt)}` : ''}
                  </Text>
                </View>
                {row.status !== 'Failed' ? (
                  <Pressable
                    onPress={() => downloadInvoice(row, user, brand).catch(() => toast.error('Unable to download the invoice.'))}
                    accessibilityLabel="Download invoice"
                    style={[styles.pdfBtn, { borderColor: pillBorder }]}
                  >
                    <Text style={[styles.pdfText, { color: pillText, fontFamily: snPro('700') }]}>PDF</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {!loading && canCancel ? (
          confirmOpen ? (
            <View style={[styles.confirm, { backgroundColor: isDark ? 'rgba(155,44,31,0.22)' : '#fde4e1' }]}>
              <Text style={[styles.confirmTitle, { color: isDark ? c.text : DANGER_TEXT, fontFamily: poppins('600') }]}>
                Cancel {isPaid ? planName : 'subscription'}?
              </Text>
              <Text style={[styles.confirmText, { color: isDark ? c.muted : '#5b2a24', fontFamily: snPro('400') }]}>
                This turns auto-pay off. The current period stays active until its end date and will not renew.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  onPress={cancelAutoPay}
                  disabled={cancelling}
                  style={[styles.confirmYes, cancelling ? { opacity: 0.6 } : null]}
                >
                  <Text style={[styles.confirmYesText, { fontFamily: snPro('700') }]}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmOpen(false)}
                  disabled={cancelling}
                  style={[styles.confirmNo, { borderColor: pillBorder, backgroundColor: cardBg }]}
                >
                  <Text style={[styles.confirmNoText, { color: pillText, fontFamily: snPro('700') }]}>
                    Keep {isPaid ? planName : 'auto-pay'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmOpen(true)}
              disabled={cancelling}
              style={[styles.cancelBtn, { borderColor: pillBorder, backgroundColor: cardBg }]}
            >
              <Text style={[styles.cancelText, { color: isDark ? '#f08a7e' : DANGER_TEXT, fontFamily: snPro('700') }]}>
                Cancel subscription
              </Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: { fontSize: 20, flex: 1 },
  hero: { backgroundColor: HERO_BG, borderRadius: 20, padding: 18, marginBottom: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroTitle: { color: '#ffffff', fontSize: 20, flex: 1, marginRight: 10 },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  statusText: { color: '#ffffff', fontSize: 12 },
  heroPrice: { color: '#e2f2dc', fontSize: 15, marginTop: 6 },
  heroMeta: { color: '#d7f0c9', fontSize: 13, marginTop: 4 },
  heroBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
  },
  heroBtnText: { color: HERO_BG, fontSize: 13 },
  sectionTitle: { fontSize: 16, marginBottom: 10 },
  empty: { borderRadius: 16, borderWidth: 1, padding: 18, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 16, marginTop: 10 },
  emptyText: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  card: { borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBody: { flex: 1, marginRight: 10 },
  rowTitle: { fontSize: 14 },
  rowMeta: { fontSize: 12, marginTop: 3 },
  pdfBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pdfText: { fontSize: 12 },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 22,
  },
  cancelText: { fontSize: 14 },
  confirm: { borderRadius: 16, padding: 16, marginTop: 22 },
  confirmTitle: { fontSize: 16 },
  confirmText: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  confirmActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  confirmYes: { backgroundColor: DANGER_TEXT, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  confirmYesText: { color: '#ffffff', fontSize: 13 },
  confirmNo: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  confirmNoText: { fontSize: 13 },
});
