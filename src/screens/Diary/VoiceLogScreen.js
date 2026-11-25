import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Mic, Sparkles, Search, Square } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useConfirm } from '../../context/ConfirmContext';
import { themeColors, colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import AiBadge from '../../components/common/AiBadge';
import AiResultCard from '../../components/Diary/AiResultCard';
import ScreenHeader from '../../components/common/ScreenHeader';
import { AiFeatureGate } from '../../components/common/AiFeatureGate';
import { parseFoodFromText, hasAiKey } from '../../services/aiService';
import { SafeAreaTop } from '../../components/common/ScreenShell';
import AppButton from '../../components/common/AppButton';
import { useSpeechToText, SPEECH_LANGUAGES } from '../../hooks/useSpeechToText';
import { languageById } from '../../config/languages';
import { getReplyLanguage } from '../../utils/replyLanguage';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export default function VoiceLogScreen({ navigation, route }) {
  return (
    <AiFeatureGate featureId="voiceLog" label="Voice Logging" navigation={navigation}>
      <VoiceLogBody navigation={navigation} route={route} />
    </AiFeatureGate>
  );
}

function VoiceLogBody({ navigation, route }) {
  const meal = route.params?.meal || 'snacks';
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { confirm } = useConfirm();
  const { addFood } = useDiary();
  const [transcript, setTranscript] = useState('');
  // Start on the app language (Profile → Language); the user can still switch here for one log.
  const [lang, setLang] = useState(() => languageById(getReplyLanguage()).speech || SPEECH_LANGUAGES[0].id);
  const voice = useSpeechToText({ text: transcript, onText: setTranscript });
  const listening = voice.listening;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const keyReady = hasAiKey();

  /** Drop bottom safe-area while keyboard is open — removes white gap under keyboard. */
  useEffect(() => {
    if (!isNative) return undefined;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onBack = async () => {
    if (loading || result || transcript.trim()) {
      const ok = await confirm({
        title: loading ? 'Cancel analysis?' : 'Leave voice log?',
        message: loading
          ? 'AI is still working. Leaving will discard this estimate.'
          : 'Your transcript and results on this screen will be lost.',
        confirmLabel: loading ? 'Yes, leave' : 'Leave',
        cancelLabel: 'Stay',
        destructive: true,
      });
      if (!ok) return;
    }
    navigation.goBack();
  };

  /** Mic button: start listening (adds to what's already in the box) or stop. */
  const toggleMic = () => {
    if (listening) {
      voice.stop();
      return;
    }
    setError('');
    setResult(null);
    Keyboard.dismiss();
    voice.start(lang);
  };

  const analyze = async () => {
    if (listening) voice.stop();
    const text = transcript.trim();
    if (!text) {
      setError('Say or type what you ate first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    Keyboard.dismiss();
    try {
      const parsed = await parseFoodFromText(text);
      setResult(parsed);
    } catch (e) {
      setError(e.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const logAll = () => {
    if (!result?.items?.length) return;
    result.items.forEach((food) => addFood(meal, food, { source: 'ai-voice' }));
    navigation.navigate('Main', { screen: 'Diary' });
  };

  const body = (
    <>
      <SafeAreaTop color={c.pageBg} />
      <ScreenHeader
        title="Voice log"
        onBack={onBack}
        theme={c}
        right={<AiBadge label={keyReady ? 'AI' : 'AI off'} />}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={isNative ? 'on-drag' : 'none'}
      >
        <Text style={[styles.sub, { color: c.muted }]}>
          {voice.available
            ? 'Tap Speak and say what you ate — e.g. “2 roti, dal and a glass of buttermilk”. You can also type or fix the text.'
            : 'Voice isn’t available here (Expo Go or this browser) — type what you ate instead.'}
        </Text>

        {voice.available ? (
          <View style={styles.langRow}>
            {SPEECH_LANGUAGES.map((l) => {
              const on = lang === l.id;
              return (
                <Pressable
                  key={l.id}
                  onPress={() => setLang(l.id)}
                  disabled={listening}
                  style={[
                    styles.langChip,
                    {
                      backgroundColor: on ? colors.primary : c.chip,
                      borderColor: on ? colors.primary : c.border,
                      opacity: listening && !on ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.langText, { color: on ? '#FFF' : c.text, fontFamily: snPro('700') }]}>
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {listening ? (
          <View style={[styles.listenRow, { backgroundColor: isDark ? '#2A1416' : '#FFF1F0', borderColor: colors.danger }]}>
            <View style={[styles.recDot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.listenText, { color: c.text, fontFamily: snPro('700') }]}>
              Listening… speak now
            </Text>
            <Pressable onPress={voice.stop} hitSlop={8}>
              <Text style={[styles.listenStop, { color: colors.danger, fontFamily: snPro('800') }]}>Stop</Text>
            </Pressable>
          </View>
        ) : null}

        {voice.error ? (
          <View style={styles.voiceErr}>
            <Text style={styles.error}>{voice.error}</Text>
            {voice.blocked ? (
              <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
                <Text style={[styles.settingsLink, { color: colors.primary, fontFamily: snPro('700') }]}>
                  Open phone settings → Permissions → Microphone → Allow
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: c.muted, fontFamily: snPro('700'), marginBottom: 0 }]}>
            TRANSCRIPT
          </Text>
          <AppButton
            size="sm"
            label={result ? 'Search again' : 'Search'}
            icon={Search}
            onPress={analyze}
            disabled={!keyReady || loading || !transcript.trim()}
            loading={loading}
            style={{ minWidth: 100 }}
          />
        </View>

        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: c.cardBg,
              borderColor: result ? colors.primary : c.border,
            },
          ]}
        >
          <TextInput
            value={transcript}
            onChangeText={setTranscript}
            multiline
            placeholder="e.g. Two eggs, toast with avocado, black coffee"
            placeholderTextColor={c.placeholder}
            style={[styles.input, { color: c.text, fontFamily: snPro('400') }]}
          />
          <Pressable
            onPress={analyze}
            disabled={!keyReady || loading || !transcript.trim()}
            hitSlop={6}
            style={[
              styles.inputSearchIcon,
              {
                backgroundColor: c.chip,
                opacity: !keyReady || loading || !transcript.trim() ? 0.5 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Search size={18} color={colors.primary} />
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.resultWrap}>
            <AiResultCard result={result} />
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: c.border,
            backgroundColor: c.pageBg,
            // No safe-area gap while keyboard is open
            paddingBottom: keyboardOpen ? 10 : 20,
          },
        ]}
      >
        {!result ? (
          <View style={styles.footerRow}>
            <AppButton
              variant="secondary"
              size="md"
              label={listening ? 'Stop' : 'Speak'}
              icon={listening ? Square : Mic}
              onPress={toggleMic}
              disabled={!voice.available || loading}
              style={styles.footerBtn}
            />
            <AppButton
              size="md"
              label="Analyze"
              icon={Sparkles}
              onPress={analyze}
              disabled={!keyReady || loading}
              loading={loading}
              style={styles.footerBtnPrimary}
            />
          </View>
        ) : (
          <View style={styles.footerRow}>
            <AppButton
              variant="secondary"
              size="md"
              label="Search again"
              icon={Search}
              onPress={analyze}
              disabled={!keyReady || loading || !transcript.trim()}
              loading={loading}
              style={styles.footerBtn}
            />
            <AppButton
              size="md"
              label={`Log ${result.items.length}`}
              onPress={logAll}
              disabled={loading}
              style={styles.footerBtnPrimary}
            />
          </View>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: c.pageBg }]}
      // Keyboard open → no bottom inset (fixes white gap under keyboard)
      edges={keyboardOpen ? [] : ['bottom']}
    >
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {body}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex}>{body}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 },
  sub: { fontSize: 14, marginTop: 4, lineHeight: 20, marginBottom: 12 },
  warn: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  warnText: { fontSize: 13 },
  warnCode: { fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
  label: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputWrap: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 110,
    position: 'relative',
  },
  input: {
    minHeight: 110,
    borderRadius: 16,
    padding: 14,
    paddingRight: 52,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  inputSearchIcon: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger, marginTop: 10, fontSize: 13 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  langChip: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  langText: { fontSize: 13 },
  listenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  listenText: { flex: 1, fontSize: 14 },
  listenStop: { fontSize: 14 },
  voiceErr: { marginBottom: 10 },
  settingsLink: { fontSize: 13, marginTop: 6 },
  resultWrap: {
    marginTop: 8,
  },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBtn: { flex: 1, minWidth: 0 },
  footerBtnPrimary: { flex: 1.15, minWidth: 0 },
});
