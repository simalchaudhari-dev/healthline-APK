import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';

/**
 * Small dropdown: label on top, the chosen value in a box, options in a popup.
 * `options`: [{ id, label }]
 */
export default function SelectField({ label, value, options, onChange, style }) {
  const { isDark, themeColors: c } = useTheme();
  const [open, setOpen] = useState(false);
  const ink = isDark ? c.text : '#0d1b2a';
  const muted = isDark ? c.muted : '#4b5563';
  const current = options.find((o) => o.id === value) || options[0];

  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]}>
      {label ? <Text style={[styles.label, { color: muted, fontFamily: snPro('700') }]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Choose'}: ${current?.label || ''}`}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: c.cardBg, borderColor: isDark ? c.border : '#cfe3c7', opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text style={[styles.value, { color: ink, fontFamily: snPro('700') }]} numberOfLines={1}>
          {current?.label}
        </Text>
        <ChevronDown size={16} color={muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.cardBg }]} onPress={() => {}}>
            {label ? <Text style={[styles.title, { color: ink, fontFamily: FONT.heading }]}>{label}</Text> : null}
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o, i) => {
                const on = o.id === current?.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[
                      styles.option,
                      i > 0 && { borderTopWidth: 1, borderTopColor: isDark ? c.border : '#eef2ec' },
                    ]}
                  >
                    <Text
                      style={[styles.optionText, { color: on ? colors.primary : ink, fontFamily: snPro(on ? '800' : '600') }]}
                    >
                      {o.label}
                    </Text>
                    {on ? <Check size={18} color={colors.primary} strokeWidth={2.6} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, marginBottom: 6 },
  box: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  value: { flex: 1, fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,27,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 17, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  optionText: { fontSize: 15 },
});
