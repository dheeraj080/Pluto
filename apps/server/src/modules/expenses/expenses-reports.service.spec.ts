import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { ExpensesReportsService } from './expenses-reports.service';
import { CurrencyConverterService } from './currency-converter.service';
import { RatesService } from '../rates/rates.service';
import { PrismaService } from '../../database/prisma.service';
import { RateTableDto } from '../rates/dto/rates-response.dto';
import { trailingMonths } from './expenses.utils';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Base USD: 1 USD buys 0.92 EUR, so 92 EUR converts to 100 USD. */
const TABLES: RateTableDto[] = [
  {
    version: 1,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-01',
    provider: 'mock',
    rates: { USD: '1.000000', EUR: '0.920000' },
  },
  {
    version: 2,
    baseCurrency: 'USD',
    effectiveDate: '2026-10-09',
    provider: 'mock',
    rates: { USD: '1.000000', EUR: '0.920000' },
  },
];

function row(overrides: Record<string, unknown>) {
  return {
    amount: new Prisma.Decimal('0.00'),
    currency: 'USD',
    incurredOn: new Date('2026-10-05T00:00:00.000Z'),
    categoryId: 'cat-1',
    ...overrides,
  };
}

function categoryRow(id: string, name: string, color = '#4f46e5') {
  return { id, name, color };
}

