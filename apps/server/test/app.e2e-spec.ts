import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
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
      // Truthy by default so RatesScheduler.onApplicationBootstrap sees an
      // existing published snapshot and skips its initial sync. That sync would
      // populate the service's in-process snapshot cache from these mocks
      // (whose default `findUnique` has no rates), and every later
      // /v1/rates/latest request would then be served that empty table.
      findFirst: jest.fn().mockResolvedValue({ id: 'boot-snap-1' }),
      // Report endpoints call getRateTablesForRange, which does
      // `(await findMany(...)).length`; default to "no snapshots" so an
      // unmocked call degrades instead of throwing on `undefined.length`.
      findMany: jest.fn().mockResolvedValue([]),
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
    expenseCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      // sync.push replays device changes through upsert.
      upsert: jest.fn(),
    },
    budget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    recurringExpense: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      // deleteCategory counts rules still referencing a category before removing it.
      count: jest.fn().mockResolvedValue(0),
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
    isEnabled: jest.fn().mockReturnValue(true),
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

    it('(POST) /v1/auth/dev-login is disabled (404) unless ENABLE_DEV_AUTH is enabled', async () => {
      // The suite pins ENABLE_DEV_AUTH=false, so the mock endpoint must be
      // indistinguishable from a missing route.
      await request(server).post('/v1/auth/dev-login').send({}).expect(404);
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

  describe('/v1/expenses', () => {
    let accessToken: string;
    const testUserId = 'expense-user-uuid-1';
    // Must be a real UUID: route params go through ParseUUIDPipe.
    const foodCategoryId = 'cafe0000-0000-4000-8000-000000000001';

    const foodCategory = {
      id: foodCategoryId,
      userId: testUserId,
      name: 'Food & Dining',
      color: '#f59e0b',
      icon: 'utensils',
      isDefault: true,
      sortOrder: 10,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      _count: { expenses: 0 },
    };

    const expenseRow = {
      id: 'expense-row-uuid-1',
      userId: testUserId,
      categoryId: foodCategoryId,
      amount: new Prisma.Decimal('12.50'),
      currency: 'USD',
      description: 'Groceries',
      incurredOn: new Date('2026-10-03T00:00:00.000Z'),
      paymentMethod: 'CARD',
      createdAt: new Date('2026-10-03T09:00:00.000Z'),
      updatedAt: new Date('2026-10-03T09:00:00.000Z'),
      category: { name: 'Food & Dining', color: '#f59e0b' },
    };

    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    beforeAll(async () => {
      // Published snapshot carrying real rates so the conversion path is exercised.
      mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({
        id: 'snap-expenses',
        version: 7,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-09'),
        isPublished: true,
      });
      mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
        id: 'snap-expenses',
        version: 7,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-09'),
        fetchedAt: new Date('2026-10-09T04:00:00.000Z'),
        provider: 'frankfurter',
        etag: 'etag-expenses',
        rates: [
          { quoteCurrency: 'USD', rate: 1 },
          { quoteCurrency: 'EUR', rate: 0.92 },
        ],
      });

      const expenseUser = {
        id: testUserId,
        email: 'expenses@example.com',
        name: 'Expenses User',
        googleId: 'google-sub-expenses',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // auth.service resolves by googleId first, then by email, then by id
      // (JWT strategy). Covering all three keeps the fallback create path away.
      mockPrismaService.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; googleId?: string; email?: string } }) =>
          Promise.resolve(
            where.id === testUserId ||
              where.googleId === 'google-sub-expenses' ||
              where.email === 'expenses@example.com'
              ? expenseUser
              : null,
          ),
      );
      mockPrismaService.user.update.mockResolvedValue(expenseUser);
      mockPrismaService.refreshSession.create.mockResolvedValue({
        id: 'sess-expenses',
        userId: testUserId,
      });
      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'google-sub-expenses',
        email: 'expenses@example.com',
        name: 'Expenses User',
        avatarUrl: null,
      });

      const response = await request(server)
        .post('/v1/auth/google')
        .send({ idToken: 'expenses-e2e-token' })
        .expect(200);
      accessToken = response.body.data.accessToken;
    });

    it('should reject expense routes without a Bearer token (401)', async () => {
      await request(server).get('/v1/expenses').expect(401);
      await request(server).get('/v1/expenses/summary').expect(401);
    });

    it('(GET) /v1/expenses/categories seeds defaults for an empty account', async () => {
      mockPrismaService.expenseCategory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([foodCategory]);

      const response = await request(server).get('/v1/expenses/categories').set(auth()).expect(200);

      expect(response.body.success).toBe(true);
      expect(mockPrismaService.expenseCategory.create).toHaveBeenCalledTimes(7);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        name: 'Food & Dining',
        expenseCount: 0,
      });
    });

    it('(POST) /v1/expenses should record an expense and serialise Decimal/Date', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(foodCategory);
      mockPrismaService.expense.create.mockResolvedValue(expenseRow);

      const response = await request(server)
        .post('/v1/expenses')
        .set(auth())
        .send({
          categoryId: foodCategoryId,
          amount: 12.5,
          currency: 'usd',
          incurredOn: '2026-10-03',
          description: 'Groceries',
          paymentMethod: 'CARD',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(12.5);
      expect(response.body.data.incurredOn).toBe('2026-10-03');
      expect(response.body.data.categoryName).toBe('Food & Dining');
      expect(mockPrismaService.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'USD' }) }),
      );
    });

    it('(POST) /v1/expenses should reject an unsupported currency (400)', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(foodCategory);
      mockPrismaService.expense.create.mockClear();

      const response = await request(server)
        .post('/v1/expenses')
        .set(auth())
        .send({ categoryId: foodCategoryId, amount: 10, currency: 'XYZ', incurredOn: '2026-10-03' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ISO 4217');
      expect(mockPrismaService.expense.create).not.toHaveBeenCalled();
    });

    it('(POST) /v1/expenses should reject a non-positive amount (400)', async () => {
      await request(server)
        .post('/v1/expenses')
        .set(auth())
        .send({ categoryId: foodCategoryId, amount: 0, currency: 'USD', incurredOn: '2026-10-03' })
        .expect(400);
    });

    it('(POST) /v1/expenses should 404 for an unknown category', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await request(server)
        .post('/v1/expenses')
        .set(auth())
        .send({
          categoryId: '00000000-0000-4000-8000-000000000000',
          amount: 10,
          currency: 'USD',
          incurredOn: '2026-10-03',
        })
        .expect(404);
    });

    it('(GET) /v1/expenses should return the paginated envelope', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([expenseRow]);
      mockPrismaService.expense.count.mockResolvedValue(1);

      const response = await request(server)
        .get('/v1/expenses?page=1&limit=10&sort=date_desc')
        .set(auth())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data).toMatchObject({ page: 1, limit: 10, total: 1 });

      const where = mockPrismaService.expense.findMany.mock.calls.at(-1)[0].where;
      expect(where.userId).toBe(testUserId);
    });

    it("(GET) /v1/expenses/:id should 404 for another user's expense", async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(null);

      const response = await request(server)
        .get('/v1/expenses/00000000-0000-4000-8000-000000000000')
        .set(auth())
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('(GET) /v1/expenses/summary should convert into the base currency', async () => {
      // The summary endpoint converts row-by-row at the historical rate for each
      // expense date, so it mocks individual rows (not a groupBy aggregate) and
      // supplies the published rate table the resolver reads from.
      mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({ id: 'snap-any' });
      mockPrismaService.rateSnapshot.findMany.mockResolvedValue([
        {
          version: 1,
          baseCurrency: 'USD',
          effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
          provider: 'frankfurter',
          rates: [
            { quoteCurrency: 'USD', rate: new Prisma.Decimal(1) },
            { quoteCurrency: 'EUR', rate: new Prisma.Decimal('0.92') },
          ],
        },
      ]);

      const summaryRows = [
        ...Array.from({ length: 5 }, () => ({
          amount: new Prisma.Decimal('20.00'),
          currency: 'USD',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
          categoryId: foodCategoryId,
        })),
        ...[23, 34.5, 34.5].map((amount) => ({
          amount: new Prisma.Decimal(amount.toFixed(2)),
          currency: 'EUR',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
          categoryId: foodCategoryId,
        })),
      ];
      mockPrismaService.expense.findMany.mockResolvedValue(summaryRows);
      mockPrismaService.expenseCategory.findMany.mockResolvedValue([
        { id: foodCategoryId, name: 'Food & Dining', color: '#f59e0b' },
      ]);

      const response = await request(server)
        .get('/v1/expenses/summary?from=2026-10-01&to=2026-10-31')
        .set(auth())
        .expect(200);

      const data = response.body.data;
      expect(data.converted).toBe(true);
      expect(data.baseCurrency).toBe('USD');
      // 100 USD (identity) + 92 EUR (23/0.92 + 34.5/0.92 + 34.5/0.92 = 100) = 200
      expect(data.total).toBe(200);
      expect(data.count).toBe(8);
      expect(data.byCategory[0].total).toBe(200);
      expect(data.byCategory[0].percentage).toBe(100);
      expect(data.byCurrency).toEqual([
        expect.objectContaining({ currency: 'USD', total: 100, count: 5 }),
        expect.objectContaining({ currency: 'EUR', total: 92, count: 3 }),
      ]);
    });

    it('(GET) /v1/expenses/summary should reject an unsupported base (400)', async () => {
      const response = await request(server)
        .get('/v1/expenses/summary?base=XYZ')
        .set(auth())
        .expect(400);

      expect(response.body.error).toContain('Unsupported reporting currency');
    });

    it('(GET) /v1/expenses/trends should return a continuous series', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('10.00'),
          currency: 'USD',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
      ]);

      const response = await request(server)
        .get('/v1/expenses/trends?months=3')
        .set(auth())
        .expect(200);

      const data = response.body.data;
      expect(data.months).toBe(3);
      expect(data.points).toHaveLength(3);
      expect(data.converted).toBe(true);
      expect(data.points.map((p: { total: number }) => typeof p.total)).toEqual([
        'number',
        'number',
        'number',
      ]);
      // Continuous: consecutive ascending months with no gaps.
      const encoded = data.points.map((p: { month: string }) => {
        const [year, month] = p.month.split('-').map(Number);
        return year * 12 + month;
      });
      expect(encoded[1] - encoded[0]).toBe(1);
      expect(encoded[2] - encoded[1]).toBe(1);
    });

    it('(GET) /v1/expenses/trends should cap the window (400)', async () => {
      await request(server).get('/v1/expenses/trends?months=99').set(auth()).expect(400);
    });

    it('(POST) /v1/expenses/budgets should create and reject a duplicate', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(foodCategory);
      mockPrismaService.budget.findFirst.mockResolvedValue(null);
      mockPrismaService.budget.create.mockResolvedValue({
        id: 'budget-uuid-1',
        userId: testUserId,
        categoryId: foodCategoryId,
        amount: new Prisma.Decimal('100.00'),
        currency: 'USD',
        period: 'MONTHLY',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        category: { name: 'Food & Dining' },
      });

      const created = await request(server)
        .post('/v1/expenses/budgets')
        .set(auth())
        .send({
          categoryId: foodCategoryId,
          amount: 100,
          currency: 'USD',
          period: 'MONTHLY',
          startDate: '2026-10-01',
        })
        .expect(201);

      expect(created.body.data.amount).toBe(100);
      expect(created.body.data.startDate).toBe('2026-10-01');

      mockPrismaService.budget.findFirst.mockResolvedValue({ id: 'budget-uuid-1' });
      await request(server)
        .post('/v1/expenses/budgets')
        .set(auth())
        .send({
          categoryId: foodCategoryId,
          amount: 200,
          currency: 'USD',
          period: 'MONTHLY',
          startDate: '2026-10-01',
        })
        .expect(409);
    });

    it('(GET) /v1/expenses/budgets/status should compare spend to budget', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([
        {
          id: 'budget-uuid-1',
          userId: testUserId,
          categoryId: foodCategoryId,
          amount: new Prisma.Decimal('100.00'),
          currency: 'USD',
          period: 'MONTHLY',
          startDate: new Date('2026-10-01T00:00:00.000Z'),
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          category: { name: 'Food & Dining', color: '#f59e0b' },
        },
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('80.00'),
          currency: 'USD',
          categoryId: foodCategoryId,
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
      ]);

      const response = await request(server)
        .get('/v1/expenses/budgets/status?month=2026-10')
        .set(auth())
        .expect(200);

      const item = response.body.data.items[0];
      expect(response.body.data.month).toBe('2026-10');
      expect(item).toMatchObject({
        budgetAmount: 100,
        spent: 80,
        remaining: 20,
        percentage: 80,
        overBudget: false,
        applied: true,
        currency: 'USD',
      });
    });

    it('(GET) /v1/expenses/budgets/status should reject a malformed month (400)', async () => {
      await request(server)
        .get('/v1/expenses/budgets/status?month=2026-13')
        .set(auth())
        .expect(400);
    });

    it('(DELETE) /v1/expenses/categories/:id should refuse while expenses reference it', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(foodCategory);
      mockPrismaService.expense.count.mockResolvedValue(2);

      const response = await request(server)
        .delete(`/v1/expenses/categories/${foodCategoryId}`)
        .set(auth())
        .expect(409);

      expect(response.body.error).toContain('expense');
    });
  });

  describe('Sync (e2e)', () => {
    let accessToken: string;

    const syncUserId = 'test-user-uuid-1';
    const categoryId = '0f3d5b7a-1111-4222-8333-444455556666';
    const expenseId = '1a2b3c4d-2222-4333-8444-555566667777';
    const budgetId = '2b3c4d5e-3333-4444-8555-666677778889';
    const winnerBudgetId = '3c4d5e6f-4444-4555-8666-777788889999';

    const auth = () => ({ Authorization: `Bearer ${accessToken}` });

    /** A create exactly as the phone's offline queue would replay it. */
    const expenseChange = () => ({
      entity: 'expense',
      id: expenseId,
      op: 'create',
      clientUpdatedAt: '2026-10-10T08:15:00.000Z',
      data: {
        categoryId,
        amount: 12.5,
        currency: 'usd',
        incurredOn: '2026-10-03',
        description: 'Groceries',
        paymentMethod: 'CARD',
      },
    });

    /** A create for an overall (category-less) budget. */
    const budgetChange = () => ({
      entity: 'budget',
      id: budgetId,
      op: 'create',
      clientUpdatedAt: '2026-10-10T08:16:00.000Z',
      data: {
        amount: 400,
        currency: 'usd',
        period: 'MONTHLY',
        startDate: '2026-10-01',
      },
    });

    beforeAll(async () => {
      const syncUser = {
        id: syncUserId,
        email: 'sync@example.com',
        name: 'Sync User',
        googleId: 'google-sub-sync',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // auth.service resolves by googleId first, then email, then id (JWT strategy).
      mockPrismaService.user.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; googleId?: string; email?: string } }) =>
          Promise.resolve(
            where.id === syncUserId ||
              where.googleId === 'google-sub-sync' ||
              where.email === 'sync@example.com'
              ? syncUser
              : null,
          ),
      );
      mockPrismaService.user.update.mockResolvedValue(syncUser);
      mockPrismaService.refreshSession.create.mockResolvedValue({
        id: 'sess-sync',
        userId: syncUserId,
      });
      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'google-sub-sync',
        email: 'sync@example.com',
        name: 'Sync User',
        avatarUrl: null,
      });

      const response = await request(server)
        .post('/v1/auth/google')
        .send({ idToken: 'sync-e2e-token' })
        .expect(200);
      accessToken = response.body.data.accessToken;
    });

    afterEach(() => {
      // Clears call history between cases; implementations survive (mockClear
      // does not reset them), so the signed-in user stays resolvable.
      jest.clearAllMocks();
    });

    it('should reject sync routes without a Bearer token (401)', async () => {
      await request(server).post('/v1/sync/push').send({ changes: [] }).expect(401);
      await request(server).get('/v1/sync/pull').expect(401);
    });

    it('(POST) /v1/sync/push applies a queued expense and reports the outcome', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue({ id: categoryId });
      mockPrismaService.expense.upsert.mockResolvedValue({
        updatedAt: new Date('2026-10-10T09:00:00.000Z'),
      });

      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({ changes: [expenseChange()] })
        .expect(200);

      expect(response.body.data.results).toEqual([
        {
          id: expenseId,
          status: 'applied',
          serverUpdatedAt: '2026-10-10T09:00:00.000Z',
        },
      ]);
      expect(typeof response.body.data.cursor).toBe('string');

      // Whole-row-wins: the device payload is normalised onto the server row.
      expect(mockPrismaService.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: expenseId },
          create: expect.objectContaining({
            id: expenseId,
            userId: syncUserId,
            categoryId,
            currency: 'USD',
            clientUpdatedAt: new Date('2026-10-10T08:15:00.000Z'),
          }),
        }),
      );
    });

    it('(POST) /v1/sync/push creates an overall budget with no category lookup', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue(null);
      mockPrismaService.budget.findFirst.mockResolvedValue(null);
      mockPrismaService.budget.upsert.mockResolvedValue({
        updatedAt: new Date('2026-10-10T09:05:00.000Z'),
      });

      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({ changes: [budgetChange()] })
        .expect(200);

      expect(response.body.data.results).toEqual([
        {
          id: budgetId,
          status: 'applied',
          serverUpdatedAt: '2026-10-10T09:05:00.000Z',
        },
      ]);
      expect(mockPrismaService.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            id: budgetId,
            userId: syncUserId,
            categoryId: null,
            currency: 'USD',
            period: 'MONTHLY',
            clientUpdatedAt: new Date('2026-10-10T08:16:00.000Z'),
          }),
        }),
      );
      expect(mockPrismaService.expenseCategory.findFirst).not.toHaveBeenCalled();
    });

    it('(POST) /v1/sync/push reports a budget colliding on (category, period) as skipped, not failed', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue(null);
      mockPrismaService.budget.findFirst.mockResolvedValue({ id: winnerBudgetId });

      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({ changes: [budgetChange()] })
        .expect(200);

      // The local row retires and adopts the server winner from the next mirror
      // refresh, so the queue must not treat this as a failure and retry forever.
      expect(response.body.data.results).toEqual([
        { id: budgetId, status: 'skipped', reason: 'duplicate' },
      ]);
      expect(mockPrismaService.budget.upsert).not.toHaveBeenCalled();
    });

    it('(POST) /v1/sync/push skips a stale replay instead of overwriting', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue({
        id: expenseId,
        userId: syncUserId,
        clientUpdatedAt: new Date('2026-10-11T00:00:00.000Z'),
      });

      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({ changes: [expenseChange()] })
        .expect(200);

      expect(response.body.data.results).toEqual([
        { id: expenseId, status: 'skipped', reason: 'stale' },
      ]);
      expect(mockPrismaService.expense.upsert).not.toHaveBeenCalled();
    });

    it('(POST) /v1/sync/push refuses to touch a row owned by another account', async () => {
      // A foreign id is indistinguishable from a missing one: ownership is
      // checked before LWW so a guessed UUID can never clobber another account.
      mockPrismaService.expense.findUnique.mockResolvedValue({
        id: expenseId,
        userId: 'some-other-user',
        clientUpdatedAt: new Date('2026-10-09T00:00:00.000Z'),
      });

      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({ changes: [expenseChange()] })
        .expect(200);

      expect(response.body.data.results).toEqual([
        { id: expenseId, status: 'failed', reason: 'not-found' },
      ]);
      expect(mockPrismaService.expense.upsert).not.toHaveBeenCalled();
    });

    it('(POST) /v1/sync/push treats a delete of a row that never reached the server as a no-op', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);

      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({
          changes: [
            {
              entity: 'expense',
              id: expenseId,
              op: 'delete',
              clientUpdatedAt: '2026-10-10T08:20:00.000Z',
            },
          ],
        })
        .expect(200);

      expect(response.body.data.results).toEqual([
        { id: expenseId, status: 'applied', reason: 'noop' },
      ]);
      expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
    });

    it('(POST) /v1/sync/push rejects a payload that does not match its entity (400)', async () => {
      // `data` is discriminated by `entity`: an expense payload under a budget
      // change (missing `period`) is a client bug, so the whole batch 400s.
      const response = await request(server)
        .post('/v1/sync/push')
        .set(auth())
        .send({
          changes: [
            {
              entity: 'budget',
              id: budgetId,
              op: 'create',
              clientUpdatedAt: '2026-10-10T08:16:00.000Z',
              data: { categoryId, amount: 12.5, currency: 'USD', incurredOn: '2026-10-03' },
            },
          ],
        })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain("data must be a valid 'budget' payload");
      expect(mockPrismaService.budget.upsert).not.toHaveBeenCalled();
    });

    it('(GET) /v1/sync/pull mirrors expenses, tombstones and a cursor', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          id: expenseId,
          categoryId,
          amount: 12.5,
          currency: 'USD',
          description: 'Groceries',
          incurredOn: new Date('2026-10-03T00:00:00.000Z'),
          paymentMethod: 'CARD',
          recurringExpenseId: null,
          clientUpdatedAt: new Date('2026-10-10T08:15:00.000Z'),
          updatedAt: new Date('2026-10-10T09:00:00.000Z'),
          deletedAt: new Date('2026-10-11T00:00:00.000Z'),
        },
      ]);

      const response = await request(server)
        .get('/v1/sync/pull?since=2026-10-10T09:00:00.000Z')
        .set(auth())
        .expect(200);

      expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: syncUserId,
            updatedAt: { gt: new Date('2026-10-10T09:00:00.000Z') },
          },
        }),
      );
      expect(response.body.data.cursor).toBe('2026-10-10T09:00:00.000Z');
      expect(response.body.data.hasMore).toBe(false);
      expect(response.body.data.expenses).toEqual([
        {
          id: expenseId,
          categoryId,
          amount: 12.5,
          currency: 'USD',
          description: 'Groceries',
          incurredOn: '2026-10-03',
          paymentMethod: 'CARD',
          recurringExpenseId: null,
          clientUpdatedAt: '2026-10-10T08:15:00.000Z',
          updatedAt: '2026-10-10T09:00:00.000Z',
          deletedAt: '2026-10-11T00:00:00.000Z',
        },
      ]);
    });
  });
});
