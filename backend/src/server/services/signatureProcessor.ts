import { OpenAI } from 'openai';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { ContactInfo, ProcessingStatus } from '@shared/types/index.js';
import { ContactSchema } from '@shared/utils/validation.js';
import { SecurityUtils } from '../../utils/security.js';

export interface ProcessingResult {
  contactInfo: Partial<ContactInfo>;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

export class SignatureProcessor {
  private openai: OpenAI;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Process email signature and extract contact information
   */
  async processSignature(
    signatureText: string,
    userId: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // Sanitize input
      const sanitizedText = SecurityUtils.sanitizeSignatureText(signatureText);
      
      // Create processing log
      const processingLog = await this.prisma.processingLog.create({
        data: {
          userId,
          rawSignature: sanitizedText,
          success: false, // Will update after processing
          processingTime: 0,
        },
      });

      // Process with OpenAI
      const result = await this.extractContactInfo(sanitizedText);
      
      const processingTime = Date.now() - startTime;
      success = result.success;
      error = result.error;

      // Update processing log
      await this.prisma.processingLog.update({
        where: { id: processingLog.id },
        data: {
          success: result.success,
          error: result.error,
          processingTime,
          extractedData: result.contactInfo,
          confidence: result.confidence,
        },
      });

      return {
        contactInfo: result.contactInfo,
        confidence: result.confidence,
        processingTime,
        success,
        error,
      };
    } catch (err) {
      const processingTime = Date.now() - startTime;
      error = err instanceof Error ? err.message : 'Unknown processing error';
      
      return {
        contactInfo: {},
        confidence: 0,
        processingTime,
        success: false,
        error,
      };
    }
  }

