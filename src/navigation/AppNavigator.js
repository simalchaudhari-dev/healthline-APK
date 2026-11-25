import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { themeColors } from '../config/colors';
import LoadingScreen from '../components/common/LoadingScreen';
import MainTabs from './MainTabs';
import OnboardingScreen from '../screens/Onboarding/OnboardingScreen';
import {
  SignInScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  VerifyResetOtpScreen,
  ResetPasswordScreen,
} from '../screens/Auth/AuthScreens';
import AddFoodScreen from '../screens/Diary/AddFoodScreen';
import FoodDetailScreen from '../screens/Diary/FoodDetailScreen';
import ScanFoodScreen from '../screens/Diary/ScanFoodScreen';
import VoiceLogScreen from '../screens/Diary/VoiceLogScreen';
import ManualFoodScreen from '../screens/Diary/ManualFoodScreen';
import RecipeDetailScreen from '../screens/Discover/RecipeDetailScreen';
import EditGoalsScreen from '../screens/Progress/EditGoalsScreen';
import LogWeightScreen from '../screens/Progress/LogWeightScreen';
import LogExerciseScreen from '../screens/Diary/LogExerciseScreen';
import RemindersScreen from '../screens/More/RemindersScreen';
import ProfileScreen from '../screens/More/ProfileScreen';
import ProfileEditScreen from '../screens/More/ProfileEditScreen';
import HealthProfileScreen from '../screens/More/HealthProfileScreen';
import WorkoutPreferenceScreen from '../screens/More/WorkoutPreferenceScreen';
import LanguageScreen from '../screens/More/LanguageScreen';
import HealthReportDownloadScreen from '../screens/More/HealthReportDownloadScreen';
import NotificationsScreen from '../screens/More/NotificationsScreen';
import StepsScreen from '../screens/Progress/StepsScreen';
import HomeExercisesScreen from '../screens/Home/HomeExercisesScreen';
import HomeExerciseDetailScreen from '../screens/Home/HomeExerciseDetailScreen';
import HomeWorkoutPlayerScreen from '../screens/Home/HomeWorkoutPlayerScreen';
import ExerciseReportScreen from '../screens/Progress/ExerciseReportScreen';
import SubscriptionScreen from '../screens/More/SubscriptionScreen';
import BuyTokensScreen from '../screens/More/BuyTokensScreen';
import PaymentHistoryScreen from '../screens/More/PaymentHistoryScreen';
import PrivacyPolicyScreen from '../screens/More/PrivacyPolicyScreen';
import TermsScreen from '../screens/More/TermsScreen';
import AboutUsScreen from '../screens/More/AboutUsScreen';
import FeedbackScreen from '../screens/More/FeedbackScreen';
import FavoritesScreen from '../screens/Diary/FavoritesScreen';
import BarcodeScanScreen from '../screens/Diary/BarcodeScanScreen';
import WeeklyReportScreen from '../screens/Progress/WeeklyReportScreen';
import AchievementsScreen from '../screens/Progress/AchievementsScreen';
import AchievementDetailScreen from '../screens/Progress/AchievementDetailScreen';
import MealPlanScreen from '../screens/Home/MealPlanScreen';
import GroceryListScreen from '../screens/Home/GroceryListScreen';
import CoachScreen from '../screens/Home/CoachScreen';
import MedicareScreen from '../screens/Home/MedicareScreen';
import WorkoutAiScreen from '../screens/Home/WorkoutAiScreen';
import HealthTracksScreen from '../screens/Home/HealthTracksScreen';
import HealthTrackDetailScreen from '../screens/Home/HealthTrackDetailScreen';
import ProgramsScreen from '../screens/Home/ProgramsScreen';
import ProgramDetailScreen from '../screens/Home/ProgramDetailScreen';
import FeaturesHubScreen from '../screens/Home/FeaturesHubScreen';
import DailySummaryScreen from '../screens/Home/DailySummaryScreen';
import HealthOverviewScreen from '../screens/Home/HealthOverviewScreen';
import HealthRecordsScreen from '../screens/Reports/HealthRecordsScreen';
import ReportReviewScreen from '../screens/Reports/ReportReviewScreen';
import ReportResultScreen from '../screens/Reports/ReportResultScreen';
import ReportExplainScreen from '../screens/Reports/ReportExplainScreen';
import ReportCompareScreen from '../screens/Reports/ReportCompareScreen';

