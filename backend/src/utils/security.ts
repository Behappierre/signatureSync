import { DataSanitizer } from '@shared/utils/index.js';

export class SecurityUtils {
  /**
   * Sanitize signature text to prevent XSS and other security issues
   */
  static sanitizeSignatureText(text: string): string {
    return DataSanitizer.sanitizeSignatureText(text);
  }

  /**
   * Sanitize contact field values
   */
  static sanitizeContactField(value: string, maxLength = 100): string {
    return DataSanitizer.sanitizeContactField(value, maxLength);
  }

  /**
   * Validate and sanitize email addresses
   */
  static validateEmail(email: string): boolean {
    return DataSanitizer.validateEmail(email);
  }

  /**
   * Validate and sanitize phone numbers
   */
  static validatePhone(phone: string): boolean {
    return DataSanitizer.validatePhone(phone);
  }

  /**
   * Check for suspicious patterns in input text
   */
  static hasSuspiciousContent(text: string): boolean {
    const suspiciousPatterns = [
      // Script injection patterns
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /((\%27)|(\'))\s*((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
      /((\%27)|(\'))union/gi,
      
      // Command injection patterns
      /[;&|`$]/g,
      /\b(eval|exec|system|shell_exec)\s*\(/gi,
      
      // Path traversal
      /\.\.[\/\\]/g,
      
      // LDAP injection
      /[()=*!&|]/g,
      
      // XPath injection
      /['"]\s*(or|and)\s*['"]/gi,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Validate API key format
   */
  static isValidApiKey(key: string): boolean {
    // API keys should be at least 20 characters long and contain only safe characters
    return /^[A-Za-z0-9_-]{20,}$/.test(key);
  }

  /**
   * Rate limiting key generator
   */
  static getRateLimitKey(ip: string, userId?: string): string {
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  /**
   * Check if origin is allowed
   */
  static isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
    if (!origin) return false;
    
    // Exact match
    if (allowedOrigins.includes(origin)) return true;
    
    // Wildcard subdomain match (e.g., *.example.com)
    return allowedOrigins.some(allowed => {
      if (allowed.startsWith('*.')) {
        const domain = allowed.substring(2);
        return origin.endsWith(`.${domain}`) || origin === domain;
      }
      return false;
    });
  }

  /**
   * Generate Content Security Policy header
   */
  static generateCSPHeader(): string {
    return [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join('; ');
  }

  /**
   * Validate JWT token format (basic check)
   */
  static isValidJWTFormat(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // Check if each part is valid base64
      parts.forEach(part => {
        if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) {
          throw new Error('Invalid base64');
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hash sensitive data for logging (preserves first/last few characters)
   */
  static hashForLogging(sensitiveData: string, showChars = 4): string {
    if (sensitiveData.length <= showChars * 2) {
      return '*'.repeat(sensitiveData.length);
    }
    
    const start = sensitiveData.substring(0, showChars);
    const end = sensitiveData.substring(sensitiveData.length - showChars);
    const middle = '*'.repeat(sensitiveData.length - showChars * 2);
    
    return `${start}${middle}${end}`;
  }
}