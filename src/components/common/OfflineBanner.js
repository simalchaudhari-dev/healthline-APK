import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, RotateCw } from 'lucide-react-native';
import { useNetwork } from '../../context/NetworkContext';
import { snPro } from '../../config/fonts';

/** Floating "no internet" card above the tab bar. Rendered once at the app root. */
export default function OfflineBanner() {
  const { isOffline, checking, retry } = useNetwork();
  const insets = useSafeAreaInsets();
  if (!isOffline) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 76 }]}>
      <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <WifiOff size={18} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily: snPro('700') }]}>No internet connection</Text>
          <Text style={[styles.sub, { fontFamily: snPro('400') }]}>
            Showing saved data. Today’s logs sync when you’re back online.
          </Text>
        </View>
        <Pressable
          onPress={retry}
          disabled={checking}
          hitSlop={8}
          style={({ pressed }) => [styles.btn, { opacity: pressed || checking ? 0.7 : 1 }]}
          accessibilityLabel="Retry connection"
        >
          {checking ? <ActivityIndicator size="small" color="#1C1C1E" /> : <RotateCw size={14} color="#1C1C1E" />}
          <Text style={[styles.btnText, { fontFamily: snPro('700') }]}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 1000 },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...Platform.select({
      android: { elevation: 6 },
      default: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  title: { color: '#FFFFFF', fontSize: 14 },
  sub: { color: '#D1D1D6', fontSize: 12, marginTop: 2, lineHeight: 16 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnText: { color: '#1C1C1E', fontSize: 13 },
});