import { ONBOARD_KEY } from '../config/storageKeys';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { hydrated: authReady, isSignedIn } = useAuth();
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARD_KEY)
      .then((v) => {
        setOnboarded(v === '1');
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready || !authReady) {
    return <LoadingScreen fullScreen message="Loading..." />;
  }

  // After logout / signed-out: always the welcome Get Started screen (step 0), not preference steps.
  const initialRouteName = isSignedIn ? 'Main' : 'Onboarding';

  return (
    <Stack.Navigator
      key={isSignedIn ? 'signed-in' : 'signed-out'}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.pageBg },
        statusBarStyle: isDark ? 'light' : 'dark',
        statusBarTranslucent: true,
        statusBarBackgroundColor: 'transparent',
      }}
    >
      <Stack.Screen name="Onboarding">
        {(props) => {
          const fromAuth = Boolean(props.route.params?.fromAuth);
          const step = fromAuth
            ? Number(props.route.params?.initialStep ?? 1) || 1
            : 0;
          return (
            <OnboardingScreen
              {...props}
              // `nav` (set by Sign In links) remounts it, so each visit starts fresh.
              key={`onboard-${isSignedIn ? 'in' : 'out'}-${fromAuth ? step : 0}-${props.route.params?.nav || 0}`}
              initialStep={step}
              onDone={async () => {
                await AsyncStorage.setItem(ONBOARD_KEY, '1');
                setOnboarded(true);
                props.navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
              }}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp">
        {(props) => (
          <SignUpScreen
            {...props}
            onRegistered={async () => {
              await AsyncStorage.setItem(ONBOARD_KEY, '1');
              setOnboarded(true);
              props.navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyResetOtp" component={VerifyResetOtpScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="AddFood" component={AddFoodScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ManualFood" component={ManualFoodScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />
      <Stack.Screen name="ScanFood" component={ScanFoodScreen} />
      <Stack.Screen name="VoiceLog" component={VoiceLogScreen} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <Stack.Screen name="EditGoals" component={EditGoalsScreen} />
      <Stack.Screen name="LogWeight" component={LogWeightScreen} />
      <Stack.Screen name="LogExercise" component={LogExerciseScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
      <Stack.Screen name="WorkoutPreference" component={WorkoutPreferenceScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="HealthReportDownload" component={HealthReportDownloadScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Steps" component={StepsScreen} />
      <Stack.Screen name="HomeExercises" component={HomeExercisesScreen} />
      <Stack.Screen name="ExerciseReport" component={ExerciseReportScreen} />
      <Stack.Screen name="HomeExerciseDetail" component={HomeExerciseDetailScreen} />
      <Stack.Screen
        name="HomeWorkoutPlayer"
        component={HomeWorkoutPlayerScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="BuyTokens" component={BuyTokensScreen} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="AboutUs" component={AboutUsScreen} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="BarcodeScan" component={BarcodeScanScreen} />
      <Stack.Screen name="WeeklyReport" component={WeeklyReportScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="AchievementDetail" component={AchievementDetailScreen} />
      <Stack.Screen name="MealPlan" component={MealPlanScreen} />
      <Stack.Screen name="GroceryList" component={GroceryListScreen} />
      <Stack.Screen name="Coach" component={CoachScreen} />
      <Stack.Screen name="Medicare" component={MedicareScreen} />
      <Stack.Screen name="WorkoutAi" component={WorkoutAiScreen} />
      <Stack.Screen name="HealthTracks" component={HealthTracksScreen} />
      <Stack.Screen name="HealthTrackDetail" component={HealthTrackDetailScreen} />
      <Stack.Screen name="Programs" component={ProgramsScreen} />
      <Stack.Screen name="ProgramDetail" component={ProgramDetailScreen} />
      <Stack.Screen name="FeaturesHub" component={FeaturesHubScreen} />
      <Stack.Screen name="DailySummary" component={DailySummaryScreen} />
      <Stack.Screen name="HealthOverview" component={HealthOverviewScreen} />
      <Stack.Screen name="HealthRecords" component={HealthRecordsScreen} />
      <Stack.Screen name="ReportReview" component={ReportReviewScreen} />
      <Stack.Screen name="ReportResult" component={ReportResultScreen} />
      <Stack.Screen name="ReportExplain" component={ReportExplainScreen} />
      <Stack.Screen name="ReportCompare" component={ReportCompareScreen} />
    </Stack.Navigator>
  );
}
