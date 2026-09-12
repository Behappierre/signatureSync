import type { SavedContact, SheetRef } from '../types/index.ts';

/**
 * Per-browser convenience only: which sheets the user has connected and what
 * they saved recently. The contact data itself lives in the spreadsheet, so
 * losing this is a cosmetic loss, never a data loss.
 */

const SHEETS_KEY = 'signaturesync.sheets';
const ACTIVE_KEY = 'signaturesync.activeSheet';
const RECENT_KEY = 'signaturesync.recent';
const MAX_RECENT = 15;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing or a full quota; the app works without persistence */
  }
}

export const loadSheets = (): SheetRef[] => read<SheetRef[]>(SHEETS_KEY, []);

export function saveSheet(sheet: SheetRef): SheetRef[] {
  const existing = loadSheets().filter((entry) => entry.id !== sheet.id);
  const next = [sheet, ...existing].slice(0, 20);
  write(SHEETS_KEY, next);
  return next;
}

export function removeSheet(id: string): SheetRef[] {
  const next = loadSheets().filter((entry) => entry.id !== id);
  write(SHEETS_KEY, next);
  if (loadActiveSheetId() === id) write(ACTIVE_KEY, '');
  return next;
}

export const loadActiveSheetId = (): string => read<string>(ACTIVE_KEY, '');
export const saveActiveSheetId = (id: string): void => write(ACTIVE_KEY, id);

export const loadRecent = (): SavedContact[] => read<SavedContact[]>(RECENT_KEY, []);

export function addRecent(entry: SavedContact): SavedContact[] {
  const next = [entry, ...loadRecent()].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
  return next;
}

export function clearRecent(): SavedContact[] {
  write(RECENT_KEY, []);
  return [];
}
