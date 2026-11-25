import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Pressable,
  Platform,
  TextInput,
} from 'react-native';
import {
  Target,
  Moon,
  Sparkles,
  Info,
  ChevronRight,
  Scale,
  Flame,
  Mic,
  Compass,
  Bell,
  Shield,
  Crown,
  Coins,
  Heart,
  Dumbbell,
  Barcode,
  ChartLine,
  User,
  CalendarDays,
  ShoppingBag,
  MessageCircle,
  HeartPulse,
  GraduationCap,
  LogOut,
  Zap,
  Footprints,
  Armchair,
  Search,
  X,
  Pencil,
  FileText,
  Fingerprint,
} from 'lucide-react-native';
import { BIOMETRIC_SUPPORTED, BIOMETRIC_NOTE } from '../../utils/biometric';
import ScreenShell from '../../components/common/ScreenShell';
import AvatarInitial from '../../components/common/AvatarInitial';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { useInbox } from '../../context/InboxContext';
import { useSteps } from '../../context/StepsContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useFeatureCatalog } from '../../context/FeatureCatalogContext';
import { FONT, snPro, poppins } from '../../config/fonts';
import { APP_NAME, APP_FULL_NAME } from '../../config/brandContent';
import { toast } from '../../utils/toast';

const GOAL_LABEL = { lose: 'Lose weight', maintain: 'Maintain', gain: 'Gain muscle' };

function matchesQuery(query, ...parts) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return parts.filter(Boolean).join(' ').toLowerCase().includes(q);
}

const INK = '#0d1b2a';
const MUTED = '#4b5563';
const PAGE_BG = '#f2f8ef';
const ROW_LINE = '#eef2ec';

