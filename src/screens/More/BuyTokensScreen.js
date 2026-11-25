import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Coins } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { formatInrAmount } from '../../config/plans';
import { apiFetchTokenPacks, apiCreateRazorpayOrder } from '../../services/subscriptionService';
import { openRazorpayCheckout } from '../../utils/openRazorpayCheckout';
import { apiMe } from '../../services/authService';
import { toast } from '../../utils/toast';

export default function BuyTokensScreen({ navigation }) {
  const { isDark, themeColors: c, primaryRgba } = useTheme();
  const { user, accessToken, setAccount } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const next = await apiFetchTokenPacks();
    setPacks(next);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
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
    }, [accessToken, load, setAccount])
  );

  const balance = Number(user?.tokenBalance || 0).toLocaleString('en-IN');

  return (
    <ScreenShell>
      <ScreenHeader title="Buy tokens" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.balance,
            {
              backgroundColor: isDark ? primaryRgba(0.16) : colors.primarySoft,
              borderColor: isDark ? primaryRgba(0.3) : primaryRgba(0.18),
            },
          ]}
        >
          <Coins size={22} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.balanceLbl, { color: c.muted, fontFamily: snPro('600') }]}>Tokens left</Text>
            <Text style={[styles.balanceVal, { color: c.text, fontFamily: FONT.nova }]}>{balance}</Text>
          </View>
        </View>

        <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('400') }]}>
          Extra tokens are added to this balance. Your plan stays the same. This is a one-time payment with UPI, cards, net banking, or a wallet.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          packs.map((pack) => (
            <View
              key={pack.id}
              style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <Text style={[styles.packName, { color: c.text, fontFamily: snPro('700') }]}>{pack.name}</Text>
              <Text style={[styles.packMeta, { color: c.muted, fontFamily: snPro('500') }]}>
                {Number(pack.tokens).toLocaleString('en-IN')} tokens · ₹{formatInrAmount(pack.price)}
              </Text>
              <AppButton
                label="Pay with Razorpay"
                loading={payingId === pack.id}
                disabled={Boolean(payingId)}
                onPress={async () => {
                  if (payingId) return;
                  if (!accessToken) {
                    toast.error('Sign in to continue.');
                    return;
                  }
                  setPayingId(pack.id);
                  try {
                    const data = await apiCreateRazorpayOrder(accessToken, { kind: 'tokens', packId: pack.id });
                    await openRazorpayCheckout(data, {
                      accessToken,
                      onPaid: (nextUser) => setAccount(nextUser),
                    });
                  } catch (err) {
                    toast.error(err.message || 'Unable to start Razorpay checkout.');
                  } finally {
                    setPayingId('');
                  }
                }}
                size="lg"
              />
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  balanceLbl: { fontSize: 13 },
  balanceVal: { fontSize: 32, marginTop: 2 },
  sub: { marginTop: 14, marginBottom: 8, fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 12 },
  packName: { fontSize: 18 },
  packMeta: { marginTop: 4, marginBottom: 14, fontSize: 14 },
});
