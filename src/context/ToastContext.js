import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { useTheme } from './ThemeContext';
import { colors } from '../config/colors';
import { snPro } from '../config/fonts';
import { registerToastHandler } from '../utils/toast';

const MAX_VISIBLE = 3;

function typeMeta(type, brandPrimary) {
  switch (type) {
    case 'success':
      return { Icon: CheckCircle2, accent: '#22C55E', soft: 'rgba(34,197,94,0.16)' };
    case 'error':
      return { Icon: XCircle, accent: colors.danger, soft: 'rgba(255,59,48,0.14)' };
    case 'warning':
      return { Icon: AlertTriangle, accent: '#F59E0B', soft: 'rgba(245,158,11,0.16)' };
    case 'info':
    default:
      return {
        Icon: Info,
        accent: brandPrimary || colors.primary,
        soft: 'rgba(0,112,224,0.14)',
      };
  }
}

function ToastItem({ item, onDismiss, isDark, cardBg, border, text, brandPrimary }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const meta = typeMeta(item.type, brandPrimary);
  const { Icon } = meta;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, item.id, onDismiss, opacity, translateY]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 140, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDismiss(item.id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: cardBg,
          borderColor: border,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.35 : 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 6 },
            default: {},
          }),
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.soft }]}>
        <Icon size={18} color={meta.accent} />
      </View>
      <Text style={[styles.message, { color: text, fontFamily: snPro('600') }]} numberOfLines={3}>
        {item.message}
      </Text>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
        <X size={16} color={isDark ? '#9CA3AF' : '#667085'} />
      </Pressable>
    </Animated.View>
  );
}

const ToastContext = React.createContext(null);

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const { isDark, themeColors: c, colors: brand } = useTheme();
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toastItem) => {
    setItems((prev) => [...prev, toastItem].slice(-MAX_VISIBLE));
  }, []);

  useEffect(() => registerToastHandler(push), [push]);

  const value = useMemo(() => ({ dismiss }), [dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { top: Math.max(insets.top, 12) + 8, paddingHorizontal: 16 }]}
      >
        {items.map((item) => (
          <ToastItem
            key={item.id}
            item={item}
            onDismiss={dismiss}
            isDark={isDark}
            cardBg={c.cardBg}
            border={c.border}
            text={c.text}
            brandPrimary={brand?.primary}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    gap: 10,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