const cardShadow = Platform.select({
  web: { boxShadow: '0 4px 14px rgba(30,94,36,0.06)' },
  default: {
    shadowColor: '#1e5e24',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});

/** Soft tint for a row's icon tile (hex colours get ~10% alpha). */
function tint(color, fallback) {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return `${color}1A`;
  return fallback;
}

export default function MoreScreen({ navigation }) {
  const {
    isDark,
    toggleTheme,
    colors,
    themeColors: c,
  } = useTheme();
  const { profile, goal, totals } = useDiary();
  const { user, signOut, biometric, enableBiometric, disableBiometric } = useAuth();
  const { unread } = useInbox();
  const { today: stepsToday, connected: stepsConnected, isAccountView: stepsFromAccount, hasSteps } = useSteps();
  const { confirm } = useConfirm();
  const { isActive, getFeature } = useFeatureCatalog();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searching = query.trim().length > 0;

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.displayName ||
    profile.name ||
    'Health line user';
  const displayEmail = user?.email || profile.email || '';
  const planLabel = user?.plan === 'Plus'
    ? `${APP_NAME} Plus`
    : user?.plan === 'Family'
      ? `${APP_NAME} Family`
      : user?.plan || 'Free';

  const goTab = (tab) => {
    navigation.navigate(tab);
  };
  const goStack = (screen, params) => {
    // Catalog-managed stack screens respect Inactive status.
    if (!isActive({ route: screen })) {
      const label = getFeature({ route: screen })?.label || 'This feature';
      toast.warning(`${label} is currently unavailable`);
      return;
    }
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate(screen, params);
      return;
    }
    navigation.navigate(screen, params);
  };

  /** More → Preferences toggle: fingerprint / face sign-in on this phone. */
  const bioOn = !!(user?.id && biometric?.user?.userId === user.id);
  const toggleBiometric = async () => {
    if (bioOn) {
      const ok = await confirm({
        title: `Turn off ${biometric.label.toLowerCase()} sign-in?`,
        message: 'You will sign in with email or Google on this phone.',
        confirmLabel: 'Turn off',
        cancelLabel: 'Cancel',
      });
      if (ok) await disableBiometric();
      return;
    }
    const replacing = biometric?.user && biometric.user.userId !== user?.id;
    const ok = await confirm({
      title: `Turn on ${biometric.label.toLowerCase()} sign-in?`,
      message: `${
        replacing
          ? `${biometric.user.name || 'Another account'} uses fingerprint sign-in on this phone. Turning it on here replaces that.\n\n`
          : ''
      }${BIOMETRIC_NOTE}`,
      confirmLabel: 'Turn on',
      cancelLabel: 'Cancel',
      destructive: false,
    });
    if (!ok) return;
    await enableBiometric();
  };

  const logOut = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'You can sign back in anytime with the same email.',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      destructive: false,
    });
    if (!ok) return;
    await signOut();
  };

  const pageTint = isDark ? c.pageBg : PAGE_BG;
  const ink = isDark ? c.text : INK;
  const muted = isDark ? c.muted : MUTED;
  const cardBg = isDark ? c.cardBg : '#FFFFFF';
  const theme = { ...c, text: ink, muted, cardBg, line: isDark ? c.border : ROW_LINE };

  return (
    <ScreenShell style={{ backgroundColor: pageTint }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Text style={[styles.headerTitle, { color: ink, fontFamily: FONT.heading }]}>More</Text>
          <Pressable
            style={({ pressed }) => [
              styles.searchBtn,
              cardShadow,
              { backgroundColor: cardBg, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => {
              if (searchOpen || searching) {
                setQuery('');
                setSearchOpen(false);
              } else {
                setSearchOpen(true);
              }
            }}
            accessibilityLabel={searchOpen ? 'Close search' : 'Search'}
          >
            {searchOpen || searching ? <X size={18} color={colors.primaryDark} /> : <Search size={18} color={colors.primaryDark} />}
          </Pressable>
        </View>

        {searchOpen || searching ? (
          <View style={[styles.searchBar, cardShadow, { backgroundColor: cardBg }]}>
            <Search size={16} color={muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search settings"
              placeholderTextColor={muted}
              style={[styles.searchInput, { color: ink, fontFamily: snPro('500') }]}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              returnKeyType="search"
            />
          </View>
        ) : null}

        {searching ? null : (
          <Pressable
            onPress={() => goStack('Profile')}
            style={({ pressed }) => [
              styles.profileCard,
              cardShadow,
              { backgroundColor: cardBg, opacity: pressed ? 0.92 : 1 },
            ]}
            accessibilityLabel="Open profile"
          >
            <AvatarInitial name={displayName} uri={user?.photoURL} size={56} backgroundColor={colors.primary} />
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: ink, fontFamily: poppins('600') }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.profileEmail, { color: muted, fontFamily: snPro('400') }]} numberOfLines={1}>
                {displayEmail || planLabel}
              </Text>
            </View>
            <View style={styles.profileRight}>
              <Pressable
                onPress={(event) => {
                  event?.stopPropagation?.();
                  goStack('Subscription');
                }}
                hitSlop={6}
                style={[styles.planPill, { backgroundColor: colors.primaryDark }]}
                accessibilityLabel={`Plan: ${planLabel}`}
              >
                <Text style={[styles.planPillText, { fontFamily: snPro('700') }]} numberOfLines={1}>
                  {planLabel}
                </Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event?.stopPropagation?.();
                  goStack('ProfileEdit');
                }}
                hitSlop={8}
                style={[styles.editBtn, { backgroundColor: tint(colors.primary, c.chip) }]}
                accessibilityLabel="Edit profile"
              >
                <Pencil size={14} color={colors.primary} />
              </Pressable>
            </View>
          </Pressable>
        )}

        <MenuSections
          query={query}
          theme={theme}
          colors={colors}
          isDark={isDark}
          isActive={isActive}
          goStack={goStack}
          goTab={goTab}
          toggleTheme={toggleTheme}
          profile={profile}
          goal={goal}
          totals={totals}
          stepsFromAccount={stepsFromAccount}
          hasSteps={hasSteps}
          stepsConnected={stepsConnected}
          stepsToday={stepsToday}
          user={user}
          unread={unread}
          planLabel={planLabel}
          biometric={biometric}
          bioOn={bioOn}
          toggleBiometric={toggleBiometric}
        />

        {(!searching || matchesQuery(query, 'Log out', 'sign out')) ? (
          <Pressable
            onPress={logOut}
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.logoutBtn,
              {
                backgroundColor: cardBg,
                borderColor: isDark ? c.border : '#cfe3c7',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <LogOut size={16} color={isDark ? colors.primary : '#1e5e24'} />
            <Text style={[styles.logoutText, { color: isDark ? colors.primary : '#1e5e24', fontFamily: snPro('700') }]}>
              Sign out
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

function Section({ title, theme, query, bucket, children }) {
  const items = React.Children.toArray(children).filter((child) => {
    if (!child) return false;
    const { title: rowTitle, subtitle, keywords, value } = child.props || {};
    return matchesQuery(query, title, rowTitle, subtitle, keywords, typeof value === 'string' ? value : '');
  });
  if (bucket && items.length) bucket.count += items.length;
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.muted, fontFamily: poppins('600') }]}>{title}</Text>
      <View style={[styles.group, cardShadow, { backgroundColor: theme.cardBg }]}>
        {items.map((child, index) => React.cloneElement(child, { last: index === items.length - 1 }))}
      </View>
    </View>
  );
}

