// Core Contact Information Types
export interface ContactInfo {
  id?: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  title?: string;
  website?: string;
  linkedin?: string;
  address?: string;
  additionalInfo?: Record<string, string>;
  confidence: ConfidenceScore;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfidenceScore {
  overall: number; // 0-1
  fields: {
    [K in keyof ContactInfo]?: number;
  };
}

// Signature Processing Types
export interface SignatureData {
  rawText: string;
  extractedInfo: Partial<ContactInfo>;
  processingStatus: ProcessingStatus;
  errors?: ValidationError[];
}

export type ProcessingStatus = 
  | 'idle' 
  | 'processing' 
  | 'completed' 
  | 'error';

export interface ValidationError {
  field: keyof ContactInfo;
  message: string;
  severity: 'error' | 'warning';
}

// Google Sheets Integration Types
export interface GoogleSheet {
  id: string;
  name: string;
  url: string;
  lastModified: Date;
}

export interface SheetMapping {
  sheetId: string;
  columnMappings: {
    [K in keyof ContactInfo]: string; // Column letter/name
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Authentication Types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  googleAccessToken: string;
  googleRefreshToken: string;
}

// API Request Types
export interface ExtractSignatureRequest {
  text: string;
}

export interface ExtractSignatureResponse {
  contactInfo: Partial<ContactInfo>;
  confidence: number;
}

export interface SaveToSheetRequest {
  sheetId: string;
  contacts: ContactInfo[];
}

export interface SaveToSheetResponse {
  savedCount: number;
  errors?: string[];
}