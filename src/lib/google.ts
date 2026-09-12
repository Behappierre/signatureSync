import { GOOGLE_API_KEY, GOOGLE_APP_ID, GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config.ts';
import type { GoogleUser } from '../types/index.ts';

/**
 * Browser-side Google auth. Uses the Google Identity Services token client,
 * which issues an access token directly to the page. There is no client
 * secret, no refresh token, no server-side session and nothing to store.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';
const RECONNECT_FLAG = 'signaturesync.connected';

let tokenClient: GoogleTokenClient.Client | null = null;
let accessToken: string | null = null;
let expiresAt = 0;
/** The scopes Google actually granted, which can be fewer than we asked for. */
let grantedScope = '';
/** Resolver for the in-flight token request, if any. */
let pending: { resolve: (token: string) => void; reject: (error: Error) => void } | null = null;

const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = scriptPromises.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = src;
    element.async = true;
    element.defer = true;
    element.onload = () => resolve();
    element.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(element);
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function ensureTokenClient(): Promise<GoogleTokenClient.Client> {
  if (tokenClient) return tokenClient;

  await loadScript(GIS_SRC);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services failed to initialise.');

  tokenClient = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (response) => {
      if (response.error || !response.access_token) {
        const message =
          response.error === 'access_denied'
            ? 'Google access was declined.'
            : response.error_description || response.error || 'Google did not return a token.';
        pending?.reject(new Error(message));
      } else {
        accessToken = response.access_token;
        grantedScope = response.scope ?? '';
        // Renew a minute early so a call never goes out on a just-expired token.
        expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000 - 60_000;
        localStorage.setItem(RECONNECT_FLAG, '1');
        pending?.resolve(response.access_token);
      }
      pending = null;
    },
    error_callback: (error) => {
      pending?.reject(new Error(error.message || 'Google sign-in was closed.'));
      pending = null;
    },
  });

  return tokenClient;
}

function requestToken(prompt: '' | 'none' | 'consent'): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (pending) {
      reject(new Error('A Google sign-in is already in progress.'));
      return;
    }
    pending = { resolve, reject };
    ensureTokenClient()
      .then((client) => client.requestAccessToken({ prompt }))
      .catch((error: unknown) => {
        pending = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

/** Interactive connect. Shows the Google consent screen when needed. */
export async function connect(): Promise<string> {
  return requestToken('');
}

/**
 * Restore a session without any UI. Resolves to null when the user has not
 * connected before or the silent request is refused.
 */
export async function restoreSession(): Promise<string | null> {
  if (localStorage.getItem(RECONNECT_FLAG) !== '1') return null;
  try {
    return await requestToken('none');
  } catch {
    return null;
  }
}

/** A valid access token, renewed silently if the current one has expired. */
export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt) return accessToken;
  accessToken = null;
  try {
    return await requestToken('none');
  } catch {
    return requestToken('');
  }
}

/**
 * What Google granted, not what we requested. A consent given before a scope
 * was added to the project stays granted at the old, narrower set, which is a
 * common and otherwise invisible cause of 403s.
 */
export function grantedScopes(): string[] {
  return grantedScope.split(' ').filter(Boolean);
}

export function hasScope(suffix: string): boolean {
  return grantedScopes().some((scope) => scope.endsWith(suffix));
}

export function currentToken(): string | null {
  return accessToken && Date.now() < expiresAt ? accessToken : null;
}

export function disconnect(): void {
  const token = accessToken;
  accessToken = null;
  expiresAt = 0;
  grantedScope = '';
  localStorage.removeItem(RECONNECT_FLAG);
  if (token) window.google?.accounts?.oauth2.revoke(token);
}

export async function fetchUser(token: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Could not read your Google profile.');
  const data = (await response.json()) as { email?: string; name?: string; picture?: string };
  return {
    email: data.email ?? '',
    name: data.name ?? data.email ?? 'Signed in',
    picture: data.picture,
  };
}

/* ------------------------------------------------------------------ */
/* Picker                                                              */
/* ------------------------------------------------------------------ */

export interface PickedSheet {
  id: string;
  name: string;
  url: string;
}

/**
 * Open the Google Picker so the user can choose an existing spreadsheet.
 * Picking a file is what grants this app access to it under drive.file.
 * Resolves to null when the user cancels.
 */
export async function pickSpreadsheet(token: string): Promise<PickedSheet | null> {
  if (!GOOGLE_API_KEY) {
    throw new Error(
      'Choosing an existing sheet needs VITE_GOOGLE_API_KEY to be set. You can still create a new sheet.',
    );
  }

  await loadScript(GAPI_SRC);
  await new Promise<void>((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error('Google API script failed to load.'));
      return;
    }
    window.gapi.load('picker', () => resolve());
  });

  const picker = window.google?.picker;
  if (!picker) throw new Error('Google Picker failed to initialise.');

  return new Promise<PickedSheet | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS);
    view.setMode(picker.DocsViewMode.LIST);

    const builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle('Choose a sheet to save contacts to')
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(
            doc
              ? {
                  id: doc.id,
                  name: doc.name,
                  url: doc.url || `https://docs.google.com/spreadsheets/d/${doc.id}`,
                }
              : null,
          );
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      });

    if (GOOGLE_APP_ID) builder.setAppId(GOOGLE_APP_ID);
    builder.build().setVisible(true);
  });
}
