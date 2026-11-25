import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Lock } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ScreenHeader from '../../components/common/ScreenHeader';
import HealthlineMark from '../../components/common/HealthlineMark';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useFeatureCatalog } from '../../context/FeatureCatalogContext';
import { getBrandContent } from '../../config/brandContent';
import { FONT, snPro } from '../../config/fonts';
import { resolveFeatureIcon } from '../../config/featureIcons';
import { apiFetchPlans } from '../../services/plansService';
import { TAB_ROUTES } from '../../services/featuresService';
import { aiFeaturesForPlan } from '../../config/aiFeatures';
import { toast } from '../../utils/toast';

const cardShadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: {},
});

export default function FeaturesHubScreen({ navigation }) {
  const { isDark, brand, colors, themeColors: c } = useTheme();
  const { user } = useAuth();
  const content = getBrandContent(brand);
  const { ready: catalogReady, hubFeatures, refresh } = useFeatureCatalog();

  const [plans, setPlans] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      const nextPlans = await apiFetchPlans();
      if (active) setPlans(nextPlans);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const unlocked = useMemo(() => {
    const list = aiFeaturesForPlan(user?.plan || 'Free', plans);
    return new Set(list);
  }, [user?.plan, plans]);

  const isLocked = useCallback(
    (item) => {
      if (!item?.aiKey) return false;
      return !unlocked.has(item.aiKey);
    },
    [unlocked]
  );

  const open = (item) => {
    if (isLocked(item)) {
      toast.warning(`Upgrade your plan to unlock ${item.label}`);
      navigation.navigate('Subscription');
      return;
    }
    if (!item.route) {
      toast.info('This feature is coming soon');
      return;
    }
    if (TAB_ROUTES.has(item.route)) {
      navigation.navigate('Main', { screen: item.route });
      return;
    }
    navigation.navigate(item.route, item.params || {});
  };

  const loading = !catalogReady;

  return (
    <ScreenShell>
      <ScreenHeader title="All features" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HealthlineMark height={40} style={styles.mark} />
        <Text style={[styles.kicker, { color: colors.primary, fontFamily: snPro('800') }]}>
          {content.appName.toUpperCase()}
        </Text>
        <Text style={[styles.headline, { color: c.text, fontFamily: FONT.nova }]}>
          Everything in one place
        </Text>
        <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('400') }]}>
          AI tools unlock with your subscription. Inactive features stay hidden.
        </Text>

        {loading ? (
          <LoadingScreen message="Loading features…" />
        ) : (
          <View style={styles.grid}>
            {hubFeatures.map((item) => {
              const locked = isLocked(item);
              const Icon = resolveFeatureIcon(item.icon);
              const tint = item.color || colors.primary;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => open(item)}
                  style={({ pressed }) => [
                    styles.tile,
                    cardShadow,
                    {
                      backgroundColor: c.cardBg,
                      borderColor: c.border,
                      opacity: pressed ? 0.88 : locked ? 0.72 : 1,
                    },
                  ]}
                >
                  <View style={styles.tileTop}>
                    <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
                      <Icon size={22} color={tint} strokeWidth={2.2} />
                    </View>
                    {locked ? (
                      <View style={[styles.lockBadge, { backgroundColor: isDark ? '#2A2A2A' : '#F2F4F7' }]}>
                        <Lock size={12} color={c.muted} />
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.tileLbl, { color: c.text, fontFamily: snPro('600') }]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  {locked ? (
                    <Text style={[styles.lockHint, { color: c.muted, fontFamily: snPro('500') }]}>
                      Upgrade
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  mark: { marginTop: 4, marginBottom: 8 },
  kicker: { fontSize: 10, letterSpacing: 1.2 },
  headline: { fontSize: 26, marginTop: 6, letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 108,
    gap: 10,
  },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLbl: { fontSize: 13, lineHeight: 18 },
  lockHint: { fontSize: 11, marginTop: -4 },
});
