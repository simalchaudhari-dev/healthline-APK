/** Admin API address. Razorpay, Cloudinary, and OpenRouter come from Admin Settings. */
export const ENV = {
  // API_BASE_URL: 'http://192.168.29.73:3000',
  // API_BASE_URL: 'http://189.72.153.19:3000',
  API_BASE_URL: 'https://healthlinenutrition.tech',
  /**
   * Google sign-in client IDs are set in Admin → Settings → Google and loaded at run time
   * (GET /api/auth/google/config). These are only a fallback when the server can't be reached.
   * Client IDs are public — never put a client secret here.
   */
  GOOGLE_WEB_CLIENT_ID: '',
  GOOGLE_ANDROID_CLIENT_ID: '718792853301-1ghpkv675rdeojm64vnojksbt624qrmc.apps.googleusercontent.com',
};

export function apiBase() {
  return String(ENV.API_BASE_URL || '').replace(/\/$/, '');
}
