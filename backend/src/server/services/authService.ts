import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { SecurityUtils } from '../../utils/security.js';
import { AuthUser } from '@shared/types/index.js';

export class AuthService {
  private oauth2Client;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${env.FRONTEND_URL}/auth/callback` // This will redirect to frontend
    );
  }

  /**
   * Generate Google OAuth URL for authentication
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    const state = SecurityUtils.generateSecureToken(32);
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens and create/update user
   */
  async handleOAuthCallback(code: string): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      
      if (!tokens.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // Set credentials to get user info
      this.oauth2Client.setCredentials(tokens);

      // Get user information
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email) {
        throw new Error('Failed to obtain user email from Google');
      }

      // Create or update user in database
      const user = await this.prisma.user.upsert({
        where: { email: userInfo.email },
        create: {
          email: userInfo.email,
          name: userInfo.name || userInfo.email,
          picture: userInfo.picture,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || '',
        },
        update: {
          name: userInfo.name || userInfo.email,
          picture: userInfo.picture,
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token || '',
          updatedAt: new Date(),
        },
      });

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture || undefined,
        googleAccessToken: user.googleAccessToken,
        googleRefreshToken: user.googleRefreshToken,
      };

      return {
        user: authUser,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
      };
    } catch (error) {
      throw new Error(`OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh Google access token
   */
  async refreshGoogleToken(userId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    this.oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
    });

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Update user with new tokens
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: credentials.access_token,
          googleRefreshToken: credentials.refresh_token || user.googleRefreshToken,
          updatedAt: new Date(),
        },
      });

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token,
      };
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new session for the user
   */
  async createSession(userId: string, jwtToken: string): Promise<void> {
    // Clean up old sessions (keep only last 5 sessions per user)
    const oldSessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 4, // Keep 4 most recent, delete the rest
    });

    if (oldSessions.length > 0) {
      await this.prisma.session.deleteMany({
        where: {
          id: { in: oldSessions.map(s => s.id) },
        },
      });
    }

    // Create new session
    await this.prisma.session.create({
      data: {
        userId,
        token: jwtToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
  }

  /**
   * Validate session and get user
   */
  async validateSession(jwtToken: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { token: jwtToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) {
        await this.prisma.session.delete({
          where: { id: session.id },
        });
      }
      return null;
    }

    // Update last used timestamp
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsed: new Date() },
    });

    const user = session.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture || undefined,
      googleAccessToken: user.googleAccessToken,
      googleRefreshToken: user.googleRefreshToken,
    };
  }

  /**
   * Logout user by invalidating session
   */
  async logout(jwtToken: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { token: jwtToken },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture || undefined,
      googleAccessToken: user.googleAccessToken,
      googleRefreshToken: user.googleRefreshToken,
    };
  }

  /**
   * Check if user has valid Google tokens
   */
  async hasValidGoogleTokens(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
      return false;
    }

    // Test the token by making a simple API call
    this.oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
    });

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      await oauth2.userinfo.get();
      return true;
    } catch (error) {
      // Token might be expired, try to refresh
      try {
        await this.refreshGoogleToken(userId);
        return true;
      } catch {
        return false;
      }
    }
  }
}