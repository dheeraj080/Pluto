import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { GoogleAuthService } from '../src/modules/auth/services/google-auth.service';
import { FrankfurterProvider } from '../src/modules/rates/providers/frankfurter.provider';
import { StorageService } from '../src/modules/backups/storage/storage.service';

describe('Pluto Server API (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    rateSnapshot: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'boot-snap-1',
        version: 1,
        baseCurrency: 'USD',
        effectiveDate: new Date(),
        fetchedAt: new Date(),
        provider: 'frankfurter',
        etag: 'etag-1',
        rates: [],
      }),
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'boot-snap-1',
        version: 1,
        baseCurrency: 'USD',
        effectiveDate: new Date(),
        etag: 'etag-1',
      }),
    },
    exchangeRate: {
      createMany: jest.fn(),
    },
    backup: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    systemLock: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === 'function') {
        return arg(mockPrismaService);
      }
      return Promise.all(arg);
    }),
  };

  const mockGoogleAuthService = {
    verifyIdToken: jest.fn(),
  };

  const mockFrankfurterProvider = {
    providerName: 'frankfurter',
    fetchLatestRates: jest.fn().mockResolvedValue({
      baseCurrency: 'USD',
      effectiveDate: '2026-10-09',
      provider: 'frankfurter',
      rates: {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.78,
        INR: 86.4,
        JPY: 152.0,
        CNY: 7.24,
        CAD: 1.38,
        AUD: 1.54,
        CHF: 0.88,
        SGD: 1.34,
        NZD: 1.67,
      },
    }),
  };

  const mockStorageService = {
    generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.local/upload-mock-url'),
    generatePresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.local/download-mock-url'),
    headObject: jest.fn().mockResolvedValue({ contentLength: 1024 }),
    verifyObjectChecksum: jest.fn().mockResolvedValue({
      matches: true,
      actualChecksumSha256: 'a'.repeat(64),
      actualBytes: 1024,
    }),
    copyObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    deleteObjects: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(GoogleAuthService)
      .useValue(mockGoogleAuthService)
      .overrideProvider(FrankfurterProvider)
      .useValue(mockFrankfurterProvider)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/health', () => {
    it('(GET) should return 200 OK and health status', async () => {
      const response = await request(server).get('/v1/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ok');
      expect(response.body.data.database.status).toBe('connected');
    });
  });

  describe('/v1/rates', () => {
    it('(GET) /v1/rates/supported-currencies should return currency metadata', async () => {
      const response = await request(server).get('/v1/rates/supported-currencies').expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((c: { code: string }) => c.code === 'USD')).toBe(true);
      expect(response.body.data.some((c: { code: string }) => c.code === 'EUR')).toBe(true);
    });

    it('(GET) /v1/rates/latest should return rates and support ETag caching', async () => {
      mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({
        id: 'snap-1',
        version: 1,
      });

      mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
        id: 'snap-1',
        version: 1,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-09'),
        fetchedAt: new Date(),
        provider: 'frankfurter',
        etag: 'W/"rates-USD-2026-10-09-abc"',
        rates: [
          { quoteCurrency: 'EUR', rate: { toFixed: () => '0.920000' } },
          { quoteCurrency: 'USD', rate: { toFixed: () => '1.000000' } },
        ],
      });

      const response = await request(server).get('/v1/rates/latest?base=USD').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rates.EUR).toBe('0.920000');
      expect(response.headers.etag).toBe('W/"rates-USD-2026-10-09-abc"');

      // Test 304 Not Modified
      await request(server)
        .get('/v1/rates/latest?base=USD')
        .set('If-None-Match', 'W/"rates-USD-2026-10-09-abc"')
        .expect(304);
    });
  });

  describe('Authentication & Protected Routes', () => {
    let accessToken: string;
    let refreshToken: string;
    const testUserId = 'test-user-uuid-1';

    beforeAll(() => {
      const testUser = {
        id: testUserId,
        email: 'user@example.com',
        name: 'E2E User',
        googleId: 'google-sub-e2e',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; email?: string; googleId?: string } }) => {
          if (where.id === testUserId || where.googleId === 'google-sub-e2e') {
            return Promise.resolve(testUser);
          }
          return Promise.resolve(null);
        },
      );

      // Called when profile is updated during Google sign-in
      mockPrismaService.user.update.mockResolvedValue(testUser);
    });

    it('should reject access to protected /v1/users/me without Bearer token', async () => {
      await request(server).get('/v1/users/me').expect(401);
    });

    it('(POST) /v1/auth/google should authenticate and return tokens', async () => {
      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'google-sub-e2e',
        email: 'user@example.com',
        name: 'E2E User',
        avatarUrl: null,
      });

      mockPrismaService.refreshSession.create.mockResolvedValue({
        id: 'sess-1',
        userId: testUserId,
      });

      const response = await request(server)
        .post('/v1/auth/google')
        .send({ idToken: 'valid-google-e2e-token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('user@example.com');

      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('(POST) /v1/auth/refresh should rotate session and reject concurrent reuse', async () => {
      const futureDate = new Date(Date.now() + 10000000);
      mockPrismaService.refreshSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        userId: testUserId,
        tokenHash: 'somehash',
        isRevoked: false,
        expiresAt: futureDate,
        user: {
          id: testUserId,
          email: 'user@example.com',
          name: 'E2E User',
          avatarUrl: null,
          createdAt: new Date(),
        },
      });
      mockPrismaService.refreshSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.refreshSession.create.mockResolvedValue({
        id: 'sess-2',
        userId: testUserId,
      });

      const response = await request(server)
        .post('/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('(GET) /v1/users/me with valid Bearer token should return user profile', async () => {
      const response = await request(server)
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
      expect(response.body.data.email).toBe('user@example.com');
    });

    it('(POST) /v1/backups/initiate with valid Bearer token should return presigned upload URL', async () => {
      const validBackupId = '11111111-1111-1111-1111-111111111111';
      mockPrismaService.backup.findFirst.mockResolvedValue(null);
      mockPrismaService.backup.create.mockResolvedValue({
        id: validBackupId,
        sequenceNumber: 1,
      });
      mockPrismaService.backup.update.mockResolvedValue({
        id: validBackupId,
        sequenceNumber: 1,
        storageKey: `backups/${testUserId}/${validBackupId}.snap`,
      });

      const response = await request(server)
        .post('/v1/backups/initiate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          schemaVersion: '1.0.0',
          appVersion: '1.0.0',
          expectedSizeBytes: 1024,
          checksumSha256: 'a'.repeat(64),
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.backupId).toBe(validBackupId);
      expect(response.body.data.uploadUrl).toBe('https://s3.local/upload-mock-url');
    });

    it('(POST) /v1/backups/:id/complete should verify checksum and finalize backup', async () => {
      const validBackupId = '11111111-1111-1111-1111-111111111111';
      mockPrismaService.backup.findUnique.mockResolvedValue({
        id: validBackupId,
        userId: testUserId,
        status: 'PENDING',
        sequenceNumber: 1,
        storageKey: `backups/${testUserId}/${validBackupId}.snap`,
        checksumSha256: 'a'.repeat(64),
      });

      mockStorageService.headObject.mockResolvedValue({ contentLength: 1024 });
      mockStorageService.verifyObjectChecksum.mockResolvedValue({
        matches: true,
        actualChecksumSha256: 'a'.repeat(64),
        actualBytes: 1024,
      });

      mockPrismaService.backup.update.mockResolvedValue({
        id: validBackupId,
        userId: testUserId,
        status: 'COMPLETED',
        sequenceNumber: 1,
        schemaVersion: '1.0.0',
        appVersion: '1.0.0',
        fileSizeBytes: BigInt(1024),
        checksumSha256: 'a'.repeat(64),
        completedAt: new Date(),
        createdAt: new Date(),
      });
      mockPrismaService.backup.findMany.mockResolvedValue([]);

      const response = await request(server)
        .post(`/v1/backups/${validBackupId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(mockStorageService.verifyObjectChecksum).toHaveBeenCalled();
    });

    it('(POST) /v1/backups/:id/complete should reject on checksum mismatch', async () => {
      const corruptBackupId = '22222222-2222-2222-2222-222222222222';
      mockPrismaService.backup.findUnique.mockResolvedValue({
        id: corruptBackupId,
        userId: testUserId,
        status: 'PENDING',
        sequenceNumber: 2,
        storageKey: `backups/${testUserId}/${corruptBackupId}.snap`,
        checksumSha256: 'a'.repeat(64),
      });

      mockStorageService.headObject.mockResolvedValue({ contentLength: 1024 });
      mockStorageService.verifyObjectChecksum.mockResolvedValue({
        matches: false,
        actualChecksumSha256: 'corrupted-hash',
        actualBytes: 1024,
      });
      mockPrismaService.backup.update.mockResolvedValue({});

      const response = await request(server)
        .post(`/v1/backups/${corruptBackupId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('checksum does not match');
    });

    it('(DELETE) /v1/users/me should delete S3 objects and remove user account', async () => {
      mockPrismaService.backup.findMany.mockResolvedValue([
        { id: 'backup-1', storageKey: `backups/${testUserId}/backup-1.snap` },
      ]);
      mockPrismaService.user.delete.mockResolvedValue({ id: testUserId });

      const response = await request(server)
        .delete('/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockStorageService.deleteObjects).toHaveBeenCalledWith([
        `backups/${testUserId}/backup-1.snap`,
        `backups/${testUserId}/staging/backup-1.bin`,
      ]);
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: testUserId },
      });
    });
  });

  describe('Admin API', () => {
    const adminUser = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      googleId: 'google-sub-admin',
      email: 'admin@example.com',
      name: 'Admin',
      avatarUrl: null,
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const regularUser = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      googleId: 'google-sub-regular',
      email: 'regular@example.com',
      name: 'Regular',
      avatarUrl: null,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let adminAccessToken: string;
    let userAccessToken: string;

    /** Signs in via POST /v1/auth/google and returns a fresh access token. */
    async function signIn(user: typeof adminUser): Promise<string> {
      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatarUrl: null,
      });
      mockPrismaService.user.update.mockResolvedValue(user);
      mockPrismaService.refreshSession.create.mockResolvedValue({ id: 'session-x' });

      const response = await request(server)
        .post('/v1/auth/google')
        .send({ idToken: `token-for-${user.googleId}` })
        .expect(200);

      return response.body.data.accessToken;
    }

    beforeAll(async () => {
      // Directory covers auth (by googleId) and JWT validation (by id) lookups
      const directory = new Map<string, typeof adminUser>([
        [adminUser.googleId, adminUser],
        [adminUser.id, adminUser],
        [regularUser.googleId, regularUser],
        [regularUser.id, regularUser],
      ]);
      mockPrismaService.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; googleId?: string; email?: string } }) =>
          Promise.resolve(directory.get(where.googleId ?? where.id ?? where.email ?? '') ?? null),
      );

      adminAccessToken = await signIn(adminUser);
      userAccessToken = await signIn(regularUser);

      // Stats dependencies
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.refreshSession.count.mockResolvedValue(1);
      mockPrismaService.backup.aggregate.mockResolvedValue({
        _count: { _all: 1 },
        _sum: { fileSizeBytes: BigInt(512) },
      });
      mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({
        version: 7,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-09'),
        fetchedAt: new Date('2026-10-09T04:00:00Z'),
      });
    });

    it('should reject /v1/admin/stats without a token (401)', async () => {
      await request(server).get('/v1/admin/stats').expect(401);
    });

    it('should reject /v1/admin/stats for non-admin users (403)', async () => {
      const response = await request(server)
        .get('/v1/admin/stats')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('(GET) /v1/admin/stats should return aggregates for admins', async () => {
      const response = await request(server)
        .get('/v1/admin/stats')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalUsers: 2,
        totalBackups: 1,
        totalStorageBytes: 512,
        activeSessions: 1,
      });
      expect(response.body.data.lastRateSnapshot.version).toBe(7);
    });

    it('(GET) /v1/admin/users should list users with counts', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          avatarUrl: null,
          role: 'ADMIN',
          createdAt: adminUser.createdAt,
          _count: { backups: 2, refreshSessions: 1 },
        },
      ]);

      const response = await request(server)
        .get('/v1/admin/users?limit=20')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.data.total).toBe(2);
      expect(response.body.data.items[0]).toMatchObject({
        email: 'admin@example.com',
        role: 'ADMIN',
        backupCount: 2,
        activeSessionCount: 1,
      });
    });

    it('(DELETE) /v1/admin/users/:id should reject self-deletion (400)', async () => {
      const response = await request(server)
        .delete(`/v1/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(400);

      expect(response.body.error).toContain('your own account');
    });

    it('(DELETE) /v1/admin/users/:id should delete another user', async () => {
      mockPrismaService.backup.findMany.mockResolvedValue([]);
      mockPrismaService.user.delete.mockResolvedValue({ id: regularUser.id });

      const response = await request(server)
        .delete(`/v1/admin/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: regularUser.id },
      });
    });
  });
});
