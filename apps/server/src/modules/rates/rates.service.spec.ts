import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RatesService } from './rates.service';
import { PrismaService } from '../../database/prisma.service';
import { EXCHANGE_RATE_PROVIDER } from './providers/provider.token';

describe('RatesService', () => {
  let ratesService: RatesService;

  const mockPrismaService = {
    rateSnapshot: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    exchangeRate: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrismaService);
      }
      return Promise.all(callback);
    }),
  };

  const mockRateProvider = {
    fetchLatestRates: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EXCHANGE_RATE_PROVIDER, useValue: mockRateProvider },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    ratesService = module.get<RatesService>(RatesService);
    jest.clearAllMocks();
  });

  it('should sync, validate, and publish exchange rate snapshot', async () => {
    mockRateProvider.fetchLatestRates.mockResolvedValue({
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
    });

    mockPrismaService.rateSnapshot.create.mockResolvedValue({
      id: 'snap-1',
      version: 1,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-09'),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-09-abc"',
      isPublished: true,
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
        { quoteCurrency: 'EUR', rate: new Prisma.Decimal('0.920000') },
        { quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') },
      ],
    });

    const result = await ratesService.syncExchangeRates('USD');

    expect(result.version).toBe(1);
    expect(result.baseCurrency).toBe('USD');
    expect(result.rates.EUR).toBe('0.920000');
    expect(result.rates.USD).toBe('1.000000');
    expect(mockPrismaService.exchangeRate.createMany).toHaveBeenCalled();
  });

  it('should preserve and serve last valid snapshot when current provider fetch fails', async () => {
    mockRateProvider.fetchLatestRates.mockRejectedValue(
      new Error('Provider HTTP 503 Service Unavailable'),
    );

    // Existing valid snapshot in DB
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({
      id: 'snap-prev',
      version: 40,
    });

    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
      id: 'snap-prev',
      version: 40,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-08'),
      fetchedAt: new Date(),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-08-prev"',
      rates: [{ quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') }],
    });

    const result = await ratesService.syncExchangeRates('USD');

    expect(result.version).toBe(40);
    expect(result.effectiveDate).toBe('2026-10-08');
  });

  it('should reject unsupported base currency', async () => {
    await expect(ratesService.getLatestRates('XYZ')).rejects.toThrow(BadRequestException);
  });

  it('coalesces concurrent on-demand syncs so only one provider call is made', async () => {
    mockRateProvider.fetchLatestRates.mockResolvedValue({
      baseCurrency: 'USD',
      effectiveDate: '2026-10-10',
      provider: 'mock',
      rates: { USD: 1.0, EUR: 0.93 },
    });
    // No snapshot exists yet → both callers share a single on-demand sync.
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue(null);
    mockPrismaService.rateSnapshot.create.mockResolvedValue({
      id: 'snap-2',
      version: 2,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      provider: 'mock',
      etag: 'W/"rates-USD-2026-10-10-abc"',
      isPublished: true,
    });
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
      id: 'snap-2',
      version: 2,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      fetchedAt: new Date(),
      provider: 'mock',
      etag: 'W/"rates-USD-2026-10-10-abc"',
      rates: [{ quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') }],
    });

    const [first, second] = await Promise.all([
      ratesService.getLatestRates('USD'),
      ratesService.getLatestRates('USD'),
    ]);

    expect(mockRateProvider.fetchLatestRates).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.exchangeRate.createMany).toHaveBeenCalledTimes(1);
    expect(first.version).toBe(2);
    expect(second.version).toBe(2);
  });

  it('serves a cached snapshot without repeating DB reads', async () => {
    const snapshot = {
      id: 'snap-cached',
      version: 5,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-09'),
      fetchedAt: new Date(),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-09-cached"',
      rates: [{ quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') }],
    };
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue(snapshot);
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue(snapshot);

    const first = await ratesService.getLatestRates('USD');
    expect(mockPrismaService.rateSnapshot.findUnique).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    const second = await ratesService.getLatestRates('USD');
    expect(mockPrismaService.rateSnapshot.findFirst).not.toHaveBeenCalled();
    expect(mockPrismaService.rateSnapshot.findUnique).not.toHaveBeenCalled();
    expect(second).toEqual(first);
  });

  it('replaces the served snapshot after a sync lands (no stale cache)', async () => {
    const oldSnapshot = {
      id: 'snap-old',
      version: 1,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-08'),
      fetchedAt: new Date(),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-08-old"',
      rates: [{ quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') }],
    };
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue(oldSnapshot);
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue(oldSnapshot);
    await ratesService.getLatestRates('USD');

    jest.clearAllMocks();
    mockRateProvider.fetchLatestRates.mockResolvedValue({
      baseCurrency: 'USD',
      effectiveDate: '2026-10-10',
      provider: 'mock',
      rates: { USD: 1.0 },
    });
    const newSnapshot = {
      id: 'snap-new',
      version: 2,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      fetchedAt: new Date(),
      provider: 'mock',
      etag: 'W/"rates-USD-2026-10-10-new"',
      rates: [{ quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') }],
    };
    mockPrismaService.rateSnapshot.create.mockResolvedValue(newSnapshot);
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue(newSnapshot);

    const synced = await ratesService.syncExchangeRates('USD');
    expect(synced.version).toBe(2);

    const served = await ratesService.getLatestRates('USD');
    expect(served.version).toBe(2);
    expect(served.etag).toBe('W/"rates-USD-2026-10-10-new"');
  });

  it('builds ascending rate tables for a range', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({ id: 'snap-any' });
    mockPrismaService.rateSnapshot.findMany.mockResolvedValue([
      {
        id: 's1',
        version: 1,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-01'),
        provider: 'mock',
        rates: [
          { quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') },
          { quoteCurrency: 'EUR', rate: new Prisma.Decimal('0.910000') },
        ],
      },
      {
        id: 's2',
        version: 2,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-09'),
        provider: 'mock',
        rates: [
          { quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') },
          { quoteCurrency: 'EUR', rate: new Prisma.Decimal('0.920000') },
        ],
      },
    ]);

    const tables = await ratesService.getRateTablesForRange('USD', new Date('2026-10-31'));

    expect(tables).toHaveLength(2);
    expect(tables[0].effectiveDate).toBe('2026-10-01');
    expect(tables[1].effectiveDate).toBe('2026-10-09');
    expect(tables[1].rates.EUR).toBe('0.920000');
  });

  it('returns the earliest snapshot when the whole range predates it', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockReset();
    mockPrismaService.rateSnapshot.findMany.mockReset();
    mockPrismaService.rateSnapshot.findFirst
      .mockResolvedValueOnce({ id: 'snap-any' }) // existence check
      .mockResolvedValueOnce({
        id: 's-earliest',
        version: 1,
        baseCurrency: 'USD',
        effectiveDate: new Date('2026-10-01'),
        provider: 'mock',
        rates: [{ quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') }],
      });
    mockPrismaService.rateSnapshot.findMany.mockResolvedValue([]);

    const tables = await ratesService.getRateTablesForRange(
      'USD',
      new Date('2026-06-30'), // before the first snapshot
    );

    expect(tables).toHaveLength(1);
    expect(tables[0].effectiveDate).toBe('2026-10-01');
    expect(tables[0].rates.USD).toBe('1.000000');
  });

  it('returns an empty table list when no snapshot can be produced', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockReset();
    mockPrismaService.rateSnapshot.findMany.mockReset();
    mockRateProvider.fetchLatestRates.mockReset();
    mockPrismaService.rateSnapshot.findFirst
      .mockResolvedValueOnce(null) // no snapshot exists → on-demand sync runs
      .mockResolvedValueOnce(null) // sync fails → no prior snapshot to preserve
      .mockResolvedValue(null); // earliest fallback also finds nothing
    mockRateProvider.fetchLatestRates.mockRejectedValue(new Error('provider down'));
    mockPrismaService.rateSnapshot.findMany.mockResolvedValue([]);

    const tables = await ratesService.getRateTablesForRange('USD', new Date('2026-12-31'));

    expect(tables).toEqual([]);
  });
});
