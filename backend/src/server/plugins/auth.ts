import { FastifyPluginAsync } from 'fastify';
import jwt from '@fastify/jwt';
import { AuthUser } from '@shared/types/index.js';
import { env } from '../../config/env.js';
import { SecurityUtils } from '../../utils/security.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
  
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export const authPlugin: FastifyPluginAsync = async (server) => {
  // Register JWT plugin
  await server.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      algorithm: 'HS256',
      expiresIn: '1h',
    },
    verify: {
      algorithms: ['HS256'],
    },
  });

  // Authentication decorator
  server.decorate('authenticate', async (request: any, reply: any) => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Basic token format validation
      if (!SecurityUtils.isValidJWTFormat(token)) {
        throw new Error('Invalid token format');
      }

      const decoded = server.jwt.verify(token) as any;

      // Attach user to request
      request.user = decoded;
    } catch (error) {
      server.log.warn('Authentication failed:', error);
      reply.code(401).send({
        error: 'Authentication Required',
        message: 'Invalid or missing authentication token',
      });
    }
  });

  // Optional authentication hook for routes that need it
  server.addHook('preHandler', async (request, reply) => {
    // Skip authentication for public routes
    const publicRoutes = [
      '/health',
      '/docs',
      '/api/auth/google/callback',
      '/api/auth/google/login',
    ];

    const isPublicRoute = publicRoutes.some(route => 
      request.url.startsWith(route)
    );

    if (isPublicRoute) {
      return;
    }

    // Apply authentication for protected routes
    if (request.url.startsWith('/api/')) {
      await server.authenticate(request, reply);
    }
  });

  // Utility function to generate tokens
  server.decorate('generateToken', (payload: any) => {
    return server.jwt.sign(payload);
  });

  // Utility function to refresh tokens
  server.decorate('refreshToken', (token: string) => {
    try {
      const decoded = server.jwt.verify(token) as any;
      const { iat, exp, ...payload } = decoded;
      return server.jwt.sign(payload);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  });
};