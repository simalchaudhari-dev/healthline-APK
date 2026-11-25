import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View, StyleSheet } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { DiaryProvider } from './src/context/DiaryContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ConfirmProvider } from './src/context/ConfirmContext';
import { ToastProvider } from './src/context/ToastContext';
import { LoaderProvider } from './src/context/LoaderContext';
import { FeatureCatalogProvider } from './src/context/FeatureCatalogContext';
import { ExerciseCatalogProvider } from './src/context/ExerciseCatalogContext';
import { ReminderCatalogProvider } from './src/context/ReminderCatalogContext';
import { InboxProvider } from './src/context/InboxContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { StepsProvider } from './src/context/StepsContext';
import OfflineBanner from './src/components/common/OfflineBanner';
import { FontProvider } from './src/config/FontProvider';
import ThemedStatusBar from './src/components/common/ThemedStatusBar';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import UpdateGate from './src/components/common/UpdateGate';
import NotificationsBridge from './src/components/common/NotificationsBridge';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef, onNavigationReady } from './src/navigation/navigationRef';

// Web: no browser focus ring / border on text fields (search, forms) — our fields draw their own frame.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('hl-input-focus')) {
  const style = document.createElement('style');
  style.id = 'hl-input-focus';
  style.textContent =
    'input:focus,input:focus-visible,textarea:focus,textarea:focus-visible,select:focus{outline:none !important;box-shadow:none !important;border-color:transparent;}';
  document.head.appendChild(style);
}

function buildNavTheme(isDark, brandColors, surfaces) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: brandColors.primary,
      background: surfaces.pageBg,
      card: surfaces.cardBg,
      text: surfaces.text,
      border: surfaces.border,
    },
  };
}

// Remount the container on sign-in/out: it holds nav state, so re-keying only the navigator
// would restore the old `Main` route instead of going to Onboarding / SignIn.
function AppNavigation({ theme }) {
  const { isSignedIn } = useAuth();
  return (
    <NavigationContainer
      key={isSignedIn ? 'signed-in' : 'signed-out'}
      theme={theme}
      ref={navigationRef}
      onReady={onNavigationReady}
    >
      <ThemedStatusBar />
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    </NavigationContainer>
  );
}

function AppContent() {
  const { isDark, colors: brandColors, themeColors: c } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: c.pageBg }]}>
      {/* Network is outermost so every data provider can re-sync when the connection returns. */}
      <NetworkProvider>
        {/* Auth wraps Diary so the diary can load / save the signed-in user's days. */}
        <AuthProvider>
          <DiaryProvider>
            <ReminderCatalogProvider>
              <NotificationsBridge />
              <InboxProvider>
                <StepsProvider>
                <FeatureCatalogProvider>
                  <ExerciseCatalogProvider>
                  <ConfirmProvider>
                    <ToastProvider>
                      <LoaderProvider>
                        <AppNavigation theme={buildNavTheme(isDark, brandColors, c)} />
                        <OfflineBanner />
                      </LoaderProvider>
                    </ToastProvider>
                  </ConfirmProvider>
                  </ExerciseCatalogProvider>
                </FeatureCatalogProvider>
                </StepsProvider>
              </InboxProvider>
            </ReminderCatalogProvider>
          </DiaryProvider>
        </AuthProvider>
      </NetworkProvider>
    </View>
  );
}

function usePortraitLock() {
  useEffect(() => {
    const lockPortrait = () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
    lockPortrait();
    const subscription = ScreenOrientation.addOrientationChangeListener(lockPortrait);
    return () => subscription.remove();
  }, []);
}

function readWebAngle() {
  if (Platform.OS !== 'web' || typeof screen === 'undefined' || !screen.orientation) return 0;
  return screen.orientation.angle || 0;
}

/** Phone turned sideways. The page stays a portrait game screen and fills the display. */
function PortraitGameFrame({ children }) {
  const { width, height } = useWindowDimensions();
  const [angle, setAngle] = useState(readWebAngle);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const read = () => setAngle(readWebAngle());
    read();
    screen.orientation?.addEventListener?.('change', read);
    window.addEventListener('orientationchange', read);
    return () => {
      screen.orientation?.removeEventListener?.('change', read);
      window.removeEventListener('orientationchange', read);
    };
  }, []);

  if (Platform.OS !== 'web' || width <= height) return children;

  const phoneTurned = Math.min(width, height) <= 520 || angle === 90 || angle === 270 || angle === -90;
  if (!phoneTurned) {
    const phoneWidth = Math.min(430, Math.max(320, Math.round(height * (9 / 19.5))));
    return (
      <View style={styles.stage}>
        <View style={[styles.phone, { width: phoneWidth }]}>{children}</View>
      </View>
    );
  }

  const rotate = angle === 270 || angle === -90 ? '90deg' : '-90deg';
  return (
    <View style={styles.lockRoot}>
      <RotatedPortrait width={width} height={height} rotate={rotate}>
        {children}
      </RotatedPortrait>
    </View>
  );
}

function RotatedPortrait({ width, height, rotate, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node?.style) return;
    node.style.position = 'absolute';
    node.style.left = '50%';
    node.style.top = '50%';
    node.style.width = `${height}px`;
    node.style.height = `${width}px`;
    node.style.transform = `translate(-50%, -50%) rotate(${rotate})`;
  }, [width, height, rotate]);
  return (
    <View ref={ref} style={styles.fill}>
      {children}
    </View>
  );
}

export default function App() {
  usePortraitLock();

  return (
    <PortraitGameFrame>
      <GestureHandlerRootView style={styles.fill}>
        <SafeAreaProvider style={styles.fill}>
          <FontProvider>
            <ThemeProvider>
              <UpdateGate>
                <AppContent />
              </UpdateGate>
            </ThemeProvider>
          </FontProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PortraitGameFrame>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  phone: {
    flex: 1,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  lockRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
});
