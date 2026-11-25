import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Stethoscope } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import AiToolsDrawer from '../../components/common/AiToolsDrawer';
import AppButton from '../../components/common/AppButton';
import { AiFeatureGate } from '../../components/common/AiFeatureGate';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import { explainMedicare, medicareFollowUp } from '../../services/aiService';
import { getReplyLanguage } from '../../utils/replyLanguage';
import { useAiChats } from '../../utils/aiChats';

const STARTER = {
  role: 'assistant',
  text: 'Tell me what the doctor said, or what is bothering you. I will explain it in plain language.',
};

const EXAMPLES = [
  'Doctor said acidity, avoid spicy food',
  'Blood pressure is a little high',
  'Knee hurts when I climb stairs',
];

const isWeb = Platform.OS === 'web';
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

function resultText(result) {
  if (!result) return '';
  return [result.meaning, result.why, result.relief, result.seeDoctor].filter(Boolean).join('\n\n');
}

function messagesFromThread(thread) {
  if (Array.isArray(thread?.messages) && thread.messages.length) return thread.messages;
  const list = [];
  if (thread?.note) list.push({ role: 'user', text: thread.note });
  if (thread?.result) {
    list.push({
      role: 'assistant',
      text: resultText(thread.result) || thread.result.meaning || 'Medicare',
      result: thread.result,
    });
  }
  (Array.isArray(thread?.followups) ? thread.followups : []).forEach((message) => {
    if (message?.text) list.push(message);
  });
  return list.length ? [STARTER, ...list] : [STARTER];
}

function resultCards(result) {
  if (!result) return [];
  return [
    { key: 'meaning', title: 'What the doctor meant', body: result.meaning },
    { key: 'why', title: 'Why this can happen', body: result.why },
    { key: 'relief', title: result.urgent ? 'Do this now' : 'A simple home step', body: result.relief },
    { key: 'doctor', title: 'When to see the doctor', body: result.seeDoctor },
  ].filter((card) => String(card.body || '').trim());
}

export default function MedicareScreen({ navigation }) {
  return (
    <AiFeatureGate featureId="medicalAi" label="Medicare assist" navigation={navigation}>
      <MedicareBody navigation={navigation} />
    </AiFeatureGate>
  );
}

