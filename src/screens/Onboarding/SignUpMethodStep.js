import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, Mail, UserPlus } from 'lucide-react-native';
import { FONT, snPro } from '../../config/fonts';
import GoogleButton from '../../components/common/GoogleButton';
import { useOnboardColors } from './onboardColors';

/**
 * Onboarding "Create your account" — shown after the language screen. Light and dark mode.
 * Google: pick an account first, then the same profile steps with the name filled in.
 * Email: the profile steps, then the email + password form.
 */
export default function SignUpMethodStep({
  onBack,
  onGoogle,
  onEmail,
  onSignIn,
  onTerms,
  onPrivacy,
  googleLoading,
  topPad = 0,
  bottomPad = 16,
}) {
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

        <View style={styles.headRow}>
          <View style={[styles.badge, { backgroundColor: C.soft, borderColor: C.softBorder }]}>
            <UserPlus size={26} color={C.accent} strokeWidth={2.2} />
          </View>
          <View style={styles.headText}>
            <Text style={[styles.title, { color: C.ink, fontFamily: FONT.nova }]}>Create your account</Text>
            <Text style={[styles.sub, { color: C.muted, fontFamily: snPro('400') }]}>
              Choose how to sign up. Next, a few quick questions build your plan.
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.line, shadowColor: C.shadow }]}>
          <GoogleButton onPress={onGoogle} loading={googleLoading} />
          <Text style={[styles.cardHint, { color: C.muted, fontFamily: snPro('500') }]}>
            No password needed — just pick your Google account.
          </Text>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: C.line }]} />
            <Text style={[styles.orText, { color: C.muted, fontFamily: snPro('600') }]}>or</Text>
            <View style={[styles.orLine, { backgroundColor: C.line }]} />
          </View>

          <Pressable
            onPress={onEmail}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.emailBtn,
              { borderColor: C.accent, backgroundColor: C.cardOn },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Mail size={18} color={C.accentStrong} strokeWidth={2.4} />
            <Text style={[styles.emailText, { color: C.accentStrong, fontFamily: snPro('800') }]}>
              Continue with Email
            </Text>
            <ChevronRight size={18} color={C.accentStrong} strokeWidth={2.4} />
          </Pressable>
          <Text style={[styles.cardHint, { color: C.muted, fontFamily: snPro('500') }]}>
            Sign up with your email and create a password.
          </Text>
        </View>

        <Text style={[styles.terms, { color: C.muted, fontFamily: snPro('500') }]}>
          By continuing you agree to the{' '}
          <Text onPress={onTerms} style={{ color: C.accent, fontFamily: snPro('800') }}>
            Terms of Use
          </Text>{' '}
          and{' '}
          <Text onPress={onPrivacy} style={{ color: C.accent, fontFamily: snPro('800') }}>
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>

      <Pressable onPress={onSignIn} style={styles.signinRow} accessibilityRole="link">
        <Text style={[styles.signinText, { color: C.muted, fontFamily: snPro('500') }]}>
          Already have an account?
          <Text style={{ color: C.accent, fontFamily: snPro('800') }}> Sign in</Text>
        </Text>
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
  badge: {
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
  card: {
    marginTop: 28,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardHint: { marginTop: 8, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12 },
  emailBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emailText: { fontSize: 15 },
  terms: { marginTop: 18, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  signinRow: { alignItems: 'center', paddingVertical: 10 },
  signinText: { fontSize: 13 },
});
