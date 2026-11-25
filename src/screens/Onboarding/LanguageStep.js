import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, ChevronRight, Info } from 'lucide-react-native';
import { FONT, snPro } from '../../config/fonts';
import { APP_LANGUAGES } from '../../config/languages';
import { useOnboardColors } from './onboardColors';

function GlobeIcon({ color }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
    </Svg>
  );
}

/** Onboarding "Choose your language" — shown after the welcome screen. Light and dark mode. */
export default function LanguageStep({ value, onChange, onBack, onContinue, topPad = 0, bottomPad = 16 }) {
  const C = useOnboardColors();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: C.bg, paddingTop: Math.max(topPad, 12) + 12, paddingBottom: bottomPad },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={onBack}
          style={[styles.back, { backgroundColor: C.backBg, shadowColor: C.shadow }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color={C.backIcon} strokeWidth={2.6} />
        </Pressable>

        {/* Globe on the left, title + hint on the right — one row. */}
        <View style={styles.headRow}>
          <View style={[styles.globe, { backgroundColor: C.soft, borderColor: C.softBorder }]}>
            <GlobeIcon color={C.accent} />
          </View>
          <View style={styles.headText}>
            <Text style={[styles.title, { color: C.ink, fontFamily: FONT.nova }]}>Choose your language</Text>
            <Text style={[styles.sub, { color: C.muted, fontFamily: snPro('400') }]}>
              You can change this any time in Settings.
            </Text>
          </View>
        </View>

        <View style={styles.list} accessibilityRole="radiogroup">
          {APP_LANGUAGES.map((l) => {
            const on = value === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => onChange(l.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [
                  styles.card,
                  on ? styles.cardOn : styles.cardOff,
                  {
                    backgroundColor: on ? C.cardOn : C.card,
                    borderColor: on ? C.accent : C.line,
                    shadowColor: on ? C.fill : C.shadow,
                  },
                  pressed && styles.cardPressed,
                ]}
              >
                {/* Letter badge shows the script at a glance. */}
                <View style={[styles.badge, { backgroundColor: on ? C.fill : C.badge }]}>
                  <Text
                    style={[styles.badgeText, { color: on ? '#FFFFFF' : C.accentStrong, fontFamily: snPro('800') }]}
                  >
                    {l.sample}
                  </Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.native, { color: C.ink, fontFamily: snPro('800') }]}>{l.native}</Text>
                  <Text style={[styles.english, { color: C.muted, fontFamily: snPro('500') }]}>{l.english}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    on ? { backgroundColor: C.fill } : { borderWidth: 2, borderColor: C.radioOff },
                  ]}
                >
                  {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.note, { backgroundColor: C.note }]}>
          <Info size={16} color={C.accent} strokeWidth={2.2} />
          <Text style={[styles.noteText, { color: C.muted, fontFamily: snPro('500') }]}>
            Food names, reports and AI Assist answers will appear in your chosen language where available.
          </Text>
        </View>
      </ScrollView>

      <Pressable
        onPress={onContinue}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        <LinearGradient
          colors={['#358a3a', '#2a7430']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.ctaGrad}
        >
          <Text style={[styles.ctaText, { fontFamily: snPro('800') }]}>Continue</Text>
          <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.6} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  scroll: { paddingBottom: 16 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 14 },
  globe: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 23, lineHeight: 28 },
  sub: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  list: { marginTop: 24, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  cardOn: {
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardOff: {
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardPressed: { transform: [{ scale: 0.98 }] },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 16 },
  cardText: { flex: 1, minWidth: 0 },
  native: { fontSize: 17 },
  english: { fontSize: 12.5, marginTop: 1 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  cta: {
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ctaGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#FFFFFF', fontSize: 16.5 },
});
