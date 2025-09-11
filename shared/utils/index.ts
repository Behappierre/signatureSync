import { z } from 'zod';

// Input validation schemas
export const ContactInfoSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  company: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]{7,20}$/),
  title: z.string().max(100).optional(),
  website: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  address: z.string().max(300).optional(),
  additionalInfo: z.record(z.string()).optional(),
});

export const SignatureTextSchema = z.string().min(1).max(5000);

// Data sanitization utilities
export class DataSanitizer {
  static sanitizeSignatureText(text: string): string {
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
      .substring(0, 5000); // Limit length
  }

  static sanitizeContactField(value: string, maxLength: number = 100): string {
    return value
      .replace(/[<>\"']/g, '') // Remove potential XSS characters
      .trim()
      .substring(0, maxLength);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validatePhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]{7,20}$/;
    return phoneRegex.test(phone);
  }
}

// Utility functions
export const getInitials = (firstName?: string, lastName?: string): string => {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

export const getConfidenceColor = (confidence: number): 'success' | 'warning' | 'error' => {
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'error';
};

// Date utilities
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};