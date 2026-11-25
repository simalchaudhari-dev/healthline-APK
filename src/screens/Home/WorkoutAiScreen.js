import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Play, Sparkles } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import AiToolsDrawer from '../../components/common/AiToolsDrawer';
import AppButton from '../../components/common/AppButton';
import { AiFeatureGate } from '../../components/common/AiFeatureGate';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useDiary } from '../../context/DiaryContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import {
  LEVELS,
  ROUTINES,
  getRoutine,
  levelOf,
  routineMinutes,
  workoutPlanFor,
} from '../../data/homeExercises';
import { useExerciseCatalog } from '../../context/ExerciseCatalogContext';
import { suggestWorkout } from '../../services/aiService';
import { getReplyLanguage } from '../../utils/replyLanguage';
import { useAiChats } from '../../utils/aiChats';

const STARTER = {
  role: 'assistant',
  text: 'Tell me how you feel today and I will pick one session already in the app.',
};

const CHIPS = ['Only 10 minutes', 'Knee is sore', 'No equipment', 'Full energy'];
const isWeb = Platform.OS === 'web';
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

function messagesFromThread(thread) {
  if (Array.isArray(thread?.messages) && thread.messages.length) return thread.messages;
  const list = [];
  if (thread?.note) list.push({ role: 'user', text: thread.note });
  if (thread?.pick) {
    const text = [thread.pick.why, thread.pick.caution].filter(Boolean).join('\n\n');
    list.push({ role: 'assistant', text: text || 'Workout', pick: thread.pick });
  }
  return list.length ? [STARTER, ...list] : [STARTER];
}

export default function WorkoutAiScreen({ navigation }) {
  return (
    <AiFeatureGate featureId="workoutAi" label="Workout AI" navigation={navigation}>
      <WorkoutAiBody navigation={navigation} />
    </AiFeatureGate>
  );
}

function WorkoutAiBody({ navigation }) {
  const { isDark, themeColors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { threads, ready, saveThread, removeThread, clearThreads } = useAiChats('workout', accessToken);
  const { profile, goal } = useDiary();
  const catalog = useExerciseCatalog();
  const plan = workoutPlanFor(profile);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const threadIdRef = useRef(null);
  const resumedRef = useRef(false);
  const [messages, setMessages] = useState([STARTER]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const routines = useMemo(() => {
    if (plan.level === 'gentle') return ROUTINES.filter((r) => levelOf(r) !== 'active');
    return ROUTINES;
  }, [plan.level, catalog]);

  const levelLabel = LEVELS.find((l) => l.id === plan.level)?.label || 'Your level';

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
    const id = threadIdRef.current || `wo-${Date.now()}`;
    threadIdRef.current = id;
    const firstUser = messages.find((message) => message.role === 'user');
    saveThread({
      id,
      title: String(firstUser?.text || 'Workout').slice(0, 80),
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
    const earlier = messages.filter((message) => message.role === 'user').map((message) => message.text);
    const userMsg = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setError('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      const pick = await suggestWorkout({
        note: [...earlier, trimmed].join('. '),
        profile,
        goal,
        routines,
        language: getReplyLanguage(),
      });
      const reply = [pick.why, pick.caution].filter(Boolean).join('\n\n');
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, pick }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e.message || 'Could not suggest a workout');
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
          placeholder="How do you feel today…"
          placeholderTextColor={c.placeholder}
          style={[styles.input, { color: c.text, fontFamily: snPro('400') }]}
          multiline={!isWeb}
          maxLength={400}
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
        <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('500') }]}>
          {levelLabel}. Tell it how you feel and it picks one session already in the app.
        </Text>

        {messages.map((message, index) => {
          const routine = message.pick ? getRoutine(message.pick.routineId) : null;
          const mine = message.role === 'user';
          return (
            <View key={`${message.role}-${index}`} style={styles.turn}>
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
              {routine ? (
                <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                  <View style={[styles.bar, { backgroundColor: routine.color || colors.primary }]} />
                  <Text style={[styles.cardKicker, { color: colors.primary, fontFamily: snPro('800') }]}>TODAY’S SESSION</Text>
                  <Text style={[styles.cardTitle, { color: c.text, fontFamily: snPro('700') }]}>{routine.name}</Text>
                  <Text style={[styles.meta, { color: c.muted, fontFamily: snPro('600') }]}>
                    {routineMinutes(routine)} min · {routine.exercises.length} moves
                    {routine.rounds > 1 ? ` × ${routine.rounds} rounds` : ''}
                  </Text>
                  <AppButton
                    label="Start workout"
                    icon={Play}
                    onPress={() => navigation.navigate('HomeWorkoutPlayer', { routineId: routine.id })}
                  />
                </View>
              ) : null}
            </View>
          );
        })}

        {error ? <Text style={[styles.error, { fontFamily: snPro('500') }]}>{error}</Text> : null}

        <View style={styles.promptRow}>
          {CHIPS.map((chip) => (
            <AppButton
              key={chip}
              variant="secondary"
              size="sm"
              label={chip}
              onPress={() => send(chip)}
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
        title="Workout AI"
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
  sub: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
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
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, overflow: 'hidden', alignSelf: 'stretch' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  cardKicker: { fontSize: 11, letterSpacing: 0.4, marginBottom: 6 },
  cardTitle: { fontSize: 18, marginBottom: 4 },
  meta: { fontSize: 13, marginBottom: 10 },
});
