/** Shared form validation helpers (local UI auth). */

import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(email) {
  const e = normalizeEmail(email);
  // Practical email check — not RFC-complete
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

export function validateEmail(email) {
  const raw = String(email || '').trim();
  if (!raw) return 'Email is required.';
  if (!isValidEmail(raw)) return 'Enter a valid email address.';
  return '';
}

/**
 * Optional phone — if any digits are entered it must be a complete, valid number
 * for the selected country (same message / rules as Admin).
 *
 * @param {string} phone E.164 value (may be empty while typing trunk-prefix / incomplete)
 * @param {string} [countryCode] ISO country from flag picker
 * @param {string} [nationalDigits] digits typed in the national field (optional)
 */
export function validatePhoneNumber(phone, countryCode, nationalDigits = '') {
  const raw = String(phone || '').trim();
  const national = String(nationalDigits || '').replace(/\D/g, '');

  // User typed something but we have no valid E.164 yet (e.g. leading 0 like 053-575-4574)
  if (!raw) {
    if (national) return 'Invalid phone number!';
    return '';
  }

  const country = String(countryCode || '').toUpperCase() || undefined;

  // National trunk prefix (0…) is not a valid stored number — matches Admin
  if (national.startsWith('0')) return 'Invalid phone number!';

  const parsed =
    (country ? parsePhoneNumberFromString(raw, country) : null) || parsePhoneNumberFromString(raw);

  if (!parsed) return 'Invalid phone number!';
  if (country && parsed.country && parsed.country !== country) {
    return 'Invalid phone number!';
  }
  if (!parsed.isValid()) return 'Invalid phone number!';

  // If we know what they typed, national digits must match the parsed number
  if (national && national !== parsed.nationalNumber) {
    return 'Invalid phone number!';
  }

  return '';
}

/** Password rules shown as live checklist under the field (register). */
export function passwordRules(password) {
  const p = String(password || '');
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN} characters`, ok: p.length >= PASSWORD_MIN },
    { id: 'lower', label: 'One lowercase letter (a–z)', ok: /[a-z]/.test(p) },
    { id: 'upper', label: 'One capital letter (A–Z)', ok: /[A-Z]/.test(p) },
    { id: 'number', label: 'One number (0–9)', ok: /\d/.test(p) },
    { id: 'special', label: 'One special character (!@#…)', ok: /[^A-Za-z0-9]/.test(p) },
  ];
}

/**
 * Password strength 0–5 = how many checklist rules pass.
 */
export function passwordStrength(password) {
  return passwordRules(password).filter((r) => r.ok).length;
}

export function passwordStrengthLabel(score) {
  if (score <= 0) return '';
  if (score <= 1) return 'Very weak';
  if (score === 2) return 'Weak';
  if (score === 3) return 'Fair';
  if (score === 4) return 'Strong';
  return 'Very strong';
}

const NEXT_RULE_HINT = {
  length: `Use at least ${PASSWORD_MIN} characters`,
  lower: 'Add a lowercase letter (a–z)',
  upper: 'Add a capital letter (A–Z)',
  number: 'Add a number (0–9)',
  special: 'Add a symbol (!@#…) to make it stronger',
};

/** One line under the password field: strength + the next missing rule (shown one at a time). */
export function passwordNextHint(password) {
  const p = String(password || '');
  const next = passwordRules(p).find((r) => !r.ok);
  if (!p) return { text: `${NEXT_RULE_HINT.length}.`, done: false };
  const label = passwordStrengthLabel(passwordStrength(p));
  if (!next) return { text: `${label} password.`, done: true };
  return { text: `${label} password. ${NEXT_RULE_HINT[next.id]}.`, done: false };
}

export function passwordStrengthColor(score) {
  if (score <= 1) return '#FF3B30';
  if (score === 2) return '#FF9500';
  if (score === 3) return '#FFCC00';
  if (score === 4) return '#34C759';
  return '#00B67A';
}

/** Full rules for register / create account. */
export function validatePassword(password) {
  const p = String(password || '');
  if (!p) return 'Password is required.';
  if (p.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  }
  const failed = passwordRules(p).filter((r) => !r.ok);
  if (failed.length) {
    return `Add: ${failed.map((r) => r.label.replace(/^One /, '').replace(/^At least /, '')).join(', ')}.`;
  }
  return '';
}

/** Lighter check for sign-in — required + min/max length. */
export function validateLoginPassword(password) {
  const p = String(password || '');
  if (!p) return 'Password is required.';
  if (p.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (p.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  }
  return '';
}

export function validateConfirmPassword(password, confirm) {
  if (!String(confirm || '')) return 'Confirm your password.';
  if (String(password) !== String(confirm)) return 'Passwords do not match.';
  return '';
}

export function validateRequired(value, label = 'This field') {
  if (!String(value || '').trim()) return `${label} is required.`;
  return '';
}

export function validateName(value, label = 'Name') {
  const v = String(value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < 2) return `${label} must be at least 2 characters.`;
  if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(v)) {
    return `${label} can only use letters, spaces, ' or -.`;
  }
  return '';
}

