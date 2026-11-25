import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  FALLBACK_REMINDERS,
  apiFetchReminderCatalog,
  loadCachedReminderCatalog,
} from '../services/remindersService';
import { useNetwork } from './NetworkContext';

const ReminderCatalogContext = createContext(null);

/** Reminder list controlled from AdminPanel → Notifications → App reminders. */
export function ReminderCatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(FALLBACK_REMINDERS);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const next = await apiFetchReminderCatalog();
    if (next) setCatalog(next);
    setReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await loadCachedReminderCatalog();
      if (active && cached) setCatalog(cached);
      if (active) await refresh();
    })();
    // Pick up admin changes whenever the app comes back to the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [refresh]);

  const { reconnectNonce } = useNetwork();
  useEffect(() => {
    if (reconnectNonce) refresh();
  }, [reconnectNonce, refresh]);

  const value = useMemo(() => ({ catalog, ready, refresh }), [catalog, ready, refresh]);

  return <ReminderCatalogContext.Provider value={value}>{children}</ReminderCatalogContext.Provider>;
}

export function useReminderCatalog() {
  const ctx = useContext(ReminderCatalogContext);
  if (!ctx) throw new Error('useReminderCatalog must be used within ReminderCatalogProvider');
  return ctx;
}
