import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  TextInput,
  Switch,
  Platform,
  Image,
  Easing,
  AccessibilityInfo,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Scale,
  Dumbbell,
  Droplet,
  Users,
  Utensils,
  User,
  Ruler,
  Activity,
  Flame,
  Target,
  Leaf,
  ShieldAlert,
  HeartPulse,
  Armchair,
  Zap,
  Timer,
  Bell,
  Moon,
} from 'lucide-react-native';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import AppButton from '../../components/common/AppButton';
import AppInput from '../../components/common/AppInput';
import PhoneInput from '../../components/common/PhoneInput';
import AvatarInitial from '../../components/common/AvatarInitial';
import { getBrandContent } from '../../config/brandContent';
import { SafeAreaTop } from '../../components/common/ScreenShell';
import { useSafeTop } from '../../utils/safeArea';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  onlyNumbers,
  validateName,
  validateAge,
  validateHeightCm,
  validateWeightKg,
  validatePhoneNumber,
} from '../../utils/validation';
import {
  FOCUS_GOALS,
  ACTIVITY,
  SEX_OPTS,
  DIET_OPTS,
  ALLERGENS,
  CONDITIONS,
} from '../../config/healthOptions';
import { LEVELS, ROUTINES, levelOf, routineMinutes, suggestedLevel, workoutPlanFor } from '../../data/homeExercises';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_KEY, ONBOARD_KEY } from '../../config/storageKeys';
import { selectReplyLanguage } from '../../utils/replyLanguage';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';
import { DEFAULT_LANGUAGE, languageById } from '../../config/languages';
import LanguageStep from './LanguageStep';
import { applyHealthProfileToDiary } from '../../utils/applyHealthProfile';
import SignUpMethodStep from './SignUpMethodStep';
import { GoogleLogo } from '../../components/common/GoogleButton';
import HealthlineMark from '../../components/common/HealthlineMark';

/** Steps after the welcome screen: 1 health profile, 2 focus + food, 3 workout + reminders. */
const LAST_STEP = 3;

const ONBOARD_LEAF_L = require('../../assets/image/onboard-leaf-l.webp');
const ONBOARD_LEAF_R = require('../../assets/image/onboard-leaf-r.webp');
const ONBOARD_HERO = require('../../assets/image/onboard-hero.webp');

const WELCOME = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  ink: '#0f1b2d',
  muted: '#5b6475',
  bg: '#f6faf5',
  card: '#ffffff',
};

/** Bottom color of the welcome gradient (also used for the web page behind it). */
const WELCOME_BOTTOM = '#dcecd4';

/** Preference steps (canvas "Basic health profile" / "Personalise goals"). */
const STEP_BG = '#f2f8ef';
const STEP_LIGHT = {
  text: '#0d1b2a',
  muted: '#4b5563',
  border: '#cfe3c7',
  cardBg: '#FFFFFF',
  track: '#d7e6d1',
};
/** Card resting shadow on the light green page. */
const CARD_SHADOW = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(30,94,36,0.06)' },
  default: {
    shadowColor: '#1e5e24',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
});
const CARD_SHADOW_ON = Platform.select({
  web: { boxShadow: '0 8px 22px rgba(46,125,50,0.14)' },
  default: {
    shadowColor: '#2e7d32',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});

/** Native driver is unavailable on web — avoid Animated warning. */
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** true when the phone asks for less motion (accessibility setting). */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => alive && setReduce(!!on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => setReduce(!!on));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/** Each welcome-screen part takes this long, and the next starts only when it has finished. */
const ENTRANCE_MS = 300;

/**
 * Welcome-screen entrance: part number `step` fades in and moves into place, starting when
 * part `step - 1` has finished, so they come in one by one from top to bottom.
 * from (same idea as AOS):
 *   'up'          — rises into place
 *   'left'/'right'— slides in from that side
 *   'pop'         — grows from a little smaller
 *   'zoom-right'  — AOS zoom-in-right: zooms in while coming from the left
 *   'zoom-left'   — AOS zoom-in-left:  zooms in while coming from the right
 */
function Entrance({ step = 0, from = 'up', distance = 40, duration = ENTRANCE_MS, reduce, style, children }) {
  const p = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      p.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(p, {
      toValue: 1,
      delay: step * ENTRANCE_MS,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [p, step, duration, reduce]);

  const slide = (out) => p.interpolate({ inputRange: [0, 1], outputRange: [out, 0] });
  const zoom = p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  let transform;
  switch (from) {
    case 'pop':
      transform = [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }];
      break;
    case 'left':
      transform = [{ translateX: slide(-distance) }];
      break;
    case 'right':
      transform = [{ translateX: slide(distance) }];
      break;
    case 'zoom-right': // from the left + zoom
      transform = [{ translateX: slide(-distance) }, { scale: zoom }];
      break;
    case 'zoom-left': // from the right + zoom
      transform = [{ translateX: slide(distance) }, { scale: zoom }];
      break;
    default:
      transform = [{ translateY: slide(22) }];
  }
  return <Animated.View style={[style, { opacity: p, transform }]}>{children}</Animated.View>;
}

/** A leaf that keeps swaying gently once it has slid in. */
function SwayingLeaf({ source, imageStyle, side, reduce }) {
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    // Start swaying once the leaf has finished sliding in (slide takes 700ms).
    const t = setTimeout(() => loop.start(), 700);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [sway, reduce]);
  const turn = side === 'left' ? ['-3deg', '4deg'] : ['3deg', '-4deg'];
  // AOS style: left leaf = zoom-in-right (from left + zoom), right leaf = zoom-in-left.
  const mode = side === 'left' ? 'zoom-right' : 'zoom-left';
  return (
    <Entrance from={mode} step={0} distance={160} duration={700} reduce={reduce}>
      <Animated.Image
        source={source}
        style={[
          imageStyle,
          {
            transform: [
              { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: turn }) },
              { translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
            ],
          },
        ]}
      />
    </Entrance>
  );
}

function NutritionIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={WELCOME.green}>
      <Path d="M5 2h1.5v6H8V2h1.5v6H11V2h1.5v7a3 3 0 0 1-2.5 3v10H7.5V12A3 3 0 0 1 5 9V2Zm11.5 0C19 2 20 5 20 9s-1.2 4.5-2.5 4.8V22H15V3c0-.6.6-1 1.5-1Z" />
    </Svg>
  );
}

function FitnessIcon() {
  return (
    <Svg width={26} height={18} viewBox="0 0 26 18" fill="#1f3a93">
      <Rect x="0" y="7" width="3" height="4" rx="1" />
      <Rect x="4" y="3" width="3.5" height="12" rx="1.5" />
      <Rect x="8.5" y="5" width="2.5" height="8" rx="1" />
      <Rect x="11" y="8" width="4" height="2" />
      <Rect x="15" y="5" width="2.5" height="8" rx="1" />
      <Rect x="18.5" y="3" width="3.5" height="12" rx="1.5" />
      <Rect x="23" y="7" width="3" height="4" rx="1" />
    </Svg>
  );
}

function ReportsIcon() {
  return (
    <Svg width={20} height={22} viewBox="0 0 20 24" fill="none" stroke="#d32f2f" strokeWidth={2} strokeLinejoin="round">
      <Path d="M3 2h9l5 5v15H3z" />
      <Path d="M12 2v5h5M6.5 12h7M6.5 15.5h7M6.5 19h5" strokeLinecap="round" />
    </Svg>
  );
}

function MedicalIcon() {
  return (
    <Svg width={22} height={24} viewBox="0 0 22 24" fill="none" stroke="#3d2a8f" strokeWidth={2} strokeLinecap="round">
      <Path d="M4 2H3v6a5 5 0 0 0 10 0V2h-1" />
      <Path d="M8 13v3a5 5 0 0 0 10 0v-2" />
      <Circle cx="18" cy="11.5" r="2.5" />
    </Svg>
  );
}

function LeafBenefitIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={WELCOME.green}>
      <Path d="M21 3S9 2 5 9c-2 3.5-1 7.5 0 9L3 21l1.3 1L6 20c1.8 1 5.5 1.5 8.7-.8C20.5 15 21 3 21 3Zm-14.6 15.7c3-4.5 6.6-7.8 10.6-10.2-3.6 2.8-6.6 6.3-9 10.6z" />
    </Svg>
  );
}

function GoalsBenefitIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={WELCOME.green} strokeWidth={2.2}>
      <Circle cx="11" cy="13" r="8.5" />
      <Circle cx="11" cy="13" r="4.5" />
      <Circle cx="11" cy="13" r="0.8" fill={WELCOME.green} />
      <Path d="M11 13 20 4M17 3v4h4" strokeLinecap="round" />
    </Svg>
  );
}

function HeartBenefitIcon() {
  return (
    <Svg width={22} height={20} viewBox="0 0 24 22" fill="none" stroke={WELCOME.green} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 20S2 13.5 2 7.3A5 5 0 0 1 12 5a5 5 0 0 1 10 2.3C22 13.5 12 20 12 20Z" />
      <Path d="M5 11h4l1.5-3 2.5 6 1.5-3H19" />
    </Svg>
  );
}

function ExpertBenefitIcon() {
  return (
    <Svg width={24} height={18} viewBox="0 0 26 18" fill={WELCOME.green}>
      <Circle cx="13" cy="4" r="3.5" />
      <Circle cx="5" cy="5.5" r="2.7" />
      <Circle cx="21" cy="5.5" r="2.7" />
      <Path d="M6.5 17c0-4 2.9-7 6.5-7s6.5 3 6.5 7z" />
      <Path d="M0 17c0-3.2 2-5.5 4.8-5.5 1 0 1.8.3 2.4.7A9 9 0 0 0 5 17zM26 17c0-3.2-2-5.5-4.8-5.5-1 0-1.8.3-2.4.7A9 9 0 0 1 21 17z" />
    </Svg>
  );
}

