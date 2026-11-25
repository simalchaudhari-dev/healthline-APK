import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { addNotificationReceivedListener } from '../services/notificationsService';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import { apiClearInbox, apiFetchInbox, apiMarkInboxRead } from '../services/authService';

const InboxContext = createContext(null);

/** Notifications inbox (admin campaigns) + unread badge count for the signed-in user. */
export function InboxProvider({ children }) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  /** Latest list, so actions can tell (synchronously) whether an item was unread. */
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetchInbox(token);
      if (tokenRef.current !== token) return; // signed out / switched account meanwhile
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(Number(data?.unread) || 0);
      setError('');
    } catch (err) {
      setError(err?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Each action updates the screen and badge right away; the server remembers it for other
  // devices. If the server call fails, the next refresh brings the real state back.

  /** "Mark all read" — clears the bell badge. */
  const markAllRead = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    try {
      await apiMarkInboxRead(token);
    } catch {
      // comes back on the next refresh
    }
  }, []);

  /** Opening one notification marks just that one read. */
  const markRead = useCallback(async (id) => {
    const token = tokenRef.current;
    if (!token || !id) return;
    const target = itemsRef.current.find((n) => n.id === id);
    if (!target || target.read) return; // already read — nothing to send
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await apiMarkInboxRead(token, id);
    } catch {
      // comes back on the next refresh
    }
  }, []);

  /** Remove one notification from this user's inbox. */
  const clearOne = useCallback(async (id) => {
    const token = tokenRef.current;
    if (!token || !id) return;
    const target = itemsRef.current.find((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.read) setUnread((u) => Math.max(0, u - 1));
    try {
      await apiClearInbox(token, id);
    } catch {
      // comes back on the next refresh
    }
  }, []);

  /** "Clear all" — empties this user's inbox. */
  const clearAll = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setItems([]);
    setUnread(0);
    try {
      await apiClearInbox(token);
    } catch {
      // comes back on the next refresh
    }
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setItems([]);
      setUnread(0);
      return undefined;
    }
    refresh();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // A campaign push arriving while the app is open → show it in the inbox straight away.
    const stopPush = addNotificationReceivedListener((n) => {
      if (n?.request?.content?.data?.notificationId) refresh();
    });
    return () => {
      appSub.remove();
      stopPush();
    };
  }, [accessToken, refresh]);

  const { reconnectNonce } = useNetwork();
  useEffect(() => {
    if (reconnectNonce) refresh();
  }, [reconnectNonce, refresh]);

  const value = useMemo(
    () => ({ items, unread, loading, error, refresh, markAllRead, markRead, clearOne, clearAll }),
    [items, unread, loading, error, refresh, markAllRead, markRead, clearOne, clearAll],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within InboxProvider');
  return ctx;
}
