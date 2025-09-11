import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { GoogleSheetsService } from '../services/googleSheetsService.js';
import { ContactSchema } from '@shared/utils/validation.js';

const GoogleSheetSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  url: Type.String({ format: 'uri' }),
  lastModified: Type.String({ format: 'date-time' }),
});

const SaveContactsRequestSchema = Type.Object({
  sheetId: Type.String(),
  contacts: Type.Array(Type.Object({
    firstName: Type.String(),
    lastName: Type.String(),
    company: Type.String(),
    email: Type.String({ format: 'email' }),
    phone: Type.String(),
    title: Type.Optional(Type.String()),
    website: Type.Optional(Type.String()),
    linkedin: Type.Optional(Type.String()),
    address: Type.Optional(Type.String()),
  })),
});

export const sheetsRoutes: FastifyPluginAsync = async (server) => {
  const sheetsService = new GoogleSheetsService(server.prisma);

  // Get user's Google Sheets
  server.get('/', {
    schema: {
      tags: ['Google Sheets'],
      summary: 'Get user Google Sheets',
      security: [{ Bearer: [] }],
      response: {
        200: Type.Object({
          sheets: Type.Array(GoogleSheetSchema),
        }),
        503: Type.Object({
          error: Type.String(),
          message: Type.String(),
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

    try {
      server.log.info(`Fetching Google Sheets for user: ${request.user.id}`);

      const sheets = await sheetsService.getUserSheets(request.user.id);
      
      reply.send({ sheets });
    } catch (error) {
      server.log.error('Google Sheets fetch error:', error);
      reply.code(503).send({
        error: 'Service Unavailable',
        message: error instanceof Error ? error.message : 'Google Sheets integration is temporarily unavailable',
      });
    }
  });

  // Save contacts to Google Sheet
  server.post<{
    Body: { sheetId: string; contacts: any[] };
    Reply: { savedCount: number; errors?: string[] };
  }>('/save', {
    schema: {
      tags: ['Google Sheets'],
      summary: 'Save contacts to Google Sheet',
      security: [{ Bearer: [] }],
      body: SaveContactsRequestSchema,
      response: {
        200: Type.Object({
          savedCount: Type.Number(),
          errors: Type.Optional(Type.Array(Type.String())),
        }),
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
    if (!request.user) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { sheetId, contacts } = request.body;

    try {
      server.log.info(`Saving ${contacts.length} contacts to sheet: ${sheetId} for user: ${request.user.id}`);

      // Validate contacts
      const validContacts = [];
      const validationErrors = [];

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        try {
          // Basic validation - ensure required fields
          if (!contact.firstName || !contact.lastName || !contact.email) {
            validationErrors.push(`Contact ${i + 1}: Missing required fields (firstName, lastName, or email)`);
            continue;
          }

          // Add confidence score if not present
          if (!contact.confidence) {
            contact.confidence = { overall: 0.8, fields: {} };
          }

          validContacts.push(contact);
        } catch (error) {
          validationErrors.push(`Contact ${i + 1}: Invalid contact data`);
        }
      }

      if (validContacts.length === 0) {
        reply.code(400).send({
          error: 'Validation Error',
          message: 'No valid contacts to save',
          details: validationErrors,
        });
        return;
      }

      // Save to Google Sheets
      const result = await sheetsService.saveContactsToSheet(
        request.user.id,
        sheetId,
        validContacts
      );

      reply.send({
        savedCount: result.savedCount,
        errors: [...validationErrors, ...result.errors],
      });
    } catch (error) {
      server.log.error('Google Sheets save error:', error);
      reply.code(503).send({
        error: 'Service Unavailable',
        message: error instanceof Error ? error.message : 'Google Sheets integration is temporarily unavailable',
      });
    }
  });

  // Create a new Google Sheet
  server.post('/create', {
    schema: {
      tags: ['Google Sheets'],
      summary: 'Create a new Google Sheet',
      security: [{ Bearer: [] }],
      body: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 100 }),
      }),
      response: {
        201: GoogleSheetSchema,
        503: Type.Object({
          error: Type.String(),
          message: Type.String(),
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

    const { name } = request.body as { name: string };

    try {
      server.log.info(`Creating new Google Sheet: ${name} for user: ${request.user.id}`);

      const newSheet = await sheetsService.createSheet(request.user.id, name);

      reply.code(201).send(newSheet);
    } catch (error) {
      server.log.error('Google Sheet creation error:', error);
      reply.code(503).send({
        error: 'Service Unavailable',
        message: error instanceof Error ? error.message : 'Google Sheets integration is temporarily unavailable',
      });
    }
  });

  // Get sheet metadata and structure
  server.get<{ Params: { sheetId: string } }>('/:sheetId', {
    schema: {
      tags: ['Google Sheets'],
      summary: 'Get sheet metadata',
      security: [{ Bearer: [] }],
      params: Type.Object({
        sheetId: Type.String(),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          name: Type.String(),
          url: Type.String(),
          columns: Type.Array(Type.Object({
            name: Type.String(),
            type: Type.String(),
          })),
          rowCount: Type.Number(),
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String(),
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

    const { sheetId } = request.params;

    try {
      server.log.info(`Getting metadata for sheet: ${sheetId} for user: ${request.user.id}`);

      const sheetMetadata = await sheetsService.getSheetMetadata(request.user.id, sheetId);

      reply.send(sheetMetadata);
    } catch (error) {
      server.log.error('Sheet metadata error:', error);
      reply.code(404).send({
        error: 'Sheet Not Found',
        message: error instanceof Error ? error.message : 'The requested sheet could not be found or accessed',
      });
    }
  });
};