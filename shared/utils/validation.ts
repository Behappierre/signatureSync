import { z } from 'zod';

// Common validation schemas
export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .toLowerCase()
  .trim();

export const PhoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]{7,20}$/, 'Invalid phone number format')
  .trim();

export const UrlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL too long')
  .trim();

export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name too long')
  .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters')
  .trim();

export const CompanySchema = z
  .string()
  .min(1, 'Company name is required')
  .max(100, 'Company name too long')
  .trim();

export const SignatureTextSchema = z
  .string()
  .min(10, 'Signature text too short')
  .max(5000, 'Signature text too long')
  .trim()
  .refine(
    (text) => {
      // Check for potential malicious content
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
      ];
      return !suspiciousPatterns.some(pattern => pattern.test(text));
    },
    'Signature contains potentially unsafe content'
  );

// Contact validation schema
export const ContactSchema = z.object({
  firstName: NameSchema,
  lastName: NameSchema,
  company: CompanySchema,
  email: EmailSchema,
  phone: PhoneSchema,
  title: z.string().max(100).optional(),
  website: UrlSchema.optional(),
  linkedin: UrlSchema.optional(),
  address: z.string().max(300).optional(),
});

// API request validation schemas
export const ExtractSignatureRequestSchema = z.object({
  text: SignatureTextSchema,
});

export const SaveToSheetRequestSchema = z.object({
  sheetId: z.string().min(1, 'Sheet ID is required'),
  contacts: z.array(ContactSchema).min(1, 'At least one contact is required').max(100, 'Too many contacts'),
});

// Validation utilities
export class ValidationUtils {
  static sanitizeHtml(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  static validateEmail(email: string): boolean {
    try {
      EmailSchema.parse(email);
      return true;
    } catch {
      return false;
    }
  }

  static validatePhone(phone: string): boolean {
    try {
      PhoneSchema.parse(phone);
      return true;
    } catch {
      return false;
    }
  }

  static validateUrl(url: string): boolean {
    try {
      UrlSchema.parse(url);
      return true;
    } catch {
      return false;
    }
  }

  static formatPhone(phone: string): string {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it doesn't start with +, assume US number and add +1
    if (!cleaned.startsWith('+')) {
      return `+1${cleaned}`;
    }
    
    return cleaned;
  }

  static extractDomain(email: string): string {
    return email.split('@')[1] || '';
  }

  static generateInitials(firstName?: string, lastName?: string): string {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}`;
  }
}