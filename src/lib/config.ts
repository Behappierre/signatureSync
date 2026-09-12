/** Build-time configuration, all of it public and safe to ship to the browser. */

/**
 * Vite replaces import.meta.env at build time. Reading it defensively keeps
 * these modules importable outside a Vite build, which is what lets the test
 * suite run them directly under Node.
 */
const env: Partial<ImportMetaEnv> = (import.meta as { env?: ImportMetaEnv }).env ?? {};

export const GOOGLE_CLIENT_ID = (env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
export const GOOGLE_API_KEY = (env.VITE_GOOGLE_API_KEY ?? '').trim();
export const GOOGLE_APP_ID = (env.VITE_GOOGLE_APP_ID ?? '').trim();

/**
 * drive.file grants access only to files the user creates through this app or
 * explicitly opens with the Picker. That keeps us out of Google's restricted
 * scope tier, so the app needs no security assessment to be used by anyone.
 *
 * Set VITE_GOOGLE_SCOPES to include .../auth/spreadsheets instead if you want
 * to paste arbitrary sheet IDs, and accept the verification work that implies.
 */
export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export const GOOGLE_SCOPES = (env.VITE_GOOGLE_SCOPES ?? DEFAULT_SCOPES).trim();

export const isConfigured = (): boolean => GOOGLE_CLIENT_ID.length > 0;
export const canUsePicker = (): boolean => GOOGLE_API_KEY.length > 0;

export const EXTRACT_ENDPOINT = '/api/extract';