function LinkRow({ icon: Icon, title, subtitle, theme, color, onPress, last, right, value }) {
  const iconColor = color || theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [
        styles.groupRow,
        !last && { borderBottomWidth: 1, borderBottomColor: theme.line },
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.groupIcon, { backgroundColor: tint(iconColor, theme.chip) }]}>
        <Icon size={16} color={iconColor} />
      </View>
      <Text style={[styles.menuTitle, { color: theme.text, fontFamily: snPro('700') }]} numberOfLines={1}>
        {title}
      </Text>
      {value ? (
        <Text style={[styles.rowValue, { color: theme.muted, fontFamily: snPro('400') }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right || <ChevronRight size={14} color="#6b7280" />}
    </Pressable>
  );
}

function MenuSections({
  query,
  theme,
  colors,
  isDark,
  isActive,
  goStack,
  goTab,
  toggleTheme,
  profile,
  goal,
  totals,
  stepsFromAccount,
  hasSteps,
  stepsConnected,
  stepsToday,
  user,
  unread,
  planLabel,
  biometric,
  bioOn,
  toggleBiometric,
}) {
  const tokenLabel = `${Number(user?.tokenBalance || 0).toLocaleString('en-IN')} tokens`;
  const logoutHit = matchesQuery(query, 'Log out', 'sign out');
  const profileText = [profile.name, GOAL_LABEL[goal]].filter(Boolean).join(' · ') || 'Your details';
  const bucket = { count: 0 };
  const has = (v) => v !== undefined && v !== null && v !== '';
  const healthValue = has(profile.weight) && has(profile.heightCm)
    ? `${profile.weight} kg · ${profile.heightCm} cm`
    : has(profile.heightCm) ? `${profile.heightCm} cm` : null;
  const stepsValue = stepsConnected && !(stepsFromAccount && !hasSteps)
    ? `${Number(stepsToday || 0).toLocaleString('en-IN')} today`
    : null;
  return (
    <>
      <Section title="Account" theme={theme} query={query} bucket={bucket}>
        <LinkRow
          icon={User}
          title="Profile"
          subtitle={profileText}
          value={GOAL_LABEL[goal]}
          keywords="account"
          theme={theme}
          color={colors.primary}
          onPress={() => goStack('Profile')}
        />
        <LinkRow
          icon={Crown}
          title="Subscription"
          subtitle={`${planLabel} · ${tokenLabel}`}
          value={planLabel}
          keywords="payment pay plan"
          theme={theme}
          color={colors.carbs}
          onPress={() => goStack('Subscription')}
        />
        <LinkRow
          icon={Coins}
          title="Buy tokens"
          subtitle="Add tokens without changing your plan"
          value={tokenLabel}
          keywords="payment pay tokens"
          theme={theme}
          color={colors.primary}
          onPress={() => goStack('BuyTokens')}
        />
      </Section>

      <Section title="Food" theme={theme} query={query} bucket={bucket}>
        {isActive({ route: 'MealPlan' }) ? (
          <LinkRow icon={CalendarDays} title="Meal plan" subtitle="Today's meals" theme={theme} color={colors.primary} onPress={() => goStack('MealPlan')} />
        ) : null}
        <LinkRow icon={ShoppingBag} title="Grocery" subtitle="Shopping list" theme={theme} color={colors.accent} onPress={() => goStack('GroceryList')} />
        <LinkRow icon={Compass} title="Recipes" subtitle="Discover meals" theme={theme} color={colors.primary} onPress={() => goTab('Discover')} />
        <LinkRow icon={Heart} title="Favorites" subtitle="Saved foods" theme={theme} color={colors.danger} onPress={() => goStack('Favorites')} />
        {isActive({ route: 'BarcodeScan' }) ? (
          <LinkRow icon={Barcode} title="Barcode" subtitle="Scan a package" theme={theme} color={colors.primary} onPress={() => goStack('BarcodeScan', { meal: 'snacks' })} />
        ) : null}
        {isActive({ route: 'ScanFood' }) ? (
          <LinkRow icon={Sparkles} title="AI meal scan" subtitle="Photo of a meal" theme={theme} color={colors.aiPurple} onPress={() => goStack('ScanFood', { meal: 'lunch' })} />
        ) : null}
        {isActive({ route: 'VoiceLog' }) ? (
          <LinkRow icon={Mic} title="Voice log" subtitle="Speak a meal" theme={theme} color={colors.aiPurple} onPress={() => goStack('VoiceLog', { meal: 'snacks' })} />
        ) : null}
        <LinkRow
          icon={Flame}
          title="Today's intake"
          subtitle={`${totals.calories} kcal logged`}
          value={`${totals.calories} kcal`}
          theme={theme}
          color={colors.carbs}
          onPress={() => goTab('Diary')}
        />
      </Section>

      <Section title="Coach" theme={theme} query={query} bucket={bucket}>
        {isActive({ route: 'Coach' }) ? (
          <LinkRow icon={MessageCircle} title="AI coach" subtitle="Ask about food and habits" theme={theme} color={colors.aiPurple} onPress={() => goStack('Coach')} />
        ) : null}
        {isActive({ route: 'Medicare' }) ? (
          <LinkRow icon={HeartPulse} title="Medicare" subtitle="Health questions" theme={theme} color={colors.danger} onPress={() => goStack('Medicare')} />
        ) : null}
        {isActive({ aiKey: 'workoutAi' }) ? (
          <LinkRow icon={Dumbbell} title="Workout AI" subtitle="A workout for today" theme={theme} color={colors.exercise} onPress={() => goStack('WorkoutAi')} />
        ) : null}
        {isActive({ route: 'Programs' }) ? (
          <LinkRow icon={GraduationCap} title="Programs" subtitle="Guided plans" theme={theme} color={colors.exercise} onPress={() => goStack('Programs')} />
        ) : null}
        <LinkRow icon={Armchair} title="Exercises at home" subtitle="Gentle and active workouts" theme={theme} color={colors.primary} onPress={() => goStack('HomeExercises')} />
      </Section>

      <Section title="Health" theme={theme} query={query} bucket={bucket}>
        <LinkRow icon={HeartPulse} title="Health tracks" subtitle="PCOS, thyroid, blood sugar, blood pressure" theme={theme} color={colors.aiPurple} onPress={() => goStack('HealthTracks')} />
        <LinkRow icon={FileText} title="Health reports" subtitle="Lab reports, results and explanations" keywords="health report health records lab report blood test results medical report upload" theme={theme} color={colors.danger} onPress={() => goStack('HealthRecords')} />
        <LinkRow icon={FileText} title="Download health report" subtitle="PDF of food, exercise, water, steps and weight" keywords="download pdf report card summary export my data total report" theme={theme} color={colors.primary} onPress={() => goStack('HealthReportDownload')} />
        <LinkRow icon={User} title="Health details" subtitle={`${profile.age} yrs · ${profile.heightCm} cm`} value={healthValue} theme={theme} color={colors.primary} onPress={() => goStack('HealthProfile')} />
        <LinkRow icon={Target} title="Nutrition goals" subtitle={`${profile.protein}g protein · ${profile.carbs}g carbs · ${profile.fat}g fat`} theme={theme} color={colors.primary} onPress={() => goStack('EditGoals')} />
        <LinkRow
          icon={Footprints}
          title="Steps"
          subtitle={
            stepsFromAccount && !hasSteps
              ? 'Not synced from your phone yet'
              : stepsConnected
                ? `${stepsToday.toLocaleString('en-IN')} steps today`
                : 'Connect step tracking'
          }
          value={stepsValue}
          theme={theme}
          color={colors.primary}
          onPress={() => goStack('Steps')}
        />
        {isActive({ route: 'LogWeight' }) ? (
          <LinkRow icon={Scale} title="Log weight" subtitle={`${profile.weight} kg · goal ${profile.goalWeight} kg`} value={has(profile.weight) ? `${profile.weight} kg` : null} theme={theme} color={colors.accent} onPress={() => goStack('LogWeight')} />
        ) : null}
        {isActive({ route: 'LogExercise' }) ? (
          <LinkRow icon={Dumbbell} title="Log exercise" subtitle="Walk, run, strength and more" theme={theme} color={colors.exercise} onPress={() => goStack('LogExercise')} />
        ) : null}
        <LinkRow icon={ChartLine} title="Weekly report" subtitle="Calories, weight and activity" theme={theme} color={colors.exercise} onPress={() => goStack('WeeklyReport')} />
        <LinkRow icon={ChartLine} title="Exercise report" subtitle="Minutes, sessions and streak" theme={theme} color={colors.primary} onPress={() => goStack('ExerciseReport')} />
      </Section>

      <Section title="Preferences" theme={theme} query={query} bucket={bucket}>
        <LinkRow
          icon={Moon}
          title="Dark mode"
          subtitle={isDark ? 'On' : 'Off'}
          keywords="dark light theme appearance"
          theme={theme}
          color={colors.primary}
          onPress={toggleTheme}
          right={
            <ThemeSwitch
              value={isDark}
              isDark={isDark}
              colors={colors}
              onChange={() => toggleTheme()}
            />
          }
        />
        {BIOMETRIC_SUPPORTED && user && biometric?.available ? (
          <LinkRow
            icon={Fingerprint}
            title={`${biometric.label} sign-in`}
            subtitle={
              bioOn
                ? 'On · works with every finger / face in this phone’s lock'
                : 'Sign in with your finger or face'
            }
            keywords="fingerprint face biometric unlock security login"
            theme={theme}
            color={colors.primary}
            onPress={toggleBiometric}
            right={<ThemeSwitch value={bioOn} isDark={isDark} colors={colors} onChange={() => toggleBiometric()} />}
          />
        ) : null}
        {user ? (
          <LinkRow
            icon={Bell}
            title="Notifications"
            subtitle={unread ? `${unread} unread` : 'Updates'}
            value={unread ? `${unread} unread` : null}
            theme={theme}
            color={colors.primary}
            onPress={() => goStack('Notifications')}
          />
        ) : null}
        {isActive({ route: 'Reminders' }) ? (
          <LinkRow icon={Bell} title="Reminders" subtitle="Meal and water nudges" theme={theme} color={colors.protein} onPress={() => goStack('Reminders')} />
        ) : null}
      </Section>
      <Section title="About" theme={theme} query={query} bucket={bucket}>
        <LinkRow icon={Shield} title="Privacy" subtitle="How your data is handled" theme={theme} color={colors.primary} onPress={() => goStack('PrivacyPolicy')} />
        <LinkRow icon={Scale} title="Terms and conditions" subtitle="Rules for using the app" theme={theme} color={colors.primary} onPress={() => goStack('Terms')} />
        <LinkRow icon={Info} title="About" subtitle={APP_FULL_NAME} theme={theme} color={colors.primary} onPress={() => goStack('AboutUs')} />
        <LinkRow icon={MessageCircle} title="Feedback" subtitle="Tell us what to fix or add" theme={theme} color={colors.primary} onPress={() => goStack('Feedback')} />
        <LinkRow icon={Zap} title="All features" subtitle="Everything in the app" theme={theme} color={colors.aiPurple} onPress={() => goStack('FeaturesHub')} />
      </Section>
      <NoMatchNote query={query} theme={theme} bucket={bucket} logoutHit={logoutHit} />
    </>
  );
}

function NoMatchNote({ query, theme, bucket, logoutHit }) {
  const q = String(query || '').trim();
  if (!q || logoutHit || bucket.count > 0) return null;
  return (
    <Text style={[styles.emptySearch, { color: theme.muted, fontFamily: snPro('500') }]}>
      No results for "{q}"
    </Text>
  );
}

// The Switch handles its own tap (Android ignores pointerEvents on a native Switch, so a
// handler-less switch swallowed taps and snapped back).
function ThemeSwitch({ value, isDark, colors, onChange }) {
  return (
    <Switch
      value={value}
      onValueChange={(v) => onChange?.(v)}
      trackColor={{ false: isDark ? '#3A3A3C' : '#D1D5DB', true: colors.primary }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={isDark ? '#3A3A3C' : '#D1D5DB'}
    />
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  headerTitle: { flex: 1, fontSize: 22 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  emptySearch: { textAlign: 'center', marginTop: 28, fontSize: 14 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 17 },
  profileEmail: { fontSize: 13, marginTop: 2 },
  profileRight: { alignItems: 'flex-end', gap: 8, maxWidth: '40%' },
  planPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  planPillText: { color: '#FFFFFF', fontSize: 12 },
  editBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 13, marginBottom: 6, marginLeft: 2 },
  group: { borderRadius: 16, paddingHorizontal: 16 },
  groupRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 8, gap: 10 },
  groupIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { flex: 1, fontSize: 14 },
  rowValue: { fontSize: 13, maxWidth: '45%' },
  logoutBtn: {
    marginTop: 22,
    height: 48,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { fontSize: 14 },
});
