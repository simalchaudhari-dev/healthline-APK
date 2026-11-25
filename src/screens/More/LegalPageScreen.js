import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Shield, Scale } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import BrandLogo from '../../components/common/BrandLogo';
import { useTheme } from '../../context/ThemeContext';
import { themeColors, colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import { fetchLegalPage } from '../../services/legalService';
import AppButton from '../../components/common/AppButton';
import { formatDate } from '../../utils/formatDate';

/** Shown only while loading or when the page can't be fetched — the real text comes from Admin Panel. */
const FALLBACK = {
  privacy: { title: 'Privacy policy', subtitle: 'Your data stays yours' },
  terms: { title: 'Terms and conditions', subtitle: 'Using HealthLine Nutrition' },
};

function formatUpdated(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDate(date);
}

export default function LegalPageScreen({ navigation, pageKey }) {
  const { isDark, primaryRgba } = useTheme();
  const c = themeColors(isDark);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const Icon = pageKey === 'terms' ? Scale : Shield;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchLegalPage(pageKey).then((next) => {
      if (!active) return;
      if (next) setPage(next);
      else setFailed(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [pageKey, attempt]);

  const shown = page || FALLBACK[pageKey];
  const updated = formatUpdated(shown.updatedAt);

  return (
    <ScreenShell>
      <ScreenHeader title={shown.title || FALLBACK[pageKey].title} onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.brandCard, cardShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <BrandLogo size={52} showName />
        </View>

        <View style={[styles.hero, { backgroundColor: isDark ? primaryRgba(0.14) : colors.primarySoft, borderColor: c.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft }]}>
            <Icon size={22} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: c.text, fontFamily: snPro('700') }]}>
              {shown.subtitle || FALLBACK[pageKey].subtitle}
            </Text>
            {updated ? (
              <Text style={[styles.heroSub, { color: c.muted, fontFamily: snPro('400') }]}>Updated {updated}</Text>
            ) : null}
          </View>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} /> : null}

        {failed && !loading && !page ? (
          <View style={[styles.block, { backgroundColor: c.cardBg, borderColor: c.border, alignItems: 'center' }]}>
            <Text style={[styles.blockTitle, { color: c.text, fontFamily: snPro('700'), textAlign: 'center' }]}>
              Couldn't load this page
            </Text>
            <Text style={[styles.blockBody, { color: c.muted, fontFamily: snPro('400'), textAlign: 'center' }]}>
              Check your internet connection and try again.
            </Text>
            <AppButton label="Try again" variant="secondary" onPress={() => setAttempt((n) => n + 1)} style={{ marginTop: 14 }} />
          </View>
        ) : null}

        {shown.intro ? (
          <Text style={[styles.intro, { color: c.text, fontFamily: snPro('400') }]}>{shown.intro}</Text>
        ) : null}

        {(shown.sections || []).map((section) => (
          <View
            key={`${section.title}-${String(section.body || '').slice(0, 24)}`}
            style={[styles.block, cardShadow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            {section.title ? (
              <Text style={[styles.blockTitle, { color: c.text, fontFamily: snPro('700') }]}>{section.title}</Text>
            ) : null}
            {section.body ? (
              <Text style={[styles.blockBody, { color: c.muted, fontFamily: snPro('400') }]}>{section.body}</Text>
            ) : null}
          </View>
        ))}

        {shown.footer ? (
          <Text style={[styles.footer, { color: c.muted, fontFamily: snPro('400') }]}>{shown.footer}</Text>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 1 },
  default: {},
});

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  brandCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 16 },
  heroSub: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  intro: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  block: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  blockTitle: { fontSize: 15, marginBottom: 8 },
  blockBody: { fontSize: 13, lineHeight: 20 },
  footer: { fontSize: 12, lineHeight: 18, marginTop: 8 },
});
