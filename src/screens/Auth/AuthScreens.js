import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { Check, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Fingerprint, Info, Lock, Mail, ScanFace, User } from 'lucide-react-native';
import { colors } from '../../config/colors';
import { FONT, snPro, poppins } from '../../config/fonts';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useDiary } from '../../context/DiaryContext';
import AppButton from '../../components/common/AppButton';
import AppInput from '../../components/common/AppInput';
import PhoneInput from '../../components/common/PhoneInput';
import OtpInput from '../../components/common/OtpInput';
import HealthlineMark from '../../components/common/HealthlineMark';
import { SafeAreaTop } from '../../components/common/ScreenShell';
import { useSafeTop } from '../../utils/safeArea';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARD_KEY } from '../../config/storageKeys';
import {
  validateEmail,
  validateName,
  validatePassword,
  validateLoginPassword,
  validateConfirmPassword,
  validatePhoneNumber,
  PASSWORD_MIN,
  PASSWORD_MAX,
} from '../../utils/validation';
import { applyHealthProfileToDiary } from '../../utils/applyHealthProfile';
import GoogleButton from '../../components/common/GoogleButton';
import { useConfirm } from '../../context/ConfirmContext';
import { BIOMETRIC_SUPPORTED, BIOMETRIC_NOTE } from '../../utils/biometric';

/** Auth screens follow the design canvas: soft green page, round back button, white fields. */
const AUTH = {
  bg: '#f2f8ef',
  ink: '#0d1b2a',
  body: '#374151',
  muted: '#4b5563',
  soft: '#e2f2dc',
  info: 'rgba(226,240,220,0.75)',
};

function useAuthColors() {
  const { isDark, themeColors: c } = useTheme();
  return {
    isDark,
    bg: isDark ? c.pageBg : AUTH.bg,
    ink: isDark ? c.text : AUTH.ink,
    body: isDark ? c.text : AUTH.body,
    muted: isDark ? c.muted : AUTH.muted,
    card: isDark ? c.cardBg : '#FFFFFF',
    soft: isDark ? c.chip : AUTH.soft,
    info: isDark ? c.chip : AUTH.info,
  };
}

function LockBadge() {
  const a = useAuthColors();
  return (
    <View style={[styles.lockOuter, { backgroundColor: a.soft }]}>
      <View style={[styles.lockInner, { backgroundColor: a.card }]}>
        <Svg
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Rect x="4" y="10" width="16" height="11" rx="2.5" />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <Circle cx="12" cy="15.5" r="1.4" fill={colors.primary} />
        </Svg>
      </View>
    </View>
  );
}

/**
 * Shared layout. `badge`: 'logo' | 'lock' | undefined — a badge centers the heading.
 * `children` holds the form and its main button; `footer` is the link pinned at the bottom.
 */
function AuthScaffold({ children, title, sub, onBack, footer, badge }) {
  const a = useAuthColors();
  const topPad = useSafeTop();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);
  const centered = !!badge;

  return (
    <View style={[styles.root, { backgroundColor: a.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.safe, { paddingBottom: bottomPad }]}>
          <SafeAreaTop color="transparent" />
          {topPad <= 0 ? <View style={{ height: Platform.OS === 'web' ? 36 : 8 }} /> : null}

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={6}
                style={[styles.backBtn, { backgroundColor: a.card }]}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <ChevronLeft size={20} color={a.isDark ? a.ink : '#1e5e24'} strokeWidth={2.6} />
              </Pressable>
            ) : null}

            <View style={[styles.head, centered && styles.headCenter]}>
              {badge === 'logo' ? <HealthlineMark height={56} /> : null}
              {badge === 'lock' ? <LockBadge /> : null}
              <Text
                style={[
                  styles.title,
                  { color: a.ink, fontFamily: FONT.heading },
                  centered && styles.textCenter,
                  badge === 'lock' && styles.titleAfterLock,
                ]}
              >
                {title}
              </Text>
              {sub ? (
                <Text
                  style={[styles.sub, { color: a.muted, fontFamily: snPro('400') }, centered && styles.textCenter]}
                >
                  {sub}
                </Text>
              ) : null}
            </View>

            <View style={styles.form}>{children}</View>
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** "Question? Action" link at the bottom of auth screens. */
function BottomLink({ question, action, onPress, disabled }) {
  const a = useAuthColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.linkWrap} accessibilityRole="link">
      <Text style={[styles.link, { color: a.body, fontFamily: snPro('400') }]}>
        {question}{' '}
        <Text style={{ color: disabled ? a.muted : colors.primary, fontFamily: poppins('600') }}>{action}</Text>
      </Text>
    </Pressable>
  );
}

