import { create } from 'zustand';
import type {
  ContactField,
  ExtractionResult,
  GoogleUser,
  SavedContact,
  SheetRef,
  Status,
} from '../types/index.ts';
import { emptyResult, extractSignature } from '../lib/extract.ts';
import * as google from '../lib/google.ts';
import * as sheets from '../lib/sheets.ts';
import * as storage from '../lib/storage.ts';

interface Notice {
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

interface AppState {
  token: string | null;
  user: GoogleUser | null;
  authStatus: Status;

  rawText: string;
  result: ExtractionResult;
  extractStatus: Status;
  edited: boolean;

  sheetList: SheetRef[];
  activeSheetId: string;
  saveStatus: Status;
  recent: SavedContact[];

  notice: Notice | null;

  init: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;

  setRawText: (text: string) => void;
  extract: () => Promise<void>;
  updateField: (field: ContactField, value: string) => void;
  reset: () => void;

  chooseSheet: () => Promise<void>;
  createSheet: (title: string) => Promise<void>;
  setActiveSheet: (id: string) => void;
  forgetSheet: (id: string) => void;
  save: () => Promise<void>;

  clearRecent: () => void;
  notify: (notice: Notice | null) => void;
}

const messageFrom = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const useAppStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  authStatus: 'idle',

  rawText: '',
  result: emptyResult(),
  extractStatus: 'idle',
  edited: false,

  sheetList: [],
  activeSheetId: '',
  saveStatus: 'idle',
  recent: [],

  notice: null,

  async init() {
    set({
      sheetList: storage.loadSheets(),
      activeSheetId: storage.loadActiveSheetId(),
      recent: storage.loadRecent(),
    });

    const token = await google.restoreSession();
    if (!token) return;

    set({ token, authStatus: 'done' });
    try {
      set({ user: await google.fetchUser(token) });
    } catch {
      /* a missing profile is not worth surfacing */
    }
  },

  async connect() {
    set({ authStatus: 'working' });
    try {
      const token = await google.connect();
      const user = await google.fetchUser(token).catch(() => null);
      set({ token, user, authStatus: 'done' });
    } catch (error) {
      set({
        authStatus: 'error',
        notice: { message: messageFrom(error, 'Google sign-in failed.'), severity: 'error' },
      });
    }
  },

  disconnect() {
    google.disconnect();
    set({
      token: null,
      user: null,
      authStatus: 'idle',
      notice: { message: 'Disconnected from Google.', severity: 'info' },
    });
  },

  setRawText(text) {
    set({ rawText: text });
  },

  async extract() {
    const { rawText } = get();
    if (rawText.trim().length === 0) return;

    set({ extractStatus: 'working' });
    try {
      const result = await extractSignature(rawText, { accessToken: get().token });
      set({ result, extractStatus: 'done', edited: false });
      if (result.warnings.length > 0) {
        set({ notice: { message: result.warnings[0], severity: 'info' } });
      }
    } catch (error) {
      set({
        extractStatus: 'error',
        notice: { message: messageFrom(error, 'Extraction failed.'), severity: 'error' },
      });
    }
  },

  updateField(field, value) {
    const { result } = get();
    const confidence = { ...result.confidence };
    // A field the user has typed into is theirs, so the machine score goes.
    delete confidence[field];
    set({
      edited: true,
      result: {
        ...result,
        contact: { ...result.contact, [field]: value },
        confidence,
        origin: { ...result.origin, [field]: undefined },
      },
    });
  },

  reset() {
    set({ rawText: '', result: emptyResult(), extractStatus: 'idle', edited: false });
  },

  async chooseSheet() {
    try {
      const token = await google.getAccessToken();
      const picked = await google.pickSpreadsheet(token);
      if (!picked) return;

      const described = await sheets.describeSpreadsheet(token, picked.id);
      const sheetList = storage.saveSheet(described);
      storage.saveActiveSheetId(described.id);
      set({
        sheetList,
        activeSheetId: described.id,
        token,
        notice: { message: `Connected to "${described.name}".`, severity: 'success' },
      });
    } catch (error) {
      set({ notice: { message: messageFrom(error, 'Could not open that sheet.'), severity: 'error' } });
    }
  },

  async createSheet(title) {
    try {
      const token = await google.getAccessToken();
      const created = await sheets.createSpreadsheet(token, title);
      const sheetList = storage.saveSheet(created);
      storage.saveActiveSheetId(created.id);
      set({
        sheetList,
        activeSheetId: created.id,
        token,
        notice: { message: `Created "${created.name}".`, severity: 'success' },
      });
    } catch (error) {
      set({ notice: { message: messageFrom(error, 'Could not create the sheet.'), severity: 'error' } });
    }
  },

  setActiveSheet(id) {
    storage.saveActiveSheetId(id);
    set({ activeSheetId: id });
  },

  forgetSheet(id) {
    const sheetList = storage.removeSheet(id);
    set({ sheetList, activeSheetId: storage.loadActiveSheetId() });
  },

  async save() {
    const { activeSheetId, sheetList, result, rawText } = get();
    const sheet = sheetList.find((entry) => entry.id === activeSheetId);

    if (!sheet) {
      set({ notice: { message: 'Choose a sheet to save into first.', severity: 'warning' } });
      return;
    }
    if (!result.contact.email && !result.contact.lastName) {
      set({
        notice: { message: 'Add at least an email address or a surname before saving.', severity: 'warning' },
      });
      return;
    }

    set({ saveStatus: 'working' });
    try {
      const token = await google.getAccessToken();
      const headers = await sheets.ensureHeaders(token, sheet);

      if (sheets.headersAreUnrecognised(headers)) {
        set({
          saveStatus: 'error',
          notice: {
            message: `None of the columns in "${sheet.name}" match a contact field. Rename them, or create a new sheet.`,
            severity: 'error',
          },
        });
        return;
      }

      await sheets.appendContact(token, sheet, result.contact, headers, rawText);

      const recent = storage.addRecent({
        contact: result.contact,
        sheetId: sheet.id,
        sheetName: sheet.name,
        sheetUrl: sheet.url,
        savedAt: new Date().toISOString(),
      });

      set({
        saveStatus: 'done',
        recent,
        token,
        rawText: '',
        result: emptyResult(),
        extractStatus: 'idle',
        edited: false,
        notice: { message: `Saved to "${sheet.name}".`, severity: 'success' },
      });
    } catch (error) {
      set({
        saveStatus: 'error',
        notice: { message: messageFrom(error, 'Could not save to the sheet.'), severity: 'error' },
      });
    }
  },

  clearRecent() {
    set({ recent: storage.clearRecent() });
  },

  notify(notice) {
    set({ notice });
  },
}));
