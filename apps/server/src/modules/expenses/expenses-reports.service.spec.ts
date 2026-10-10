import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { ExpensesReportsService } from './expenses-reports.service';
import { CurrencyConverter, CurrencyConverterService } from './currency-converter.service';
import { PrismaService } from '../../database/prisma.service';
import { trailingMonths } from './expenses.utils';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Base USD: 1 USD buys 0.92 EUR, so 92 EUR converts to exactly 100 USD.
const USD_CONVERTER = new CurrencyConverter('USD', { USD: '1', EUR: '0.92' }, '2026-10-09');

describe('ExpensesReportsService', () => {
  let service: ExpensesReportsService;

  const mockPrismaService = {
    expense: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    expenseCategory: {
      findMany: jest.fn(),
    },
    budget: {
      findMany: jest.fn(),
    },
  };

  const mockConverter = {
    resolveBase: jest.fn(),
    tryGetConverter: jest.fn(),
    supportedCurrencies: ['USD', 'EUR'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConverter.resolveBase.mockImplementation((base?: string) => (base ?? 'USD').toUpperCase());
    mockConverter.tryGetConverter.mockResolvedValue(USD_CONVERTER);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CurrencyConverterService, useValue: mockConverter },
      ],
    }).compile();

    service = module.get<ExpensesReportsService>(ExpensesReportsService);
  });

  describe('getSummary', () => {
    const groups = [
      {
        categoryId: 'cat-1',
        currency: 'USD',
        _sum: { amount: new Prisma.Decimal('100.00') },
        _count: { _all: 5 },
      },
      {
        categoryId: 'cat-1',
        currency: 'EUR',
        _sum: { amount: new Prisma.Decimal('92.00') },
        _count: { _all: 3 },
      },
      {
        categoryId: 'cat-2',
        currency: 'USD',
        _sum: { amount: new Prisma.Decimal('50.00') },
        _count: { _all: 2 },
      },
    ];

    beforeEach(() => {
      mockPrismaService.expense.groupBy.mockResolvedValue(groups);
      mockPrismaService.expenseCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Food', color: '#f59e0b' },
        { id: 'cat-2', name: 'Transport', color: '#3b82f6' },
      ]);
    });

    it('folds multiple currencies together per category using the base as pivot', async () => {
      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      // cat-1: 100 USD + 92 EUR (92/0.92 = 100) = 200
      const food = result.byCategory.find((c) => c.categoryId === 'cat-1');
      expect(food?.total).toBe(200);
      expect(food?.count).toBe(8);
      expect(result.total).toBe(250);
      expect(result.count).toBe(10);
      expect(result.average).toBe(25);
    });

    it('computes category shares that sum to 100', async () => {
      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.byCategory.map((c) => c.percentage)).toEqual([80, 20]);
      expect(result.byCategory.reduce((s, c) => s + c.percentage, 0)).toBe(100);
      expect(result.byCategory.map((c) => c.total).reduce((s, t) => s + t, 0)).toBe(result.total);
    });

    it('sorts the breakdown largest first', async () => {
      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.byCategory[0].categoryName).toBe('Food');
      expect(result.byCategory[0].color).toBe('#f59e0b');
    });

    it('reports native subtotals per currency alongside converted totals', async () => {
      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.byCurrency).toEqual([
        { currency: 'USD', total: 150, count: 7 },
        { currency: 'EUR', total: 92, count: 3 },
      ]);
      expect(result.converted).toBe(true);
      expect(result.baseCurrency).toBe('USD');
    });

    it('scopes the aggregate to the caller', async () => {
      await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(mockPrismaService.expense.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: USER_A }) }),
      );
    });

    it('defaults to the current calendar month', async () => {
      const now = new Date();
      const expectedFrom = `${now.toISOString().slice(0, 7)}-01`;

      const result = await service.getSummary(USER_A, {});

      expect(result.from).toBe(expectedFrom);
    });

    it('degrades to null totals when no rate snapshot is available', async () => {
      mockConverter.tryGetConverter.mockResolvedValue(null);

      const result = await service.getSummary(USER_A, { from: '2026-10-01', to: '2026-10-31' });

      expect(result.converted).toBe(false);
      expect(result.conversionUnavailableReason).toBeTruthy();
      expect(result.total).toBeNull();
      expect(result.average).toBeNull();
      expect(result.byCategory).toEqual([]);
      // Native figures are still useful and always safe to report.
      expect(result.count).toBe(10);
      expect(result.byCurrency).toHaveLength(2);
    });

    it('rejects an unsupported base currency', async () => {
      mockConverter.resolveBase.mockImplementation(() => {
        throw new BadRequestException("Unsupported currency 'XYZ'");
      });

      await expect(service.getSummary(USER_A, { base: 'XYZ' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getTrends', () => {
    it('returns a continuous, zero-filled series oldest first', async () => {
      const months = trailingMonths(3);
      const [prev, current] = [months[months.length - 2], months[months.length - 1]];

      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('10.00'),
          currency: 'USD',
          incurredOn: new Date(`${current}-05T00:00:00.000Z`),
        },
        {
          amount: new Prisma.Decimal('9.20'),
          currency: 'EUR',
          incurredOn: new Date(`${current}-06T00:00:00.000Z`),
        },
        {
          amount: new Prisma.Decimal('20.00'),
          currency: 'USD',
          incurredOn: new Date(`${prev}-15T00:00:00.000Z`),
        },
      ]);

      const result = await service.getTrends(USER_A, { months: 3 });

      expect(result.points.map((p) => p.month)).toEqual(months);
      expect(result.months).toBe(3);
      // Current month: 10 USD + 9.2 EUR (=10 USD) = 20 across two expenses.
      expect(result.points[2]).toEqual({ month: current, total: 20, count: 2 });
      expect(result.points[1]).toEqual({ month: prev, total: 20, count: 1 });
      // The oldest bucket had no activity but must still be present for the axis.
      expect(result.points[0]).toEqual({ month: months[0], total: 0, count: 0 });
      expect(result.converted).toBe(true);
    });

    it('only queries the covered date window', async () => {
      const months = trailingMonths(6);
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      await service.getTrends(USER_A, { months: 6 });

      const where = mockPrismaService.expense.findMany.mock.calls[0][0].where;
      expect(where.incurredOn.gte.toISOString().slice(0, 7)).toBe(months[0]);
      expect(where.incurredOn.lte.toISOString().slice(0, 7)).toBe(months[5]);
    });

    it('returns null totals when conversion is unavailable', async () => {
      mockConverter.tryGetConverter.mockResolvedValue(null);
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      const result = await service.getTrends(USER_A, { months: 2 });

      expect(result.converted).toBe(false);
      expect(result.conversionUnavailableReason).toBeTruthy();
      expect(result.points.every((p) => p.total === null)).toBe(true);
      expect(result.points.every((p) => p.count === 0)).toBe(true);
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
        {
          amount: new Prisma.Decimal('60.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
        {
          amount: new Prisma.Decimal('20.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-07T00:00:00.000Z'),
        },
        {
          amount: new Prisma.Decimal('30.00'),
          currency: 'USD',
          categoryId: 'cat-2',
          incurredOn: new Date('2026-10-08T00:00:00.000Z'),
        },
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
    });

    it('excludes spending that falls outside the evaluated month', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('60.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
        {
          amount: new Prisma.Decimal('500.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-11-05T00:00:00.000Z'),
        },
      ]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });

      expect(result.items[0].spent).toBe(60);
    });

    it('flags over-budget spending', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('150.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
      ]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.overBudget).toBe(true);
      expect(item.remaining).toBe(-50);
      expect(item.percentage).toBe(150);
    });

    it('converts spend recorded in other currencies into the base', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('46.00'),
          currency: 'EUR',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
      ]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      // 46 EUR / 0.92 = 50 USD
      expect(item.spent).toBe(50);
    });

    it('an overall budget counts every category', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([
        budget({ id: 'budget-2', categoryId: null, category: null }),
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('60.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
        {
          amount: new Prisma.Decimal('30.00'),
          currency: 'USD',
          categoryId: 'cat-2',
          incurredOn: new Date('2026-10-06T00:00:00.000Z'),
        },
      ]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.categoryId).toBeNull();
      expect(item.spent).toBe(90);
    });

    it('does not charge spend that happened before the budget start date', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([
        budget({ startDate: new Date('2026-10-15T00:00:00.000Z') }),
      ]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('40.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
        {
          amount: new Prisma.Decimal('10.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-20T00:00:00.000Z'),
        },
      ]);

      const item = (await service.getBudgetStatus(USER_A, { month: '2026-10' })).items[0];

      expect(item.spent).toBe(10);
      expect(item.applied).toBe(true);
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

    it('falls back to native-currency comparison when rates are unavailable', async () => {
      mockConverter.tryGetConverter.mockResolvedValue(null);
      mockPrismaService.budget.findMany.mockResolvedValue([budget()]);
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('75.00'),
          currency: 'USD',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-05T00:00:00.000Z'),
        },
        // EUR spend cannot be compared without rates and must not be double-counted.
        {
          amount: new Prisma.Decimal('92.00'),
          currency: 'EUR',
          categoryId: 'cat-1',
          incurredOn: new Date('2026-10-06T00:00:00.000Z'),
        },
      ]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });

      expect(result.converted).toBe(false);
      expect(result.conversionUnavailableReason).toBeTruthy();
      expect(result.items[0].spent).toBe(75);
      expect(result.items[0].currency).toBe('USD');
    });

    it('returns an empty list without querying expenses when there are no budgets', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([]);

      const result = await service.getBudgetStatus(USER_A, { month: '2026-10' });

      expect(result.items).toEqual([]);
      expect(mockPrismaService.expense.findMany).not.toHaveBeenCalled();
    });

    it('rejects a malformed month', async () => {
      await expect(service.getBudgetStatus(USER_A, { month: '2026-13' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
