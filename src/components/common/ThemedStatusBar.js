import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useTheme } from '../../context/ThemeContext';

/**
 * Match status-bar / root window to theme so APK has no black strip or seam line.
 */
export default function ThemedStatusBar({ style: styleOverride, hidden = false }) {
  const { isDark, themeColors: c } = useTheme();
  const barStyle = styleOverride ?? (isDark ? 'light' : 'dark');

  useEffect(() => {
    setStatusBarStyle(barStyle);

    if (Platform.OS === 'android') {
      try {
        RNStatusBar.setTranslucent(true);
        RNStatusBar.setBackgroundColor('transparent');
        RNStatusBar.setBarStyle(barStyle === 'light' ? 'light-content' : 'dark-content', true);
      } catch {
        // ignored on unsupported builds
      }
    }

    const apply = async () => {
      try {
        await SystemUI.setBackgroundColorAsync(c.pageBg);
      } catch {
        // unsupported platform
      }
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'theme-color');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', c.pageBg);
        document.documentElement.style.backgroundColor = c.pageBg;
        document.body.style.backgroundColor = c.pageBg;
      }
    };
    apply();
  }, [isDark, c.pageBg, barStyle]);

  return (
    <StatusBar
      style={barStyle}
      hidden={hidden}
      translucent
      backgroundColor="transparent"
    />
  );
}
