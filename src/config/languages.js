/**
 * The one app language (onboarding + Profile → Language). Saved to the account, used by
 * every AI screen and voice logging. `speech` is the voice-logging locale.
 */
export const APP_LANGUAGES = [
  { id: 'en', native: 'English', english: 'English', sample: 'Aa', speech: 'en-IN' },
  { id: 'hi', native: 'हिन्दी', english: 'Hindi', sample: 'अ', speech: 'hi-IN' },
  { id: 'gu', native: 'ગુજરાતી', english: 'Gujarati', sample: 'અ', speech: 'gu-IN' },
  { id: 'hinglish', native: 'Hinglish', english: 'Hindi in English letters', sample: 'Hi', speech: 'hi-IN' },
];

export const DEFAULT_LANGUAGE = 'en';

export function languageById(id) {
  return APP_LANGUAGES.find((l) => l.id === id) || APP_LANGUAGES[0];
}
