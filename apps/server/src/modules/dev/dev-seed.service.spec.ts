import { Test, TestingModule } from '@nestjs/testing';
import { DevSeedService } from './dev-seed.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyConverter,
  CurrencyConverterService,
} from '../expenses/currency-converter.service';

const USER = 'dev-user-1';

describe('DevSeedService', () => {
  let service: DevSeedService;

  const mockPrismaService = {
    expense: {
      count: jest.fn(),
      createMany: jest.fn(),
    },
    expenseCategory: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    budget: {
      createMany: jest.fn(),
    },
  };

  const mockConverter = {
    defaultBaseCurrency: 'USD',
    tryGetConverter: jest.fn(),
  };

  // Base USD: 1 USD buys 0.92 EUR — enough to make `supportedCurrencies` meaningful.
  const USD_CONVERTER = new CurrencyConverter(
    'USD',
    { USD: '1', EUR: '0.92', GBP: '0.78' },
    '2026-10-09',
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.expense.count.mockResolvedValue(0);
    mockPrismaService.expenseCategory.findMany.mockResolvedValue([
      { id: 'cat-food', name: 'Food & Dining' },
      { id: 'cat-other', name: 'Other' },
    ]);
    mockConverter.tryGetConverter.mockResolvedValue(USD_CONVERTER);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevSeedService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CurrencyConverterService, useValue: mockConverter },
      ],
    }).compile();

    service = module.get<DevSeedService>(DevSeedService);
  });

  it('seeds expenses and budgets for a fresh account', async () => {
    await service.seedDemoData(USER);

    expect(mockPrismaService.expense.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrismaService.budget.createMany).toHaveBeenCalledTimes(1);

    const expenses = mockPrismaService.expense.createMany.mock.calls[0][0].data as Array<{
      userId: string;
      currency: string;
    }>;
    expect(expenses.length).toBeGreaterThan(0);
    expect(expenses.every((row) => row.userId === USER)).toBe(true);
    // Only currencies present in the snapshot may be seeded.
    expect(expenses.every((row) => ['USD', 'EUR', 'GBP'].includes(row.currency))).toBe(true);

    const budgets = mockPrismaService.budget.createMany.mock.calls[0][0].data as Array<{
      categoryId: string | null;
      currency: string;
    }>;
    expect(budgets).toHaveLength(2);
    expect(budgets.some((budget) => budget.categoryId === null)).toBe(true);
    expect(budgets.every((budget) => budget.currency === 'USD')).toBe(true);
  });

  it('creates the default categories when the account has none', async () => {
    mockPrismaService.expenseCategory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'cat-food', name: 'Food & Dining' }]);

    await service.seedDemoData(USER);

    expect(mockPrismaService.expenseCategory.createMany).toHaveBeenCalledTimes(1);
    const data = mockPrismaService.expenseCategory.createMany.mock.calls[0][0].data as unknown[];
    expect(data.length).toBeGreaterThan(0);
  });

  it('is idempotent — leaves an account that already has expenses untouched', async () => {
    mockPrismaService.expense.count.mockResolvedValue(5);

    await service.seedDemoData(USER);

    expect(mockPrismaService.expense.createMany).not.toHaveBeenCalled();
    expect(mockPrismaService.budget.createMany).not.toHaveBeenCalled();
    expect(mockPrismaService.expenseCategory.createMany).not.toHaveBeenCalled();
  });

  it('falls back to the base currency when no snapshot is available', async () => {
    mockConverter.tryGetConverter.mockResolvedValue(null);

    await service.seedDemoData(USER);

    const expenses = mockPrismaService.expense.createMany.mock.calls[0][0].data as Array<{
      currency: string;
    }>;
    expect(expenses.every((row) => row.currency === 'USD')).toBe(true);
  });
});