function CheckRow({ checked, onToggle, error, children }) {
  const a = useAuthColors();
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.checkRow, { backgroundColor: a.info }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.checkBox,
          {
            borderColor: checked ? colors.primary : error ? colors.danger : '#9ca3af',
            backgroundColor: checked ? colors.primary : a.card,
          },
        ]}
      >
        {checked ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.checkText, { color: a.body, fontFamily: snPro('400') }]}>{children}</Text>
    </Pressable>
  );
}

/** White card with a small icon + title — groups related fields (matches onboarding). */
function AuthSection({ Icon, title, children }) {
  const a = useAuthColors();
  return (
    <View style={[styles.section, { backgroundColor: a.card, borderColor: a.isDark ? a.soft : '#cfe3c7' }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: a.soft }]}>
          <Icon size={15} color={colors.primary} strokeWidth={2.4} />
        </View>
        <Text style={[styles.sectionTitle, { color: a.ink, fontFamily: snPro('800') }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** Thin line with a word in the middle ("or"). */
function OrDivider({ label = 'or' }) {
  const a = useAuthColors();
  const line = { backgroundColor: a.isDark ? a.soft : '#d7e6d1' };
  return (
    <View style={styles.orRow}>
      <View style={[styles.orLine, line]} />
      <Text style={[styles.orText, { color: a.muted, fontFamily: snPro('600') }]}>{label}</Text>
      <View style={[styles.orLine, line]} />
    </View>
  );
}

/** "Sign in as <name>" with the phone's fingerprint / face — shown when set up on this phone. */
function BiometricCard({ name, label, onPress, loading }) {
  const a = useAuthColors();
  const Icon = /face/i.test(label) && !/finger/i.test(label) ? ScanFace : Fingerprint;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`Sign in as ${name} with ${label}`}
      style={({ pressed }) => [
        styles.bioCard,
        { backgroundColor: a.card, borderColor: a.isDark ? a.soft : '#cfe3c7' },
        (pressed || loading) && { opacity: 0.75 },
      ]}
    >
      <View style={[styles.bioIcon, { backgroundColor: a.soft }]}>
        <Icon size={26} color={colors.primary} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.bioTitle, { color: a.ink, fontFamily: snPro('800') }]} numberOfLines={1}>
          Sign in as {name}
        </Text>
        <Text style={[styles.bioSub, { color: a.muted, fontFamily: snPro('500') }]}>
          {loading ? 'Checking…' : `Use ${label.toLowerCase()}`}
        </Text>
      </View>
      <ChevronRight size={18} color={a.muted} strokeWidth={2.4} />
    </Pressable>
  );
}

/**
 * After a normal sign-in on a phone with fingerprint / face set up: offer it once per account.
 * Runs after the app has opened (the confirm dialog is app-wide).
 */
async function offerBiometric({ user, biometric, enableBiometric, confirm }) {
  if (!BIOMETRIC_SUPPORTED || !user?.id || !biometric?.available) return;
  if (biometric.user?.userId === user.id) return; // already on for this account
  const askedKey = `healthline.bioOffer.${user.id}`;
  try {
    if (await AsyncStorage.getItem(askedKey)) return;
    await AsyncStorage.setItem(askedKey, '1');
  } catch {
    return;
  }
  const ok = await confirm({
    title: `Sign in with ${biometric.label.toLowerCase()}?`,
    message: `${
      biometric.user
        ? `Next time, sign in on this phone with your ${biometric.label.toLowerCase()}. This replaces ${biometric.user.name || 'the other account'} on this phone.`
        : `Next time, sign in on this phone with your ${biometric.label.toLowerCase()} — no password needed.`
    }\n\n${BIOMETRIC_NOTE}\n\nYou can turn it off in More → Preferences.`,
    confirmLabel: 'Turn on',
    cancelLabel: 'Not now',
    destructive: false,
  });
  if (ok) await enableBiometric();
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.formError}>
      <CircleAlert size={16} color={colors.danger} />
      <Text style={[styles.formErrorText, { fontFamily: snPro('600') }]}>{message}</Text>
    </View>
  );
}

