import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const IS_WEB = Platform.OS === 'web';

// On web NetInfo pings Google every few seconds and logs an AbortError each time a ping is cancelled.
// The browser's own online/offline state is enough there; phones use the OS (native) reachability check.
// Note: with the ping off, NetInfo reports isInternetReachable = false on web — so it is ignored below.
if (IS_WEB) {
  NetInfo.configure({ reachabilityShouldRun: () => false });
}

const NetworkContext = createContext({ isOffline: false, reconnectNonce: 0, retry: () => {} });

/** null (unknown yet) counts as online — only a definite "no" shows the offline banner. */
function offlineFrom(state) {
  if (!state) return false;
  if (state.isConnected === false) return true;
  // Web: no reachability ping, so only the browser's online/offline flag (isConnected) is meaningful.
  return !IS_WEB && state.isInternetReachable === false;
}

/**
 * Device connectivity for the whole app.
 * `reconnectNonce` goes up whenever the connection comes back or the user taps Retry — data providers
 * (diary, inbox, reminders, features) watch it and re-sync, so offline work uploads automatically.
 */
export function NetworkProvider({ children }) {
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const wasOffline = useRef(false);

  const apply = useCallback((state) => {
    const offline = offlineFrom(state);
    setIsOffline(offline);
    if (wasOffline.current && !offline) setReconnectNonce((n) => n + 1);
    wasOffline.current = offline;
  }, []);

  useEffect(() => NetInfo.addEventListener(apply), [apply]);

  /** Re-check the connection now and ask every provider to reload. */
  const retry = useCallback(async () => {
    setChecking(true);
    try {
      apply(await NetInfo.refresh());
    } catch {
      // Keep the last known state.
    } finally {
      setChecking(false);
      setReconnectNonce((n) => n + 1);
    }
  }, [apply]);

  const value = useMemo(
    () => ({ isOffline, checking, reconnectNonce, retry }),
    [isOffline, checking, reconnectNonce, retry],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
