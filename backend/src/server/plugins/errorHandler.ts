import { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

export const errorHandler: FastifyPluginAsync = async (server) => {
  server.setErrorHandler((error, request, reply) => {
    // Log error with context
    server.log.error({
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        ip: request.ip,
      },
    }, 'Request error');

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        details: error.validation,
      });
    }

    // Handle JWT errors
    if (error.message.includes('jwt') || error.message.includes('token')) {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: 'Invalid or expired token',
      });
    }

    // Handle Prisma errors
    if (error.message.includes('Prisma')) {
      server.log.error('Database error:', error);
      return reply.status(500).send({
        error: 'Database Error',
        message: 'A database error occurred',
      });
    }

    // Handle Google API errors
    if (error.message.includes('Google') || error.message.includes('Sheets')) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Google Sheets integration is temporarily unavailable',
      });
    }

    // Handle OpenAI API errors
    if (error.message.includes('OpenAI') || error.message.includes('AI')) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'AI processing service is temporarily unavailable',
      });
    }

    // Handle rate limiting
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests, please try again later',
      });
    }

    // Generic client errors (4xx)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: 'Client Error',
        message: error.message || 'Bad request',
      });
    }

    // Generic server errors (5xx)
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });
};