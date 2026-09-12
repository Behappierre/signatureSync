import { CONTACT_FIELDS, FIELD_LABELS } from '../types/index.ts';
import type { ContactField, ContactInfo, SheetRef } from '../types/index.ts';

/**
 * Google Sheets v4 accessed straight from the browser with the user's own
 * access token. The spreadsheet is the datastore: there is no other copy of
 * the contact data anywhere.
 */

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Column headers written into a sheet this app creates. */
export const DEFAULT_HEADERS = [
  ...CONTACT_FIELDS.map((field) => FIELD_LABELS[field]),
  'Date added',
];

/** Header spellings we will recognise in a sheet the user already had. */
const HEADER_ALIASES: Record<ContactField | 'dateAdded' | 'source', string[]> = {
  firstName: ['first name', 'firstname', 'first', 'given name', 'forename'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name'],
  title: ['job title', 'title', 'role', 'position', 'job role'],
  company: ['company', 'organisation', 'organization', 'employer', 'business', 'firm'],
  email: ['email', 'e-mail', 'email address', 'e-mail address', 'mail'],
  phone: ['phone', 'telephone', 'mobile', 'phone number', 'tel', 'contact number', 'number'],
  website: ['website', 'web', 'url', 'web site', 'site', 'company website'],
  linkedin: ['linkedin', 'linked in', 'linkedin url', 'linkedin profile'],
  address: ['address', 'location', 'postal address', 'office address'],
  dateAdded: ['date added', 'added', 'date', 'created', 'timestamp', 'added on'],
  source: ['source', 'raw signature', 'signature', 'notes', 'note'],
};

/**
 * Collapse a heading to a comparison key: lower case, alphanumerics only. This
 * makes "E-Mail", "e mail" and "email_ " all match the same alias.
 */
function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalised alias -> the field it fills. First definition wins. */
const HEADER_LOOKUP: Map<string, ContactField | 'dateAdded' | 'source'> = (() => {
  const lookup = new Map<string, ContactField | 'dateAdded' | 'source'>();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const normalised = normaliseHeader(alias);
      if (!lookup.has(normalised)) {
        lookup.set(normalised, key as ContactField | 'dateAdded' | 'source');
      }
    }
  }
  return lookup;
})();

export class SheetsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SheetsError';
    this.status = status;
  }
}

async function call<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      /* response body was not JSON; the status line will do */
    }

    if (response.status === 401) {
      throw new SheetsError('Your Google session has expired. Reconnect and try again.', 401);
    }
    if (response.status === 403) {
      // Google's own message distinguishes the three causes that look alike
      // from here: a disabled API, an insufficient scope, and a file this app
      // was never granted. Passing it through beats guessing at one of them.
      throw new SheetsError(detail, 403);
    }
    if (response.status === 404) {
      throw new SheetsError('That spreadsheet no longer exists.', 404);
    }
    throw new SheetsError(detail, response.status);
  }

  return (await response.json()) as T;
}

interface SpreadsheetMeta {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

/** Create a new spreadsheet with a Contacts tab and a formatted header row. */
export async function createSpreadsheet(token: string, title: string): Promise<SheetRef> {
  const created = await call<SpreadsheetMeta>(token, '', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: 'Contacts',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  const id = created.spreadsheetId;
  if (!id) throw new SheetsError('Google did not return an ID for the new sheet.', 500);

  await call(token, `/${id}/values/Contacts!A1:${columnLetter(DEFAULT_HEADERS.length)}1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [DEFAULT_HEADERS] }),
  });

  // Bold the header row. Cosmetic, and a failure here must not lose the sheet.
  try {
    await call(token, `/${id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
        ],
      }),
    });
  } catch {
    /* formatting is optional */
  }

  return {
    id,
    name: created.properties?.title ?? title,
    url: created.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${id}`,
    tab: 'Contacts',
    addedAt: new Date().toISOString(),
  };
}

/** Read a spreadsheet's title and the name of the tab we should write to. */
export async function describeSpreadsheet(token: string, id: string): Promise<SheetRef> {
  const meta = await call<SpreadsheetMeta>(
    token,
    `/${id}?fields=properties.title,spreadsheetUrl,sheets.properties.title`,
  );

  const tabs = (meta.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((name): name is string => Boolean(name));

  // Prefer a tab that is obviously for contacts, otherwise the first one.
  const preferred = tabs.find((name) => /contact|signature|lead/i.test(name)) ?? tabs[0] ?? 'Sheet1';

  return {
    id,
    name: meta.properties?.title ?? 'Untitled spreadsheet',
    url: meta.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${id}`,
    tab: preferred,
    addedAt: new Date().toISOString(),
  };
}

