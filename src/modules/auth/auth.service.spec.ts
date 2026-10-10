import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { PrismaService } from '../../database/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-access-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
  };

  const mockGoogleAuthService = {
    verifyIdToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: GoogleAuthService, useValue: mockGoogleAuthService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should authenticate valid Google token and issue access + refresh tokens', async () => {
    mockGoogleAuthService.verifyIdToken.mockResolvedValue({
      googleId: 'google-12345',
      email: 'alex@example.com',
      name: 'Alex Smith',
      avatarUrl: 'https://example.com/photo.jpg',
    });

    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.user.create.mockResolvedValue({
      id: 'user-uuid-1',
      googleId: 'google-12345',
      email: 'alex@example.com',
      name: 'Alex Smith',
      avatarUrl: 'https://example.com/photo.jpg',
      createdAt: new Date(),
    });

    mockPrismaService.refreshSession.create.mockResolvedValue({
      id: 'session-uuid-1',
      userId: 'user-uuid-1',
    });

    const result = await authService.authenticateWithGoogle('google-id-token');

    expect(result.accessToken).toBe('mock-jwt-access-token');
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('alex@example.com');
  });

  it('should rotate session successfully when valid refresh token is provided', async () => {
    const rawToken = 'sample-valid-refresh-token';
    const tokenHash = authService.hashToken(rawToken);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    mockPrismaService.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      tokenHash,
      isRevoked: false,
      expiresAt: futureDate,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'User One',
        avatarUrl: null,
        createdAt: new Date(),
      },
    });

    mockPrismaService.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaService.refreshSession.create.mockResolvedValue({ id: 'session-2' });

    const result = await authService.refreshSession(rawToken);

    expect(result.accessToken).toBe('mock-jwt-access-token');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(rawToken); // Rotated to new token
  });

  it('should detect concurrent refresh token race condition and revoke all sessions', async () => {
    const rawToken = 'racing-refresh-token';
    const tokenHash = authService.hashToken(rawToken);

    mockPrismaService.refreshSession.findUnique.mockResolvedValue({
      id: 'session-race',
      userId: 'user-racer',
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 50000),
      user: { id: 'user-racer' },
    });

    // Simulate concurrent update: another worker rotated it in between, so update count is 0
    mockPrismaService.refreshSession.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(authService.refreshSession(rawToken)).rejects.toThrow(
      'Refresh token reuse detected. Please log in again.',
    );

    // Verify replay detection revokes all sessions
    expect(mockPrismaService.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-racer' },
      data: { isRevoked: true },
    });
  });

  it('should detect replay attack on revoked refresh token and revoke all user sessions', async () => {
    const rawToken = 'revoked-replay-token';
    const tokenHash = authService.hashToken(rawToken);

    mockPrismaService.refreshSession.findUnique.mockResolvedValue({
      id: 'session-old',
      userId: 'user-compromised',
      tokenHash,
      isRevoked: true, // Already revoked!
      expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-compromised' },
    });

    await expect(authService.refreshSession(rawToken)).rejects.toThrow(UnauthorizedException);

    // Verify all sessions were invalidated for security
    expect(mockPrismaService.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-compromised' },
      data: { isRevoked: true },
    });
  });

  it('should reject expired refresh token', async () => {
    const rawToken = 'expired-refresh-token';
    const tokenHash = authService.hashToken(rawToken);

    mockPrismaService.refreshSession.findUnique.mockResolvedValue({
      id: 'session-expired',
      userId: 'user-1',
      tokenHash,
      isRevoked: false,
      expiresAt: new Date(Date.now() - 100000), // In past
      user: { id: 'user-1' },
    });

    await expect(authService.refreshSession(rawToken)).rejects.toThrow('Refresh token has expired');
  });

  describe('ADMIN_EMAILS promotion', () => {
    async function buildServiceWithAdminEmails(adminEmails: string): Promise<AuthService> {
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: JwtService, useValue: mockJwtService },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue: unknown) =>
                key === 'ADMIN_EMAILS' ? adminEmails : defaultValue,
              ),
            },
          },
          { provide: GoogleAuthService, useValue: mockGoogleAuthService },
        ],
      }).compile();
      return module.get<AuthService>(AuthService);
    }

    it('promotes a listed user to ADMIN on sign-in', async () => {
      const service = await buildServiceWithAdminEmails('admin@example.com, owner@example.com');

      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'google-admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        avatarUrl: null,
      });

      const existingUser = {
        id: 'user-admin',
        googleId: 'google-admin-1',
        email: 'admin@example.com',
        name: 'Admin',
        avatarUrl: null,
        role: 'USER',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockImplementation(({ data }: { data: { role?: string } }) =>
        Promise.resolve({ ...existingUser, ...data }),
      );
      mockPrismaService.refreshSession.create.mockResolvedValue({ id: 'session-1' });

      await service.authenticateWithGoogle('valid-token');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-admin' },
          data: { role: 'ADMIN' },
        }),
      );
    });

    it('does not promote users outside ADMIN_EMAILS', async () => {
      const service = await buildServiceWithAdminEmails('admin@example.com');

      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'google-user-1',
        email: 'someone@example.com',
        name: 'Someone',
        avatarUrl: null,
      });

      const existingUser = {
        id: 'user-regular',
        googleId: 'google-user-1',
        email: 'someone@example.com',
        name: 'Someone',
        avatarUrl: null,
        role: 'USER',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(existingUser);
      mockPrismaService.refreshSession.create.mockResolvedValue({ id: 'session-1' });

      await service.authenticateWithGoogle('valid-token');

      // Only the profile-sync update runs — never a role change
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: 'ADMIN' } }),
      );
    });
  });
});
