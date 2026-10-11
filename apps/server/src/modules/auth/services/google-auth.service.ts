import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly client: OAuth2Client;
  private readonly allowedClientIds: string[];

  constructor(private readonly configService: ConfigService) {
    const rawClientIds = this.configService.get<string>('GOOGLE_ALLOWED_CLIENT_IDS');
    this.allowedClientIds = rawClientIds
      ? rawClientIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];

    if (this.allowedClientIds.length === 0) {
      this.logger.warn('No Google OAuth client IDs configured in GOOGLE_ALLOWED_CLIENT_IDS');
    }

    this.client = new OAuth2Client();
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.allowedClientIds.length > 0 ? this.allowedClientIds : undefined,
      });

      const payload: TokenPayload | undefined = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID token payload');
      }

      // Check issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!payload.iss || !validIssuers.includes(payload.iss)) {
        throw new UnauthorizedException('Invalid Google token issuer');
      }

      // Extract stable external subject identifier (sub)
      const googleId = payload.sub;
      if (!googleId) {
        throw new UnauthorizedException('Google token missing sub claim');
      }

      if (!payload.email) {
        throw new UnauthorizedException('Google token missing email claim');
      }

      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google token email is not verified');
      }

      return {
        googleId,
        email: payload.email.toLowerCase(),
        name: payload.name,
        avatarUrl: payload.picture,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(
        `Google token verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new UnauthorizedException('Google ID token verification failed');
    }
  }
}
