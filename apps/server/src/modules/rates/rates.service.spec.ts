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
      rates: [
        { quoteCurrency: 'USD', rate: 1.0, effectiveDate: '2026-10-09' },
        { quoteCurrency: 'EUR', rate: 0.92, effectiveDate: '2026-10-09' },
        { quoteCurrency: 'GBP', rate: 0.78, effectiveDate: '2026-10-09' },
        { quoteCurrency: 'JPY', rate: 152.0, effectiveDate: '2026-10-09' },
      ],
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
      rates: [
        { quoteCurrency: 'USD', rate: 1.0, effectiveDate: '2026-10-10' },
        { quoteCurrency: 'EUR', rate: 0.93, effectiveDate: '2026-10-10' },
      ],
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
      rates: [{ quoteCurrency: 'USD', rate: 1.0, effectiveDate: '2026-10-10' }],
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

  it('builds ascending rate-history points for a currency pair', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({ id: 'snap-any' });
    mockPrismaService.rateSnapshot.findMany.mockResolvedValue([
      {
        id: 'r1',
        version: 1,
        baseCurrency: 'EUR',
        effectiveDate: new Date('2026-10-01'),
        provider: 'mock',
        rates: [
          { quoteCurrency: 'EUR', rate: new Prisma.Decimal('1.000000') },
          { quoteCurrency: 'INR', rate: new Prisma.Decimal('89.500000') },
        ],
      },
      {
        id: 'r2',
        version: 2,
        baseCurrency: 'EUR',
        effectiveDate: new Date('2026-10-09'),
        provider: 'mock',
        rates: [
          { quoteCurrency: 'EUR', rate: new Prisma.Decimal('1.000000') },
          { quoteCurrency: 'INR', rate: new Prisma.Decimal('90.250000') },
        ],
      },
    ]);

    const history = await ratesService.getRateHistory({
      base: 'EUR',
      quote: 'INR',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(history.baseCurrency).toBe('EUR');
    expect(history.quoteCurrency).toBe('INR');
    expect(history.from).toBe('2026-10-01');
    expect(history.to).toBe('2026-10-31');
    expect(history.points).toEqual([
      { date: '2026-10-01', rate: 89.5 },
      { date: '2026-10-09', rate: 90.25 },
    ]);
  });

  it('skips snapshots that do not quote the requested currency', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({ id: 'snap-any' });
    mockPrismaService.rateSnapshot.findMany.mockResolvedValue([
      {
        id: 'r1',
        version: 1,
        baseCurrency: 'EUR',
        effectiveDate: new Date('2026-10-01'),
        provider: 'mock',
        rates: [{ quoteCurrency: 'EUR', rate: new Prisma.Decimal('1.000000') }],
      },
    ]);

    const history = await ratesService.getRateHistory({ base: 'EUR', quote: 'INR' });

    expect(history.points).toEqual([]);
  });

  it('rejects an unsupported quote currency in rate history', async () => {
    await expect(ratesService.getRateHistory({ base: 'EUR', quote: 'XYZ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('defaults the rate-history range to the trailing twelve months', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({ id: 'snap-any' });
    mockPrismaService.rateSnapshot.findMany.mockResolvedValue([]);

    const history = await ratesService.getRateHistory({ base: 'USD', quote: 'EUR' });

    const expectedTo = new Date().toISOString().slice(0, 10);
    const start = new Date(`${expectedTo}T00:00:00.000Z`);
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    expect(history.to).toBe(expectedTo);
    expect(history.from).toBe(start.toISOString().slice(0, 10));
    expect(history.points).toEqual([]);
  });

  it('carries forward currencies the provider did not refresh, preserving their date', async () => {
    mockRateProvider.fetchLatestRates.mockResolvedValue({
      baseCurrency: 'USD',
      effectiveDate: '2026-10-10',
      provider: 'frankfurter',
      rates: [
        { quoteCurrency: 'USD', rate: 1.0, effectiveDate: '2026-10-10' },
        { quoteCurrency: 'EUR', rate: 0.93, effectiveDate: '2026-10-10' },
      ],
    });
    // Previous snapshot refreshed EUR on the 9th but last saw VND on the 8th.
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({
      id: 'snap-prev',
      version: 7,
      effectiveDate: new Date('2026-10-09'),
      etag: 'W/"rates-USD-2026-10-09-prev"',
      rates: [
        {
          quoteCurrency: 'USD',
          rate: new Prisma.Decimal('1.000000'),
          effectiveDate: new Date('2026-10-09'),
        },
        {
          quoteCurrency: 'VND',
          rate: new Prisma.Decimal('25000.000000'),
          effectiveDate: new Date('2026-10-08'),
        },
      ],
    });
    mockPrismaService.rateSnapshot.create.mockResolvedValue({
      id: 'snap-cf',
      version: 8,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-10-cf"',
      isPublished: true,
    });
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
      id: 'snap-cf',
      version: 8,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      fetchedAt: new Date(),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-10-cf"',
      rates: [
        { quoteCurrency: 'EUR', rate: new Prisma.Decimal('0.930000') },
        { quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') },
        { quoteCurrency: 'VND', rate: new Prisma.Decimal('25000.000000') },
      ],
    });

    await ratesService.syncExchangeRates('USD');

    const rows = mockPrismaService.exchangeRate.createMany.mock.calls[0][0].data as Array<{
      quoteCurrency: string;
      effectiveDate: Date;
    }>;
    const vnd = rows.find((r) => r.quoteCurrency === 'VND');
    expect(vnd).toBeDefined();
    // VND was not refreshed today, so it keeps its own (older) observation date.
    expect(vnd!.effectiveDate.toISOString().slice(0, 10)).toBe('2026-10-08');
  });

  it('stores only supported registry codes, dropping non-recordable provider rows', async () => {
    // Frankfurter blends in codes we can never record (metals, CNH, crown
    // dependencies). Storing them would bloat every snapshot and leak them
    // into /rates/latest as if they were spendable.
    mockRateProvider.fetchLatestRates.mockResolvedValue({
      baseCurrency: 'USD',
      effectiveDate: '2026-10-10',
      provider: 'frankfurter',
      rates: [
        { quoteCurrency: 'USD', rate: 1.0, effectiveDate: '2026-10-10' },
        { quoteCurrency: 'EUR', rate: 0.93, effectiveDate: '2026-10-10' },
        { quoteCurrency: 'XAU', rate: 0.0005, effectiveDate: '2026-10-10' },
        { quoteCurrency: 'CNH', rate: 7.1, effectiveDate: '2026-10-10' },
        { quoteCurrency: 'GGP', rate: 0.79, effectiveDate: '2026-10-10' },
      ],
    });
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue(null);
    mockPrismaService.rateSnapshot.create.mockResolvedValue({
      id: 'snap-filtered',
      version: 1,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-10-filtered"',
      isPublished: true,
    });
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
      id: 'snap-filtered',
      version: 1,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-10'),
      fetchedAt: new Date(),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-10-filtered"',
      rates: [
        { quoteCurrency: 'USD', rate: new Prisma.Decimal('1.000000') },
        { quoteCurrency: 'EUR', rate: new Prisma.Decimal('0.930000') },
      ],
    });

    await ratesService.syncExchangeRates('USD');

    const stored = mockPrismaService.exchangeRate.createMany.mock.calls[0][0]
      .data as Array<{ quoteCurrency: string }>;
    const codes = stored.map((r) => r.quoteCurrency);
    expect(codes).toEqual(expect.arrayContaining(['USD', 'EUR']));
    expect(codes).not.toEqual(expect.arrayContaining(['XAU', 'CNH', 'GGP']));
  });

  it('derives a non-canonical base from the canonical snapshot', async () => {
    mockPrismaService.rateSnapshot.findFirst.mockResolvedValue({ id: 'snap-canon' });
    mockPrismaService.rateSnapshot.findUnique.mockResolvedValue({
      id: 'snap-canon',
      version: 3,
      baseCurrency: 'USD',
      effectiveDate: new Date('2026-10-09'),
      fetchedAt: new Date(),
      provider: 'frankfurter',
      etag: 'W/"rates-USD-2026-10-09-canon"',
      rates: [
        {
          quoteCurrency: 'EUR',
          rate: new Prisma.Decimal('0.920000'),
          effectiveDate: new Date('2026-10-09'),
        },
        {
          quoteCurrency: 'JPY',
          rate: new Prisma.Decimal('152.000000'),
          effectiveDate: new Date('2026-10-09'),
        },
        {
          quoteCurrency: 'USD',
          rate: new Prisma.Decimal('1.000000'),
          effectiveDate: new Date('2026-10-09'),
        },
      ],
    });

    const dto = await ratesService.getLatestRates('EUR');

    expect(dto.baseCurrency).toBe('EUR');
    expect(dto.rates.EUR).toBe('1.000000');
    expect(dto.rates.USD).toBe('1.086957'); // 1 / 0.92
    expect(dto.rates.JPY).toBe('165.217391'); // 152 / 0.92
  });
});
