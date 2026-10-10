import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GoogleAuthService } from './services/google-auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtlDays: number;
  private readonly adminEmails: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleAuthService: GoogleAuthService,
  ) {
    this.accessTokenTtl = this.configService.get<string>('ACCESS_TOKEN_TTL', '15m');
    this.refreshTokenTtlDays = this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    this.adminEmails = new Set(
      (this.configService.get<string>('ADMIN_EMAILS', '') ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  /**
   * Hashes a raw refresh token using SHA-256 before database storage/comparison
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a cryptographically strong random refresh token
   */
  private generateRawRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Authenticates a user using their Google ID token
   */
  async authenticateWithGoogle(
    idToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const verifiedUser = await this.googleAuthService.verifyIdToken(idToken);

    // Find or create user via Google sub
    let user = await this.prisma.user.findUnique({
      where: { googleId: verifiedUser.googleId },
    });

    if (!user) {
      // Check if user with same email exists
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email: verifiedUser.email },
      });

      if (existingEmailUser) {
        if (existingEmailUser.googleId && existingEmailUser.googleId !== verifiedUser.googleId) {
          this.logger.warn(
            `Account linking rejected: Email ${verifiedUser.email} is already linked to Google ID ${existingEmailUser.googleId}`,
          );
          throw new UnauthorizedException('Email is already associated with a different account');
        }

        // Link Google ID to existing email user
        user = await this.prisma.user.update({
          where: { id: existingEmailUser.id },
          data: {
            googleId: verifiedUser.googleId,
            name: existingEmailUser.name || verifiedUser.name,
            avatarUrl: existingEmailUser.avatarUrl || verifiedUser.avatarUrl,
          },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            googleId: verifiedUser.googleId,
            email: verifiedUser.email,
            name: verifiedUser.name,
            avatarUrl: verifiedUser.avatarUrl,
          },
        });
      }
    } else {
      // Update profile info if changed
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: verifiedUser.name || user.name,
          avatarUrl: verifiedUser.avatarUrl || user.avatarUrl,
        },
      });
    }

    // Promote to ADMIN if listed in ADMIN_EMAILS (checked on every sign-in)
    user = await this.applyAdminRole(user);

    return this.createAuthSession(
      user.id,
      user.email,
      user.name,
      user.avatarUrl,
      user.createdAt,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Promotes a user to ADMIN when their e-mail appears in the ADMIN_EMAILS
   * configuration. Runs on every sign-in so operators can be promoted (and
   * demoted) purely through environment configuration.
   */
  private async applyAdminRole(user: User): Promise<User> {
    if (user.role === 'ADMIN' || !this.adminEmails.has(user.email.toLowerCase())) {
      return user;
    }

    this.logger.log(`Promoting user ${user.email} to ADMIN (listed in ADMIN_EMAILS)`);
    return this.prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
  }

  /**
   * Rotates a refresh token session and issues a new access token
   * Executes in an atomic transaction with conditional revocation to prevent concurrent double-rotation.
   */
  async refreshSession(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(refreshToken);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.refreshSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      // Check if session exists
      if (!session) {
        this.logger.warn('Refresh session not found for provided token');
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Replay detection: If token is already revoked, revoke all sessions for this user
      if (session.isRevoked) {
        this.logger.warn(
          `Security alert: Revoked refresh token replay detected for user ${session.userId}. Revoking all sessions.`,
        );
        await tx.refreshSession.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
      }

      // Check expiration
      if (new Date() > session.expiresAt) {
        this.logger.warn(`Refresh session expired for user ${session.userId}`);
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Atomic conditional revocation: only update if STILL unrevoked
      const revokeResult = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          isRevoked: false,
        },
        data: { isRevoked: true },
      });

      // If count is 0, another concurrent request already revoked it: trigger replay defense
      if (revokeResult.count === 0) {
        this.logger.warn(
          `Security alert: Concurrent refresh token race detected for user ${session.userId}. Revoking all sessions.`,
        );
        await tx.refreshSession.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Refresh token reuse detected. Please log in again.');
      }

      const newRawRefreshToken = this.generateRawRefreshToken();
      const newTokenHash = this.hashToken(newRawRefreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

      await tx.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: newTokenHash,
          ipAddress,
          userAgent,
          expiresAt,
        },
      });

      // Issue access token
      const accessToken = this.jwtService.sign(
        {
          sub: session.user.id,
          email: session.user.email,
          type: 'access',
        },
        {
          expiresIn: this.accessTokenTtl as StringValue,
        },
      );

      return {
        accessToken,
        expiresIn: this.parseTtlToSeconds(this.accessTokenTtl),
        refreshToken: newRawRefreshToken,
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          avatarUrl: session.user.avatarUrl,
          createdAt: session.user.createdAt,
        },
      };
    });
  }

  /**
   * Revokes a refresh token session (Logout)
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshSession.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  }

  /**
   * Helper to create access token and save refresh session in database
   */
  private async createAuthSession(
    userId: string,
    email: string,
    name: string | null,
    avatarUrl: string | null,
    createdAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const rawRefreshToken = this.generateRawRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);

    // Save refresh session in DB
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        type: 'access',
      },
      {
        expiresIn: this.accessTokenTtl as StringValue,
      },
    );

    return {
      accessToken,
      expiresIn: this.parseTtlToSeconds(this.accessTokenTtl),
      refreshToken: rawRefreshToken,
      user: {
        id: userId,
        email,
        name,
        avatarUrl,
        createdAt,
      },
    };
  }

  private parseTtlToSeconds(ttl: string): number {
    if (ttl.endsWith('m')) {
      return parseInt(ttl, 10) * 60;
    }
    if (ttl.endsWith('h')) {
      return parseInt(ttl, 10) * 3600;
    }
    if (ttl.endsWith('d')) {
      return parseInt(ttl, 10) * 86400;
    }
    if (ttl.endsWith('s')) {
      return parseInt(ttl, 10);
    }
    return 900;
  }
}
