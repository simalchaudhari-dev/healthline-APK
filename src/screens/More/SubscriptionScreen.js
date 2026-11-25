import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Check, ChevronRight, Crown, Sparkles } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ScreenHeader from '../../components/common/ScreenHeader';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { PLANS as FALLBACK_PLANS, formatPlanLabel, formatInrAmount, parsePlanAmount, yearlySavings } from '../../config/plans';
import { apiFetchPlans } from '../../services/plansService';
import { apiMe } from '../../services/authService';
import { apiCreateRazorpayOrder } from '../../services/subscriptionService';
import { openRazorpayCheckout } from '../../utils/openRazorpayCheckout';
import { toast } from '../../utils/toast';
import { formatDate } from '../../utils/formatDate';

export default function SubscriptionScreen({ navigation }) {
  const { isDark, themeColors: c, primaryRgba } = useTheme();
  const { user, accessToken, setAccount } = useAuth();
  const { confirm } = useConfirm();
  const currentPlan = user?.plan || 'Free';
  // A paid plan is "current" only for the billing it is on — Family monthly can still switch to Family yearly.
  // No saved billing (e.g. plan set by an admin) counts as monthly.
  const currentBilling = currentPlan === 'Free' ? '' : user?.subscription?.billing || 'monthly';
  // Open on the tab the user is currently billed on.
  const [billing, setBilling] = useState(currentBilling === 'yearly' ? 'yearly' : 'monthly');
  const isCurrentChoice = (planId) =>
    planId === currentPlan && (planId === 'Free' || billing === currentBilling);
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState('');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    const next = await apiFetchPlans();
    setPlans(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return undefined;
      let active = true;
      apiMe(accessToken)
        .then((data) => {
          if (active && data?.user) setAccount(data.user);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [accessToken, setAccount])
  );

  const onChoose = async (plan) => {
    if (payingId) return;
    if (isCurrentChoice(plan.id)) {
      await confirm({
        title: 'Current plan',
        message: `You are already on ${formatPlanLabel(currentPlan, plans)}${
          currentBilling ? ` (${currentBilling})` : ''
        }.`,
        confirmLabel: 'OK',
        cancelLabel: null,
        destructive: false,
      });
      return;
    }

    if (plan.id === 'Free') {
      await confirm({
        title: 'Free plan',
        message: 'Free does not need a payment. Plus and Family are paid inside the app.',
        confirmLabel: 'Got it',
        cancelLabel: null,
        destructive: false,
      });
      return;
    }

    if (!accessToken) {
      toast.error('Sign in to continue.');
      return;
    }

    setPayingId(plan.id);
    try {
      const data = await apiCreateRazorpayOrder(accessToken, {
        kind: 'plan',
        planCode: plan.id,
        billing,
      });
      await openRazorpayCheckout(data, {
        accessToken,
        onPaid: (nextUser) => setAccount(nextUser),
      });
    } catch (err) {
      toast.error(err.message || 'Unable to start Razorpay checkout.');
    } finally {
      setPayingId('');
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Subscription" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { color: colors.primary, fontFamily: snPro('800') }]}>PLANS</Text>
        <Text style={[styles.title, { color: c.text, fontFamily: FONT.nova }]}>Choose your plan</Text>
        <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('400') }]}>
          Monthly and yearly plans renew with UPI AutoPay, credit or debit cards, international cards, or netbanking e-mandate.
        </Text>

        <View
          style={[
            styles.currentBanner,
            {
              backgroundColor: isDark ? primaryRgba(0.16) : colors.primarySoft,
              borderColor: isDark ? primaryRgba(0.3) : primaryRgba(0.18),
            },
          ]}
        >
          <Crown size={18} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.currentLbl, { color: c.muted, fontFamily: snPro('600') }]}>
              Current plan
            </Text>
            <Text style={[styles.currentVal, { color: c.text, fontFamily: snPro('700') }]}>
              {formatPlanLabel(currentPlan, plans)}
            </Text>
            <Text style={[styles.currentLbl, { color: c.muted, fontFamily: snPro('500'), marginTop: 2 }]}>
              {Number(user?.tokenBalance || 0).toLocaleString('en-IN')} tokens left
            </Text>
            <Pressable onPress={() => navigation.navigate('BuyTokens')} style={{ marginTop: 8 }}>
              <Text style={[styles.currentLbl, { color: colors.primary, fontFamily: snPro('700') }]}>
                Buy tokens
              </Text>
            </Pressable>
            {user?.subscription?.endsAt && currentPlan !== 'Free' ? (
              <Text style={[styles.currentLbl, { color: c.muted, fontFamily: snPro('500'), marginTop: 2 }]}>
                {user.subscription.billing === 'yearly' ? '1 year' : '1 month'} · {user.subscription.autoPay ? 'renews' : 'ends'}{' '}
                {formatDate(user.subscription.endsAt)}
              </Text>
            ) : null}
            {user?.subscription?.pending?.planName ? (
              <Text style={[styles.currentLbl, { color: c.muted, fontFamily: snPro('500'), marginTop: 2 }]}>
                {user.subscription.pending.planName} starts{' '}
                {user.subscription.pending.startsAt
                  ? formatDate(user.subscription.pending.startsAt)
                  : 'after this plan ends'}
              </Text>
            ) : null}
          </View>
          {user?.status ? (
            <View style={[styles.statusChip, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
              <Text style={[styles.statusText, { color: colors.primary, fontFamily: snPro('700') }]}>
                {user.status}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.billingToggle, { backgroundColor: c.chip, borderColor: c.border }]}>
          <Pressable
            onPress={() => setBilling('monthly')}
            style={[
              styles.billingBtn,
              billing === 'monthly' && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.billingLbl,
                {
                  color: billing === 'monthly' ? '#FFFFFF' : c.muted,
                  fontFamily: snPro('700'),
                },
              ]}
            >
              Monthly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBilling('yearly')}
            style={[
              styles.billingBtn,
              billing === 'yearly' && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                styles.billingLbl,
                {
                  color: billing === 'yearly' ? '#FFFFFF' : c.muted,
                  fontFamily: snPro('700'),
                },
              ]}
            >
              Yearly
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <LoadingScreen message="Loading plans…" />
        ) : (
          plans.map((plan) => {
            const isCurrent = isCurrentChoice(plan.id);
            const useYearly = billing === 'yearly' && parsePlanAmount(plan.priceYearly) != null;
            const amount = useYearly
              ? parsePlanAmount(plan.priceYearly)
              : parsePlanAmount(plan.priceMonthly) ?? 0;
            const periodLabel = amount === 0 ? null : useYearly ? '/ yr' : '/ mo';
            const currencyCode = useYearly ? plan.yearlyCurrency || 'INR' : plan.monthlyCurrency || 'INR';
            const currencySymbol = currencyCode === 'USD' ? '$' : '₹';
            const savings = useYearly ? yearlySavings(plan) : 0;

            return (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.cardBg,
                    borderColor: plan.highlight
                      ? colors.primary
                      : isCurrent
                        ? primaryRgba(0.45)
                        : c.border,
                  },
                  plan.highlight && styles.cardHighlight,
                ]}
              >
                {plan.highlight ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Sparkles size={12} color="#FFFFFF" />
                    <Text style={[styles.badgeText, { fontFamily: snPro('700') }]}>Popular</Text>
                  </View>
                ) : null}

                <Text style={[styles.planName, { color: c.text, fontFamily: FONT.nova }]}>
                  {plan.name}
                </Text>
                {savings > 0 ? (
                  <Text style={[styles.savings, { color: colors.primary, fontFamily: snPro('600') }]}>
                    Saving ₹{formatInrAmount(savings)} a year
                  </Text>
                ) : (
                  <Text style={[styles.planTag, { color: c.muted, fontFamily: snPro('500') }]}>
                    {plan.tagline}
                  </Text>
                )}

                <View style={styles.priceRow}>
                  <Text style={[styles.currency, { color: c.text, fontFamily: snPro('700') }]}>{currencySymbol}</Text>
                  <Text style={[styles.priceAmount, { color: c.text, fontFamily: snPro('800') }]}>
                    {formatInrAmount(amount)}
                  </Text>
                  {periodLabel ? (
                    <Text style={[styles.pricePeriod, { color: c.muted, fontFamily: snPro('600') }]}>
                      {periodLabel}
                    </Text>
                  ) : null}
                </View>

                {Number(plan.tokenAllowance) > 0 ? (
                  <Text style={[styles.planTag, { color: c.muted, fontFamily: snPro('600'), marginTop: 8 }]}>
                    First purchase adds {Number(plan.tokenAllowance).toLocaleString('en-IN')} tokens
                  </Text>
                ) : null}

                <View style={styles.featureList}>
                  {(plan.features || []).map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <View
                        style={[
                          styles.check,
                          { backgroundColor: isDark ? primaryRgba(0.22) : colors.primarySoft },
                        ]}
                      >
                        <Check size={12} color={colors.primary} strokeWidth={3} />
                      </View>
                      <Text style={[styles.featureText, { color: c.text, fontFamily: snPro('500') }]}>
                        {f}
                      </Text>
                    </View>
                  ))}
                </View>

                <AppButton
                  label={
                    isCurrent
                      ? 'Current plan'
                      : plan.id === 'Free'
                        ? 'Stay on Free'
                        : plan.id === currentPlan
                          ? `Switch to ${billing}`
                          : 'Pay with Razorpay'
                  }
                  onPress={() => onChoose({ ...plan, _amount: amount })}
                  size="lg"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  loading={payingId === plan.id}
                  disabled={isCurrent || Boolean(payingId)}
                />
              </View>
            );
          })
        )}

        <Pressable
          onPress={() => navigation.navigate('PaymentHistory')}
          style={[styles.historyLink, { backgroundColor: c.cardBg, borderColor: c.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.historyLinkTitle, { color: c.text, fontFamily: snPro('700') }]}>
              Payment history
            </Text>
            <Text style={[styles.historyLinkSub, { color: c.muted, fontFamily: snPro('400') }]}>
              See your checkouts and renewals
            </Text>
          </View>
          <ChevronRight size={18} color={c.muted} />
        </Pressable>

        <Text style={[styles.footnote, { color: c.muted, fontFamily: snPro('400') }]}>
          Razorpay renews a paid plan until you cancel it from Payment history. The current period stays active until it ends.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  kicker: { fontSize: 11, letterSpacing: 1.2, marginBottom: 6 },
  title: { fontSize: 28, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  currentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  currentLbl: { fontSize: 11 },
  currentVal: { fontSize: 16, marginTop: 2 },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: { fontSize: 11 },
  billingToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  billingBtn: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
  },
  billingLbl: { fontSize: 13 },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  cardHighlight: { borderWidth: 2 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11 },
  planName: { fontSize: 22, marginBottom: 4 },
  planTag: { fontSize: 13, marginBottom: 10 },
  savings: { fontSize: 13, marginBottom: 10 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 4,
  },
  currency: { fontSize: 22, marginBottom: 4 },
  priceAmount: { fontSize: 36, lineHeight: 40 },
  pricePeriod: { fontSize: 15, marginBottom: 6, marginLeft: 2 },
  featureList: { marginBottom: 16, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20 },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  historyLinkTitle: { fontSize: 15 },
  historyLinkSub: { fontSize: 12, marginTop: 2 },
  footnote: { fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: 'center' },
});
