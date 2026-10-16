import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OccurrenceStatus, Prisma, RecurrenceFrequency, RecurringRuleStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverterService } from './currency-converter.service';
import { ExpensesService } from './expenses.service';
import { RecurringExpensesService } from './recurring-expenses.service';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RULE_ID = '11111111-1111-4111-8111-111111111111';
const OCC_ID = '22222222-2222-4222-8222-222222222222';
const CAT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EXP_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: RULE_ID,
    userId: USER_A,
    categoryId: CAT_ID,
    amount: new Prisma.Decimal('1500'),
    currency: 'USD',
    description: 'Rent',
    paymentMethod: 'CARD',
    frequency: RecurrenceFrequency.MONTHLY,
    interval: 1,
    startDate: utc('2026-01-15'),
    endDate: null,
    status: RecurringRuleStatus.ACTIVE,
    lastGeneratedOn: utc('2026-09-30'),
    pausedAt: null,
    createdAt: utc('2026-01-01'),
    updatedAt: utc('2026-01-01'),
    category: { name: 'Housing', color: '#f59e0b' },
    ...overrides,
  };
}

function makeOccurrence(overrides: Record<string, unknown> = {}) {
  return {
    id: OCC_ID,
    recurringExpenseId: RULE_ID,
    dueOn: utc('2026-10-15'),
    status: OccurrenceStatus.PENDING,
    amount: new Prisma.Decimal('1500'),
    currency: 'USD',
    categoryId: CAT_ID,
    description: 'Rent',
    paymentMethod: 'CARD',
    expenseId: null,
    confirmedAt: null,
    createdAt: utc('2026-10-01'),
    ...overrides,
  };
}

const expenseDto = {
  id: EXP_ID,
  categoryId: CAT_ID,
  categoryName: 'Housing',
  categoryColor: '#f59e0b',
  amount: 1500,
  currency: 'USD',
  description: 'Rent',
  incurredOn: '2026-10-15',
  paymentMethod: 'CARD',
  recurringExpenseId: RULE_ID,
  createdAt: utc('2026-10-15'),
  updatedAt: utc('2026-10-15'),
};