describe('ExpensesReportsService', () => {
  let service: ExpensesReportsService;

  const mockPrismaService = {
    expense: { findMany: jest.fn() },
    expenseCategory: { findMany: jest.fn() },
    budget: { findMany: jest.fn() },
  };

  const mockConverter = {
    resolveBase: jest.fn(),
    assertSupported: jest.fn(),
  };

  const mockRatesService = {
    getRateTablesForRange: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => defaultValue),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConverter.resolveBase.mockImplementation((base?: string) => (base ?? 'USD').toUpperCase());
    mockConverter.assertSupported.mockImplementation((code: string) => code.toUpperCase());
    mockRatesService.getRateTablesForRange.mockImplementation(() => Promise.resolve(TABLES));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CurrencyConverterService, useValue: mockConverter },
        { provide: RatesService, useValue: mockRatesService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ExpensesReportsService>(ExpensesReportsService);
  });

  describe('getSummary', () => {
    beforeEach(() => {
      mockPrismaService.expenseCategory.findMany.mockResolvedValue([
        categoryRow('cat-1', 'Food', '#f59e0b'),
        categoryRow('cat-2', 'Transport', '#3b82f6'),
      ]);
    });

    it('folds multiple currencies together per category using the base as pivot', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
        row({ amount: new Prisma.Decimal('50.00'), categoryId: 'cat-2' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      const food = result.byCategory.find((c) => c.categoryId === 'cat-1');
      expect(food?.total).toBe(200); // 100 USD + 92 EUR (=100 USD)
      expect(food?.count).toBe(2);
      expect(result.total).toBe(250);
      expect(result.count).toBe(3);
      expect(result.average).toBe(83.33);
      expect(result.conversionStatus).toBe('converted');
      expect(result.converted).toBe(true);
    });

    it('computes category shares that sum to 100', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
        row({ amount: new Prisma.Decimal('50.00'), categoryId: 'cat-2' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.byCategory.map((c) => c.percentage)).toEqual([80, 20]);
      expect(result.byCategory.reduce((s, c) => s + c.percentage, 0)).toBe(100);
      expect(result.byCategory.map((c) => c.total).reduce((s, t) => s + t, 0)).toBe(result.total);
    });

    it('reports native subtotals per currency alongside converted totals', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
        row({ amount: new Prisma.Decimal('50.00'), categoryId: 'cat-2' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.byCurrency).toEqual([
        { currency: 'USD', total: 150, count: 2 },
        { currency: 'EUR', total: 92, count: 1 },
      ]);
      expect(result.baseCurrency).toBe('USD');
    });

    it('resolves the latest snapshot on-or-before each expense date (historical)', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.total).toBe(100);
      // 10-01 is the latest snapshot on-or-before 10-05 and within lookback.
      expect(result.rateProvenance.earliestRateDate).toBe('2026-10-01');
      expect(result.rateProvenance.policies).toContain('historical');
    });

    it('labels rows older than every snapshot as estimate without lying about the rate date', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date('2026-05-15T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-05-01', to: '2026-05-31' });

      expect(result.total).toBe(100); // still converted
      expect(result.rateProvenance.policies).toContain('estimate');
      expect(result.rateProvenance.earliestRateDate).toBe('2026-10-01'); // real snapshot date
    });

    it('flags partially-converted reports and lists the unconvertible currencies', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
        row({ amount: new Prisma.Decimal('50000.00'), currency: 'VND' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.converted).toBe(false);
      expect(result.conversionStatus).toBe('partially_converted');
      expect(result.unconvertedCurrencies).toEqual(['VND']);
      expect(result.total).toBe(100);
      // Native VND total is still intact and always reported.
      expect(result.byCurrency.find((c) => c.currency === 'VND')?.total).toBe(50000);
    });

    it('reports unavailable (null totals, no breakdown) when nothing can convert', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.converted).toBe(false);
      expect(result.conversionStatus).toBe('unavailable');
      expect(result.conversionUnavailableReason).toBeTruthy();
      expect(result.total).toBeNull();
      expect(result.average).toBeNull();
      expect(result.byCategory).toEqual([]);
      expect(result.count).toBe(1);
      expect(result.byCurrency).toEqual([{ currency: 'EUR', total: 92, count: 1 }]);
    });

    it('still converts base-currency rows exactly when no snapshots exist', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.conversionStatus).toBe('partially_converted');
      expect(result.total).toBe(100);
      expect(result.unconvertedCurrencies).toEqual(['EUR']);
    });

    it('scopes the aggregate to the caller', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: USER_A }) }),
      );
    });

    it('defaults to the current calendar month', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      const now = new Date();
      const expectedFrom = `${now.toISOString().slice(0, 7)}-01`;

      const result = await service.getSummary(USER_A, {});

      expect(result.from).toBe(expectedFrom);
      expect(result.total).toBe(0);
    });

    it('rejects an unsupported base currency', async () => {
      mockConverter.resolveBase.mockImplementation(() => {
        throw new BadRequestException("Unsupported currency 'XYZ'");
      });

      await expect(service.getSummary(USER_A, { base: 'XYZ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('expresses totals in the requested secondary currency from the same snapshot', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([
        {
          version: 1,
          baseCurrency: 'USD',
          effectiveDate: '2026-10-01',
          provider: 'mock',
          rates: { USD: '1.000000', EUR: '0.920000', INR: '83.000000' },
        },
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
        row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' }),
        row({ amount: new Prisma.Decimal('50.00'), categoryId: 'cat-2' }),
      ]);

      const result = await service.getSummary(USER_A, {
        from: '2026-10-01',
        to: '2026-10-31',
        secondary: 'INR',
      });

      expect(result.secondaryCurrency).toBe('INR');
      expect(result.secondaryTotal).toBe(20750); // 250 USD * 83
      const food = result.byCategory.find((c) => c.categoryId === 'cat-1');
      expect(food?.secondaryTotal).toBe(16600); // 200 USD * 83
    });

    it('omits secondary fields when no secondary currency is requested', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({ amount: new Prisma.Decimal('100.00') }),
      ]);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.secondaryCurrency).toBeUndefined();
      expect(result.secondaryTotal).toBeUndefined();
      expect(result.byCategory[0].secondaryTotal).toBeUndefined();
    });

    it('rejects an unsupported secondary currency', async () => {
      mockConverter.assertSupported.mockImplementation(() => {
        throw new BadRequestException("Unsupported currency 'XYZ'");
      });

      await expect(
        service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31', secondary: 'XYZ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTrends', () => {
    it('returns a continuous, zero-filled series oldest first', async () => {
      const months = trailingMonths(3);
      const [prev, current] = [months[months.length - 2], months[months.length - 1]];

      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('10.00'),
          incurredOn: new Date(`${current}-05T00:00:00.000Z`),
        }),
        row({
          amount: new Prisma.Decimal('9.20'),
          currency: 'EUR',
          incurredOn: new Date(`${current}-06T00:00:00.000Z`),
        }),
        row({
          amount: new Prisma.Decimal('20.00'),
          incurredOn: new Date(`${prev}-15T00:00:00.000Z`),
        }),
      ]);

      const result = await service.getTrends(USER_A, { months: 3 });

      expect(result.points.map((p) => p.month)).toEqual(months);
      expect(result.months).toBe(3);
      expect(result.points[2]).toEqual({ month: current, total: 20, count: 2 });
      expect(result.points[1]).toEqual({ month: prev, total: 20, count: 1 });
      expect(result.points[0]).toEqual({ month: months[0], total: 0, count: 0 });
      expect(result.converted).toBe(true);
      expect(result.conversionStatus).toBe('converted');
    });

    it('only queries the covered date window', async () => {
      const months = trailingMonths(6);
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      await service.getTrends(USER_A, { months: 6 });

      const where = mockPrismaService.expense.findMany.mock.calls[0][0].where;
      expect(where.incurredOn.gte.toISOString().slice(0, 7)).toBe(months[0]);
      expect(where.incurredOn.lte.toISOString().slice(0, 7)).toBe(months[5]);
    });

    it('returns null point totals when nothing can convert', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([]);
      const months = trailingMonths(2);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date(`${months[1]}-05T00:00:00.000Z`),
        }),
      ]);

      const result = await service.getTrends(USER_A, { months: 2 });

      expect(result.converted).toBe(false);
      expect(result.conversionStatus).toBe('unavailable');
      expect(result.unconvertedCurrencies).toEqual(['EUR']);
      expect(result.points.every((p) => p.total === null)).toBe(true);
      expect(result.points[1].count).toBe(1);
    });
  });

  describe('getSeries', () => {
    it('buckets a day series continuously, zero-filling empty days', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('10.00'),
          incurredOn: new Date('2026-10-03T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('9.20'),
          currency: 'EUR',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getSeries(USER_A, {
        from: '2026-10-01',
        to: '2026-10-05',
        granularity: 'day',
      });

      expect(result.granularity).toBe('day');
      expect(result.points.map((p) => p.bucket)).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
      ]);
      expect(result.points.map((p) => p.total)).toEqual([0, 0, 10, 0, 10]);
      expect(result.points[2].count).toBe(1);
    });

    it('groups into Monday-anchored week buckets', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('10.00'),
          incurredOn: new Date('2026-10-03T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getSeries(USER_A, {
        from: '2026-10-01',
        to: '2026-10-31',
        granularity: 'week',
      });

      expect(result.points.map((p) => p.bucket)).toEqual([
        '2026-09-28',
        '2026-10-05',
        '2026-10-12',
        '2026-10-19',
        '2026-10-26',
      ]);
      expect(result.points[0].total).toBe(10);
    });

    it('expresses the series in a secondary currency when requested', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([
        {
          version: 1,
          baseCurrency: 'USD',
          effectiveDate: '2026-10-01',
          provider: 'mock',
          rates: { USD: '1.000000', EUR: '0.920000', INR: '83.000000' },
        },
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('10.00'),
          incurredOn: new Date('2026-10-03T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getSeries(USER_A, {
        from: '2026-10-01',
        to: '2026-10-05',
        granularity: 'day',
        secondary: 'INR',
      });

      expect(result.secondaryCurrency).toBe('INR');
      expect(result.points[2].total).toBe(10);
      expect(result.points[2].secondaryTotal).toBe(830);
      expect(result.points[0].secondaryTotal).toBe(0);
    });

    it('rejects a range that would yield too many buckets', async () => {
      await expect(
        service.getSeries(USER_A, {
          from: '2020-01-01',
          to: '2026-12-31',
          granularity: 'day',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCategoryTrends', () => {
    it('returns monthly series for the top categories only', async () => {
      const months = trailingMonths(3);
      const [prev, current] = [months[1], months[2]];

      mockPrismaService.expenseCategory.findMany.mockResolvedValue([
        categoryRow('cat-1', 'Food', '#34d399'),
        categoryRow('cat-2', 'Transport', '#7dd3fc'),
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('100.00'),
          categoryId: 'cat-1',
          incurredOn: new Date(`${current}-05T00:00:00.000Z`),
        }),
        row({
          amount: new Prisma.Decimal('50.00'),
          categoryId: 'cat-1',
          incurredOn: new Date(`${prev}-05T00:00:00.000Z`),
        }),
        row({
          amount: new Prisma.Decimal('20.00'),
          categoryId: 'cat-2',
          incurredOn: new Date(`${current}-06T00:00:00.000Z`),
        }),
        row({
          amount: new Prisma.Decimal('5.00'),
          categoryId: 'cat-3',
          incurredOn: new Date(`${current}-07T00:00:00.000Z`),
        }),
      ]);

      const result = await service.getCategoryTrends(USER_A, { months: 3, top: 2 });

      expect(result.months).toBe(3);
      expect(result.series.map((s) => s.categoryId)).toEqual(['cat-1', 'cat-2']);
      const food = result.series[0];
      expect(food.categoryName).toBe('Food');
      expect(food.points.map((p) => p.month)).toEqual(months);
      expect(food.points.map((p) => p.total)).toEqual([0, 50, 100]);
      expect(result.series[1].points.map((p) => p.total)).toEqual([0, 0, 20]);
    });
  });

  describe('getComparison', () => {
    beforeEach(() => {
      mockPrismaService.expenseCategory.findMany.mockResolvedValue([
        categoryRow('cat-1', 'Food', '#f59e0b'),
      ]);
    });

    it('computes absolute and percentage deltas between two periods', async () => {
      mockPrismaService.expense.findMany
        .mockResolvedValueOnce([
          row({ amount: new Prisma.Decimal('50.00') }),
          row({ amount: new Prisma.Decimal('50.00') }),
          row({ amount: new Prisma.Decimal('50.00') }),
        ])
        .mockResolvedValueOnce([
          row({ amount: new Prisma.Decimal('50.00') }),
          row({ amount: new Prisma.Decimal('50.00') }),
        ]);

      const result = await service.getComparison(USER_A, {
        currentFrom: '2026-10-01',
        currentTo: '2026-10-31',
        previousFrom: '2026-09-01',
        previousTo: '2026-09-30',
      });

      expect(result.converted).toBe(true);
      expect(result.current.total).toBe(150);
      expect(result.previous.total).toBe(100);
      expect(result.delta.totalAbs).toBe(50);
      expect(result.delta.totalPct).toBe(50);
      expect(result.delta.countAbs).toBe(1);
      expect(result.delta.countPct).toBe(50);
    });

    it('merges conversion status across both periods', async () => {
      mockRatesService.getRateTablesForRange
        .mockResolvedValueOnce(TABLES)
        .mockResolvedValueOnce([]);
      mockPrismaService.expense.findMany
        .mockResolvedValueOnce([row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' })])
        .mockResolvedValueOnce([row({ amount: new Prisma.Decimal('92.00'), currency: 'EUR' })]);

      const result = await service.getComparison(USER_A, {
        currentFrom: '2026-10-01',
        currentTo: '2026-10-31',
        previousFrom: '2026-09-01',
        previousTo: '2026-09-30',
      });

      expect(result.conversionStatus).toBe('partially_converted');
      expect(result.unconvertedCurrencies).toEqual(['EUR']);
      expect(result.current.total).toBe(100);
      expect(result.previous.total).toBeNull();
    });
  });

  describe('getTopExpenses', () => {
    it('returns expenses with per-line conversion provenance', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          id: 'e1',
          description: 'Rent',
          amount: new Prisma.Decimal('1000.00'),
          incurredOn: new Date('2026-10-01T00:00:00.000Z'),
          category: { name: 'Housing' },
        }),
        row({
          id: 'e2',
          description: 'Trip',
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date('2026-10-02T00:00:00.000Z'),
          category: { name: 'Travel' },
        }),
      ]);

      const result = await service.getTopExpenses(USER_A, { limit: 5 });

      expect(result.conversionStatus).toBe('converted');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].amountNative).toBe(1000);
      expect(result.items[0].amount).toBe(1000);
      expect(result.items[1].amount).toBe(100); // 92 EUR -> 100 USD
      expect(result.items[1].rateDate).toBe('2026-10-01');
      expect(result.items[1].ratePolicy).toBe('historical');
      expect(result.items[1].conversionStatus).toBe('converted');
      expect(result.items[1].convertedCurrency).toBe('USD');
    });

    it('marks unconvertible lines with null amounts and clear status', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          id: 'e1',
          description: 'Trip',
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date('2026-10-02T00:00:00.000Z'),
          category: null,
        }),
      ]);

      const result = await service.getTopExpenses(USER_A, {});

      expect(result.converted).toBe(false);
      expect(result.conversionStatus).toBe('unavailable');
      expect(result.unconvertedCurrencies).toEqual(['EUR']);
      expect(result.items[0].amount).toBeNull();
      expect(result.items[0].convertedAmount).toBeNull();
      expect(result.items[0].rateDate).toBeNull();
      expect(result.items[0].ratePolicy).toBeNull();
      expect(result.items[0].conversionStatus).toBe('unavailable');
    });
  });

  describe('getByDayOfWeek', () => {
    it('buckets totals into the seven UTC weekdays', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('10.00'),
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('20.00'),
          incurredOn: new Date('2026-10-06T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getByDayOfWeek(USER_A, {});

      expect(result.items).toHaveLength(7);
      const monday = result.items.find((entry) => entry.label === 'Mon');
      const tuesday = result.items.find((entry) => entry.label === 'Tue');
      expect(monday?.total).toBe(10);
      expect(monday?.count).toBe(1);
      expect(tuesday?.total).toBe(20);
      expect(result.items.find((entry) => entry.label === 'Sun')?.total).toBe(0);
      expect(result.conversionStatus).toBe('converted');
    });
  });

  describe('exportCsv', () => {
    it('emits a header and one quoted row per expense with rate provenance', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          description: 'Rent, "monthly"',
          amount: new Prisma.Decimal('1000.00'),
          currency: 'USD',
          incurredOn: new Date('2026-10-01T00:00:00.000Z'),
          category: { name: 'Housing' },
        },
        {
          description: 'Trip',
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date('2026-10-02T00:00:00.000Z'),
          category: { name: 'Travel' },
        },
      ]);

      const csv = await service.exportCsv(USER_A, {});
      const [header, row1, row2] = csv.split('\n');

      expect(header).toBe(
        'Date,Description,Category,Amount,Currency,BaseAmount,BaseCurrency,Converted,RateDate,RatePolicy,ConversionStatus',
      );
      expect(row1).toContain('2026-10-01');
      expect(row1).toContain('Rent, ""monthly""');
      expect(row1).toContain('1000.00,USD,1000.00,USD,true,,historical,converted');
      // EUR row carries the true snapshot date and an explicit policy.
      expect(row2).toContain('92.00,EUR,100.00,USD,true,2026-10-01,historical,converted');
    });

    it('adds secondary columns when a second currency is requested', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([
        {
          version: 1,
          baseCurrency: 'USD',
          effectiveDate: '2026-10-01',
          provider: 'mock',
          rates: { USD: '1.000000', EUR: '0.920000', INR: '83.000000' },
        },
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          description: 'Rent',
          amount: new Prisma.Decimal('100.00'),
          currency: 'USD',
          incurredOn: new Date('2026-10-01T00:00:00.000Z'),
          category: { name: 'Housing' },
        },
        {
          description: 'Trip',
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date('2026-10-02T00:00:00.000Z'),
          category: { name: 'Travel' },
        },
      ]);

      const csv = await service.exportCsv(USER_A, { secondary: 'INR' });
      const [header, row1, row2] = csv.split('\n');

      expect(header.endsWith('ConversionStatus,SecondaryAmount,SecondaryCurrency')).toBe(true);
      // A base-currency row needs no rate for the base value, but still gets a
      // secondary value from the same snapshot: 100 USD * 83.
      expect(row1).toContain('100.00,USD,100.00,USD,true,,historical,converted,8300.00,INR');
      // 92 EUR -> 100 USD -> 8300 INR, at the row's own snapshot date.
      expect(row2).toContain(
        '92.00,EUR,100.00,USD,true,2026-10-01,historical,converted,8300.00,INR',
      );
    });
  });

  describe('getBudgetStatus', () => {
    const foodCategory = { id: 'cat-1', name: 'Food', color: '#f59e0b' };

    function budget(overrides: Record<string, unknown> = {}) {
      return {
        id: 'budget-1',
        userId: USER_A,
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: 'USD',
        period: BudgetPeriod.MONTHLY,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        category: foodCategory,
        ...overrides,
      };
    }

    it('compares spend against budget for the requested month', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('60.00'),
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('20.00'),
          incurredOn: new Date('2026-10-07T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('30.00'),
          categoryId: 'cat-2',
          incurredOn: new Date('2026-10-08T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.spent).toBe(80);
      expect(item.budgetAmount).toBe(100);
      expect(item.remaining).toBe(20);
      expect(item.percentage).toBe(80);
      expect(item.overBudget).toBe(false);
      expect(item.applied).toBe(true);
      expect(item.currency).toBe('USD');
      expect(item.convertedAmount).toBe(100);
      expect(item.convertedCurrency).toBe('USD');
      expect(item.conversionStatus).toBe('converted');
      expect(result.conversionStatus).toBe('converted');
    });

    it('converts a foreign-currency budget target at the window start', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([
        budget({ currency: 'EUR', amount: new Prisma.Decimal('92.00') }),
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.budgetAmount).toBe(100);
      expect(item.convertedAmount).toBe(100);
      expect(item.currency).toBe('USD');
      expect(item.rateDate).toBe('2026-10-01');
      expect(item.ratePolicy).toBe('historical');
    });

    it('excludes spending that falls outside the evaluated month', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('60.00'),
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('500.00'),
          incurredOn: new Date('2026-11-05T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });

      expect(result.items[0].spent).toBe(60);
    });

    it('flags over-budget spending', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('150.00'),
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
      ]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.overBudget).toBe(true);
      expect(item.remaining).toBe(-50);
      expect(item.percentage).toBe(150);
    });

    it('an overall budget counts every category', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([
        budget({ id: 'budget-2', categoryId: null, category: null }),
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('60.00'),
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('30.00'),
          categoryId: 'cat-2',
          incurredOn: new Date('2026-10-06T00:00:00.000Z'),
        }),
      ]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.categoryId).toBeNull();
      expect(item.spent).toBe(90);
    });

    it('marks a budget that starts after the window as not yet applied', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([
        budget({ startDate: new Date('2026-11-01T00:00:00.000Z') }),
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.applied).toBe(false);
      expect(item.spent).toBe(0);
    });

    it('keeps spend native and marks the item unavailable when rates are missing', async () => {
      mockRatesService.getRateTablesForRange.mockResolvedValue([]);
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        row({
          amount: new Prisma.Decimal('75.00'),
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        }),
        row({
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          incurredOn: new Date('2026-10-06T00:00:00.000Z'),
        }),
      ]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });
      const item = result.items[0];

      // Only the base-currency spend is comparable; EUR spend cannot be summed.
      expect(item.spent).toBe(75);
      expect(item.conversionStatus).toBe('unavailable');
      expect(item.convertedAmount).toBe(100); // budget target itself still converts (identity)
      expect(result.conversionStatus).toBe('partially_converted');
      expect(result.converted).toBe(false);
      expect(result.unconvertedCurrencies).toEqual(['EUR']);
    });

    it('returns an empty list without querying expenses when there are no budgets', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });

      expect(result.items).toEqual([]);
      expect(mockPrismaService.expense.findMany).not.toHaveBeenCalled();
      expect(result.conversionStatus).toBe('converted');
    });

    it('rejects a malformed month', async () => {
      await expect(service.getBudgetStatus(USER_A, { month: '2026-13' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