function columnLetter(index: number): string {
  let value = index;
  let letters = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters || 'A';
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

/**
 * Read the header row, writing our default headers first if the sheet is
 * empty. Returns the headers as they now stand in the sheet.
 */
export async function ensureHeaders(token: string, sheet: SheetRef): Promise<string[]> {
  const range = `${quoteTab(sheet.tab)}!A1:ZZ1`;
  const existing = await call<{ values?: string[][] }>(
    token,
    `/${sheet.id}/values/${encodeURIComponent(range)}`,
  );

  const headers = (existing.values?.[0] ?? []).map((header) => String(header ?? '').trim());
  if (headers.some((header) => header.length > 0)) return headers;

  const writeRange = `${quoteTab(sheet.tab)}!A1:${columnLetter(DEFAULT_HEADERS.length)}1`;
  await call(token, `/${sheet.id}/values/${encodeURIComponent(writeRange)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [DEFAULT_HEADERS] }),
  });
  return [...DEFAULT_HEADERS];
}

/**
 * Line up a contact with whatever headers the sheet actually has, so the app
 * adapts to the user's existing columns rather than demanding its own.
 */
export function mapContactToRow(
  contact: ContactInfo,
  headers: string[],
  rawSignature = '',
): string[] {
  const timestamp = new Date().toLocaleString('en-GB');

  return headers.map((header) => {
    const key = HEADER_LOOKUP.get(normaliseHeader(header));
    if (!key) return '';
    if (key === 'dateAdded') return timestamp;
    if (key === 'source') return rawSignature;
    return contact[key] ?? '';
  });
}

/** True when none of the sheet's headers match a field we can fill. */
export function headersAreUnrecognised(headers: string[]): boolean {
  return !headers.some((header) => HEADER_LOOKUP.has(normaliseHeader(header)));
}

/**
 * Sheets interprets a leading =, +, - or @ as the start of a formula, so a
 * phone number written as "+44 7700 900123" evaluates and lands in the cell as
 * #ERROR!. A leading apostrophe forces the value to be treated as text and is
 * not itself displayed.
 */
function guardFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/**
 * Find the first row with nothing in it, reading the values rather than
 * trusting the API's append behaviour.
 *
 * values.append searches the given range for a "table" and appends beneath
 * whatever it finds. On a sheet carrying stray content or formatting it can
 * latch onto the wrong block and write the row offset both down and across,
 * which is exactly what it did here. Computing the row and writing to an
 * explicit range removes that guesswork.
 */
async function nextEmptyRow(token: string, sheet: SheetRef, width: number): Promise<number> {
  const range = `${quoteTab(sheet.tab)}!A:${columnLetter(Math.max(width, 1))}`;
  const existing = await call<{ values?: string[][] }>(
    token,
    `/${sheet.id}/values/${encodeURIComponent(range)}`,
  );

  const rows = existing.values ?? [];
  // Trailing rows of blanks should not push the next write down the sheet.
  let lastUsed = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if ((rows[i] ?? []).some((cell) => String(cell ?? '').trim().length > 0)) lastUsed = i + 1;
  }

  return lastUsed + 1;
}

/** Write one contact as a new row. Returns the range it landed in. */
export async function appendContact(
  token: string,
  sheet: SheetRef,
  contact: ContactInfo,
  headers: string[],
  rawSignature = '',
): Promise<string> {
  const row = mapContactToRow(contact, headers, rawSignature).map(guardFormula);
  const width = Math.max(headers.length, row.length, 1);
  const target = await nextEmptyRow(token, sheet, width);

  const range = `${quoteTab(sheet.tab)}!A${target}:${columnLetter(width)}${target}`;

  const result = await call<{ updatedRange?: string }>(
    token,
    `/${sheet.id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [row] }) },
  );

  return result.updatedRange ?? range;
}

export const __testing = { columnLetter, quoteTab, normaliseHeader, guardFormula, HEADER_LOOKUP };