export function SignUpScreen({ navigation, route, onRegistered }) {
  const { signUp, signInWithGoogle } = useAuth();
  const { updateProfile, setGoal, updateReminder, profile, goal, reminders } = useDiary();
  const onboardProfile = route?.params?.profile || null;
  const [firstName, setFirstName] = useState(route?.params?.firstName || '');
  const [lastName, setLastName] = useState(route?.params?.lastName || '');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('IN');
  const [phoneNational, setPhoneNational] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '', agreed: '' });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [googleLoading, setGoogleLoading] = useState(false);

  const setField = (key, value, extra = {}) => {
    if (key === 'firstName') setFirstName(value);
    if (key === 'lastName') setLastName(value);
    if (key === 'email') setEmail(value);
    if (key === 'phone') {
      setPhoneNumber(value);
      if (extra.country) setPhoneCountry(extra.country);
      if (extra.national !== undefined) setPhoneNational(extra.national);
    }
    if (key === 'password') setPassword(value);
    if (key === 'confirm') setConfirm(value);
    setFormError('');
    const countryForPhone = extra.country || phoneCountry;
    const nationalForPhone = extra.national !== undefined ? extra.national : phoneNational;
    if (touched[key] || errors[key]) {
      setErrors((prev) => ({
        ...prev,
        firstName: key === 'firstName' ? validateName(value, 'First name') : prev.firstName,
        lastName: key === 'lastName' ? validateName(value, 'Last name') : prev.lastName,
        email: key === 'email' ? validateEmail(value) : prev.email,
        phone:
          key === 'phone'
            ? validatePhoneNumber(value, countryForPhone, nationalForPhone)
            : prev.phone,
        password: key === 'password' ? validatePassword(value) : prev.password,
        confirm:
          key === 'confirm' || key === 'password'
            ? validateConfirmPassword(key === 'password' ? value : password, key === 'confirm' ? value : confirm)
            : prev.confirm,
      }));
    }
  };

  const touch = (key) => setTouched((prev) => ({ ...prev, [key]: true }));

  const validateAll = () => {
    const next = {
      firstName: validateName(firstName, 'First name'),
      lastName: validateName(lastName, 'Last name'),
      email: validateEmail(email),
      phone: validatePhoneNumber(phoneNumber, phoneCountry, phoneNational),
      password: validatePassword(password),
      confirm: validateConfirmPassword(password, confirm),
      agreed: agreed ? '' : 'Please accept the Terms of Use and Privacy Policy.',
    };
    setErrors(next);
    setTouched({ firstName: true, lastName: true, email: true, phone: true, password: true, confirm: true });
    return !next.firstName && !next.lastName && !next.email && !next.phone && !next.password && !next.confirm && !next.agreed;
  };

  // Prefer onboarding route payload; fall back to diary prefs filled during steps
  const buildProfilePayload = () =>
      onboardProfile ||
      (profile
        ? {
            sex: profile.sex || '',
            age: Number(profile.age) || 30,
            heightCm: Number(profile.heightCm) || 168,
            activity: profile.activity || 'Moderate',
            goal: goal || 'lose',
            calories: Number(profile.calories) || 2200,
            protein: Number(profile.protein) || 140,
            carbs: Number(profile.carbs) || 220,
            fat: Number(profile.fat) || 73,
            waterGoal: Number(profile.waterGoal) || 8,
            weight: Number(profile.weight) || 72,
            goalWeight: Number(profile.goalWeight) || 68,
            diet: Array.isArray(profile.diet) ? profile.diet : [],
            allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
            conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
            focusGoals: Array.isArray(profile.focusGoals) ? profile.focusGoals : [],
            workoutLevel: profile.workoutLevel || '',
            workoutRoutine: profile.workoutRoutine || '',
            reminders: {
              breakfast: reminders?.breakfast,
              lunch: reminders?.lunch,
              dinner: reminders?.dinner,
              water: reminders?.water,
              weighIn: reminders?.weighIn,
            },
          }
        : undefined);

  /** Same finish as email sign-up: copy the profile into the diary, then open the app. */
  const finishRegistration = async (user, profilePayload, names) => {
    applyHealthProfileToDiary(
      { updateProfile, setGoal, updateReminder },
      {
        user,
        profile: profilePayload || user?.profile,
        firstName: names.firstName,
        lastName: names.lastName,
      }
    );

    if (onRegistered) {
      await onRegistered();
      return;
    }
    try {
      await AsyncStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      // continue
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const onGoogle = async () => {
    setFormError('');
    const profilePayload = buildProfilePayload();
    setGoogleLoading(true);
    const res = await signInWithGoogle({ profile: profilePayload });
    setGoogleLoading(false);
    if (!res.ok) {
      if (!res.cancelled && res.error) setFormError(res.error);
      return;
    }
    // An existing account keeps its own saved profile — only a new one takes onboarding answers.
    await finishRegistration(res.user, res.isNew ? profilePayload : null, {
      firstName: res.user?.firstName || '',
      lastName: res.user?.lastName || '',
    });
  };

  const onSubmit = async () => {
    setFormError('');
    if (!validateAll()) return;

    const profilePayload = buildProfilePayload();

    setLoading(true);
    const res = await signUp({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      profile: profilePayload,
    });
    setLoading(false);
    if (!res.ok) {
      if (/email/i.test(res.error || '')) setErrors((p) => ({ ...p, email: res.error }));
      else setFormError(res.error);
      return;
    }

    await finishRegistration(res.user, profilePayload, { firstName, lastName });
  };

  return (
    <AuthScaffold
      title="Create your account"
      sub={
        onboardProfile
          ? 'Your preferences are saved. Add your details to finish.'
          : 'One account for your meals, workouts and health records.'
      }
      onBack={() => navigation.goBack()}
      footer={
        <BottomLink
          question="Already have an account?"
          action="Sign in"
          onPress={() => navigation.navigate('SignIn')}
        />
      }
    >
      {onboardProfile ? (
        <View style={[styles.savedChip, { backgroundColor: AUTH.soft }]}>
          <CircleCheck size={16} color={colors.primary} strokeWidth={2.4} />
          <Text style={[styles.savedText, { fontFamily: snPro('700') }]}>Health profile saved — 3 of 3 steps done</Text>
        </View>
      ) : null}

      {/* Android app: native Google picker. Web: Google popup. */}
      <GoogleButton onPress={onGoogle} loading={googleLoading} label="Sign up with Google" />
      <Text style={[styles.googleNote, { fontFamily: snPro('500') }]}>
        By continuing with Google you agree to the{' '}
        <Text onPress={() => navigation.navigate('Terms')} style={styles.googleNoteLink}>
          Terms of Use
        </Text>{' '}
        and{' '}
        <Text onPress={() => navigation.navigate('PrivacyPolicy')} style={styles.googleNoteLink}>
          Privacy Policy
        </Text>
        .
      </Text>
      <OrDivider label="or sign up with email" />

      <AuthSection Icon={User} title="Your details">
      <View style={styles.row2}>
        <AppInput
          tone="soft"
          style={styles.row2Col}
          label="First name"
          value={firstName}
          onChangeText={(v) => setField('firstName', v)}
          onBlur={() => {
            touch('firstName');
            setErrors((p) => ({ ...p, firstName: validateName(firstName, 'First name') }));
          }}
          error={touched.firstName ? errors.firstName : ''}
          placeholder="First name"
          autoCapitalize="words"
          textContentType="givenName"
          autoComplete="given-name"
        />
        <AppInput
          tone="soft"
          style={styles.row2Col}
          label="Last name"
          value={lastName}
          onChangeText={(v) => setField('lastName', v)}
          onBlur={() => {
            touch('lastName');
            setErrors((p) => ({ ...p, lastName: validateName(lastName, 'Last name') }));
          }}
          error={touched.lastName ? errors.lastName : ''}
          placeholder="Last name"
          autoCapitalize="words"
          textContentType="familyName"
          autoComplete="family-name"
        />
      </View>
      </AuthSection>

      <AuthSection Icon={Mail} title="Contact">
      <AppInput
        tone="soft"
        label="Email"
        value={email}
        onChangeText={(v) => setField('email', v)}
        onBlur={() => {
          touch('email');
          setErrors((p) => ({ ...p, email: validateEmail(email) }));
        }}
        placeholder="you@example.com"
        error={touched.email ? errors.email : ''}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <PhoneInput
        tone="soft"
        label="Mobile number"
        value={phoneNumber}
        onChangeText={(v, code, national) =>
          setField('phone', v, { country: code, national: national || '' })
        }
        onCountryChange={setPhoneCountry}
        onBlur={(e164, code, national) => {
          touch('phone');
          if (code) setPhoneCountry(code);
          if (e164 !== undefined) setPhoneNumber(e164);
          if (national !== undefined) setPhoneNational(national);
          setErrors((p) => ({
            ...p,
            phone: validatePhoneNumber(
              e164 ?? phoneNumber,
              code || phoneCountry,
              national ?? phoneNational
            ),
          }));
        }}
        placeholder="Enter mobile number"
        defaultCountry="IN"
        error={touched.phone ? errors.phone : ''}
      />
      </AuthSection>

      <AuthSection Icon={Lock} title="Secure your account">
      <AppInput
        tone="soft"
        label="Password"
        value={password}
        onChangeText={(v) => setField('password', v)}
        onBlur={() => {
          touch('password');
          setErrors((p) => ({
            ...p,
            password: validatePassword(password),
            confirm: touched.confirm ? validateConfirmPassword(password, confirm) : p.confirm,
          }));
        }}
        placeholder={`At least ${PASSWORD_MIN} characters`}
        secure
        showStrength
        maxLength={PASSWORD_MAX}
        error={touched.password ? errors.password : ''}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <AppInput
        tone="soft"
        label="Confirm password"
        value={confirm}
        onChangeText={(v) => setField('confirm', v)}
        onBlur={() => {
          touch('confirm');
          setErrors((p) => ({ ...p, confirm: validateConfirmPassword(password, confirm) }));
        }}
        placeholder="Type it again"
        secure
        maxLength={PASSWORD_MAX}
        error={touched.confirm ? errors.confirm : ''}
        textContentType="newPassword"
        autoComplete="new-password"
        style={{ marginBottom: 0 }}
      />
      </AuthSection>

      <CheckRow
        checked={agreed}
        error={!!errors.agreed}
        onToggle={() => {
          setAgreed((v) => !v);
          setErrors((p) => ({ ...p, agreed: '' }));
        }}
      >
        I agree to the{' '}
        <Text
          onPress={() => navigation.navigate('Terms')}
          style={{ color: colors.primary, fontFamily: snPro('700') }}
        >
          Terms of Use
        </Text>{' '}
        and{' '}
        <Text
          onPress={() => navigation.navigate('PrivacyPolicy')}
          style={{ color: colors.primary, fontFamily: snPro('700') }}
        >
          Privacy Policy
        </Text>
        .
      </CheckRow>
      {errors.agreed ? (
        <Text style={[styles.fieldError, { fontFamily: snPro('600') }]}>{errors.agreed}</Text>
      ) : null}

      <FormError message={formError} />
      <AppButton label="Create account" onPress={onSubmit} loading={loading} size="lg" style={styles.cta} />
    </AuthScaffold>
  );
}

export function SignInScreen({ navigation }) {
  const { signIn, signInWithGoogle, checkGoogleAccount, biometric, enableBiometric, signInWithBiometric } = useAuth();
  const { confirm } = useConfirm();
  const [bioLoading, setBioLoading] = useState(false);
  const showBio = BIOMETRIC_SUPPORTED && biometric?.available && !!biometric?.user;
  const { updateProfile, setGoal, updateReminder } = useDiary();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [googleLoading, setGoogleLoading] = useState(false);

  const validateAll = () => {
    const next = {
      email: validateEmail(email),
      password: validateLoginPassword(password),
    };
    setErrors(next);
    setTouched({ email: true, password: true });
    return !next.email && !next.password;
  };

  const onSubmit = async () => {
    setFormError('');
    if (!validateAll()) return;

    setLoading(true);
    const res = await signIn({ email, password });
    setLoading(false);
    if (!res.ok) {
      if (/password/i.test(res.error || '')) setErrors((p) => ({ ...p, password: res.error }));
      else if (/email|account|found/i.test(res.error || '')) setErrors((p) => ({ ...p, email: res.error }));
      else setFormError(res.error);
      return;
    }
    await openApp(res.user);
    offerBiometric({ user: res.user, biometric, enableBiometric, confirm }).catch(() => {});
  };

  const onBiometric = async () => {
    setFormError('');
    setBioLoading(true);
    const res = await signInWithBiometric();
    setBioLoading(false);
    if (!res.ok) {
      if (!res.cancelled && res.error) setFormError(res.error);
      return;
    }
    await openApp(res.user);
  };

  // Like Google Pay: when fingerprint sign-in is set up, ask for it as soon as the screen opens.
  const bioAsked = React.useRef(false);
  useEffect(() => {
    if (!showBio || bioAsked.current) return;
    bioAsked.current = true;
    onBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBio]);

  const openApp = async (user) => {
    applyHealthProfileToDiary(
      { updateProfile, setGoal, updateReminder },
      { user }
    );
    try {
      await AsyncStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      // AuthProvider remounts navigator to Main when signed in
    }
    // Navigator remounts to Main via isSignedIn; keep reset as fallback.
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  // Existing Google account → sign in. New one → the profile steps first (name from Google);
  // the account is created at the end of the steps.
  const onGoogle = async () => {
    setFormError('');
    setGoogleLoading(true);
    const check = await checkGoogleAccount();
    if (!check.ok) {
      setGoogleLoading(false);
      if (!check.cancelled && check.error) setFormError(check.error);
      return;
    }
    if (!check.exists) {
      setGoogleLoading(false);
      navigation.navigate('Onboarding', { initialStep: 1, fromAuth: true, google: check, nav: Date.now() });
      return;
    }
    const res = await signInWithGoogle({ credential: check.credential });
    setGoogleLoading(false);
    if (!res.ok) {
      if (!res.cancelled && res.error) setFormError(res.error);
      return;
    }
    await openApp(res.user);
    offerBiometric({ user: res.user, biometric, enableBiometric, confirm }).catch(() => {});
  };

  return (
    <AuthScaffold
      badge="logo"
      title="Welcome back"
      sub="Sign in to pick up where you left off."
      onBack={() => navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })}
      footer={
        <BottomLink
          question="New to Health line?"
          action="Create account"
          onPress={() => navigation.navigate('Onboarding', { startAt: 'language', nav: Date.now() })}
        />
      }
    >
      {showBio ? (
        <>
          <BiometricCard
            name={biometric.user.name || biometric.user.email}
            label={biometric.label}
            onPress={onBiometric}
            loading={bioLoading}
          />
          <OrDivider label="or sign in another way" />
        </>
      ) : null}
      <AppInput
        tone="soft"
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setFormError('');
          if (touched.email) setErrors((p) => ({ ...p, email: validateEmail(v) }));
        }}
        onBlur={() => {
          setTouched((p) => ({ ...p, email: true }));
          setErrors((p) => ({ ...p, email: validateEmail(email) }));
        }}
        placeholder="you@example.com"
        error={touched.email ? errors.email : ''}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <AppInput
        tone="soft"
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setFormError('');
          if (touched.password) setErrors((p) => ({ ...p, password: validateLoginPassword(v) }));
        }}
        onBlur={() => {
          setTouched((p) => ({ ...p, password: true }));
          setErrors((p) => ({ ...p, password: validateLoginPassword(password) }));
        }}
        placeholder="Enter your password"
        secure
        maxLength={PASSWORD_MAX}
        error={touched.password ? errors.password : ''}
        textContentType="password"
        autoComplete="password"
      />
      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot} hitSlop={6}>
        <Text style={[styles.forgotText, { color: colors.primary, fontFamily: snPro('700') }]}>
          Forgot password?
        </Text>
      </Pressable>

      <FormError message={formError} />
      <AppButton label="Sign in" onPress={onSubmit} loading={loading} size="lg" style={styles.cta} />

      <OrDivider />
      <GoogleButton onPress={onGoogle} loading={googleLoading} />
    </AuthScaffold>
  );
}

