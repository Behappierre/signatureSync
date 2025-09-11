import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SecurityUtils } from '../../utils/security.js';
import { SignatureTextSchema } from '@shared/utils/validation.js';
import { SignatureProcessor } from '../services/signatureProcessor.js';

const SignatureRequestSchema = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 5000 }),
});

const ContactInfoResponseSchema = Type.Object({
  contactInfo: Type.Object({
    firstName: Type.String(),
    lastName: Type.String(),
    company: Type.String(),
    email: Type.String({ format: 'email' }),
    phone: Type.String(),
    title: Type.Optional(Type.String()),
    website: Type.Optional(Type.String()),
    linkedin: Type.Optional(Type.String()),
    address: Type.Optional(Type.String()),
  }),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
});

export const signatureRoutes: FastifyPluginAsync = async (server) => {
  const signatureProcessor = new SignatureProcessor(server.prisma);

  // Extract contact information from email signature
  server.post<{
    Body: { text: string };
    Reply: { contactInfo: any; confidence: number };
  }>('/extract-signature', {
    schema: {
      tags: ['Signature Processing'],
      summary: 'Extract contact information from email signature',
      security: [{ Bearer: [] }],
      body: SignatureRequestSchema,
      response: {
        200: ContactInfoResponseSchema,
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
        503: Type.Object({
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { text } = request.body;

    try {
      // Validate and sanitize input
      const sanitizedText = SecurityUtils.sanitizeSignatureText(text);
      
      if (SecurityUtils.hasSuspiciousContent(sanitizedText)) {
        reply.code(400).send({
          error: 'Invalid Input',
          message: 'Signature text contains potentially unsafe content',
        });
        return;
      }

      // Validate using shared schema
      const validationResult = SignatureTextSchema.safeParse(sanitizedText);
      if (!validationResult.success) {
        reply.code(400).send({
          error: 'Validation Error',
          message: 'Invalid signature text format',
          details: validationResult.error.errors,
        });
        return;
      }

      if (!request.user) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      server.log.info(`Processing signature for user: ${request.user.id}`);
      
      // Process signature with OpenAI
      const result = await signatureProcessor.processSignature(sanitizedText, request.user.id);
      
      if (!result.success) {
        reply.code(500).send({
          error: 'Processing Failed',
          message: result.error || 'Failed to process signature',
        });
        return;
      }

      reply.send({
        contactInfo: result.contactInfo,
        confidence: result.confidence,
        processingTime: result.processingTime,
      });
    } catch (error) {
      server.log.error('Signature processing error:', error);
      reply.code(503).send({
        error: 'Service Unavailable',
        message: 'AI processing service is temporarily unavailable',
      });
    }
  });

  // Get processing history for the current user
  server.get('/processing-history', {
    schema: {
      tags: ['Signature Processing'],
      summary: 'Get user processing history',
      security: [{ Bearer: [] }],
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          history: Type.Array(Type.Object({
            id: Type.String(),
            createdAt: Type.String({ format: 'date-time' }),
            success: Type.Boolean(),
            processingTime: Type.Number(),
            error: Type.Optional(Type.String()),
          })),
          total: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { limit = 10, offset = 0 } = request.query as any;

    try {
      const result = await signatureProcessor.getProcessingHistory(
        request.user.id,
        Math.min(limit, 100), // Cap at 100
        Math.max(offset, 0)   // Ensure non-negative
      );

      reply.send(result);
    } catch (error) {
      server.log.error('Processing history error:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve processing history',
      });
    }
  });

  // Validate signature text before processing
  server.post('/validate-signature', {
    schema: {
      tags: ['Signature Processing'],
      summary: 'Validate signature text format and content',
      security: [{ Bearer: [] }],
      body: SignatureRequestSchema,
      response: {
        200: Type.Object({
          valid: Type.Boolean(),
          warnings: Type.Array(Type.String()),
          suggestions: Type.Array(Type.String()),
        }),
      },
    },
  }, async (request, reply) => {
    const { text } = request.body;
    
    try {
      // Sanitize input first
      const sanitizedText = SecurityUtils.sanitizeSignatureText(text);
      
      // Validate using signature processor
      const validation = signatureProcessor.validateSignature(sanitizedText);
      
      reply.send(validation);
    } catch (error) {
      server.log.error('Signature validation error:', error);
      reply.code(500).send({
        error: 'Validation Error',
        message: 'Failed to validate signature',
      });
    }
  });
};