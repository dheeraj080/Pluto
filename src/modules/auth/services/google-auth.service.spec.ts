import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-client-id.apps.googleusercontent.com'),
    };
    service = new GoogleAuthService(mockConfigService as ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject when OAuth2Client verification throws error', async () => {
    const internalClient = (
      service as unknown as { client: { verifyIdToken: () => Promise<unknown> } }
    ).client;
    jest.spyOn(internalClient, 'verifyIdToken').mockRejectedValue(new Error('Invalid token'));

    await expect(service.verifyIdToken('invalid-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should reject when payload has invalid issuer', async () => {
    const internalClient = (
      service as unknown as { client: { verifyIdToken: () => Promise<unknown> } }
    ).client;
    jest.spyOn(internalClient, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        iss: 'invalid-issuer.com',
        sub: 'google-sub-123',
        email: 'user@example.com',
      }),
    });

    await expect(service.verifyIdToken('token-with-bad-issuer')).rejects.toThrow(
      'Invalid Google token issuer',
    );
  });

  it('should successfully extract user when token is valid', async () => {
    const internalClient = (
      service as unknown as { client: { verifyIdToken: () => Promise<unknown> } }
    ).client;
    jest.spyOn(internalClient, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        iss: 'https://accounts.google.com',
        sub: 'google-sub-987654',
        email: 'TEST.USER@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      }),
    });

    const result = await service.verifyIdToken('valid-google-jwt');

    expect(result.googleId).toBe('google-sub-987654');
    expect(result.email).toBe('test.user@example.com');
    expect(result.name).toBe('Test User');
    expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('should reject when email_verified is false', async () => {
    const internalClient = (
      service as unknown as { client: { verifyIdToken: () => Promise<unknown> } }
    ).client;
    jest.spyOn(internalClient, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        iss: 'https://accounts.google.com',
        sub: 'google-sub-unverified',
        email: 'unverified@example.com',
        email_verified: false,
      }),
    });

    await expect(service.verifyIdToken('token-with-unverified-email')).rejects.toThrow(
      'Google token email is not verified',
    );
  });
});
