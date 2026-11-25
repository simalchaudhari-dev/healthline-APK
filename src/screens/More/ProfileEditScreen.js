import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenShell from '../../components/common/ScreenShell';
import ScreenHeader, { SaveButton } from '../../components/common/ScreenHeader';
import AvatarInitial from '../../components/common/AvatarInitial';
import { useTheme } from '../../context/ThemeContext';
import { useDiary } from '../../context/DiaryContext';
import { useAuth } from '../../context/AuthContext';
import { colors, themeColors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';
import { validateEmail, validateName, validatePhoneNumber } from '../../utils/validation';
import PhoneInput from '../../components/common/PhoneInput';
import AvatarCropModal from '../../components/common/AvatarCropModal';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { formatPlanLabel } from '../../config/plans';
import { toast } from '../../utils/toast';

const GOALS = [
  { key: 'lose', label: 'Lose weight' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain', label: 'Gain muscle' },
];

function splitExistingName(profile) {
  if (profile.firstName || profile.lastName) {
    return {
      first: profile.firstName || '',
      last: profile.lastName || '',
    };
  }
  const parts = String(profile.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' '),
  };
}

export default function ProfileEditScreen({ navigation }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const { profile, updateProfile, goal, setGoal } = useDiary();
  const { user, isSignedIn, updateUser } = useAuth();

  const initial = useMemo(() => {
    const fromProfile = splitExistingName(profile);
    return {
      firstName: user?.firstName || fromProfile.first,
      lastName: user?.lastName || fromProfile.last,
      email: user?.email || profile.email || '',
    };
  }, [profile, user]);

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email);
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [phoneCountry, setPhoneCountry] = useState(
    () => parsePhoneNumberFromString(user?.phoneNumber || '')?.country || 'IN',
  );
  const [phoneNational, setPhoneNational] = useState('');
  const [selectedGoal, setSelectedGoal] = useState(goal);
  const [errors, setErrors] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [localPhoto, setLocalPhoto] = useState(null); // { uri, mimeType, fileName }
  const [cropSource, setCropSource] = useState(null); // picked photo waiting on the crop screen

  // Keep fields in sync when auth user loads / refreshes
  useEffect(() => {
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setEmail(initial.email);
  }, [initial.firstName, initial.lastName, initial.email]);

  const displayName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') ||
    user?.displayName ||
    profile.name;

  const planLabel = formatPlanLabel(user?.plan || 'Free');
  const previewUri = localPhoto?.uri || user?.photoURL || '';

  const pickPhoto = async () => {
    if (!isSignedIn) {
      toast.warning('Sign in to update your profile photo.');
      setFormError('Sign in to update your profile photo.');
      return;
    }
    setFormError('');
    try {
      // Android Photo Picker (PickVisualMedia) / iOS PHPicker do not require media library permissions.
      // Our own crop screen (same on web and Android) — so no system editor here.
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });

      if (picked.canceled || !picked.assets?.[0]?.uri) return;

      const asset = picked.assets[0];
      setCropSource({ uri: asset.uri, width: asset.width, height: asset.height });
    } catch (e) {
      const msg = e.message || 'Could not open gallery.';
      toast.error(msg);
      setFormError(msg);
    }
  };

  /** "Use photo" on the crop screen → upload the cropped square. */
  const uploadCropped = async (photo) => {
    setCropSource(null);
    setLocalPhoto(photo);
    const res = await updateUser({
      firstName,
      lastName,
      email,
      photoURL: photo,
    });
    if (!res.ok) {
      setFormError(res.error || 'Could not upload photo.');
      return;
    }
    setLocalPhoto(null);
  };

  const cancelCrop = (message) => {
    setCropSource(null);
    if (typeof message === 'string' && message) {
      toast.error(message);
      setFormError(message);
    }
  };

  const save = async () => {
    setFormError('');
    const nextErrors = {
      firstName: validateName(firstName, 'First name'),
      lastName: validateName(lastName, 'Last name'),
      email: validateEmail(email),
      phone: validatePhoneNumber(phoneNumber, phoneCountry, phoneNational),
    };
    setErrors(nextErrors);
    if (nextErrors.firstName || nextErrors.lastName || nextErrors.email || nextErrors.phone) {
      toast.warning('Please fix the highlighted fields.');
      return;
    }

    const fn = firstName.trim();
    const ln = lastName.trim();
    const fullName = [fn, ln].filter(Boolean).join(' ');

    setSaving(true);
    try {
      if (isSignedIn && updateUser) {
        const res = await updateUser({
          firstName: fn,
          lastName: ln,
          email,
          photoURL: localPhoto || undefined,
          phoneNumber,
          profile: { goal: selectedGoal },
        });
        if (!res.ok) {
          setErrors((p) => ({ ...p, email: res.error || 'Could not update account.' }));
          setFormError(res.error || 'Could not update account.');
          return;
        }
        setLocalPhoto(null);
      } else {
        toast.success('Profile saved');
      }

      updateProfile({
        name: fullName,
        firstName: fn,
        lastName: ln,
        email: email.trim().toLowerCase(),
      });
      setGoal(selectedGoal);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: c.text, backgroundColor: c.cardBg, borderColor: c.border, fontFamily: snPro('600') },
  ];

  return (
    <ScreenShell>
      <ScreenHeader
        title="Edit profile"
        onBack={() => navigation.goBack()}
        theme={c}
        right={<SaveButton onPress={save} disabled={saving} />}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <AvatarInitial
            name={displayName}
            uri={previewUri}
            size={88}
            backgroundColor={colors.primary}
            onPress={isSignedIn ? pickPhoto : undefined}
            accessibilityLabel="Change profile photo"
          />
          {isSignedIn ? (
            <Pressable onPress={pickPhoto} hitSlop={8}>
              <Text style={[styles.changePhoto, { color: colors.primary, fontFamily: snPro('700') }]}>
                {previewUri ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.hint, { color: c.muted, fontFamily: snPro('500') }]}>
            {isSignedIn ? user?.email || email : 'Sign in to sync your account'}
          </Text>
        </View>

        {isSignedIn ? (
          <Pressable
            onPress={() => navigation.navigate('Subscription')}
            style={[
              styles.planCard,
              {
                backgroundColor: isDark ? '#1C1C1E' : colors.primarySoft,
                borderColor: c.border,
              },
            ]}
          >
            <View style={[styles.planIcon, { backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF' }]}>
              <Crown size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planLbl, { color: c.muted, fontFamily: snPro('600') }]}>
                Subscription
              </Text>
              <Text style={[styles.planVal, { color: c.text, fontFamily: snPro('700') }]}>
                {planLabel}
                {user?.status ? ` · ${user.status}` : ''}
              </Text>
            </View>
            <Text style={[styles.planCta, { color: colors.primary, fontFamily: snPro('700') }]}>
              Manage
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800') }]}>FIRST NAME</Text>
        <TextInput
          value={firstName}
          onChangeText={(v) => {
            setFirstName(v);
            if (errors.firstName) setErrors((p) => ({ ...p, firstName: validateName(v, 'First name') }));
          }}
          style={inputStyle}
          placeholder="First name"
          placeholderTextColor={c.placeholder}
          autoCapitalize="words"
          textContentType="givenName"
          autoComplete="given-name"
        />
        {errors.firstName ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errors.firstName}</Text>
        ) : null}

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800'), marginTop: 16 }]}>
          LAST NAME
        </Text>
        <TextInput
          value={lastName}
          onChangeText={(v) => {
            setLastName(v);
            if (errors.lastName) setErrors((p) => ({ ...p, lastName: validateName(v, 'Last name') }));
          }}
          style={inputStyle}
          placeholder="Last name"
          placeholderTextColor={c.placeholder}
          autoCapitalize="words"
          textContentType="familyName"
          autoComplete="family-name"
        />
        {errors.lastName ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errors.lastName}</Text>
        ) : null}

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800'), marginTop: 16 }]}>EMAIL</Text>
        <TextInput
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errors.email) setErrors((p) => ({ ...p, email: validateEmail(v) }));
          }}
          style={inputStyle}
          placeholder="you@email.com"
          placeholderTextColor={c.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
        />
        {errors.email ? (
          <Text style={[styles.error, { color: colors.danger }]}>{errors.email}</Text>
        ) : null}

        {isSignedIn ? (
          <PhoneInput
            label="Phone number"
            value={phoneNumber}
            onChangeText={(v, code, national) => {
              setPhoneNumber(v);
              if (code) setPhoneCountry(code);
              setPhoneNational(national || '');
              if (errors.phone) setErrors((p) => ({ ...p, phone: '' }));
            }}
            onCountryChange={setPhoneCountry}
            onBlur={(e164, code, national) => {
              if (code) setPhoneCountry(code);
              if (e164 !== undefined) setPhoneNumber(e164);
              if (national !== undefined) setPhoneNational(national);
              setErrors((p) => ({
                ...p,
                phone: validatePhoneNumber(e164 ?? phoneNumber, code || phoneCountry, national ?? phoneNational),
              }));
            }}
            placeholder="Enter phone number"
            defaultCountry="IN"
            error={errors.phone}
            style={{ marginTop: 16 }}
          />
        ) : null}

        <Text style={[styles.section, { color: c.muted, fontFamily: snPro('800'), marginTop: 16 }]}>GOAL</Text>
        {GOALS.map((g) => {
          const on = selectedGoal === g.key;
          return (
            <Pressable
              key={g.key}
              onPress={() => setSelectedGoal(g.key)}
              style={[
                styles.goalRow,
                {
                  backgroundColor: c.cardBg,
                  borderColor: on ? colors.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.goalLbl, { color: c.text, fontFamily: snPro('700') }]}>{g.label}</Text>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: on ? colors.primary : c.border,
                    backgroundColor: on ? colors.primary : 'transparent',
                  },
                ]}
              />
            </Pressable>
          );
        })}

        {formError ? (
          <Text style={[styles.error, { color: colors.danger, marginTop: 12 }]}>{formError}</Text>
        ) : null}

        <View style={[styles.info, { backgroundColor: isDark ? '#1C1C1E' : c.chip }]}>
          <Text style={[styles.infoTitle, { color: c.text, fontFamily: FONT.nova }]}>
            {isSignedIn ? 'Synced account' : 'Local profile'}
          </Text>
          <Text style={[styles.infoBody, { color: c.muted, fontFamily: snPro('400') }]}>
            {isSignedIn
              ? 'Name, email, phone, photo and goal save to your Health line account. Body, diet and allergies are under More → Health details.'
              : 'Sign in to sync your account. Goals stay on this device.'}
          </Text>
        </View>
      </ScrollView>

      {/* Move & zoom the picked photo in a round frame before it is uploaded */}
      <AvatarCropModal
        visible={!!cropSource}
        uri={cropSource?.uri}
        width={cropSource?.width}
        height={cropSource?.height}
        onCancel={cancelCrop}
        onDone={uploadCropped}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  avatarWrap: { alignItems: 'center', marginBottom: 16 },
  changePhoto: { fontSize: 14, marginTop: 10 },
  hint: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
    gap: 10,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLbl: { fontSize: 11 },
  planVal: { fontSize: 15, marginTop: 2 },
  planCta: { fontSize: 13 },
  section: { fontSize: 10, letterSpacing: 1, marginBottom: 10 },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 12, marginTop: 6, marginBottom: 2 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  goalLbl: { fontSize: 15 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 99,
    borderWidth: 2,
  },
  info: {
    marginTop: 20,
    borderRadius: 14,
    padding: 14,
  },
  infoTitle: { fontSize: 16, marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 19 },
});
