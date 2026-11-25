import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { APP_LANGUAGES, languageById } from '../../config/languages';
import { selectReplyLanguage, useReplyLanguage } from '../../utils/replyLanguage';
import { toast } from '../../utils/toast';

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

/** The one app language (same as onboarding). Saved to the account and used across the app. */
export default function LanguageScreen({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const { accessToken } = useAuth();
  const language = useReplyLanguage();

  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const tileBg = isDark ? '#1A2A1A' : colors.primarySoft;

  const pickLanguage = (id) => {
    if (id === language) return;
    selectReplyLanguage(id, accessToken)
      .then(() => toast.success(`Language set to ${languageById(id).native}`))
      .catch(() => toast.error('Could not save the language. Try again.'));
  };

  const radio = (on) => (
    <View style={[styles.radio, { borderColor: on ? colors.primary : isDark ? c.border : '#cfe3c7' }]}>
      {on ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
    </View>
  );

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.back, CARD_SHADOW, { backgroundColor: c.cardBg }]}
          >
            <ChevronLeft size={20} color={isDark ? c.text : colors.primaryDark} strokeWidth={2.6} />
          </Pressable>
          <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>Language</Text>
        </View>

        <Text style={[styles.kicker, { color: muted, fontFamily: snPro('700') }]}>CHOOSE YOUR LANGUAGE</Text>
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {APP_LANGUAGES.map((l) => {
            const on = language === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => pickLanguage(l.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [
                  styles.card,
                  CARD_SHADOW,
                  {
                    backgroundColor: on ? tileBg : c.cardBg,
                    borderColor: on ? colors.primary : isDark ? c.border : 'transparent',
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                {radio(on)}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.native, { color: ink, fontFamily: poppins('600') }]}>{l.native}</Text>
                  <Text style={[styles.english, { color: muted, fontFamily: snPro('400') }]}>{l.english}</Text>
                </View>
                <Text style={[styles.sample, { color: colors.primary, fontFamily: snPro('800') }]}>{l.sample}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: muted, fontFamily: snPro('400') }]}>
          One language for the whole app: AI Coach, Medicare, recipes, workout tips, report explanations and voice
          food logging. Saved to your account, so it stays the same on every phone.
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, lineHeight: 26 },
  kicker: { fontSize: 11, letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  native: { fontSize: 16, lineHeight: 22 },
  english: { fontSize: 12, marginTop: 1 },
  sample: { fontSize: 13 },
  note: { fontSize: 12, lineHeight: 17 },
});
