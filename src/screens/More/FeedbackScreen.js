import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Bug, Lightbulb, MessageCircle } from 'lucide-react-native';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader from '../../components/common/ScreenHeader';
import AppButton from '../../components/common/AppButton';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { themeColors, colors, primaryRgba } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { toast } from '../../utils/toast';
import { apiSubmitFeedback } from '../../services/authService';

const APP_VERSION = '1.0.0';

const TYPES = [
  { id: 'Bug', label: 'Bug', hint: 'Something is broken', icon: Bug },
  { id: 'Suggestion', label: 'Suggestion', hint: 'A change you want', icon: Lightbulb },
  { id: 'Other', label: 'Other', hint: 'Anything else', icon: MessageCircle },
];

export default function FeedbackScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { accessToken } = useAuth();
  const [category, setCategory] = useState('Suggestion');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (!accessToken) {
      toast.error('Sign in to send feedback.');
      return;
    }
    if (text.length < 5) {
      toast.error('Write at least a few words.');
      return;
    }
    try {
      setSending(true);
      await apiSubmitFeedback(accessToken, { category, message: text, appVersion: APP_VERSION });
      setMessage('');
      toast.success('Thanks. Your feedback was sent.');
      navigation.goBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send feedback.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Feedback" onBack={() => navigation.goBack()} theme={c} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: c.text, fontFamily: FONT.nova }]}>Tell us what to change</Text>
        <Text style={[styles.sub, { color: c.muted, fontFamily: snPro('400') }]}>
          Your note is saved for the team. They use it to update the app.
        </Text>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>TYPE</Text>
        <View style={styles.types}>
          {TYPES.map((item) => {
            const selected = category === item.id;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={() => setCategory(item.id)}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: selected ? (isDark ? primaryRgba(0.22) : colors.primarySoft) : c.cardBg,
                    borderColor: selected ? colors.primary : c.border,
                  },
                ]}
              >
                <Icon size={18} color={selected ? colors.primary : c.muted} />
                <Text style={[styles.typeLabel, { color: c.text, fontFamily: snPro('700') }]}>{item.label}</Text>
                <Text style={[styles.typeHint, { color: c.muted, fontFamily: snPro('500') }]}>{item.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>MESSAGE</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          placeholder="What should we fix or add?"
          placeholderTextColor={c.placeholder}
          style={[
            styles.input,
            {
              color: c.text,
              backgroundColor: c.cardBg,
              borderColor: c.border,
              fontFamily: snPro('400'),
            },
          ]}
        />
        <Text style={[styles.count, { color: c.muted, fontFamily: snPro('500') }]}>{message.trim().length}/2000</Text>

        <AppButton label="Send feedback" onPress={submit} loading={sending} disabled={sending} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 26, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  section: { fontSize: 10, letterSpacing: 1, marginBottom: 10 },
  types: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  typeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
      default: {},
    }),
  },
  typeLabel: { fontSize: 13, marginTop: 4 },
  typeHint: { fontSize: 11, lineHeight: 15 },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  count: { fontSize: 12, marginTop: 6, marginBottom: 16, textAlign: 'right' },
});
