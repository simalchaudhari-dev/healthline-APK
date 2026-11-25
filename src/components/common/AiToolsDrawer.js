import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Check, PanelRight, Plus, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors, primaryRgba } from '../../config/colors';
import { snPro } from '../../config/fonts';
import { useSafeTop } from '../../utils/safeArea';
import { REPLY_LANGUAGES, selectReplyLanguage, useReplyLanguage } from '../../utils/replyLanguage';

/** One header button. Language and chat history open in a right sidebar. */
export default function AiToolsDrawer({ threads, onOpen, onNew, onDelete, onClear }) {
  const { isDark, themeColors: c } = useTheme();
  const { accessToken } = useAuth();
  const lang = useReplyLanguage();
  const top = useSafeTop();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(280, Math.round(width * 0.82));
  const progress = useRef(new Animated.Value(0)).current;
  const running = useRef(null);
  const closing = useRef(false);
  const [mounted, setMounted] = useState(false);
  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (!mounted) return undefined;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    running.current = anim;
    anim.start();
    return undefined;
  }, [mounted, nativeDriver, progress]);

  const openDrawer = () => {
    if (mounted) return;
    closing.current = false;
    setMounted(true);
  };

  const close = () => {
    if (!mounted || closing.current) return;
    closing.current = true;
    running.current?.stop();
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    running.current = anim;
    anim.start(({ finished }) => {
      closing.current = false;
      if (finished) setMounted(false);
    });
  };

  const slideX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [panelWidth, 0],
  });

  const chooseLanguage = (id) => {
    selectReplyLanguage(id, accessToken).catch(() => {});
  };

  return (
    <>
      <Pressable
        onPress={openDrawer}
        hitSlop={8}
        style={[styles.iconBtn, { backgroundColor: c.chip }]}
      >
        <PanelRight size={18} color={c.text} />
      </Pressable>

      <Modal transparent visible={mounted} animationType="none" onRequestClose={close}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={close}>
            <Animated.View style={[styles.dim, { opacity: progress }]} />
          </Pressable>
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                backgroundColor: isDark ? '#16161A' : '#FFFFFF',
                borderColor: c.border,
                paddingTop: top + 16,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <View style={styles.closeRow}>
              <Pressable
                onPress={close}
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: c.chip }]}
              >
                <X size={16} color={c.text} />
              </Pressable>
            </View>
            <Text style={[styles.section, { color: c.muted, fontFamily: snPro('700') }]}>Reply language</Text>
            {REPLY_LANGUAGES.map((item) => {
              const on = item.id === lang;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => chooseLanguage(item.id)}
                  style={[
                    styles.langRow,
                    on
                      ? {
                          backgroundColor: isDark ? primaryRgba(0.22) : colors.primarySoft,
                          borderColor: colors.primary,
                        }
                      : { borderColor: 'transparent' },
                  ]}
                >
                  <Text style={[styles.langText, { color: on ? colors.primary : c.text, fontFamily: snPro(on ? '700' : '500') }]}>
                    {item.label}
                  </Text>
                  {on ? <Check size={16} color={colors.primary} /> : <View style={styles.checkSpace} />}
                </Pressable>
              );
            })}

            <Text style={[styles.section, styles.historyLabel, { color: c.muted, fontFamily: snPro('700') }]}>
              Chat history
            </Text>
            <Pressable
              onPress={() => {
                close();
                onNew?.();
              }}
              style={[styles.newRow, { borderColor: c.border }]}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={[styles.newText, { color: colors.primary, fontFamily: snPro('700') }]}>New chat</Text>
            </Pressable>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {threads?.length ? (
                threads.map((thread) => (
                  <View key={thread.id} style={[styles.row, { borderColor: c.border }]}>
                    <Pressable
                      style={styles.rowMain}
                      onPress={() => {
                        close();
                        onOpen?.(thread);
                      }}
                    >
                      <Text style={[styles.rowTitle, { color: c.text, fontFamily: snPro('600') }]} numberOfLines={2}>
                        {thread.title || 'Chat'}
                      </Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => onDelete?.(thread.id)}>
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={[styles.empty, { color: c.muted, fontFamily: snPro('500') }]}>No saved chats yet.</Text>
              )}
            </ScrollView>

            {threads?.length ? (
              <Pressable
                onPress={() => {
                  close();
                  onClear?.();
                }}
              >
                <Text style={[styles.clear, { color: colors.danger, fontFamily: snPro('700') }]}>Delete all history</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  closeRow: { alignItems: 'flex-end', marginBottom: 8 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  historyLabel: { marginTop: 18 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  langText: { fontSize: 15 },
  checkSpace: { width: 16 },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  newText: { fontSize: 14 },
  list: { flexGrow: 0, maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 14, lineHeight: 18 },
  empty: { fontSize: 13, paddingVertical: 16 },
  clear: { fontSize: 13, textAlign: 'center', marginTop: 12 },
});