export function ForgotPasswordScreen({ navigation }) {
  const a = useAuthColors();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const onSubmit = async () => {
    const err = validateEmail(email);
    setTouched(true);
    setError(err);
    if (err) return;

    setLoading(true);
    const res = await requestPasswordReset({ email });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigation.navigate('VerifyResetOtp', {
      email: res.email,
      resendInSeconds: res.resendInSeconds,
      expiresInMinutes: res.expiresInMinutes,
    });
  };

  return (
    <AuthScaffold
      badge="lock"
      title="Forgot password?"
      sub="Enter the email you signed up with and we'll send you a 6-digit code to reset your password."
      onBack={() => navigation.goBack()}
      footer={
        <BottomLink question="Remembered it?" action="Back to sign in" onPress={() => navigation.navigate('SignIn')} />
      }
    >
      <AppInput
        tone="soft"
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (touched) setError(validateEmail(v));
        }}
        onBlur={() => {
          setTouched(true);
          setError(validateEmail(email));
        }}
        placeholder="you@example.com"
        error={touched ? error : ''}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <AppButton label="Send code" onPress={onSubmit} loading={loading} size="lg" style={styles.cta} />

      <View style={[styles.infoBox, { backgroundColor: a.info }]}>
        <Info size={20} color={colors.primary} strokeWidth={2.2} />
        <Text style={[styles.infoText, { color: a.body, fontFamily: snPro('400') }]}>
          Can't find the email? Check your spam folder, or make sure it's the address you signed up with.
        </Text>
      </View>
    </AuthScaffold>
  );
}