  /**
   * Extract contact information using OpenAI
   */
  private async extractContactInfo(text: string): Promise<{
    contactInfo: Partial<ContactInfo>;
    confidence: number;
    success: boolean;
    error?: string;
  }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting contact information from email signatures. 

INSTRUCTIONS:
1. Extract the following fields when available: firstName, lastName, company, email, phone, title, website, linkedin, address
2. Return ONLY a valid JSON object with the extracted information
3. If a field is not found or unclear, omit it from the response
4. Provide a confidence score (0-1) for the overall extraction quality
5. For names: Extract first and last name separately
6. For phone: Include country code if available, format consistently
7. For email: Extract the primary business email
8. For company: Extract the main company/organization name
9. For title: Extract job title or role
10. For website: Extract company website URL
11. For linkedin: Extract LinkedIn profile URL if mentioned
12. For address: Extract business address if mentioned

RESPONSE FORMAT:
{
  "firstName": "string",
  "lastName": "string", 
  "company": "string",
  "email": "string",
  "phone": "string",
  "title": "string",
  "website": "string", 
  "linkedin": "string",
  "address": "string",
  "confidence": 0.95
}

Be very precise and only extract information that is clearly present in the signature.`,
          },
          {
            role: 'user',
            content: `Extract contact information from this email signature:\n\n${text}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) {
        throw new Error('Empty response from OpenAI');
      }

      let parsed;
      try {
        parsed = JSON.parse(responseContent);
      } catch {
        throw new Error('Invalid JSON response from OpenAI');
      }

      // Extract confidence score
      const confidence = Math.min(Math.max(parsed.confidence || 0.7, 0), 1);
      delete parsed.confidence;

      // Clean and validate extracted data
      const contactInfo = this.cleanExtractedData(parsed);
      
      // Calculate actual confidence based on extracted fields
      const actualConfidence = this.calculateConfidence(contactInfo, text);

      return {
        contactInfo,
        confidence: Math.min(confidence, actualConfidence),
        success: true,
      };
    } catch (error) {
      return {
        contactInfo: {},
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI processing failed',
      };
    }
  }

  /**
   * Clean and sanitize extracted contact data
   */
  private cleanExtractedData(data: any): Partial<ContactInfo> {
    const cleaned: Partial<ContactInfo> = {};

    // Clean string fields
    const stringFields = ['firstName', 'lastName', 'company', 'email', 'phone', 'title', 'website', 'linkedin', 'address'];
    
    for (const field of stringFields) {
      if (data[field] && typeof data[field] === 'string') {
        const cleanValue = SecurityUtils.sanitizeContactField(data[field], field === 'address' ? 300 : 100);
        if (cleanValue.trim()) {
          (cleaned as any)[field] = cleanValue.trim();
        }
      }
    }

    // Validate email format
    if (cleaned.email && !SecurityUtils.validateEmail(cleaned.email)) {
      delete cleaned.email;
    }

    // Validate phone format
    if (cleaned.phone && !SecurityUtils.validatePhone(cleaned.phone)) {
      // Try to clean the phone number
      const cleanPhone = cleaned.phone.replace(/[^\d+\-\(\)\s]/g, '');
      if (SecurityUtils.validatePhone(cleanPhone)) {
        cleaned.phone = cleanPhone;
      } else {
        delete cleaned.phone;
      }
    }

    // Validate URLs
    if (cleaned.website && !this.isValidUrl(cleaned.website)) {
      delete cleaned.website;
    }
    
    if (cleaned.linkedin && !this.isValidUrl(cleaned.linkedin)) {
      delete cleaned.linkedin;
    }

    return cleaned;
  }

  /**
   * Calculate confidence score based on extracted fields and signature content
   */
  private calculateConfidence(contactInfo: Partial<ContactInfo>, originalText: string): number {
    let score = 0;
    let maxScore = 0;

    // Required fields (higher weight)
    const requiredFields = ['firstName', 'lastName', 'email', 'company'];
    requiredFields.forEach(field => {
      maxScore += 25; // 25 points each for required fields
      if ((contactInfo as any)[field]) {
        score += 25;
      }
    });

    // Optional fields (lower weight)
    const optionalFields = ['phone', 'title', 'website', 'linkedin', 'address'];
    optionalFields.forEach(field => {
      maxScore += 5; // 5 points each for optional fields
      if ((contactInfo as any)[field]) {
        score += 5;
      }
    });

    // Bonus for email/phone pattern detection in original text
    if (/@/.test(originalText)) {
      score += 5;
      maxScore += 5;
    }

    if (/[\d\s\-\(\)\+]{7,}/.test(originalText)) {
      score += 5;
      maxScore += 5;
    }

    // Penalty for very short signatures
    if (originalText.length < 50) {
      score *= 0.8;
    }

    return Math.min(Math.max(score / maxScore, 0), 1);
  }

  /**
   * Simple URL validation
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get processing history for a user
   */
  async getProcessingHistory(
    userId: string,
    limit = 10,
    offset = 0
  ): Promise<{
    history: Array<{
      id: string;
      createdAt: Date;
      success: boolean;
      processingTime: number;
      error?: string;
      confidence?: number;
    }>;
    total: number;
  }> {
    const [history, total] = await Promise.all([
      this.prisma.processingLog.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          success: true,
          processingTime: true,
          error: true,
          confidence: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.processingLog.count({
        where: { userId },
      }),
    ]);

    return { history, total };
  }

  /**
   * Validate signature text before processing
   */
  validateSignature(text: string): {
    valid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Length checks
    if (text.length < 20) {
      warnings.push('Signature text appears too short for accurate extraction');
      suggestions.push('Ensure the signature contains complete contact information');
    }

    if (text.length > 3000) {
      warnings.push('Signature text is very long and may contain irrelevant information');
      suggestions.push('Try to extract only the contact signature portion');
    }

    // Content checks
    if (!text.includes('@')) {
      warnings.push('No email address detected in signature');
    }

    if (!/[\d\s\-\(\)\+]{7,}/.test(text)) {
      warnings.push('No phone number pattern detected in signature');
    }

    if (!/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text)) {
      warnings.push('No clear name pattern detected in signature');
    }

    // Security checks
    if (SecurityUtils.hasSuspiciousContent(text)) {
      warnings.push('Signature contains potentially unsafe content');
      suggestions.push('Please remove any scripts, links, or suspicious content');
    }

    const isValid = warnings.length === 0 || warnings.every(w => 
      !w.includes('unsafe') && !w.includes('suspicious')
    );

    return {
      valid: isValid,
      warnings,
      suggestions: isValid ? [] : suggestions,
    };
  }
}