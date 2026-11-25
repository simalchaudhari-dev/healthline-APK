import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../config/colors';
import { snPro } from '../../config/fonts';
import { countries as ALL_COUNTRIES } from '../../data/countries';

const COUNTRIES = ALL_COUNTRIES.filter((c) => c.code && c.phone);

function findCountryByCode(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES.find((c) => c.code === 'IN') || COUNTRIES[0];
}

function dialDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function matchCountryFromValue(value, fallbackCode = 'IN') {
  const parsed = parsePhoneNumberFromString(String(value || ''));
  if (parsed?.country) return findCountryByCode(parsed.country);
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return findCountryByCode(fallbackCode);
  const ranked = [...COUNTRIES].sort((a, b) => dialDigits(b.phone).length - dialDigits(a.phone).length);
  return ranked.find((c) => digits.startsWith(dialDigits(c.phone))) || findCountryByCode(fallbackCode);
}

/**
 * Display string for a country, like Admin: international spacing without "+code" (the flag
 * shows it) and without a national trunk "0" — "98765 43210", "7911 123456".
 */
function formatNational(countryCode, input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  const dial = dialDigits(findCountryByCode(countryCode)?.phone);
  if (!dial) return new AsYouType(countryCode).input(digits);
  const typed = new AsYouType().input(`+${dial}${digits}`);
  const prefix = `+${dial}`;
  return typed.startsWith(prefix) ? typed.slice(prefix.length).trim() : digits;
}

function nationalDigitsFromValue(value, countryCode) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = parsePhoneNumberFromString(raw, countryCode);
  if (parsed) return parsed.nationalNumber || '';
  const digits = raw.replace(/\D/g, '');
  const dial = dialDigits(findCountryByCode(countryCode)?.phone);
  if (digits.startsWith(dial)) return digits.slice(dial.length);
  return digits;
}

function toE164(countryCode, nationalDisplay) {
  const digits = String(nationalDisplay || '').replace(/\D/g, '');
  if (!digits) return '';
  // Keep leading trunk "0" out of a "fixed" E.164 — Admin rejects 053-… style input
  if (digits.startsWith('0')) {
    return '';
  }
  const parsed = parsePhoneNumberFromString(digits, countryCode);
  if (parsed?.number) return parsed.number;
  const dial = dialDigits(findCountryByCode(countryCode)?.phone);
  return dial ? `+${dial}${digits}` : `+${digits}`;
}

function CountryFlag({ code, size = 22 }) {
  const cc = String(code || '').toLowerCase();
  if (!cc) return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#ccc' }} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#E6E8EC',
      }}
    >
      <Image
        source={{ uri: `https://flagcdn.com/w80/${cc}.png` }}
        style={{ width: size, height: size }}
        resizeMode="cover"
        accessibilityLabel={`${cc} flag`}
      />
    </View>
  );
}

/**
 * Admin-style phone field: circular flag + country picker + national formatting.
 * Emits E.164 strings (e.g. +919723506358) via onChangeText.
 */
