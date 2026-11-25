import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from './ThemeContext';
import { colors } from '../config/colors';
import { snPro } from '../config/fonts';
import { registerLoaderHandler } from '../utils/loader';

/**
 * App-wide API loader overlay (AdminPanel Splash/Loading portal style).
 * Drive with `import { loader } from '../utils/loader'`.
 */
export function LoaderProvider({ children }) {
  const { isDark, themeColors: c, colors: brand } = useTheme();
  const [state, setState] = useState({ visible: false, message: '' });

  const apply = useCallback((next) => {
    setState({
      visible: !!next.visible,
      message: next.message || '',
    });
  }, []);

  useEffect(() => registerLoaderHandler(apply), [apply]);

  const value = useMemo(() => ({ visible: state.visible }), [state.visible]);

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <Modal visible={state.visible} transparent animationType="fade" statusBarTranslucent>
        <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(16,24,40,0.35)' }]}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: c.cardBg,
                borderColor: c.border,
                ...Platform.select({
                  ios: {
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 8 },
                  },
                  android: { elevation: 8 },
                  default: {},
                }),
              },
            ]}
          >
            <ActivityIndicator size="large" color={brand?.primary || colors.primary} />
            <Text style={[styles.message, { color: c.text, fontFamily: snPro('600') }]}>
              {state.message || 'Please wait...'}
            </Text>
          </View>
        </View>
      </Modal>
    </LoaderContext.Provider>
  );
}

const LoaderContext = React.createContext({ visible: false });

export function useLoader() {
  return React.useContext(LoaderContext);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    minWidth: 160,
    maxWidth: 280,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