const OTP_LENGTH = 6;

export function VerifyResetOtpScreen({ navigation, route }) {
  const a = useAuthColors();
  const { requestPasswordReset, verifyResetOtp } = useAuth();
  const email = route?.params?.email || '';
  const expiresInMinutes = Number(route?.params?.expiresInMinutes) || 10;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(Number(route?.params?.resendInSeconds) || 60);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onVerify = async () => {
    setInfo('');
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setLoading(true);
    const res = await verifyResetOtp({ email, otp });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigation.replace('ResetPassword', { email, resetToken: res.resetToken });
  };

  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    setError('');
    setInfo('');
    setResending(true);
    const res = await requestPasswordReset({ email });
    setResending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOtp('');
    setInfo('A new code has been sent.');
    setCooldown(res.resendInSeconds);
  };

  const resendDisabled = cooldown > 0 || resending;
  const mm = Math.floor(cooldown / 60);
  const ss = String(cooldown % 60).padStart(2, '0');
  let resendLabel = 'Resend code';
  if (resending) resendLabel = 'Sending...';

  return (
    <AuthScaffold
      title="Check your email"
      sub={
        <>
          We sent a {OTP_LENGTH}-digit code to{' '}
          <Text style={{ color: a.ink, fontFamily: snPro('700') }}>{email}</Text>. It expires in{' '}
          {expiresInMinutes} minutes.
        </>
      }
      onBack={() => navigation.goBack()}
    >
      <OtpInput
        tone="soft"
        label="Verification code"
        length={OTP_LENGTH}
        value={otp}
        onChangeText={(v) => {
          setOtp(v);
          setError('');
        }}
        error={error}
        hint={info}
      />
      <Pressable onPress={onResend} disabled={resendDisabled} style={styles.resendRow}>
        <Text style={[styles.resendText, { color: a.muted, fontFamily: snPro('400') }]}>
          Didn't get it?{' '}
          <Text style={{ color: resendDisabled ? a.muted : colors.primary, fontFamily: snPro('700') }}>
            {resendLabel}
          </Text>
          {cooldown > 0 && !resending ? ` in ${mm}:${ss}` : ''}
        </Text>
      </Pressable>

      <AppButton label="Verify code" onPress={onVerify} loading={loading} size="lg" style={styles.cta} />
    </AuthScaffold>
  );
}