export default function PhoneInput({
  label = 'Phone number',
  value = '',
  onChangeText,
  onCountryChange,
  onBlur,
  placeholder = 'Enter phone number',
  error = '',
  defaultCountry = 'IN',
  style,
  tone,
}) {
  const { isDark, themeColors: c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const initialCountry = value
    ? matchCountryFromValue(value, defaultCountry)
    : findCountryByCode(defaultCountry);

  const [country, setCountry] = useState(initialCountry);
  const [national, setNational] = useState(() =>
    value
      ? formatNational(initialCountry.code, nationalDigitsFromValue(value, initialCountry.code))
      : ''
  );

  // tone="soft": white field with a light green border (auth screens).
  const soft = tone === 'soft' && !isDark;
  const fill = isDark ? '#1C1C1E' : soft ? '#FFFFFF' : '#F4F6F8';
  const idleBorder = soft ? '#cfe3c7' : c.border;
  const placeholderColor = c.placeholder || c.muted;
  const hasError = !!error;
  const borderColor = hasError ? colors.danger : focused ? colors.primary : idleBorder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const dialQuery = q.replace(/\D/g, '');
    return COUNTRIES.filter((item) => {
      const name = String(item.label || '').toLowerCase();
      const code = String(item.code || '').toLowerCase();
      const dial = dialDigits(item.phone);
      const byName = name.includes(q);
      const byCode = code.includes(q);
      // Only match dial when the query has digits — `''.includes` is true for every string
      const byDial = dialQuery.length > 0 && dial.includes(dialQuery);
      return byName || byCode || byDial;
    });
  }, [query]);

  const emit = (nextCountry, nextNationalDisplay) => {
    const nationalDigits = String(nextNationalDisplay || '').replace(/\D/g, '');
    const e164 = toE164(nextCountry.code, nextNationalDisplay);
    onCountryChange?.(nextCountry.code);
    // Third arg = raw national digits (for trunk-prefix / length checks)
    onChangeText?.(e164, nextCountry.code, nationalDigits);
  };

  const openPicker = () => {
    setQuery('');
    setPickerOpen(true);
  };

  const pickCountry = (item) => {
    const digits = String(national || '').replace(/\D/g, '');
    const formatted = formatNational(item.code, digits);
    setCountry(item);
    setNational(formatted);
    setPickerOpen(false);
    setQuery('');
    emit(item, formatted);
  };

  const onNationalChange = (text) => {
    const raw = String(text || '');
    if (raw.trim().startsWith('+')) {
      const parsed = parsePhoneNumberFromString(raw);
      if (parsed?.country) {
        const nextCountry = findCountryByCode(parsed.country);
        const formatted = formatNational(nextCountry.code, parsed.nationalNumber);
        setCountry(nextCountry);
        setNational(formatted);
        emit(nextCountry, formatted);
        return;
      }
    }
    const formatted = formatNational(country.code, raw);
    setNational(formatted);
    emit(country, formatted);
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={[styles.label, { color: c.text, fontFamily: snPro(soft ? '700' : '600') }]}>{label}</Text>
      ) : null}

      <View style={[styles.box, { backgroundColor: fill, borderColor }]}>
        <Pressable onPress={openPicker} style={styles.flagBtn} hitSlop={6}>
          <CountryFlag code={country.code} size={22} />
          <ChevronDown size={16} color={c.muted} />
          <View style={[styles.vDivider, { backgroundColor: c.border }]} />
        </Pressable>

        <TextInput
          value={national}
          onChangeText={onNationalChange}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="telephoneNumber"
          autoComplete="tel"
          underlineColorAndroid="transparent"
          selectionColor={colors.primary}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const nationalDigits = String(national || '').replace(/\D/g, '');
            onBlur?.(toE164(country.code, national), country.code, nationalDigits);
          }}
          style={[styles.input, { color: c.text, fontFamily: snPro('600'), backgroundColor: fill }]}
        />
      </View>

      {hasError ? (
        <Text style={[styles.error, { fontFamily: snPro('600') }]}>{error}</Text>
      ) : null}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: isDark ? '#141414' : '#FFFFFF' }]}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.text, fontFamily: snPro('700') }]}>
                Select country
              </Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
                <X size={22} color={c.muted} />
              </Pressable>
            </View>

            <View style={[styles.searchBox, { backgroundColor: fill, borderColor: c.border }]}>
              <Search size={16} color={c.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search..."
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: c.text, fontFamily: snPro('500') }]}
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: c.muted, fontFamily: snPro('500') }]}>
                  No country found
                </Text>
              }
              renderItem={({ item }) => {
                const selected = item.code === country.code;
                return (
                  <Pressable
                    onPress={() => pickCountry(item)}
                    style={[
                      styles.row,
                      selected && { backgroundColor: isDark ? '#1C1C1E' : '#F4F6F8' },
                    ]}
                  >
                    <CountryFlag code={item.code} size={22} />
                    <Text
                      style={[styles.rowLabel, { color: c.text, fontFamily: snPro('600') }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text style={[styles.rowMeta, { color: c.muted, fontFamily: snPro('500') }]}>
                      {item.code}
                    </Text>
                    <Text style={[styles.rowDial, { color: c.muted, fontFamily: snPro('600') }]}>
                      (+{item.phone})
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: 14 },
  label: { fontSize: 13, marginBottom: 8 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingRight: 14,
    minHeight: 52,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    gap: 4,
    minHeight: 52,
  },
  vDivider: { width: 1, height: 22, marginLeft: 6, marginRight: 4 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
    margin: 0,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' }
      : null),
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 6, lineHeight: 16 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 17 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: { flex: 1, fontSize: 15 },
  rowMeta: { fontSize: 12, minWidth: 28 },
  rowDial: { fontSize: 13 },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
});
