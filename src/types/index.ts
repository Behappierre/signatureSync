/** Canonical contact fields, in the order they are written to a new sheet. */
export const CONTACT_FIELDS = [
  'firstName',
  'lastName',
  'title',
  'company',
  'email',
  'phone',
  'website',
  'linkedin',
  'address',
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

export type ContactInfo = Record<ContactField, string>;

export const EMPTY_CONTACT: ContactInfo = {
  firstName: '',
  lastName: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  linkedin: '',
  address: '',
};

export const FIELD_LABELS: Record<ContactField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  title: 'Job title',
  company: 'Company',
  email: 'Email',
  phone: 'Phone',
  website: 'Website',
  linkedin: 'LinkedIn',
  address: 'Address',
};

/** 0 to 1 per field. A missing entry means the field was never populated. */
export type FieldConfidence = Partial<Record<ContactField, number>>;

export type ExtractionSource = 'heuristic' | 'ai' | 'hybrid';

export interface ExtractionResult {
  contact: ContactInfo;
  confidence: FieldConfidence;
  /** Which field came from where, for the UI to explain itself. */
  origin: Partial<Record<ContactField, ExtractionSource>>;
  source: ExtractionSource;
  warnings: string[];
  elapsedMs: number;
}

export interface SheetRef {
  id: string;
  name: string;
  url: string;
  /** Tab name within the spreadsheet that contacts are written to. */
  tab: string;
  addedAt: string;
}

export interface SavedContact {
  contact: ContactInfo;
  sheetId: string;
  sheetName: string;
  sheetUrl: string;
  savedAt: string;
}

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export type Status = 'idle' | 'working' | 'done' | 'error';