export function ResetPasswordScreen({ navigation, route }) {
  const { resetPassword } = useAuth();
  const email = route?.params?.email || '';
  const resetToken = route?.params?.resetToken || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({ password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setFormError('');
    const next = {
      password: validatePassword(password),
      confirm: validateConfirmPassword(password, confirm),
    };
    setErrors(next);
    setTouched({ password: true, confirm: true });
    if (next.password || next.confirm) return;

    setLoading(true);
    const res = await resetPassword({ email, resetToken, password });
    setLoading(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    navigation.reset({ index: 1, routes: [{ name: 'Onboarding' }, { name: 'SignIn' }] });
  };

  return (
    <AuthScaffold
      title="Choose a new password"
      sub={`Set a new password for ${email}.`}
      onBack={() => navigation.navigate('SignIn')}
    >
      <AppInput
        tone="soft"
        label="New password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setFormError('');
          if (touched.password) setErrors((p) => ({ ...p, password: validatePassword(v) }));
        }}
        onBlur={() => {
          setTouched((p) => ({ ...p, password: true }));
          setErrors((p) => ({ ...p, password: validatePassword(password) }));
        }}
        placeholder={`At least ${PASSWORD_MIN} characters`}
        secure
        showStrength
        maxLength={PASSWORD_MAX}
        error={touched.password ? errors.password : ''}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <AppInput
        tone="soft"
        label="Confirm new password"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setFormError('');
          if (touched.confirm) setErrors((p) => ({ ...p, confirm: validateConfirmPassword(password, v) }));
        }}
        onBlur={() => {
          setTouched((p) => ({ ...p, confirm: true }));
          setErrors((p) => ({ ...p, confirm: validateConfirmPassword(password, confirm) }));
        }}
        placeholder="Type it again"
        secure
        maxLength={PASSWORD_MAX}
        error={touched.confirm ? errors.confirm : ''}
        textContentType="newPassword"
        autoComplete="new-password"
      />

      <FormError message={formError} />
      <AppButton label="Reset password" onPress={onSubmit} loading={loading} size="lg" style={styles.cta} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e5e24',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  head: { marginTop: 20, marginBottom: 26 },
  headCenter: { alignItems: 'center', marginTop: 28 },
  textCenter: { textAlign: 'center' },
  title: { fontSize: 28, lineHeight: 36, marginTop: 4 },
  titleAfterLock: { marginTop: 28 },
  sub: { fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 340 },
  lockOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e5e24',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  form: { width: '100%' },
  row2: { flexDirection: 'row', gap: 12 },
  row2Col: { flex: 1, width: undefined, minWidth: 0 },
  cta: {
    marginTop: 12,
    shadowColor: '#2e7d32',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  forgot: { alignSelf: 'flex-end', marginTop: -4, paddingVertical: 6 },
  forgotText: { fontSize: 13 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
    padding: 14,
    borderRadius: 14,
  },
  section: {
    marginBottom: 14,
    padding: 16,
    paddingBottom: 4,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#1e5e24',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 99,
    marginBottom: 14,
  },
  savedText: { fontSize: 12.5, color: '#1b5e20' },
  googleNote: { marginTop: 8, fontSize: 11.5, lineHeight: 16, color: '#4b5563', textAlign: 'center' },
  googleNoteLink: { color: colors.primary, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  bioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#1e5e24',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  bioIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bioTitle: { fontSize: 15.5 },
  bioSub: { fontSize: 12.5, marginTop: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  orText: { fontSize: 12 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkText: { flex: 1, fontSize: 13, lineHeight: 19 },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 6, marginLeft: 14 },
  formError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  formErrorText: { flex: 1, color: colors.danger, fontSize: 13 },
  infoBox: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  resendRow: { marginTop: -2, paddingVertical: 4 },
  resendText: { fontSize: 13 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  linkWrap: { alignItems: 'center', paddingVertical: 8 },
  link: { fontSize: 14, textAlign: 'center' },
});
