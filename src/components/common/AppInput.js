import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Eye, EyeOff, CircleAlert } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import {
  onlyNumbers,
  passwordNextHint,
  passwordStrength,
  passwordStrengthColor,
} from '../../utils/validation';

/**
 * Web: browsers paint autofilled inputs with their own (grey/black) text colour, which is
 * hard to read in dark mode. One page-wide rule keeps autofilled text in the theme's colour.
 */
const AUTOFILL_STYLE_ID = 'hl-autofill-text';
function syncAutofillTextColor(color) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !color) return;
  let tag = document.getElementById(AUTOFILL_STYLE_ID);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = AUTOFILL_STYLE_ID;
    document.head.appendChild(tag);
  }
  const css = `input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,textarea:-webkit-autofill{-webkit-text-fill-color:${color} !important;caret-color:${color};transition:background-color 600000s 0s,color 600000s 0s;}`;
  if (tag.textContent !== css) tag.textContent = css;
}

function webAutofillStyle(fill) {
  if (Platform.OS !== 'web') return null;
  return {
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    backgroundColor: fill,
    boxShadow: `0 0 0px 1000px ${fill} inset`,
  };
}

/**
 * Shared text field — label, focus ring, error/hint prompts, optional password
 * strength meter + rule checklist.
 */
export default function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  error = '',
  hint = '',
  showStrength = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  onBlur,
  onFocus,
  style,
  inputStyle,
  tone,
  ...rest
}) {
  const { isDark, themeColors: c } = useTheme();
  useEffect(() => {
    syncAutofillTextColor(c.text);
  }, [c.text]);
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  // tone="soft": white field with a light green border (auth screens).
  const soft = tone === 'soft' && !isDark;
  const fill = isDark ? '#1C1C1E' : soft ? '#FFFFFF' : '#F4F6F8';
  const idleBorder = soft ? '#cfe3c7' : c.border;
  const placeholderColor = c.placeholder || c.muted;
  const hasError = !!error;
  const borderColor = hasError ? colors.danger : focused ? colors.primary : idleBorder;
  const showMeter = showStrength && secure;
  const strength = showMeter ? passwordStrength(value) : 0;
  const strengthClr = passwordStrengthColor(strength);
  // Requirements show one at a time — only the next missing rule.
  const nextHint = showMeter ? passwordNextHint(value) : null;
  const decimal = keyboardType === 'decimal-pad';
  const numeric = decimal || keyboardType === 'number-pad' || keyboardType === 'numeric';
  const handleChange = (next) => {
    onChangeText?.(numeric ? onlyNumbers(next, { decimal }) : next);
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={[styles.label, { color: c.text, fontFamily: snPro(soft ? '700' : '600') }]}>{label}</Text>
      ) : null}

      <View style={[styles.box, { backgroundColor: fill, borderColor }]}>
        <TextInput
          value={value}
          onChangeText={handleChange}
          inputMode={decimal ? 'decimal' : numeric ? 'numeric' : undefined}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          secureTextEntry={secure && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete || 'off'}
          textContentType={textContentType || 'none'}
          importantForAutofill="no"
          underlineColorAndroid="transparent"
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: c.text, fontFamily: snPro('600'), backgroundColor: fill },
            webAutofillStyle(fill),
            inputStyle,
          ]}
          {...rest}
        />
        {hasError && !secure ? (
          <View style={styles.trailing}>
            <CircleAlert size={18} color={colors.danger} />
          </View>
        ) : null}
        {secure ? (
          <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} style={styles.trailing}>
            {show ? <EyeOff size={18} color={c.muted} /> : <Eye size={18} color={c.muted} />}
          </Pressable>
        ) : null}
      </View>

      {showMeter ? (
        <View style={styles.strengthBlock}>
          <View style={styles.strengthRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSeg,
                  {
                    backgroundColor:
                      i < strength ? strengthClr : isDark ? '#2A2A2A' : soft ? '#d7e6d1' : '#E6E8EC',
                  },
                ]}
              />
            ))}
          </View>
          {!hasError ? (
            <Text
              style={[
                styles.strengthHint,
                { color: nextHint.done ? strengthClr : c.muted, fontFamily: snPro(nextHint.done ? '700' : '500') },
              ]}
            >
              {nextHint.text}
            </Text>
          ) : null}
        </View>
      ) : null}

      {hasError ? (
        <Text style={[styles.error, { fontFamily: snPro('600') }]}>{error}</Text>
      ) : hint && !showMeter ? (
        <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('500') }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: 14 },
  label: {
    fontSize: 13,
    marginBottom: 8,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
    margin: 0,
  },
  trailing: { paddingLeft: 8, paddingVertical: 6 },
  strengthBlock: { marginTop: 10 },
  strengthRow: { flexDirection: 'row', gap: 6 },
  strengthSeg: {
    flex: 1,
    height: 4,
    borderRadius: 99,
  },
  strengthHint: { fontSize: 12, marginTop: 8, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 12, marginTop: 6, lineHeight: 16 },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 16 },
});
