/**
 * Extends app.json at build time.
 *
 * google-services.json (Firebase / push) is not committed to git:
 *   - EAS builds: uploaded as the secret file variable GOOGLE_SERVICES_JSON (preview + production)
 *   - Local: keep your copy at ./google-services.json (git-ignored)
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
});