function MedicareBody({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { threads, ready, saveThread, removeThread, clearThreads } = useAiChats('medicare', accessToken);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const threadIdRef = useRef(null);
  const resumedRef = useRef(false);
  const [messages, setMessages] = useState([STARTER]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!ready || resumedRef.current) return;
    resumedRef.current = true;
    const latest = threads[0];
    if (!latest) return;
    threadIdRef.current = latest.id;
    setMessages(messagesFromThread(latest));
  }, [ready, threads]);

  useEffect(() => {
    const real = messages.some((message) => message.role === 'user');
    if (!real) return;
    const id = threadIdRef.current || `med-${Date.now()}`;
    threadIdRef.current = id;
    const firstUser = messages.find((message) => message.role === 'user');
    saveThread({
      id,
      title: String(firstUser?.text || 'Medicare').slice(0, 80),
      updatedAt: new Date().toISOString(),
      messages,
    });
  }, [messages, saveThread]);

  useEffect(() => {
    if (!isNative) return undefined;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardOpen(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isWeb) {
        inputRef.current?.blur();
        Keyboard.dismiss();
        return undefined;
      }
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => {
        clearTimeout(t);
        inputRef.current?.blur();
        Keyboard.dismiss();
        setKeyboardOpen(false);
      };
    }, []),
  );

  const send = async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || loading) return;
    const isFollowUp = messages.some((message) => message.role === 'user');
    const userMsg = { role: 'user', text: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft('');
    setError('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      if (!isFollowUp) {
        const result = await explainMedicare(trimmed, getReplyLanguage());
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: resultText(result) || result.meaning, result },
        ]);
      } else {
        const history = next
          .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.text !== STARTER.text))
          .map((message) => ({ role: message.role, content: message.text }));
        const reply = await medicareFollowUp(history, getReplyLanguage());
        setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e.message || 'Could not explain that note');
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    threadIdRef.current = null;
    setMessages([STARTER]);
    setDraft('');
    setError('');
    if (isNative) setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openThread = (thread) => {
    threadIdRef.current = thread.id;
    setMessages(messagesFromThread(thread));
    setDraft('');
    setError('');
  };

  const footer = (
    <View
      style={[
        styles.footer,
        {
          borderTopColor: c.border,
          backgroundColor: c.pageBg,
          paddingBottom: keyboardOpen ? 10 : isNative ? Math.max(insets.bottom, 12) : 16,
        },
      ]}
    >
      <View style={[styles.inputRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder="What is bothering you…"
          placeholderTextColor={c.placeholder}
          style={[styles.input, { color: c.text, fontFamily: snPro('400') }]}
          multiline={!isWeb}
          maxLength={800}
          autoFocus={false}
          showSoftInputOnFocus={isNative}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={() => send(draft)}
        />
      </View>
      <View style={styles.footerBtns}>
        <AppButton variant="secondary" size="md" label="New chat" onPress={newChat} style={{ flex: 1, minWidth: 0 }} />
        <AppButton
          size="md"
          label="Send"
          icon={Sparkles}
          onPress={() => send(draft)}
          loading={loading}
          disabled={!draft.trim()}
          style={{ flex: 1.2, minWidth: 0 }}
        />
      </View>
    </View>
  );

  const chat = (
    <View style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={isNative ? 'interactive' : 'none'}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={[styles.note, { backgroundColor: isDark ? '#2A2218' : '#FFF6E8', borderColor: isDark ? '#5C4A32' : '#F3D7A1' }]}>
          <Stethoscope size={16} color={isDark ? '#F6C56B' : '#9A6700'} />
          <Text style={[styles.noteText, { color: isDark ? '#F6E7C8' : '#6B4E16', fontFamily: snPro('500') }]}>
            This explains words in plain language and suggests one homemade comfort step. It is not a diagnosis and does not replace your doctor.
          </Text>
        </View>

        {messages.map((message, index) => {
          const mine = message.role === 'user';
          const cards = resultCards(message.result);
          return (
            <View key={`${message.role}-${index}`} style={styles.turn}>
              {cards.length ? null : (
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleUser : styles.bubbleBot,
                    {
                      backgroundColor: mine ? colors.primary : c.cardBg,
                      borderColor: mine ? colors.primary : c.border,
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: mine ? '#FFFFFF' : c.text, fontFamily: snPro('500') }]}>
                    {message.text}
                  </Text>
                </View>
              )}
              {cards.map((card) => (
                <View
                  key={card.key}
                  style={[
                    styles.card,
                    {
                      backgroundColor: c.cardBg,
                      borderColor: card.key === 'relief' && message.result?.urgent ? colors.danger : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: colors.primary, fontFamily: snPro('800') }]}>{card.title}</Text>
                  <Text style={[styles.cardBody, { color: c.text, fontFamily: snPro('500') }]}>{card.body}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {error ? <Text style={[styles.error, { fontFamily: snPro('500') }]}>{error}</Text> : null}

        <View style={styles.promptRow}>
          {EXAMPLES.map((example) => (
            <AppButton
              key={example}
              variant="secondary"
              size="sm"
              label={example}
              onPress={() => send(example)}
              disabled={loading}
              style={{ marginTop: 0, flexShrink: 1 }}
              textStyle={{ fontSize: 11 }}
            />
          ))}
        </View>
      </ScrollView>
      {footer}
    </View>
  );

  return (
    <ScreenShell>
      <ScreenHeader
        title="Medicare assist"
        onBack={() => navigation.goBack()}
        theme={c}
        right={
          <AiToolsDrawer
            threads={threads}
            onOpen={openThread}
            onNew={newChat}
            onDelete={(id) => {
              if (id === threadIdRef.current) newChat();
              removeThread(id);
            }}
            onClear={() => {
              newChat();
              clearThreads();
            }}
          />
        }
      />
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={insets.top + 8}>
          {chat}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex}>{chat}</View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  note: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  turn: { marginBottom: 4 },
  bubble: {
    maxWidth: '88%',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleBot: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  inputRow: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
  },
  input: { fontSize: 15, maxHeight: 80, ...(isWeb ? { outlineStyle: 'none' } : null) },
  footerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 12, letterSpacing: 0.3, marginBottom: 6 },
  cardBody: { fontSize: 15, lineHeight: 22 },
});
