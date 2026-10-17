import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BudgetPeriod, Prisma, RecurrenceFrequency } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { CurrencyConverterService } from './currency-converter.service';
import { PrismaService } from '../../database/prisma.service';
import { ExpenseQueryDto } from './dto/expense-query.dto';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    userId: USER_A,
    name: 'Food & Dining',
    color: '#f59e0b',
    icon: 'utensils',
    isDefault: true,
    sortOrder: 10,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    _count: { expenses: 0 },
    ...overrides,
  };
}

function makeExpense(overrides: Record<string, unknown> = {}) {
  const category = overrides.category ?? { name: 'Food & Dining', color: '#f59e0b' };
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    userId: USER_A,
    categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    amount: new Prisma.Decimal('12.50'),
    currency: 'USD',
    description: 'Groceries',
    incurredOn: new Date('2026-10-03T00:00:00.000Z'),
    paymentMethod: 'CARD',
    recurringExpenseId: null,
    createdAt: new Date('2026-10-03T09:00:00.000Z'),
    updatedAt: new Date('2026-10-03T09:00:00.000Z'),
    category,
    ...overrides,
  };
}

describe('ExpensesService', () => {
  let service: ExpensesService;

  const mockPrismaService = {
    expenseCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    budget: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    recurringExpense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    recurringExpenseOccurrence: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    // `jest.fn()` + `.mockImplementation` rather than an inline function: the
    // latter makes the mock's type infer from a body that references its own
    // initializer, which TypeScript reports as TS7022.
    $transaction: jest.fn().mockImplementation(async (arg: unknown): Promise<unknown> => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') return arg(mockPrismaService);
      return arg;
    }),
  };

  const mockConverter = {
    assertSupported: jest.fn(),
    assertValidCode: jest.fn(),
    resolveBase: jest.fn(),
    tryGetConverter: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConverter.assertSupported.mockImplementation((currency: string) => {
      const code = currency.trim().toUpperCase();
      if (!['USD', 'EUR', 'JPY'].includes(code)) {
        throw new Error(`Unsupported currency '${currency}'`);
      }
      return code;
    });
    // Recording accepts any syntactically plausible code; only invalid shapes throw.
    mockConverter.assertValidCode.mockImplementation((currency: string) => {
      const code = currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        throw new Error(`'${currency}' is not a valid ISO 4217 currency code`);
      }
      return code;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CurrencyConverterService, useValue: mockConverter },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('listCategories', () => {
    it('seeds defaults on first read for an empty account', async () => {
      mockPrismaService.expenseCategory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([makeCategory()]);

      const result = await service.listCategories(USER_A);

      expect(mockPrismaService.expenseCategory.create).toHaveBeenCalledTimes(7);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Food & Dining',
        expenseCount: 0,
        isDefault: true,
      });
    });

    it('does not seed when categories already exist', async () => {
      mockPrismaService.expenseCategory.findMany.mockResolvedValue([makeCategory()]);

      const result = await service.listCategories(USER_A);

      expect(mockPrismaService.expenseCategory.create).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('scopes the category query to the caller', async () => {
      mockPrismaService.expenseCategory.findMany.mockResolvedValue([]);

      await service.listCategories(USER_B);

      expect(mockPrismaService.expenseCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_B } }),
      );
    });
  });

  describe('createCategory', () => {
    it('rejects a duplicate name', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());

      await expect(service.createCategory(USER_A, { name: 'Food & Dining' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('trims the name and applies a default colour', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);
      mockPrismaService.expenseCategory.create.mockResolvedValue(makeCategory({ name: 'Travel' }));

      const result = await service.createCategory(USER_A, { name: '  Travel  ' });

      expect(mockPrismaService.expenseCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Travel', color: '#34d399', isDefault: false }),
        }),
      );
      expect(result.name).toBe('Travel');
    });
  });

  describe('createExpense', () => {
    it('rejects an unknown category with 404', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createExpense(USER_A, {
          categoryId: '00000000-0000-4000-8000-000000000000',
          amount: 10,
          currency: 'USD',
          incurredOn: '2026-10-10',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('normalises the currency before persisting', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.create.mockResolvedValue(makeExpense({ currency: 'EUR' }));

      await service.createExpense(USER_A, {
        categoryId: makeCategory().id,
        amount: 12.5,
        currency: 'eur',
        incurredOn: '2026-10-03',
      });

      expect(mockConverter.assertValidCode).toHaveBeenCalledWith('eur');
      expect(mockPrismaService.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'EUR' }) }),
      );
    });

    it('accepts a valid ISO code the rate provider cannot convert', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.create.mockResolvedValue(makeExpense({ currency: 'THB' }));

      const dto = await service.createExpense(USER_A, {
        categoryId: makeCategory().id,
        amount: 500,
        currency: 'THB',
        incurredOn: '2026-10-03',
      });

      expect(mockConverter.assertValidCode).toHaveBeenCalledWith('THB');
      expect(mockPrismaService.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currency: 'THB' }) }),
      );
      expect(dto.currency).toBe('THB');
    });

    it('rejects a structurally invalid currency code', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());

      await expect(
        service.createExpense(USER_A, {
          categoryId: makeCategory().id,
          amount: 10,
          currency: 'X', // too short
          incurredOn: '2026-10-03',
        }),
      ).rejects.toThrow(/not a valid ISO 4217/);
    });

    it('stores the amount as an exact two-decimal Decimal', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.create.mockResolvedValue(makeExpense());

      await service.createExpense(USER_A, {
        categoryId: makeCategory().id,
        amount: 12.5,
        currency: 'USD',
        incurredOn: '2026-10-03',
      });

      const data = mockPrismaService.expense.create.mock.calls[0][0].data;
      expect(data.amount).toBeInstanceOf(Prisma.Decimal);
      expect(data.amount.toFixed(2)).toBe('12.50');
      expect(data.incurredOn.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    });

    it('serialises Decimal and Date values into plain JSON types', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.create.mockResolvedValue(makeExpense());

      const dto = await service.createExpense(USER_A, {
        categoryId: makeCategory().id,
        amount: 12.5,
        currency: 'USD',
        incurredOn: '2026-10-03',
      });

      expect(dto.amount).toBe(12.5);
      expect(dto.incurredOn).toBe('2026-10-03');
      expect(dto.categoryName).toBe('Food & Dining');
      expect(typeof dto.createdAt).toBe('object');
    });
  });

  describe('createExpense with an inline recurrence', () => {
    it('records the expense, seeds a rule and a confirmed occurrence', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.create.mockResolvedValue(makeExpense());
      mockPrismaService.expense.update.mockResolvedValue(
        makeExpense({ recurringExpenseId: 'dddddddd-0000-4000-8000-000000000001' }),
      );
      mockPrismaService.recurringExpense.create.mockResolvedValue({
        id: 'dddddddd-0000-4000-8000-000000000001',
      });
      mockPrismaService.recurringExpenseOccurrence.create.mockResolvedValue({});

      const dto = await service.createExpense(USER_A, {
        categoryId: makeCategory().id,
        amount: 12.5,
        currency: 'USD',
        incurredOn: '2020-01-15',
        recurrence: { frequency: RecurrenceFrequency.MONTHLY },
      });

      // The expense is linked back to the rule it seeded.
      expect(mockPrismaService.expense.update.mock.calls[0][0].data).toEqual({
        recurringExpenseId: 'dddddddd-0000-4000-8000-000000000001',
      });
      expect(dto.recurringExpenseId).toBe('dddddddd-0000-4000-8000-000000000001');

      // The rule copies the expense snapshot and anchors on its incurred date.
      const ruleData = mockPrismaService.recurringExpense.create.mock.calls[0][0].data;
      expect(ruleData.frequency).toBe(RecurrenceFrequency.MONTHLY);
      expect(ruleData.interval).toBe(1);
      expect(ruleData.startDate.toISOString()).toBe('2020-01-15T00:00:00.000Z');

      // The first occurrence is the expense itself, already confirmed.
      const occurrenceData =
        mockPrismaService.recurringExpenseOccurrence.create.mock.calls[0][0].data;
      expect(occurrenceData.status).toBe('CONFIRMED');
      expect(occurrenceData.dueOn.toISOString()).toBe('2020-01-15T00:00:00.000Z');
      expect(occurrenceData.expenseId).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    });

    it('seeds the cursor to the current period so a back-dated expense does not back-fill', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.create.mockResolvedValue(makeExpense());
      mockPrismaService.expense.update.mockResolvedValue(
        makeExpense({ recurringExpenseId: 'dddddddd-0000-4000-8000-000000000001' }),
      );
      mockPrismaService.recurringExpense.create.mockResolvedValue({
        id: 'dddddddd-0000-4000-8000-000000000001',
      });
      mockPrismaService.recurringExpenseOccurrence.create.mockResolvedValue({});

      await service.createExpense(USER_A, {
        categoryId: makeCategory().id,
        amount: 12.5,
        currency: 'USD',
        // Years in the past: without the cursor clamp, generation would emit
        // every intervening month as a pending occurrence.
        incurredOn: '2020-01-15',
        recurrence: { frequency: RecurrenceFrequency.MONTHLY },
      });

      const ruleData = mockPrismaService.recurringExpense.create.mock.calls[0][0].data;
      const now = new Date();
      // The last day of the previous calendar month.
      const expectedCursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      expect(ruleData.lastGeneratedOn.toISOString()).toBe(expectedCursor.toISOString());
      expect(ruleData.lastGeneratedOn.getTime()).toBeGreaterThan(
        new Date('2020-01-15T00:00:00.000Z').getTime(),
      );
    });
  });

  describe('listExpenses', () => {
    const query = new ExpenseQueryDto();

    it('always scopes the filter to the caller', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);
      mockPrismaService.expense.count.mockResolvedValue(0);

      await service.listExpenses(USER_A, query);

      const where = mockPrismaService.expense.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe(USER_A);
    });

    it('applies filters and maps them to Prisma conditions', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);
      mockPrismaService.expense.count.mockResolvedValue(0);

      await service.listExpenses(USER_A, {
        ...new ExpenseQueryDto(),
        categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        currency: 'eur',
        search: 'lunch',
        from: '2026-10-01',
        to: '2026-10-31',
        minAmount: 5,
        maxAmount: 100,
      });

      const where = mockPrismaService.expense.findMany.mock.calls[0][0].where;
      expect(where.categoryId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      expect(where.currency).toBe('EUR');
      expect(where.description).toEqual({ contains: 'lunch', mode: 'insensitive' });
      expect(where.incurredOn).toEqual({
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-31T00:00:00.000Z'),
      });
      expect(where.amount).toEqual({ gte: 5, lte: 100 });
    });

    it('computes the offset from page and limit', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);
      mockPrismaService.expense.count.mockResolvedValue(0);

      const result = await service.listExpenses(USER_A, {
        ...new ExpenseQueryDto(),
        page: 3,
        limit: 10,
      });

      expect(mockPrismaService.expense.findMany.mock.calls[0][0].skip).toBe(20);
      expect(result).toMatchObject({ page: 3, limit: 10, total: 0 });
    });

    it('orders newest first by default', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);
      mockPrismaService.expense.count.mockResolvedValue(0);

      await service.listExpenses(USER_A, query);
      expect(mockPrismaService.expense.findMany.mock.calls[0][0].orderBy).toEqual([
        { incurredOn: 'desc' },
        { createdAt: 'desc' },
      ]);

      await service.listExpenses(USER_A, { ...new ExpenseQueryDto(), sort: 'amount_desc' });
      expect(mockPrismaService.expense.findMany.mock.calls[1][0].orderBy).toEqual([
        { amount: 'desc' },
        { id: 'asc' },
      ]);
    });
  });

  describe('ownership', () => {
    it("returns 404 for another user's expense rather than 403", async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(null);

      await expect(
        service.getExpense(USER_B, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.expense.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: expect.any(String), userId: USER_B } }),
      );
    });

    it('refuses to update a foreign expense', async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(null);

      await expect(
        service.updateExpense(USER_B, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', { amount: 1 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    it('refuses while expenses still reference it', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.count.mockResolvedValue(3);

      await expect(service.deleteCategory(USER_A, makeCategory().id)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.expenseCategory.delete).not.toHaveBeenCalled();
    });

    it('removes dependent budgets along with the category', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.count.mockResolvedValue(0);
      mockPrismaService.expenseCategory.delete.mockResolvedValue({});

      const result = await service.deleteCategory(USER_A, makeCategory().id);

      expect(mockPrismaService.budget.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.expenseCategory.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('moves the expenses to the target category before deleting', async () => {
      const targetId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      mockPrismaService.expenseCategory.findFirst
        .mockResolvedValueOnce(makeCategory())
        .mockResolvedValueOnce(makeCategory({ id: targetId, name: 'Travel', isDefault: false }));
      mockPrismaService.expense.count.mockResolvedValue(3);
      mockPrismaService.expense.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.budget.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.expenseCategory.delete.mockResolvedValue({});

      const result = await service.deleteCategory(USER_A, makeCategory().id, targetId);

      expect(mockPrismaService.expense.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_A, categoryId: makeCategory().id },
        data: { categoryId: targetId },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('refuses to reassign a category onto itself', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(makeCategory());
      mockPrismaService.expense.count.mockResolvedValue(1);

      await expect(
        service.deleteCategory(USER_A, makeCategory().id, makeCategory().id),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a target category the caller does not own', async () => {
      mockPrismaService.expenseCategory.findFirst
        .mockResolvedValueOnce(makeCategory())
        .mockResolvedValueOnce(null);
      mockPrismaService.expense.count.mockResolvedValue(2);

      await expect(
        service.deleteCategory(USER_A, makeCategory().id, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.expense.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('createBudget', () => {
    const baseBudget = {
      amount: 500,
      currency: 'USD',
      period: BudgetPeriod.MONTHLY,
      startDate: '2026-10-01',
    };

    it('rejects a duplicate (category, period) pair', async () => {
      mockPrismaService.budget.findFirst.mockResolvedValue({ id: 'x', category: { name: 'Food' } });

      await expect(
        service.createBudget(USER_A, {
          ...baseBudget,
          categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a second overall budget (null category) that the DB unique index cannot catch', async () => {
      // Postgres treats NULLs as distinct, so this must be caught in application code.
      mockPrismaService.budget.findFirst.mockResolvedValue({ id: 'x', category: null });

      await expect(service.createBudget(USER_A, baseBudget)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.budget.create).not.toHaveBeenCalled();
    });

    it('rejects a budget against a foreign category', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createBudget(USER_A, {
          ...baseBudget,
          categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps a lost create race to a conflict instead of a 500', async () => {
      // The pre-check saw nothing, but a concurrent create won the race and the
      // unique index rejected this one. That is the same conflict, so the
      // caller must still see a 409 rather than a 500.
      mockPrismaService.budget.findFirst.mockResolvedValue(null);
      mockPrismaService.budget.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['userId', 'period'] },
        }),
      );

      await expect(service.createBudget(USER_A, baseBudget)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.budget.create).toHaveBeenCalled();
    });

    it('does not swallow an unrelated create failure', async () => {
      mockPrismaService.budget.findFirst.mockResolvedValue(null);
      mockPrismaService.budget.create.mockRejectedValue(new Error('connection reset'));

      await expect(service.createBudget(USER_A, baseBudget)).rejects.toThrow('connection reset');
    });

    it('creates an overall budget when no category is given', async () => {
      mockPrismaService.budget.findFirst.mockResolvedValue(null);
      mockPrismaService.budget.create.mockResolvedValue({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        categoryId: null,
        category: null,
        amount: new Prisma.Decimal('500.00'),
        currency: 'USD',
        period: BudgetPeriod.MONTHLY,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const dto = await service.createBudget(USER_A, baseBudget);

      expect(mockPrismaService.budget.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ categoryId: null }) }),
      );
      expect(dto.categoryId).toBeNull();
      expect(dto.amount).toBe(500);
      expect(dto.startDate).toBe('2026-10-01');
    });
  });

  describe('updateBudget / deleteBudget', () => {
    it('404s when the budget belongs to someone else', async () => {
      mockPrismaService.budget.findFirst.mockResolvedValue(null);

      await expect(service.updateBudget(USER_B, 'id', { amount: 10 })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteBudget(USER_B, 'id')).rejects.toThrow(NotFoundException);
    });
  });
});
