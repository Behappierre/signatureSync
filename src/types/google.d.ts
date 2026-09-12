/**
 * Minimal ambient declarations for the two Google browser libraries we load at
 * runtime: Google Identity Services (accounts.google.com/gsi/client) and the
 * Picker (apis.google.com/js/api.js). Hand-written rather than pulled from
 * DefinitelyTyped so the build has no dependency on those packages.
 */

export {};

declare global {
  namespace GoogleTokenClient {
    interface TokenResponse {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    }

    interface Client {
      requestAccessToken(overrides?: { prompt?: '' | 'none' | 'consent' | 'select_account' }): void;
    }

    interface Config {
      client_id: string;
      scope: string;
      prompt?: string;
      callback: (response: TokenResponse) => void;
      error_callback?: (error: { type?: string; message?: string }) => void;
    }
  }

  namespace GooglePicker {
    interface Builder {
      addView(view: unknown): Builder;
      setOAuthToken(token: string): Builder;
      setDeveloperKey(key: string): Builder;
      setAppId(appId: string): Builder;
      setTitle(title: string): Builder;
      setCallback(cb: (data: PickerResponse) => void): Builder;
      build(): { setVisible(visible: boolean): void };
    }

    interface PickerDocument {
      id: string;
      name: string;
      url: string;
      mimeType: string;
    }

    interface PickerResponse {
      action: string;
      docs?: PickerDocument[];
    }
  }

  interface Window {
    google?: {
      accounts?: {
        oauth2: {
          initTokenClient(config: GoogleTokenClient.Config): GoogleTokenClient.Client;
          revoke(token: string, done?: () => void): void;
        };
      };
      picker?: {
        PickerBuilder: new () => GooglePicker.Builder;
        DocsView: new (viewId?: unknown) => {
          setIncludeFolders(v: boolean): unknown;
          setSelectFolderEnabled(v: boolean): unknown;
          setMode(mode: unknown): unknown;
          setOwnedByMe(v: boolean): unknown;
        };
        ViewId: { SPREADSHEETS: unknown; DOCS: unknown };
        DocsViewMode: { LIST: unknown; GRID: unknown };
        Action: { PICKED: string; CANCEL: string };
        Feature: { MULTISELECT_ENABLED: unknown };
      };
    };
    gapi?: {
      load(api: string, callback: () => void): void;
    };
  }
}
