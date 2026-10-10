import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RatesService } from './rates.service';
import { FrankfurterProvider } from './providers/frankfurter.provider';
import { PrismaService } from '../../database/prisma.service';

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

  const mockFrankfurterProvider = {
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
        { provide: FrankfurterProvider, useValue: mockFrankfurterProvider },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    ratesService = module.get<RatesService>(RatesService);
    jest.clearAllMocks();
  });

  it('should sync, validate, and publish exchange rate snapshot', async () => {
    mockFrankfurterProvider.fetchLatestRates.mockResolvedValue({
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
    mockFrankfurterProvider.fetchLatestRates.mockRejectedValue(
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
});
