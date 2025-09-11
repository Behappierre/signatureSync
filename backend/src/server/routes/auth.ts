import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AuthService } from '../services/authService.js';

export const authRoutes: FastifyPluginAsync = async (server) => {
  const authService = new AuthService(server.prisma);

  // Google OAuth login endpoint
  server.get('/google/login', {
    schema: {
      tags: ['Authentication'],
      summary: 'Initiate Google OAuth login',
      response: {
        200: Type.Object({
          authUrl: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const authUrl = authService.generateAuthUrl();
      
      reply.send({
        authUrl,
      });
    } catch (error) {
      server.log.error('OAuth login error:', error);
      reply.code(500).send({
        error: 'Authentication Error',
        message: 'Failed to generate OAuth URL',
      });
    }
  });

  // Google OAuth callback endpoint
  server.post('/google/callback', {
    schema: {
      tags: ['Authentication'],
      summary: 'Handle Google OAuth callback',
      body: Type.Object({
        code: Type.String(),
        state: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          token: Type.String(),
          user: Type.Object({
            id: Type.String(),
            email: Type.String(),
            name: Type.String(),
            picture: Type.Optional(Type.String()),
          }),
          expiresIn: Type.Number(),
        }),
      },
    },
  }, async (request, reply) => {
    const { code } = request.body as { code: string };

    try {
      // Handle OAuth callback
      const { user } = await authService.handleOAuthCallback(code);
      
      // Generate JWT token
      const jwtToken = server.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      });

      // Create session
      await authService.createSession(user.id, jwtToken);

      reply.send({
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        expiresIn: 3600, // 1 hour
      });
    } catch (error) {
      server.log.error('OAuth callback error:', error);
      reply.code(400).send({
        error: 'Authentication Error',
        message: error instanceof Error ? error.message : 'OAuth callback failed',
      });
    }
  });

  // Token refresh endpoint
  server.post('/refresh', {
    schema: {
      tags: ['Authentication'],
      summary: 'Refresh authentication token',
      security: [{ Bearer: [] }],
      response: {
        200: Type.Object({
          token: Type.String(),
          expiresIn: Type.Number(),
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
      // Refresh Google tokens if needed
      const hasValidTokens = await authService.hasValidGoogleTokens(request.user.id);
      if (!hasValidTokens) {
        await authService.refreshGoogleToken(request.user.id);
      }

      // Generate new JWT token
      const jwtToken = server.jwt.sign({
        id: request.user.id,
        email: request.user.email,
        name: request.user.name,
        picture: request.user.picture,
      });

      // Update session
      await authService.createSession(request.user.id, jwtToken);

      reply.send({
        token: jwtToken,
        expiresIn: 3600, // 1 hour
      });
    } catch (error) {
      server.log.error('Token refresh error:', error);
      reply.code(401).send({
        error: 'Authentication Error',
        message: 'Failed to refresh token',
      });
    }
  });

  // Logout endpoint
  server.post('/logout', {
    schema: {
      tags: ['Authentication'],
      summary: 'Logout user and invalidate tokens',
      security: [{ Bearer: [] }],
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        await authService.logout(token);
      } catch (error) {
        server.log.error('Logout error:', error);
      }
    }

    reply.send({
      message: 'Logged out successfully',
    });
  });

  // Get current user info
  server.get('/me', {
    schema: {
      tags: ['Authentication'],
      summary: 'Get current user information',
      security: [{ Bearer: [] }],
      response: {
        200: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.String(),
          picture: Type.Optional(Type.String()),
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

    reply.send({
      id: request.user.id,
      email: request.user.email,
      name: request.user.name,
      picture: request.user.picture,
    });
  });
};