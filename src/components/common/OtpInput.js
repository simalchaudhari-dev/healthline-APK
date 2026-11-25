import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { snPro, poppins } from '../../config/fonts';

/**
 * Segmented one-time-code field — one box per digit. A single hidden TextInput
 * captures typing, paste and SMS/email autofill; the boxes only display it.
 */
export default function OtpInput({
  value,
  onChangeText,
  length = 6,
  label,
  error = '',
  hint = '',
  autoFocus = true,
  onComplete,
  style,
  tone,
}) {
  const { isDark, colors, themeColors: c } = useTheme();
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  // tone="soft": white field with a light green border (auth screens).
  const soft = tone === 'soft' && !isDark;
  const fill = isDark ? '#1C1C1E' : soft ? '#FFFFFF' : '#F4F6F8';
  const idleBorder = soft ? '#cfe3c7' : c.border;
  const hasError = !!error;
  const digits = String(value || '').split('');
  const activeIndex = Math.min(digits.length, length - 1);

  const handleChange = (text) => {
    const next = String(text || '').replace(/\D/g, '').slice(0, length);
    onChangeText?.(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={[styles.label, { color: c.text, fontFamily: snPro(soft ? '700' : '600') }]}>{label}</Text>
      ) : null}

      <Pressable onPress={() => inputRef.current?.focus()} style={styles.row} accessibilityRole="none">
        {Array.from({ length }).map((_, i) => {
          const isActive = focused && i === activeIndex;
          let borderColor = idleBorder;
          if (hasError) borderColor = colors.danger;
          else if (isActive) borderColor = colors.primary;
          else if (digits[i]) borderColor = soft ? colors.primary : isDark ? '#3A3A3C' : '#C9CED6';

          return (
            <View
              key={i}
              style={[
                styles.cell,
                { backgroundColor: fill, borderColor },
                isActive && !hasError ? { borderWidth: 2 } : null,
              ]}
            >
              <Text style={[styles.digit, { color: hasError ? colors.danger : c.text, fontFamily: soft ? poppins('600') : snPro('700') }]}>
                {digits[i] || ''}
              </Text>
              {isActive && !digits[i] ? (
                <View style={[styles.caret, { backgroundColor: colors.primary }]} />
              ) : null}
            </View>
          );
        })}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          maxLength={length}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus={autoFocus}
          caretHidden
          contextMenuHidden={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label || 'Verification code'}
          style={[styles.hiddenInput, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
        />
      </Pressable>

      {hasError ? (
        <View style={styles.msgRow}>
          <CircleAlert size={14} color={colors.danger} />
          <Text style={[styles.error, { color: colors.danger, fontFamily: snPro('600') }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('500') }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: 14 },
  label: { fontSize: 13, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    position: 'relative',
  },
  cell: {
    flex: 1,
    maxWidth: 56,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 22 },
  caret: { position: 'absolute', width: 2, height: 24, borderRadius: 1 },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    color: 'transparent',
    fontSize: 1,
  },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  error: { fontSize: 13, flex: 1 },
  hint: { fontSize: 12, marginTop: 10 },
});
