import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, BellOff, CheckCheck, Trash2, X } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import LoadingScreen from '../../components/common/LoadingScreen';
import ScreenHeader from '../../components/common/ScreenHeader';
import { softShadow } from '../../components/common/premiumStyles';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useInbox } from '../../context/InboxContext';
import { useConfirm } from '../../context/ConfirmContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';

function timeAgo(value) {
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const daysAgo = Math.round(hrs / 24);
  if (daysAgo < 7) return `${daysAgo} d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fullDate(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Messages the HealthLine team sent (admin push campaigns).
 * Unread ones carry a red dot (and the bell badge) until opened or "Mark all read".
 * Tap a card to read the whole message; remove one, or "Clear all".
 */
export default function NotificationsScreen({ navigation, route }) {
  const { isDark, themeColors: c } = useTheme();
  const { isSignedIn } = useAuth();
  const { confirm } = useConfirm();
  const { items, unread, loading, error, refresh, markAllRead, markRead, clearOne, clearAll } = useInbox();
  /** Set when opened by tapping a push — that message opens straight away. */
  const highlightId = route?.params?.highlightId || null;
  const [openId, setOpenId] = useState(null);
  const opened = openId ? items.find((n) => n.id === openId) : null;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const openItem = useCallback(
    (item) => {
      setOpenId(item.id);
      if (!item.read) markRead(item.id);
    },
    [markRead],
  );

  // Opened from a push: show that message once the list has it.
  const [highlightShown, setHighlightShown] = useState(false);
  useEffect(() => {
    if (!highlightId || highlightShown) return;
    const item = items.find((n) => n.id === highlightId);
    if (item) {
      setHighlightShown(true);
      openItem(item);
    }
  }, [highlightId, highlightShown, items, openItem]);

  const onClearAll = async () => {
    const ok = await confirm({
      title: 'Clear all notifications?',
      message: 'They will be removed from this list. New ones will still arrive.',
      confirmLabel: 'Clear all',
      cancelLabel: 'Cancel',
    });
    if (ok) clearAll();
  };

  const removeOpened = () => {
    const id = openId;
    setOpenId(null);
    if (id) clearOne(id);
  };

  const unreadTint = isDark ? 'rgba(255,59,48,0.08)' : '#FFF6F5';

  const empty = (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft }]}>
        <BellOff size={26} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text, fontFamily: snPro('700') }]}>
        {isSignedIn ? 'No notifications yet' : 'Sign in to see notifications'}
      </Text>
      <Text style={[styles.emptyBody, { color: c.muted, fontFamily: snPro('400') }]}>
        {error || 'Updates and tips from HealthLine will show up here.'}
      </Text>
    </View>
  );

  const toolbar = items.length ? (
    <View style={styles.toolbar}>
      <Text style={[styles.toolbarText, { color: c.muted, fontFamily: snPro('700') }]}>
        {unread ? `${unread} unread` : 'All caught up'}
      </Text>
      <View style={styles.toolbarActions}>
        <Pressable
          onPress={markAllRead}
          disabled={!unread}
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
          style={({ pressed }) => [
            styles.toolBtn,
            { backgroundColor: c.cardBg, borderColor: c.border },
            (!unread || pressed) && { opacity: unread ? 0.7 : 0.45 },
          ]}
        >
          <CheckCheck size={15} color={colors.primary} strokeWidth={2.4} />
          <Text style={[styles.toolBtnText, { color: colors.primary, fontFamily: snPro('800') }]}>Mark all read</Text>
        </Pressable>
        <Pressable
          onPress={onClearAll}
          accessibilityRole="button"
          accessibilityLabel="Clear all notifications"
          style={({ pressed }) => [
            styles.toolBtn,
            { backgroundColor: c.cardBg, borderColor: c.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Trash2 size={15} color={colors.danger} strokeWidth={2.4} />
          <Text style={[styles.toolBtnText, { color: colors.danger, fontFamily: snPro('800') }]}>Clear all</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <ScreenShell>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} theme={c} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={toolbar}
        contentContainerStyle={[styles.list, !items.length && { flexGrow: 1 }]}
        ListEmptyComponent={loading ? <LoadingScreen message="Loading notifications…" /> : empty}
        refreshControl={
          <RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} colors={[colors.primary]} />
        }
        renderItem={({ item }) => (
          // Two sibling buttons (open / remove) — a button may not sit inside another on web.
          <View
            style={[
              styles.row,
              softShadow,
              {
                backgroundColor: item.read ? c.cardBg : unreadTint,
                borderColor: item.read ? c.border : 'rgba(255,59,48,0.35)',
              },
            ]}
          >
          <Pressable
            onPress={() => openItem(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}`}
            style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.icon, { backgroundColor: isDark ? '#1A2744' : colors.primarySoft }]}>
              <Bell size={18} color={colors.primary} />
              {!item.read ? <View style={[styles.iconDot, { backgroundColor: colors.danger, borderColor: c.cardBg }]} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text
                  style={[styles.title, { color: c.text, fontFamily: snPro(item.read ? '700' : '800') }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                {!item.read ? (
                  <View style={[styles.newPill, { backgroundColor: colors.danger }]}>
                    <Text style={[styles.newPillText, { fontFamily: snPro('800') }]}>NEW</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.body, { color: c.muted, fontFamily: snPro('400') }]} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={[styles.time, { color: c.muted, fontFamily: snPro('600') }]}>
                {timeAgo(item.sentAt)} · Tap to read
              </Text>
            </View>
          </Pressable>
            <Pressable
              onPress={() => clearOne(item.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Remove notification"
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
            >
              <X size={16} color={c.muted} strokeWidth={2.4} />
            </Pressable>
          </View>
        )}
      />

      {/* Full message */}
      <Modal visible={!!opened} transparent animationType="fade" onRequestClose={() => setOpenId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenId(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.cardBg }]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <View style={[styles.icon, { backgroundColor: isDark ? '#1A2744' : colors.primarySoft }]}>
                <Bell size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sheetTime, { color: c.muted, fontFamily: snPro('600') }]}>
                {opened ? fullDate(opened.sentAt) : ''}
              </Text>
              <Pressable
                onPress={() => setOpenId(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.closeBtn, { backgroundColor: c.chip || c.border }]}
              >
                <X size={16} color={c.text} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Text style={[styles.sheetTitle, { color: c.text, fontFamily: FONT.nova }]}>{opened?.title}</Text>
            <ScrollView style={styles.sheetBodyWrap} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetBody, { color: c.text, fontFamily: snPro('400') }]}>{opened?.body}</Text>
            </ScrollView>
            <View style={styles.sheetActions}>
              <Pressable
                onPress={removeOpened}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetBtn,
                  { borderWidth: 1.5, borderColor: colors.danger },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Trash2 size={16} color={colors.danger} strokeWidth={2.4} />
                <Text style={[styles.sheetBtnText, { color: colors.danger, fontFamily: snPro('800') }]}>Remove</Text>
              </Pressable>
              <Pressable
                onPress={() => setOpenId(null)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.sheetBtnText, { color: '#FFFFFF', fontFamily: snPro('800') }]}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  toolbarText: { fontSize: 13 },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
  },
  toolBtnText: { fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, flexShrink: 1 },
  newPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newPillText: { color: '#FFFFFF', fontSize: 9.5, letterSpacing: 0.4 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  time: { fontSize: 11, marginTop: 8 },
  removeBtn: { padding: 4, marginTop: -2, marginRight: -4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 60 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, marginTop: 14 },
  emptyBody: { fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    alignSelf: 'center',
    borderRadius: 22,
    padding: 20,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTime: { flex: 1, fontSize: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 20, lineHeight: 26, marginTop: 16 },
  sheetBodyWrap: { marginTop: 10, flexGrow: 0 },
  sheetBody: { fontSize: 15, lineHeight: 23 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  sheetBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sheetBtnText: { fontSize: 15 },
});