function Swoosh() {
  return (
    <Svg style={styles.swoosh} width={230} height={12} viewBox="0 0 230 12" fill="none">
      <Path d="M3 9C60 2 170 1 227 5" stroke="#6fb33f" strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

const WELCOME_FEATURES = [
  {
    id: 'nutrition',
    title: 'Nutrition',
    sub: 'Track meals, calories and get diet plans',
    icBg: '#e6f4e4',
    Icon: NutritionIcon,
  },
  {
    id: 'fitness',
    title: 'Fitness',
    sub: 'Gym workouts, steps and activity',
    icBg: '#e7ecfb',
    Icon: FitnessIcon,
  },
  {
    id: 'reports',
    title: 'Health Reports',
    sub: 'Upload reports and get easy explanations',
    icBg: '#fde8e6',
    Icon: ReportsIcon,
  },
  {
    id: 'medical',
    title: 'Medical Guidance',
    sub: 'Get suggestions on diet, exercise and more',
    icBg: '#efeafb',
    Icon: MedicalIcon,
  },
];

const WELCOME_BENEFITS = [
  { id: 'plans', label: 'Personalized\nPlans', Icon: LeafBenefitIcon },
  { id: 'goals', label: 'Track\nYour Goals', Icon: GoalsBenefitIcon },
  { id: 'healthy', label: 'Stay\nHealthy', Icon: HeartBenefitIcon },
  { id: 'expert', label: 'Expert-level\nGuidance', Icon: ExpertBenefitIcon },
];

const NOTIF_OPTS = [
  { id: 'brief', label: 'Morning brief', sub: "Your day's targets and plan at 07:00" },
  { id: 'gap', label: 'Smart gap nudges', sub: 'Only when a macro is at risk — max 1 a day' },
  { id: 'water', label: 'Hydration reminders', sub: "Every 3 hours while you're active" },
  { id: 'weekly', label: 'Weekly review', sub: "Sunday recap and next week's plan" },
];

function focusToDiaryGoal(selected) {
  if (selected.lose) return 'lose';
  if (selected.protein) return 'gain';
  return 'maintain';
}

function suggestCalories({ weight, activity }) {
  const w = Number(weight) || 70;
  const mult = { Low: 26, Light: 28, Moderate: 30, High: 33 }[activity] || 30;
  return Math.round((w * mult) / 10) * 10;
}

function macrosFromCalories(cals, diaryGoal) {
  let pPct = 0.3;
  let cPct = 0.4;
  let fPct = 0.3;
  if (diaryGoal === 'gain') {
    pPct = 0.35;
    cPct = 0.4;
    fPct = 0.25;
  } else if (diaryGoal === 'lose') {
    pPct = 0.35;
    cPct = 0.35;
    fPct = 0.3;
  }
  return {
    protein: Math.round((cals * pPct) / 4),
    carbs: Math.round((cals * cPct) / 4),
    fat: Math.round((cals * fPct) / 9),
  };
}

function softPrimary(isDark, brandColors, primaryRgba) {
  return isDark ? primaryRgba(0.18) : brandColors.primarySoft;
}

const GOAL_ICONS = { lose: Scale, protein: Dumbbell, sugar: Droplet, family: Users, energy: Utensils };

/** Canvas card: white, 2px green border when picked; transparent border + soft shadow otherwise. */
function selectableCard(on, theme, isDark) {
  if (isDark) {
    return { borderColor: on ? colors.primary : theme.border, backgroundColor: theme.cardBg };
  }
  return [
    { borderColor: on ? colors.primary : 'transparent', backgroundColor: theme.cardBg },
    on ? CARD_SHADOW_ON : CARD_SHADOW,
  ];
}

/** Canvas chip: filled green when picked, white with a light green border otherwise. */
function chipStyle(on, theme) {
  return {
    box: { borderColor: on ? colors.primary : theme.border, backgroundColor: on ? colors.primary : theme.cardBg },
    text: { color: on ? '#FFFFFF' : theme.text, fontFamily: snPro('700') },
  };
}

export default function OnboardingScreen({ onDone, navigation, route, initialStep = 0 }) {
  const { isDark, colors, themeColors: c, primaryRgba } = useTheme();
  const { setGoal, updateProfile, updateReminder } = useDiary();
  const { isSignedIn, checkGoogleAccount, signInWithGoogle } = useAuth();
  const fromAuth = Boolean(route?.params?.fromAuth);
  /**
   * Google sign-up in progress: { credential, google: { email, firstName, lastName } }.
   * Set on the "Create your account" page (or passed from Sign In). The account is created
   * at the end of the steps, with the answers — not before.
   */
  const [googleAcct, setGoogleAcct] = useState(() => route?.params?.google || null);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Mobile number for Google sign-up (email sign-up asks for it on the register form).
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('IN');
  const [phoneNational, setPhoneNational] = useState('');
  const [step, setStep] = useState(() => {
    if (fromAuth) return Number(route?.params?.initialStep ?? initialStep) || 1;
    return Number(initialStep) || 0;
  });
  // Choose-language screen sits between the welcome screen (step 0) and step 1.
  // Sign In → "Create account" starts on the language page (route param startAt: 'language').
  const startAtLanguage = route?.params?.startAt === 'language';
  const [pickingLang, setPickingLang] = useState(startAtLanguage);
  // "Create your account" (Google or Email) sits between the language screen and step 1.
  const [pickingMethod, setPickingMethod] = useState(false);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;
  const topPad = useSafeTop();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'web' ? 16 : 10);

  const [focus, setFocus] = useState({ lose: true, protein: true, sugar: false, family: true, energy: false });
  const [firstName, setFirstName] = useState(() => route?.params?.google?.google?.firstName || '');
  const [lastName, setLastName] = useState(() => route?.params?.google?.google?.lastName || '');
  const [sex, setSex] = useState('Female');
  const [age, setAge] = useState('34');
  const [height, setHeight] = useState('168');
  const [weight, setWeight] = useState('74.5');
  const [goalWeight, setGoalWeight] = useState('68.0');
  const [activity, setActivity] = useState('Moderate');
  const [diet, setDiet] = useState({ 'High-protein': true });
  const [allergies, setAllergies] = useState({ Fish: true });
  const [conditions, setConditions] = useState({ 'Pre-diabetic': true });
  const [notifs, setNotifs] = useState({ brief: true, gap: true, water: false, weekly: true });
  // null = not picked yet → suggested from age when the workout step opens.
  const [workoutLevel, setWorkoutLevel] = useState(null);
  const [workoutRoutine, setWorkoutRoutine] = useState(null);
  const plan = workoutPlanFor({
    age,
    workoutLevel: workoutLevel || suggestedLevel(age),
    workoutRoutine,
  });
  const [bodyErrors, setBodyErrors] = useState({});
  const [bodyTouched, setBodyTouched] = useState({});
  const scrollRef = useRef(null);
  const fieldYRef = useRef({});

  const registerFieldY = useCallback((key, y) => {
    if (key && Number.isFinite(y)) fieldYRef.current[key] = y;
  }, []);

  const scrollToField = useCallback((key) => {
    const y = fieldYRef.current[key];
    if (!scrollRef.current || !Number.isFinite(y)) return;
    scrollRef.current.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }, []);

  const suggestedCals = useMemo(
    () => suggestCalories({ weight, activity }),
    [weight, activity],
  );
  const diaryGoal = useMemo(() => focusToDiaryGoal(focus), [focus]);
  const suggestedMacros = useMemo(
    () => macrosFromCalories(suggestedCals, diaryGoal),
    [suggestedCals, diaryGoal],
  );

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(18);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(slide, { toValue: 0, duration: 380, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [step, pickingLang, pickingMethod, fade, slide]);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((v) => {
        if (v) setLanguage(languageById(v).id);
      })
      .catch(() => {});
  }, []);

  // Web: the page body can show under the app's bottom edge. Match it to the welcome
  // gradient's bottom green so no light strip appears, then restore it.
  const onWelcome = step === 0 && !pickingLang && !pickingMethod;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !onWelcome) return undefined;
    // Next frame, so ThemedStatusBar (a parent, whose effect runs after ours) can't overwrite it.
    const id = requestAnimationFrame(() => {
      document.documentElement.style.backgroundColor = WELCOME_BOTTOM;
      document.body.style.backgroundColor = WELCOME_BOTTOM;
    });
    return () => {
      cancelAnimationFrame(id);
      document.documentElement.style.backgroundColor = c.pageBg;
      document.body.style.backgroundColor = c.pageBg;
    };
  }, [onWelcome, c.pageBg]);

  const confirmLanguage = () => {
    AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => {});
    // AI Assist answers in the chosen language too (kept on the phone, uploaded after sign-in).
    selectReplyLanguage(language).catch(() => {});
    setPickingLang(false);
    if (isSignedIn) {
      setStep(1);
      return;
    }
    setPickingMethod(true);
  };

  /** "Continue with Google": existing account → straight in; new → the steps, name filled in. */
  const chooseGoogle = async () => {
    setGoogleBusy(true);
    const res = await checkGoogleAccount();
    setGoogleBusy(false);
    if (!res.ok) return;
    if (res.exists) {
      const signedIn = await signInWithGoogle({ credential: res.credential });
      if (signedIn.ok) {
        // Load this account's own targets (calories, macros, goal, reminders) into the diary,
        // as Sign In does — otherwise Home shows the defaults. Signing in then opens Home.
        applyHealthProfileToDiary({ updateProfile, setGoal, updateReminder }, { user: signedIn.user });
        AsyncStorage.setItem(ONBOARD_KEY, '1').catch(() => {});
      }
      return;
    }
    setGoogleAcct(res);
    if (res.google?.firstName) setFirstName(res.google.firstName);
    if (res.google?.lastName) setLastName(res.google.lastName);
    setPickingMethod(false);
    setStep(1);
  };

  const chooseEmail = () => {
    setGoogleAcct(null);
    setPickingMethod(false);
    setStep(1);
  };

  /** Exclusive keys ("No preference" / "None") clear the rest of that group, and vice versa. */
  const toggleMap = (setter, key, exclusiveKey) => {
    setter((prev) => {
      if (exclusiveKey && key === exclusiveKey) {
        return !prev[key] ? { [exclusiveKey]: true } : {};
      }
      const next = { ...prev, [key]: !prev[key] };
      if (exclusiveKey) next[exclusiveKey] = false;
      return next;
    });
  };

  const finish = async () => {
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'Alex';
    const macros = macrosFromCalories(suggestedCals, focusToDiaryGoal(focus));
    setGoal(focusToDiaryGoal(focus));
    updateProfile({
      name: displayName,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      sex,
      weight: Number(weight) || 72,
      goalWeight: Number(goalWeight) || 68,
      calories: suggestedCals,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      age: Number(age) || 30,
      heightCm: Number(height) || 168,
      activity,
      diet: Object.keys(diet).filter((k) => diet[k]),
      focusGoals: Object.keys(focus).filter((k) => focus[k]),
      allergies: Object.keys(allergies).filter((k) => allergies[k]),
      conditions: Object.keys(conditions).filter((k) => conditions[k]),
      workoutLevel: plan.level,
      workoutRoutine: plan.routine?.id || '',
    });
    updateReminder('breakfast', !!notifs.brief);
    updateReminder('lunch', !!notifs.gap);
    updateReminder('dinner', !!notifs.gap);
    updateReminder('water', !!notifs.water);
    updateReminder('weighIn', !!notifs.weekly);

    const signupProfile = {
        sex,
        age: Number(age) || 30,
        heightCm: Number(height) || 168,
        activity,
        goal: diaryGoal,
        calories: suggestedCals,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        waterGoal: 8,
        weight: Number(weight) || 72,
        goalWeight: Number(goalWeight) || 68,
        diet: Object.keys(diet).filter((k) => diet[k]),
        focusGoals: Object.keys(focus).filter((k) => focus[k]),
        allergies: Object.keys(allergies).filter((k) => allergies[k]),
        conditions: Object.keys(conditions).filter((k) => conditions[k]),
        workoutLevel: plan.level,
        workoutRoutine: plan.routine?.id || '',
        reminders: {
          breakfast: !!notifs.brief,
          lunch: !!notifs.gap,
          dinner: !!notifs.gap,
          water: !!notifs.water,
          weighIn: !!notifs.weekly,
        },
    };

    // Already signed in (e.g. finished profile later) → app.
    if (isSignedIn) {
      onDone();
      return;
    }
    // Google sign-up: create the account now, with these answers. The app then opens Home.
    if (googleAcct) {
      const res = await signInWithGoogle({
        credential: googleAcct.credential,
        profile: signupProfile,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber,
      });
      if (res.ok) AsyncStorage.setItem(ONBOARD_KEY, '1').catch(() => {});
      return;
    }
    // Email sign-up → register page (email + password) after preference steps.
    if (!navigation) {
      console.warn('Onboarding: navigation missing, cannot open SignUp');
      return;
    }
    navigation.navigate('SignUp', {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      profile: signupProfile,
    });
  };

  const validateBodyStep = () => {
    const next = {
      firstName: validateName(firstName, 'First name'),
      lastName: validateName(lastName, 'Last name'),
      age: validateAge(age),
      height: validateHeightCm(height),
      weight: validateWeightKg(weight, 'Current weight'),
      goalWeight: validateWeightKg(goalWeight, 'Goal weight'),
      phone: googleAcct ? validatePhoneNumber(phoneNumber, phoneCountry, phoneNational) : '',
    };
    setBodyErrors(next);
    setBodyTouched({
      firstName: true,
      lastName: true,
      phone: true,
      age: true,
      height: true,
      weight: true,
      goalWeight: true,
    });
    const order = ['firstName', 'lastName', 'phone', 'age', 'height', 'weight', 'goalWeight'];
    const firstError = order.find((k) => next[k]);
    if (firstError) {
      // Wait a tick so error text mounts, then scroll to that field.
      setTimeout(() => scrollToField(firstError), 50);
      return false;
    }
    return true;
  };

  const next = () => {
    if (step === 0) {
      setPickingLang(true);
      return;
    }
    if (step === 1 && !validateBodyStep()) {
      return;
    }
    if (step < LAST_STEP) {
      setStep((s) => s + 1);
      return;
    }
    finish();
  };

  const back = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      return;
    }
    if (step === 1 && fromAuth) {
      navigation?.navigate('SignIn');
      return;
    }
    if (step === 1) {
      setStep(0);
      if (isSignedIn) setPickingLang(true);
      else setPickingMethod(true);
    }
  };

  const backFromMethod = () => {
    setPickingMethod(false);
    setPickingLang(true);
  };

  const backFromLanguage = () => {
    // Came from Sign In → back there; otherwise back to the welcome screen.
    if (startAtLanguage) {
      navigation?.navigate('SignIn');
      return;
    }
    setPickingLang(false);
  };

  // Android hardware back: go to the previous step (same as the on-screen back arrow)
  // instead of leaving the whole sign-up flow. Only the welcome screen lets the system handle it.
  const hardwareBackRef = useRef(null);
  hardwareBackRef.current = () => {
    // Another screen (Terms, Register…) is on top → let navigation close that one.
    if (typeof navigation?.isFocused === 'function' && !navigation.isFocused()) return false;
    if (pickingMethod) {
      backFromMethod();
      return true;
    }
    if (pickingLang) {
      backFromLanguage();
      return true;
    }
    if (step >= 1) {
      back();
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => hardwareBackRef.current?.() ?? false);
    return () => sub.remove();
  }, []);

  const ctaLabel =
    step === 0
      ? 'Get started'
      : step === LAST_STEP
        ? isSignedIn
          ? 'Start tracking'
          : googleAcct
            ? 'Create account'
            : 'Continue to register'
        : 'Continue';

  if (pickingMethod) {
    return (
      <Animated.View style={[styles.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <SignUpMethodStep
          onBack={backFromMethod}
          onGoogle={chooseGoogle}
          onEmail={chooseEmail}
          onSignIn={() => navigation?.navigate('SignIn')}
          onTerms={() => navigation?.navigate('Terms')}
          onPrivacy={() => navigation?.navigate('PrivacyPolicy')}
          googleLoading={googleBusy}
          topPad={topPad}
          bottomPad={Math.max(bottomPad, 20)}
        />
      </Animated.View>
    );
  }

  if (pickingLang) {
    return (
      <Animated.View style={[styles.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <LanguageStep
          value={language}
          onChange={setLanguage}
          onBack={backFromLanguage}
          onContinue={confirmLanguage}
          topPad={topPad}
          bottomPad={Math.max(bottomPad, 20)}
        />
      </Animated.View>
    );
  }

  const isWelcome = step === 0;
  // Steps use the canvas look: soft green page, white cards, light green borders.
  const st = isDark ? c : { ...c, ...STEP_LIGHT };
  // The welcome screen is always light (its artwork is made for it); the steps follow the theme.
  const grad = isWelcome
    ? // Canvas: near-white glow at the top, soft green shade toward the bottom.
      ['#fbfdf9', '#f2f8ef', WELCOME_BOTTOM]
    : isDark
      ? ['#0A0A0A', '#000000', '#000000']
      : [STEP_BG, STEP_BG, STEP_BG];

  return (
    <View style={[styles.root, { backgroundColor: isWelcome ? WELCOME.bg : isDark ? c.pageBg : STEP_BG }]}>
      <LinearGradient colors={grad} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      {isWelcome ? <View style={styles.welcomeBlob} /> : null}

      <View style={[styles.safe, { paddingBottom: isWelcome ? Math.max(bottomPad, 20) : bottomPad }]}>
        {isWelcome ? null : (
          <>
            <SafeAreaTop color="transparent" />
            {topPad <= 0 ? <View style={{ height: Platform.OS === 'web' ? 44 : 12 }} /> : null}
          </>
        )}

        <Animated.View style={[styles.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
          {isWelcome ? (
            <GetStartedStep
              onNext={next}
              onSignIn={() => navigation?.navigate('SignIn')}
              topPad={topPad}
            />
          ) : (
            <>
              <OnboardHeader step={step} onBack={back} theme={st} />
              <ScrollView
                ref={scrollRef}
                style={styles.flex}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {step === 1 ? (
                  <>
                  {googleAcct ? (
                    <View style={[styles.googleChip, { backgroundColor: st.cardBg, borderColor: st.border }]}>
                      <GoogleLogo size={16} />
                      <Text
                        style={[styles.googleChipText, { color: st.text, fontFamily: snPro('700') }]}
                        numberOfLines={1}
                      >
                        Signing up as {googleAcct.google?.email || 'your Google account'}
                      </Text>
                    </View>
                  ) : null}
                  <BodyStep
                    phone={
                      googleAcct
                        ? {
                            value: phoneNumber,
                            error: bodyTouched.phone ? bodyErrors.phone : '',
                            onChange: (v, code, national) => {
                              const nextCountry = code || phoneCountry;
                              setPhoneNumber(v);
                              if (code) setPhoneCountry(code);
                              setPhoneNational(national || '');
                              if (bodyTouched.phone) {
                                setBodyErrors((p) => ({
                                  ...p,
                                  phone: validatePhoneNumber(v, nextCountry, national || ''),
                                }));
                              }
                            },
                            onCountryChange: setPhoneCountry,
                            onBlur: (e164, code, national) => {
                              const v = e164 ?? phoneNumber;
                              const nextCountry = code || phoneCountry;
                              const nextNational = national ?? phoneNational;
                              if (code) setPhoneCountry(code);
                              if (e164 !== undefined) setPhoneNumber(e164);
                              if (national !== undefined) setPhoneNational(national);
                              setBodyTouched((p) => ({ ...p, phone: true }));
                              setBodyErrors((p) => ({
                                ...p,
                                phone: validatePhoneNumber(v, nextCountry, nextNational),
                              }));
                            },
                          }
                        : null
                    }
                    firstName={firstName}
                    setFirstName={(v) => {
                      setFirstName(v);
                      if (bodyTouched.firstName) {
                        setBodyErrors((p) => ({ ...p, firstName: validateName(v, 'First name') }));
                      }
                    }}
                    lastName={lastName}
                    setLastName={(v) => {
                      setLastName(v);
                      if (bodyTouched.lastName) {
                        setBodyErrors((p) => ({ ...p, lastName: validateName(v, 'Last name') }));
                      }
                    }}
                    sex={sex}
                    setSex={setSex}
                    age={age}
                    setAge={(v) => {
                      setAge(v);
                      if (bodyTouched.age) setBodyErrors((p) => ({ ...p, age: validateAge(v) }));
                    }}
                    height={height}
                    setHeight={(v) => {
                      setHeight(v);
                      if (bodyTouched.height) {
                        setBodyErrors((p) => ({ ...p, height: validateHeightCm(v) }));
                      }
                    }}
                    weight={weight}
                    setWeight={(v) => {
                      setWeight(v);
                      if (bodyTouched.weight) {
                        setBodyErrors((p) => ({ ...p, weight: validateWeightKg(v, 'Current weight') }));
                      }
                    }}
                    goalWeight={goalWeight}
                    setGoalWeight={(v) => {
                      setGoalWeight(v);
                      if (bodyTouched.goalWeight) {
                        setBodyErrors((p) => ({
                          ...p,
                          goalWeight: validateWeightKg(v, 'Goal weight'),
                        }));
                      }
                    }}
                    activity={activity}
                    setActivity={setActivity}
                    suggestedCals={suggestedCals}
                    suggestedMacros={suggestedMacros}
                    errors={bodyErrors}
                    touched={bodyTouched}
                    registerFieldY={registerFieldY}
                    onBlurField={(key) => {
                      setBodyTouched((p) => ({ ...p, [key]: true }));
                      setBodyErrors((p) => {
                        const next = { ...p };
                        if (key === 'firstName') next.firstName = validateName(firstName, 'First name');
                        if (key === 'lastName') next.lastName = validateName(lastName, 'Last name');
                        if (key === 'age') next.age = validateAge(age);
                        if (key === 'height') next.height = validateHeightCm(height);
                        if (key === 'weight') next.weight = validateWeightKg(weight, 'Current weight');
                        if (key === 'goalWeight') {
                          next.goalWeight = validateWeightKg(goalWeight, 'Goal weight');
                        }
                        return next;
                      });
                    }}
                    theme={st}
                    isDark={isDark}
                  />
                  <AllergiesStep
                    sections={['conditions']}
                    conditions={conditions}
                    setConditions={setConditions}
                    toggleMap={toggleMap}
                    theme={st}
                  />
                  </>
                ) : null}
                {step === 2 ? (
                  <>
                    <GoalsStep focus={focus} setFocus={setFocus} theme={st} isDark={isDark} />
                    <AllergiesStep
                      sections={['diet', 'allergies']}
                      diet={diet}
                      setDiet={setDiet}
                      allergies={allergies}
                      setAllergies={setAllergies}
                      toggleMap={toggleMap}
                      theme={st}
                    />
                  </>
                ) : null}
                {step === 3 ? (
                  <>
                  <WorkoutStep
                    age={age}
                    level={plan.level}
                    routineId={plan.routine?.id}
                    setLevel={(id) => {
                      setWorkoutLevel(id);
                      setWorkoutRoutine(null);
                    }}
                    setRoutine={setWorkoutRoutine}
                    theme={st}
                    isDark={isDark}
                  />
                  <NotifsStep notifs={notifs} setNotifs={setNotifs} theme={st} isDark={isDark} />
                  </>
                ) : null}
              </ScrollView>
              <View style={styles.footer}>
                <AppButton label={ctaLabel} onPress={next} size="lg" style={styles.ctaShadow} />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

function OnboardHeader({ step, onBack, theme }) {
  const { colors } = useTheme();
  const pct = `${(step / LAST_STEP) * 100}%`;
  return (
    <View style={styles.obHead}>
      <Pressable
        onPress={onBack}
        hitSlop={6}
        style={[styles.backBtn, { backgroundColor: theme.cardBg }]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={20} color={colors.primaryDark} strokeWidth={2.6} />
      </Pressable>
      <View style={styles.obHeadBody}>
        <Text style={[styles.stepLbl, { color: colors.primaryDark, fontFamily: snPro('700') }]}>
          Step {step} of {LAST_STEP}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: theme.track }]}>
          <View style={[styles.progressFill, { width: pct, backgroundColor: colors.primary }]} />
        </View>
      </View>
    </View>
  );
}

function GetStartedStep({ onNext, onSignIn, topPad }) {
  // Each part comes in one after another when the screen opens (off when Reduce motion is on).
  const reduce = useReduceMotion();
  return (
    <View style={styles.welcomeScreen}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.welcomeScroll, { paddingTop: Math.max(topPad, 8) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Leaves live inside the scroll content so they move with the page. */}
        <View pointerEvents="none" style={styles.leafLWrap}>
          <SwayingLeaf source={ONBOARD_LEAF_L} imageStyle={styles.leafL} side="left" reduce={reduce} />
        </View>
        <View pointerEvents="none" style={styles.leafRWrap}>
          <SwayingLeaf source={ONBOARD_LEAF_R} imageStyle={styles.leafR} side="right" reduce={reduce} />
        </View>
        <View style={styles.brandBlock}>
          <Entrance from="pop" step={1} reduce={reduce}>
            <HealthlineMark height={56} />
          </Entrance>
          <Entrance step={2} reduce={reduce} style={{ alignItems: 'center' }}>
            <Text style={[styles.brandName, { fontFamily: FONT.nova }]}>Health line</Text>
            <Text style={[styles.brandTag, { fontFamily: snPro('500') }]}>
              Eat Smart • Move More • Live Better
            </Text>
          </Entrance>
        </View>

        <View style={styles.headline}>
          <Entrance step={3} reduce={reduce} style={{ alignItems: 'center' }}>
            <Text style={[styles.headlineTitle, { fontFamily: FONT.nova }]}>Better Habits</Text>
          </Entrance>
          <Entrance step={4} reduce={reduce} style={{ alignItems: 'center' }}>
            <Text style={[styles.headlineTitleGreen, { fontFamily: FONT.nova }]}>A Healthier You</Text>
            <Swoosh />
          </Entrance>
          <Entrance step={5} reduce={reduce}>
            <Text style={[styles.lead, { fontFamily: snPro('400') }]}>
              Track your meals, stay active, understand your health reports and get personalized guidance — all in one app.
            </Text>
          </Entrance>
        </View>

        <Entrance from="pop" step={6} reduce={reduce}>
          <View style={styles.heroWrap}>
            <Image source={ONBOARD_HERO} style={styles.heroImg} resizeMode="contain" />
            <LinearGradient
              colors={['rgba(243,248,240,1)', 'rgba(243,248,240,0)', 'rgba(234,243,229,0)', 'rgba(234,243,229,1)']}
              locations={[0, 0.06, 0.92, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>
        </Entrance>

        {/* All 4 features in one row: icon on top, name below. */}
        <View style={styles.featureGrid}>
          <View style={styles.featureRow}>
            {WELCOME_FEATURES.map((item, index) => (
              <Entrance key={item.id} step={7 + index} reduce={reduce} style={styles.featureCell}>
                <Pressable onPress={onNext} style={[styles.featureCard, styles.featureCardFill]}>
                  <View style={[styles.featureIcon, { backgroundColor: item.icBg }]}>
                    <item.Icon />
                  </View>
                  <Text style={[styles.featureTitle, { fontFamily: snPro('800') }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                </Pressable>
              </Entrance>
            ))}
          </View>
        </View>

        <View style={styles.benefits}>
          {WELCOME_BENEFITS.map((item, index) => (
            <View key={item.id} style={styles.benefit}>
              {index > 0 ? <View style={styles.benefitDivider} /> : null}
              <Entrance from="pop" step={11 + index} reduce={reduce} style={{ alignItems: 'center' }}>
                <View style={styles.benefitIcon}>
                  <item.Icon />
                </View>
                <Text style={[styles.benefitLabel, { fontFamily: snPro('600') }]}>{item.label}</Text>
              </Entrance>
            </View>
          ))}
        </View>

        <Entrance step={15} reduce={reduce}>
          <Pressable onPress={onNext} style={styles.ctaBtn}>
            <LinearGradient
              colors={['#358a3a', '#2a7430']}
              style={styles.ctaGrad}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            >
              <Text style={[styles.ctaText, { fontFamily: snPro('800') }]}>Get Started</Text>
              <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onSignIn} style={styles.signinRow}>
            <Text style={[styles.signinText, { fontFamily: snPro('500') }]}>
              Already have an account?
              <Text style={{ color: WELCOME.greenDark, fontFamily: snPro('800') }}> Sign in</Text>
            </Text>
          </Pressable>
        </Entrance>
      </ScrollView>
    </View>
  );
}

function GoalsStep({ focus, setFocus, theme, isDark }) {
  const { colors } = useTheme();
  const pickedCount = FOCUS_GOALS.filter((g) => focus[g.id]).length;
  return (
    <View>
      <Text style={[styles.h1, { color: theme.text, fontFamily: FONT.nova }]}>
        What would you like to focus on?
      </Text>
      <Text style={[styles.sub, { color: theme.muted, fontFamily: snPro('400') }]}>
        Pick as many as you like. Your daily plan is built from these.
      </Text>
      <View style={styles.goalHeadRow}>
        <Text style={[styles.goalHeadLbl, { color: theme.text, fontFamily: snPro('800') }]}>Your goals</Text>
        <View style={[styles.countPill, { backgroundColor: colors.primarySoft || '#e2f2dc' }]}>
          <Text style={[styles.countText, { color: colors.primaryDark, fontFamily: snPro('800') }]}>
            {pickedCount} selected
          </Text>
        </View>
      </View>
      <View style={styles.goalList}>
        {FOCUS_GOALS.map((g) => {
          const on = !!focus[g.id];
          const Icon = GOAL_ICONS[g.id] || Utensils;
          return (
            <Pressable
              key={g.id}
              onPress={() => setFocus((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.goalRow,
                selectableCard(on, theme, isDark),
                on && !isDark && { backgroundColor: '#f7fcf5' },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={[styles.goalIcon, { backgroundColor: on ? colors.primary : theme.track }]}>
                <Icon size={20} color={on ? '#FFFFFF' : colors.primaryDark} strokeWidth={2.2} />
              </View>
              <View style={styles.goalText}>
                <Text style={[styles.goalTitle, { color: theme.text, fontFamily: snPro('800') }]}>{g.label}</Text>
                <Text style={[styles.goalSub, { color: theme.muted, fontFamily: snPro('500') }]}>{g.sub}</Text>
              </View>
              <View
                style={[
                  styles.goalCheck,
                  on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: theme.border },
                ]}
              >
                {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BodyStep({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  sex,
  setSex,
  age,
  setAge,
  height,
  setHeight,
  weight,
  setWeight,
  goalWeight,
  setGoalWeight,
  activity,
  setActivity,
  suggestedCals,
  suggestedMacros,
  errors = {},
  touched = {},
  registerFieldY,
  onBlurField,
  theme,
  isDark,
  phone = null,
}) {
  const { colors, primaryRgba, brand } = useTheme();
  const { appName } = getBrandContent(brand);
  const soft = softPrimary(isDark, colors, primaryRgba);

  // "Lose 6.5 kg to reach your goal" — only when both weights are valid numbers.
  const goalHint = (() => {
    const w = Number(weight);
    const g = Number(goalWeight);
    if (!(w > 0) || !(g > 0) || errors.weight || errors.goalWeight) return '';
    const diff = Math.round(Math.abs(w - g) * 10) / 10;
    if (diff === 0) return 'Goal: keep your current weight';
    return `${w > g ? 'Lose' : 'Gain'} ${diff} kg to reach your goal`;
  })();

  return (
    <View>
      <Text style={[styles.h1, { color: theme.text, fontFamily: FONT.nova }]}>Your health profile</Text>
      <Text style={[styles.sub, { color: theme.muted, fontFamily: snPro('400') }]}>
        We use this to set realistic calorie, protein and activity targets.
      </Text>

      {/* About you — names side by side, sex as one segmented control. */}
      <ProfileSection
        Icon={User}
        title="About you"
        theme={theme}
        onLayout={(e) => {
          const y = e.nativeEvent.layout.y;
          registerFieldY?.('firstName', y);
          registerFieldY?.('lastName', y);
          registerFieldY?.('phone', y);
        }}
      >
        <View style={styles.row2}>
          <View style={styles.row2Col}>
            <AppInput
              label="First name"
              tone="soft"
              value={firstName}
              onChangeText={setFirstName}
              onBlur={() => onBlurField?.('firstName')}
              placeholder="Alex"
              error={touched.firstName ? errors.firstName : ''}
              autoCapitalize="words"
              textContentType="givenName"
              autoComplete="given-name"
            />
          </View>
          <View style={styles.row2Col}>
            <AppInput
              label="Last name"
              tone="soft"
              value={lastName}
              onChangeText={setLastName}
              onBlur={() => onBlurField?.('lastName')}
              placeholder="Rivera"
              error={touched.lastName ? errors.lastName : ''}
              autoCapitalize="words"
              textContentType="familyName"
              autoComplete="family-name"
            />
          </View>
        </View>

        {phone ? (
          <PhoneInput
            tone="soft"
            label="Mobile number"
            value={phone.value}
            onChangeText={phone.onChange}
            onCountryChange={phone.onCountryChange}
            onBlur={phone.onBlur}
            placeholder="Enter mobile number"
            defaultCountry="IN"
            error={phone.error}
          />
        ) : null}

        <Text style={[styles.fieldGroupLbl, { color: theme.text, fontFamily: snPro('700') }]}>Sex</Text>
        <Segmented
          options={SEX_OPTS.map((o) => ({ id: o.id, label: o.id === 'Prefer not to say' ? 'Skip' : o.label }))}
          value={sex}
          onChange={setSex}
          theme={theme}
        />
      </ProfileSection>

      {/* Body — four number cards in a 2 x 2 grid. */}
      <ProfileSection
        Icon={Ruler}
        title="Your body"
        theme={theme}
        onLayout={(e) => {
          const y = e.nativeEvent.layout.y;
          ['age', 'height', 'weight', 'goalWeight'].forEach((k) => registerFieldY?.(k, y));
        }}
      >
        <View style={styles.row2}>
          <View style={styles.row2Col}>
            <FieldCard
              label="Age"
              value={age}
              onChangeText={setAge}
              onBlur={() => onBlurField?.('age')}
              keyboardType="number-pad"
              suffix="yrs"
              theme={theme}
              error={touched.age ? errors.age : ''}
            />
          </View>
          <View style={styles.row2Col}>
            <FieldCard
              label="Height"
              value={height}
              onChangeText={setHeight}
              onBlur={() => onBlurField?.('height')}
              keyboardType="number-pad"
              suffix="cm"
              theme={theme}
              error={touched.height ? errors.height : ''}
            />
          </View>
        </View>
        <View style={[styles.row2, { marginTop: 12 }]}>
          <View style={styles.row2Col}>
            <FieldCard
              label="Current weight"
              value={weight}
              onChangeText={setWeight}
              onBlur={() => onBlurField?.('weight')}
              keyboardType="decimal-pad"
              suffix="kg"
              theme={theme}
              error={touched.weight ? errors.weight : ''}
            />
          </View>
          <View style={styles.row2Col}>
            <FieldCard
              label="Goal weight"
              value={goalWeight}
              onChangeText={setGoalWeight}
              onBlur={() => onBlurField?.('goalWeight')}
              keyboardType="decimal-pad"
              suffix="kg"
              theme={theme}
              error={touched.goalWeight ? errors.goalWeight : ''}
            />
          </View>
        </View>
        {goalHint ? (
          <View style={[styles.goalHint, { backgroundColor: soft }]}>
            <Target size={14} color={colors.primary} strokeWidth={2.4} />
            <Text style={[styles.goalHintText, { color: colors.primaryDark, fontFamily: snPro('700') }]}>
              {goalHint}
            </Text>
          </View>
        ) : null}
      </ProfileSection>

      {/* Activity — segmented control with a plain-words hint for the picked level. */}
      <ProfileSection Icon={Activity} title="How active are you?" theme={theme}>
        <Segmented
          options={ACTIVITY.map((a) => ({ id: a, label: a }))}
          value={activity}
          onChange={setActivity}
          theme={theme}
        />
        <Text style={[styles.actHint, { color: theme.muted, fontFamily: snPro('500') }]}>
          {ACTIVITY_HINT[activity] || ''}
        </Text>
      </ProfileSection>

      {/* Daily target — the payoff, shown as a green card. */}
      <LinearGradient
        colors={isDark ? ['#1f4d22', '#173b1a'] : ['#358a3a', '#25692b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.suggestBox}
      >
        <View style={styles.suggestHead}>
          <View style={styles.suggestIcon}>
            <Flame size={16} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <Text style={[styles.suggestLbl, { fontFamily: snPro('700') }]}>{appName} suggests</Text>
        </View>
        <View style={styles.suggestRow}>
          <Text style={[styles.suggestNum, { fontFamily: FONT.nova }]}>{suggestedCals}</Text>
          <Text style={[styles.suggestUnit, { fontFamily: snPro('600') }]}>kcal / day</Text>
        </View>
        <View style={styles.macroRow}>
          {[
            ['Protein', suggestedMacros.protein],
            ['Carbs', suggestedMacros.carbs],
            ['Fat', suggestedMacros.fat],
          ].map(([k, v]) => (
            <View key={k} style={styles.macroPill}>
              <Text style={[styles.macroVal, { fontFamily: snPro('800') }]}>{v}g</Text>
              <Text style={[styles.macroKey, { fontFamily: snPro('500') }]}>{k}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const ACTIVITY_HINT = {
  Low: 'Mostly sitting, little exercise',
  Light: 'Walks or light exercise 1–3 days a week',
  Moderate: 'Exercise 3–5 days a week',
  High: 'Hard training most days',
};

/** White card with a small icon + title — groups related fields. */
function ProfileSection({ Icon, title, badge, theme, onLayout, children }) {
  const { colors } = useTheme();
  return (
    <View onLayout={onLayout} style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft || '#e2f2dc' }]}>
          <Icon size={15} color={colors.primary} strokeWidth={2.4} />
        </View>
        <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: snPro('800') }]}>{title}</Text>
        {badge ? (
          <Text style={[styles.sectionBadge, { color: theme.muted, borderColor: theme.border, fontFamily: snPro('700') }]}>
            {badge}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Equal-width segmented control: the picked option becomes a filled green pill. */
function Segmented({ options, value, onChange, theme }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segTrack, { backgroundColor: theme.track }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segItem, on && [styles.segItemOn, { backgroundColor: colors.primary }]]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segText, { color: on ? '#FFFFFF' : theme.text, fontFamily: snPro(on ? '800' : '600') }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FieldCard({ label, value, onChangeText, onBlur, keyboardType, suffix, large, theme, error }) {
  const text = String(value ?? '');
  const [inputW, setInputW] = useState(28);
  const hasError = !!error;
  const decimal = keyboardType === 'decimal-pad';
  const numeric = decimal || keyboardType === 'number-pad' || keyboardType === 'numeric';

  return (
    <View style={styles.fieldCardWrap}>
      <View
        style={[
          styles.fieldCard,
          large && { marginTop: 0 },
          {
            borderColor: hasError ? colors.danger : theme.border,
            backgroundColor: theme.cardBg,
          },
        ]}
      >
        <Text style={[styles.fieldLbl, { color: theme.text, fontFamily: snPro('600') }]}>{label}</Text>
        <View style={[styles.fieldValueRow, large && styles.fieldValueRowLarge]}>
          <Text
            style={[styles.fieldInput, styles.fieldMeasure, { color: theme.text, fontFamily: FONT.nova }]}
            onLayout={(e) => {
              const w = Math.ceil(e.nativeEvent.layout.width);
              setInputW(Math.max(w + 4, 20));
            }}
          >
            {text.length ? text : '0'}
          </Text>
          <TextInput
            value={text}
            onChangeText={(next) => onChangeText(numeric ? onlyNumbers(next, { decimal }) : next)}
            onBlur={onBlur}
            keyboardType={keyboardType || 'default'}
            inputMode={decimal ? 'decimal' : numeric ? 'numeric' : undefined}
            placeholderTextColor={theme.placeholder}
            underlineColorAndroid="transparent"
            selectionColor={colors.primary}
            style={[
              styles.fieldInput,
              { color: theme.text, fontFamily: FONT.nova, width: inputW },
              Platform.OS === 'web'
                ? { outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' }
                : null,
            ]}
          />
          {suffix ? (
            <Text style={[styles.fieldSuffix, { color: theme.muted, fontFamily: snPro('500') }]}>
              {suffix}
            </Text>
          ) : null}
        </View>
      </View>
      {hasError ? (
        <Text style={[styles.fieldError, { fontFamily: snPro('600') }]}>{error}</Text>
      ) : null}
    </View>
  );
}

/** Chip groups. `sections` picks which groups show — they are split across steps 1 and 2. */
function AllergiesStep({
  diet,
  setDiet,
  allergies,
  setAllergies,
  conditions,
  setConditions,
  toggleMap,
  theme,
  sections = ['diet', 'allergies', 'conditions'],
}) {
  const has = (key) => sections.includes(key);
  const renderPills = (items, selected, setter, exclusiveKey) =>
    items.map((a) => {
      const on = !!selected[a];
      const chip = chipStyle(on, theme);
      return (
        <Pressable
          key={a}
          onPress={() => toggleMap(setter, a, exclusiveKey)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: on }}
          style={({ pressed }) => [styles.pill, chip.box, pressed && { opacity: 0.85 }]}
        >
          {on ? <Check size={13} color="#FFFFFF" strokeWidth={3} /> : null}
          <Text style={[styles.pillText, chip.text]}>{a}</Text>
        </Pressable>
      );
    });

  return (
    <View>
      {has('diet') ? (
        <ProfileSection Icon={Leaf} title="Food preference" theme={theme}>
          <View style={styles.chipWrap}>{renderPills(DIET_OPTS, diet, setDiet, 'No preference')}</View>
        </ProfileSection>
      ) : null}

      {has('allergies') ? (
        <ProfileSection Icon={ShieldAlert} title="Allergies or foods to avoid" theme={theme}>
          <View style={styles.chipWrap}>{renderPills(ALLERGENS, allergies, setAllergies)}</View>
        </ProfileSection>
      ) : null}

      {has('conditions') ? (
        <ProfileSection Icon={HeartPulse} title="Any health conditions?" badge="Optional" theme={theme}>
          <View style={styles.chipWrap}>{renderPills(CONDITIONS, conditions, setConditions, 'None')}</View>
          <Text style={[styles.chipNote, { color: theme.muted, fontFamily: snPro('500') }]}>
            Only used to tailor suggestions. Never shared without your permission.
          </Text>
        </ProfileSection>
      ) : null}
    </View>
  );
}

function WorkoutStep({ age, level, routineId, setLevel, setRoutine, theme, isDark }) {
  const { colors } = useTheme();
  useExerciseCatalog(); // routines come from the server; re-render when they arrive
  const suggested = suggestedLevel(age);
  const routines = ROUTINES.filter((r) => levelOf(r) === level);
  // Small green bits (tags, pills, idle icons) need a lighter green to read in dark mode.
  const accent = isDark ? '#8fd192' : colors.primaryDark;
  const tint = isDark ? 'rgba(124,196,127,0.16)' : colors.primarySoft || '#e2f2dc';

  return (
    <View>
      <Text style={[styles.h1, { color: theme.text, fontFamily: FONT.nova }]}>Workout and reminders</Text>
      <Text style={[styles.sub, { color: theme.muted, fontFamily: snPro('400') }]}>
        Pick a daily routine for your home screen and when we should nudge you. You can change both later.
      </Text>

      <ProfileSection Icon={Dumbbell} title="Workout level" theme={theme}>
        <View style={styles.row2}>
          {LEVELS.map((l) => {
            const on = level === l.id;
            const LvlIcon = l.id === 'gentle' ? Armchair : Zap;
            return (
              <Pressable
                key={l.id}
                onPress={() => setLevel(l.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [
                  styles.levelTile,
                  on
                    ? { borderColor: colors.primary, backgroundColor: isDark ? theme.cardBg : '#f7fcf5' }
                    : { borderColor: theme.border, backgroundColor: theme.cardBg },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.levelTop}>
                  <View style={[styles.goalIcon, { backgroundColor: on ? colors.primary : theme.track }]}>
                    <LvlIcon size={20} color={on ? '#FFFFFF' : accent} strokeWidth={2.2} />
                  </View>
                  <View
                    style={[
                      styles.goalCheck,
                      on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: theme.border },
                    ]}
                  >
                    {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                </View>
                <Text style={[styles.levelTitle, { color: theme.text, fontFamily: snPro('800') }]}>{l.label}</Text>
                <Text style={[styles.levelSub, { color: theme.muted, fontFamily: snPro('500') }]}>
                  {l.id === 'gentle' ? 'Beginners · chair moves, balance, easy yoga' : 'Fit · cardio, strength, core'}
                </Text>
                {l.id === suggested ? (
                  <View style={[styles.suggestTag, { backgroundColor: tint }]}>
                    <Text
                      style={[styles.suggestTagText, { color: accent, fontFamily: snPro('800') }]}
                      numberOfLines={1}
                    >
                      ★ Suggested
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ProfileSection>

      <View style={styles.goalHeadRow}>
        <Text style={[styles.goalHeadLbl, { color: theme.text, fontFamily: snPro('800') }]}>Daily routine</Text>
        <Text style={[styles.goalHeadHint, { color: theme.muted, fontFamily: snPro('500') }]}>Pick one</Text>
      </View>
      <View style={styles.goalList}>
        {routines.map((r) => {
          const on = routineId === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setRoutine(r.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.goalRow,
                selectableCard(on, theme, isDark),
                on && !isDark && { backgroundColor: '#f7fcf5' },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={[styles.goalIcon, { backgroundColor: on ? colors.primary : theme.track }]}>
                <Flame size={20} color={on ? '#FFFFFF' : accent} strokeWidth={2.2} />
              </View>
              <View style={styles.goalText}>
                <View style={styles.routineTitleRow}>
                  <Text
                    style={[styles.goalTitle, { color: theme.text, fontFamily: snPro('800'), flexShrink: 1 }]}
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                  <View style={[styles.minPill, { backgroundColor: tint }]}>
                    <Timer size={11} color={accent} strokeWidth={2.4} />
                    <Text style={[styles.minText, { color: accent, fontFamily: snPro('800') }]}>
                      {routineMinutes(r)} min
                    </Text>
                  </View>
                </View>
                <Text style={[styles.goalSub, { color: theme.muted, fontFamily: snPro('500') }]} numberOfLines={2}>
                  {r.description}
                </Text>
              </View>
              <View
                style={[
                  styles.goalCheck,
                  on ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: theme.border },
                ]}
              >
                {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Reminder toggles — shown as a section under the workout picker (step 3). */
function NotifsStep({ notifs, setNotifs, theme, isDark }) {
  return (
    <ProfileSection Icon={Bell} title="Reminders" theme={theme}>
      <Text style={[styles.notifIntro, { color: theme.muted, fontFamily: snPro('500') }]}>
        At most three nudges a day, never during quiet hours.
      </Text>

      <View>
        {NOTIF_OPTS.map((n, i) => {
          const on = !!notifs[n.id];
          return (
            <Pressable
              key={n.id}
              onPress={() => setNotifs((prev) => ({ ...prev, [n.id]: !prev[n.id] }))}
              style={[
                styles.notifRow,
                i < NOTIF_OPTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.notifTitle, { color: theme.text, fontFamily: snPro('800') }]}>
                  {n.label}
                </Text>
                <Text style={[styles.notifSub, { color: theme.muted, fontFamily: snPro('400') }]}>
                  {n.sub}
                </Text>
              </View>
              <View pointerEvents="none">
                <Switch
                  value={on}
                  onValueChange={() => {}}
                  trackColor={{ false: isDark ? '#3A3A3C' : '#D1D5DB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.quietRow, { backgroundColor: theme.track }]}>
        <Moon size={18} color={colors.primaryDark} strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.notifTitle, { color: theme.text, fontFamily: snPro('700') }]}>
            Quiet hours
          </Text>
          <Text style={[styles.notifSub, { color: theme.muted, fontFamily: snPro('400') }]}>
            No notifications in this window
          </Text>
        </View>
        <Text style={[styles.quietTime, { color: theme.text, fontFamily: FONT.nova }]}>22:00–07:00</Text>
      </View>
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  blobA: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  blobB: {
    position: 'absolute',
    top: 180,
    left: -90,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  welcomeBlob: {
    position: 'absolute',
    right: -110,
    bottom: -90,
    width: 240,
    height: 200,
    borderRadius: 120,
    backgroundColor: '#d6e9cd',
  },
  welcomeScreen: { flex: 1, overflow: 'hidden' },
  // welcomeScroll: { paddingBottom: 16 },
  welcomeScroll: { paddingBottom: 0 },
  leafLWrap: { position: 'absolute', left: 0, top: 20, zIndex: 2 },
  leafRWrap: { position: 'absolute', right: 4, top: 90, zIndex: 2 },
  leafL: { width: 90, height: 90 },
  leafR: { width: 82, height: 82 },
  brandBlock: { alignItems: 'center', marginTop: 4 },
  brandName: {
    marginTop: 2,
    fontSize: 26,
    color: WELCOME.greenDark,
    letterSpacing: 0.2,
  },
  brandTag: { marginTop: 2, fontSize: 10.5, color: '#556072' },
  // headline: { alignItems: 'center', marginTop: 18, paddingHorizontal: 16 },
  headline: { alignItems: 'center', marginTop: 10, paddingHorizontal: 16 },
  headlineTitle: {
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.3,
    color: WELCOME.ink,
    textAlign: 'center',
  },
  headlineTitleGreen: {
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.3,
    color: WELCOME.greenDark,
    textAlign: 'center',
  },
  swoosh: { marginTop: -2, alignSelf: 'center' },
  lead: {
    // marginTop: 10,
    marginTop: 5,
    paddingHorizontal: 24,
    // fontSize: 13,
    fontSize: 10,
    lineHeight: 17,
    color: WELCOME.muted,
    textAlign: 'center',
  },
  heroWrap: {
    width: '100%',
    height: 210,
    // marginTop: 14,
    marginTop: 0,
    overflow: 'hidden',
  },
  heroImg: { width: '100%', height: '100%' },
  featureGrid: { gap: 8, paddingHorizontal: 16 },
  featureRow: { flexDirection: 'row', gap: 8 },
  /** The animated wrapper takes the card's place in the row; the card fills it. */
  featureCell: { flex: 1, minWidth: 0 },
  featureCardFill: { flexGrow: 1 },
  featureCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: WELCOME.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#1e3c1e',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: { flex: 1, minWidth: 0 },
  featureTitle: { fontSize: 10.5, lineHeight: 13, color: WELCOME.ink, textAlign: 'center' },
  featureSub: { fontSize: 9.5, lineHeight: 12.5, color: WELCOME.muted },
  benefits: {
    // marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: 'rgba(230,243,228,0.6)',
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 10,
  },
  benefit: { flex: 1, alignItems: 'center', paddingHorizontal: 4, position: 'relative' },
  benefitDivider: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#d4e3d2',
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcefd8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  benefitLabel: {
    fontSize: 9.5,
    lineHeight: 12.5,
    color: '#2a3442',
    textAlign: 'center',
  },
  ctaBtn: {
    marginTop: 12,
    marginHorizontal: 22,
    height: 46,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#2e7d32',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  ctaGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16 },
  // signinRow: { alignItems: 'center', marginTop: 18, paddingBottom: 4 },
  signinRow: { alignItems: 'center', marginTop: 3, paddingBottom: 4 },
  signinText: { fontSize: 11.5, color: '#3c4656' },
  accountLink: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  accountText: { fontSize: 14 },
  obHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...CARD_SHADOW,
  },
  obHeadBody: { flex: 1 },
  stepLbl: { fontSize: 12 },
  progressTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 6 },
  scroll: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  h1: { fontSize: 26, lineHeight: 34 },
  sub: { marginTop: 6, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  list: { gap: 10 },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
  },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  goalCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
  },
  goalHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  goalHeadLbl: { fontSize: 15 },
  countPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  countText: { fontSize: 12 },
  goalList: { gap: 10, marginBottom: 16 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  goalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  goalText: { flex: 1, minWidth: 0 },
  goalCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: { fontSize: 15, lineHeight: 19 },
  goalHeadHint: { fontSize: 12 },
  googleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    marginBottom: 14,
  },
  googleChipText: { fontSize: 12.5, flexShrink: 1 },
  levelTile: { flex: 1, minWidth: 0, padding: 12, borderRadius: 16, borderWidth: 1.5 },
  levelTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  levelTitle: { marginTop: 10, fontSize: 14.5 },
  levelSub: { marginTop: 3, fontSize: 11.5, lineHeight: 15 },
  suggestTag: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  suggestTagText: { fontSize: 11 },
  routineTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  minPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
  },
  minText: { fontSize: 10.5 },
  goalSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  sectionBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  ctaShadow: CARD_SHADOW_ON,
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectTitle: { fontSize: 14 },
  selectSub: { fontSize: 12, marginTop: 2 },
  row2: { flexDirection: 'row', gap: 14 },
  row2Col: { flex: 1, minWidth: 0 },
  row2AfterSex: { marginTop: 20 },
  weightBlock: { marginTop: 16 },
  fieldCardWrap: { width: '100%' },
  fieldCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  fieldError: { color: colors.danger, fontSize: 11, marginTop: 6, lineHeight: 14 },
  fieldLbl: { fontSize: 11 },
  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 4,
    gap: 6,
    position: 'relative',
  },
  fieldValueRowLarge: { justifyContent: 'flex-start' },
  fieldInput: {
    fontSize: 24,
    padding: 0,
    margin: 0,
    minHeight: 32,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  fieldMeasure: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    left: 0,
    top: 0,
  },
  fieldSuffix: { fontSize: 13, marginBottom: 4 },
  sectionLbl: { marginTop: 20, marginBottom: 10, fontSize: 13 },
  sexList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sexRow: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexRadio: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexLbl: { fontSize: 13 },
  radioDot: { width: 10, height: 10, borderRadius: 99 },
  actRow: { flexDirection: 'row', gap: 8 },
  actChip: {
    flex: 1,
    height: 38,
    borderRadius: 99,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actText: { fontSize: 13 },
  section: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    ...CARD_SHADOW,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15 },
  fieldGroupLbl: { fontSize: 13, marginBottom: 8 },
  segTrack: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  segItem: {
    flex: 1,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segItemOn: {
    shadowColor: '#2e7d32',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  segText: { fontSize: 13 },
  actHint: { fontSize: 12.5, marginTop: 10, textAlign: 'center' },
  goalHint: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  goalHintText: { fontSize: 12.5 },
  suggestBox: {
    marginTop: 2,
    padding: 18,
    borderRadius: 20,
    overflow: 'hidden',
  },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestLbl: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  suggestRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  suggestNum: { fontSize: 36, color: '#FFFFFF' },
  suggestUnit: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  macroPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  macroVal: { fontSize: 15, color: '#FFFFFF' },
  macroKey: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  textFieldInput: { fontSize: 16, paddingVertical: 4, paddingHorizontal: 0 },
  chipSection: { fontSize: 13, marginTop: 18, marginBottom: 10 },
  chipSectionFirst: { marginTop: 0 },
  chipNote: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  notifIntro: { fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 8, columnGap: 8 },
  pill: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { fontSize: 13 },
  notifCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  notifTitle: { fontSize: 14 },
  notifSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  quietRow: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quietTime: { fontSize: 15 },
  // footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  footer: { paddingHorizontal: 24, paddingTop: 3, paddingBottom: 0 },
});