describe('RecurringExpensesService', () => {
  let service: RecurringExpensesService;

  const mockPrisma = {
    recurringExpense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    recurringExpenseOccurrence: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    expenseCategory: { findFirst: jest.fn(), findMany: jest.fn() },
    expense: { updateMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (arg: unknown): Promise<unknown> => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === 'function') return arg(mockPrisma);
      return arg;
    }),
  };

  const mockConverter = {
    assertValidCode: jest.fn((currency: string) => currency.trim().toUpperCase()),
  };

  const mockExpensesService = { createExpenseRecord: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Freeze "today" so the no-back-fill cursor is deterministic.
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CurrencyConverterService, useValue: mockConverter },
        { provide: ExpensesService, useValue: mockExpensesService },
      ],
    }).compile();

    service = module.get<RecurringExpensesService>(RecurringExpensesService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createRule', () => {
    it('seeds the cursor so only the current period is generated, never a back-fill', async () => {
      mockPrisma.expenseCategory.findFirst.mockResolvedValue({ id: CAT_ID });
      mockPrisma.recurringExpense.create.mockResolvedValue(makeRule());
      mockPrisma.recurringExpenseOccurrence.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.recurringExpense.update.mockResolvedValue(makeRule());
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(makeRule());
      mockPrisma.recurringExpenseOccurrence.findMany.mockResolvedValue([
        { dueOn: utc('2026-10-15') },
      ]);

      const rule = await service.createRule(USER_A, {
        categoryId: CAT_ID,
        amount: 1500,
        currency: 'usd',
        frequency: RecurrenceFrequency.MONTHLY,
        startDate: '2026-01-15',
      });

      expect(mockPrisma.recurringExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            // Anchored in January, but the cursor starts at the current period.
            startDate: utc('2026-01-15'),
            lastGeneratedOn: utc('2026-09-30'),
            status: RecurringRuleStatus.ACTIVE,
          }),
        }),
      );
      expect(mockPrisma.recurringExpenseOccurrence.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ dueOn: utc('2026-10-15'), currency: 'USD' })],
          skipDuplicates: true,
        }),
      );
      expect(rule.pendingCount).toBe(1);
      expect(rule.nextDueOn).toBe('2026-10-15');
    });

    it('rejects an end date before the start date', async () => {
      mockPrisma.expenseCategory.findFirst.mockResolvedValue({ id: CAT_ID });

      await expect(
        service.createRule(USER_A, {
          categoryId: CAT_ID,
          amount: 10,
          currency: 'USD',
          frequency: RecurrenceFrequency.MONTHLY,
          startDate: '2026-10-01',
          endDate: '2026-09-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a category the caller does not own', async () => {
      mockPrisma.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createRule(USER_A, {
          categoryId: CAT_ID,
          amount: 10,
          currency: 'USD',
          frequency: RecurrenceFrequency.MONTHLY,
          startDate: '2026-10-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRule', () => {
    it('syncs pending occurrences to a payload edit while leaving history frozen', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(makeRule());
      mockPrisma.recurringExpense.update.mockResolvedValue(
        makeRule({ amount: new Prisma.Decimal('1600') }),
      );
      mockPrisma.recurringExpenseOccurrence.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.recurringExpenseOccurrence.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.recurringExpenseOccurrence.findMany.mockResolvedValue([]);

      await service.updateRule(USER_A, RULE_ID, { amount: 1600 });

      expect(mockPrisma.recurringExpenseOccurrence.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recurringExpenseId: RULE_ID, status: OccurrenceStatus.PENDING },
          data: expect.objectContaining({ amount: expect.anything() }),
        }),
      );
    });

    it('does not touch occurrences for a cadence-only edit', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(makeRule());
      mockPrisma.recurringExpense.update.mockResolvedValue(
        makeRule({ frequency: RecurrenceFrequency.WEEKLY }),
      );
      mockPrisma.recurringExpenseOccurrence.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.recurringExpenseOccurrence.findMany.mockResolvedValue([]);

      await service.updateRule(USER_A, RULE_ID, { frequency: RecurrenceFrequency.WEEKLY });

      expect(mockPrisma.recurringExpenseOccurrence.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('confirmOccurrence', () => {
    it('claims the occurrence and records an expense in one transaction', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(makeOccurrence());
      mockPrisma.recurringExpenseOccurrence.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.recurringExpenseOccurrence.update.mockResolvedValue(makeOccurrence());
      mockExpensesService.createExpenseRecord.mockResolvedValue(expenseDto);

      const result = await service.confirmOccurrence(USER_A, OCC_ID, {});

      expect(result).toBe(expenseDto);
      expect(mockPrisma.recurringExpenseOccurrence.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: OCC_ID, recurringExpense: { userId: USER_A } } }),
      );
      expect(mockPrisma.recurringExpenseOccurrence.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: OCC_ID, status: OccurrenceStatus.PENDING },
          data: expect.objectContaining({ status: OccurrenceStatus.CONFIRMED }),
        }),
      );
      expect(mockExpensesService.createExpenseRecord).toHaveBeenCalledWith(
        USER_A,
        expect.objectContaining({
          categoryId: CAT_ID,
          amount: 1500,
          currency: 'USD',
          incurredOn: utc('2026-10-15'),
          recurringExpenseId: RULE_ID,
        }),
        mockPrisma,
      );
      expect(mockPrisma.recurringExpenseOccurrence.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { expenseId: EXP_ID } }),
      );
    });

    it('applies overrides from the body', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(makeOccurrence());
      mockPrisma.recurringExpenseOccurrence.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.recurringExpenseOccurrence.update.mockResolvedValue(makeOccurrence());
      mockExpensesService.createExpenseRecord.mockResolvedValue(expenseDto);

      await service.confirmOccurrence(USER_A, OCC_ID, {
        amount: 1600,
        currency: 'eur',
        incurredOn: '2026-10-20',
      });

      expect(mockExpensesService.createExpenseRecord).toHaveBeenCalledWith(
        USER_A,
        expect.objectContaining({ amount: 1600, currency: 'EUR', incurredOn: utc('2026-10-20') }),
        mockPrisma,
      );
    });

    it('404s an occurrence that is not the caller’s', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(null);

      await expect(service.confirmOccurrence(USER_A, OCC_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s an occurrence that was already handled', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(
        makeOccurrence({ status: OccurrenceStatus.CONFIRMED }),
      );

      await expect(service.confirmOccurrence(USER_A, OCC_ID, {})).rejects.toThrow(
        ConflictException,
      );
      expect(mockExpensesService.createExpenseRecord).not.toHaveBeenCalled();
    });

    it('409s when another request wins the claim between read and write', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(makeOccurrence());
      mockPrisma.recurringExpenseOccurrence.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmOccurrence(USER_A, OCC_ID, {})).rejects.toThrow(
        ConflictException,
      );
      expect(mockExpensesService.createExpenseRecord).not.toHaveBeenCalled();
    });
  });

  describe('skipOccurrence', () => {
    it('marks a pending occurrence as skipped', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(makeOccurrence());
      mockPrisma.recurringExpenseOccurrence.update.mockResolvedValue(makeOccurrence());

      const result = await service.skipOccurrence(USER_A, OCC_ID);

      expect(result.success).toBe(true);
      expect(mockPrisma.recurringExpenseOccurrence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: OCC_ID },
          data: { status: OccurrenceStatus.SKIPPED },
        }),
      );
    });

    it('409s when the occurrence was already handled', async () => {
      mockPrisma.recurringExpenseOccurrence.findFirst.mockResolvedValue(
        makeOccurrence({ status: OccurrenceStatus.SKIPPED }),
      );

      await expect(service.skipOccurrence(USER_A, OCC_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteRule', () => {
    it('detaches the expenses it produced, then deletes the rule', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(makeRule());
      mockPrisma.expense.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.recurringExpense.delete.mockResolvedValue(makeRule());

      const result = await service.deleteRule(USER_A, RULE_ID);

      expect(result.success).toBe(true);
      expect(mockPrisma.expense.updateMany).toHaveBeenCalledWith({
        where: { recurringExpenseId: RULE_ID },
        data: { recurringExpenseId: null },
      });
      expect(mockPrisma.recurringExpense.delete).toHaveBeenCalledWith({ where: { id: RULE_ID } });
    });

    it('404s a rule that is not the caller’s', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(null);

      await expect(service.deleteRule(USER_A, RULE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('ensureGenerated', () => {
    it('catches every active rule up to today', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([makeRule()]);
      mockPrisma.recurringExpenseOccurrence.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.recurringExpense.update.mockResolvedValue(makeRule());

      await service.ensureGenerated(USER_A);

      expect(mockPrisma.recurringExpense.findMany).toHaveBeenCalledWith({
        where: { userId: USER_A, status: RecurringRuleStatus.ACTIVE },
      });
      expect(mockPrisma.recurringExpenseOccurrence.createMany).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the rule has no due occurrence in the window', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([
        makeRule({ startDate: utc('2026-12-01'), lastGeneratedOn: null }),
      ]);

      await service.ensureGenerated(USER_A);

      expect(mockPrisma.recurringExpenseOccurrence.createMany).not.toHaveBeenCalled();
    });
  });
});