/** Keep digits. Weight-style fields may keep a single decimal point. Drops + and -. */
export function onlyNumbers(value, { decimal = false } = {}) {
  const raw = String(value ?? '');
  if (!decimal) return raw.replace(/\D/g, '');
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
}

export function validateAge(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Age is required.';
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Enter a whole number for age.';
  if (n < 13 || n > 120) return 'Age must be between 13 and 120.';
  return '';
}

export function validateHeightCm(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Height is required.';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a valid height.';
  if (n < 100 || n > 250) return 'Height must be between 100 and 250 cm.';
  return '';
}

export function validateWeightKg(value, label = 'Weight') {
  const raw = String(value || '').trim();
  if (!raw) return `${label} is required.`;
  const n = Number(raw);
  if (!Number.isFinite(n)) return `Enter a valid ${label.toLowerCase()}.`;
  if (n < 30 || n > 300) return `${label} must be between 30 and 300 kg.`;
  return '';
}

/** Trimmed text length check for names of activities, foods, grocery items, etc. */
export function validateText(value, label = 'This field', { min = 2, max = 80 } = {}) {
  const v = String(value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return '';
}

export function validateInteger(
  value,
  label = 'Value',
  { min = 0, max = 9999, required = true } = {},
) {
  const raw = String(value || '').trim();
  if (!raw) return required ? `${label} is required.` : '';
  if (!/^\d+$/.test(raw)) return `Enter a whole number for ${label.toLowerCase()}.`;
  const n = Number(raw);
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return '';
}

export function validateNumber(
  value,
  label = 'Value',
  { min = 0, max = 9999, required = true } = {},
) {
  const raw = String(value || '').trim();
  if (!raw) return required ? `${label} is required.` : '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return `Enter a valid ${label.toLowerCase()}.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return '';
}

export function validateMinutes(value) {
  return validateInteger(value, 'Minutes', { min: 1, max: 600 });
}

export function validateCaloriesBurned(value) {
  return validateInteger(value, 'Calories', { min: 1, max: 5000 });
}

export function validateDailyCalories(value) {
  return validateInteger(value, 'Calories', { min: 800, max: 6000 });
}

export function validateMacroGrams(value, label = 'Macro', { required = true, min = 0, max = 1000 } = {}) {
  return validateNumber(value, label, { min, max, required });
}

export function validateWaterGlasses(value) {
  return validateInteger(value, 'Water glasses', { min: 1, max: 30 });
}

export function validateActivityName(value) {
  return validateText(value, 'Activity', { min: 2, max: 60 });
}

export function validateFoodName(value) {
  return validateText(value, 'Food name', { min: 2, max: 80 });
}

export function validateMealName(value) {
  return validateText(value, 'Meal name', { min: 2, max: 80 });
}

export function validateGroceryName(value) {
  return validateText(value, 'Item name', { min: 2, max: 80 });
}

export function validateQty(value, label = 'Quantity') {
  const v = String(value || '').trim();
  if (!v) return `${label} is required.`;
  if (v.length > 40) return `${label} is too long.`;
  return '';
}

