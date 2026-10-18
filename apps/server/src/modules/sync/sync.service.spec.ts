import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { SyncService } from './sync.service';
import { CurrencyConverterService } from '../expenses/currency-converter.service';
import { PrismaService } from '../../database/prisma.service';
import { SyncChangeDto } from './dto/sync.dto';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXPENSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BUDGET_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const OTHER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECURRING_ID = 'abababab-abab-4aba-8aba-abababababab';

const basePayload = {
  categoryId: CATEGORY_ID,
  amount: 12.5,
  currency: 'USD',
  description: 'Groceries',
  paymentMethod: 'CARD',
  incurredOn: '2026-10-03',
};

const baseBudgetPayload = {
  categoryId: CATEGORY_ID,
  amount: 400,
  currency: 'USD',
  period: 'MONTHLY' as const,
  startDate: '2026-10-01',
};

function makeChange(overrides: Partial<SyncChangeDto> = {}): SyncChangeDto {
  return {
    entity: 'expense',
    id: EXPENSE_ID,
    op: 'create',
    clientUpdatedAt: '2026-10-03T09:00:00.000Z',
    data: { ...basePayload },
    ...overrides,
  };
}

function makeBudgetChange(overrides: Partial<SyncChangeDto> = {}): SyncChangeDto {
  return {
    entity: 'budget',
    id: BUDGET_ID,
    op: 'create',
    clientUpdatedAt: '2026-10-03T09:00:00.000Z',
    data: { ...baseBudgetPayload },
    ...overrides,
  };
}

const baseCategoryPayload = {
  name: 'Groceries',
  color: '#f59e0b',
  icon: null,
  sortOrder: 0,
};

function makeCategoryChange(overrides: Partial<SyncChangeDto> = {}): SyncChangeDto {
  return {
    entity: 'category',
    id: CATEGORY_ID,
    op: 'create',
    clientUpdatedAt: '2026-10-03T09:00:00.000Z',
    data: { ...baseCategoryPayload },
    ...overrides,
  };
}

describe('SyncService', () => {
  let service: SyncService;

  const mockPrismaService = {
    expense: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    budget: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    expenseCategory: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    recurringExpense: { findFirst: jest.fn() },
  };

  const mockConverter = { assertValidCode: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConverter.assertValidCode.mockImplementation((currency: string) =>
      currency.trim().toUpperCase(),
    );
    mockPrismaService.expenseCategory.findFirst.mockResolvedValue({ id: CATEGORY_ID });
    mockPrismaService.recurringExpense.findFirst.mockResolvedValue({ id: RECURRING_ID });
    mockPrismaService.expense.upsert.mockResolvedValue({
      updatedAt: new Date('2026-10-03T10:00:00.000Z'),
    });
    mockPrismaService.expense.update.mockResolvedValue({
      updatedAt: new Date('2026-10-03T10:00:00.000Z'),
    });
    mockPrismaService.budget.findUnique.mockResolvedValue(null);
    mockPrismaService.budget.findFirst.mockResolvedValue(null);
    mockPrismaService.budget.upsert.mockResolvedValue({
      updatedAt: new Date('2026-10-03T10:00:00.000Z'),
    });
    mockPrismaService.budget.delete.mockResolvedValue({ id: BUDGET_ID });
    mockPrismaService.expenseCategory.findUnique.mockResolvedValue(null);
    mockPrismaService.expenseCategory.upsert.mockResolvedValue({
      updatedAt: new Date('2026-10-03T10:00:00.000Z'),
    });
    mockPrismaService.expenseCategory.delete.mockResolvedValue({ id: CATEGORY_ID });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CurrencyConverterService, useValue: mockConverter },
      ],
    }).compile();

    service = module.get(SyncService);
  });

  describe('push', () => {
    it('creates a client-identified expense on first push', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);

      const result = await service.push(USER_A, [makeChange()]);

      expect(mockPrismaService.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EXPENSE_ID },
          create: expect.objectContaining({
            id: EXPENSE_ID,
            userId: USER_A,
            categoryId: CATEGORY_ID,
            currency: 'USD',
            clientUpdatedAt: new Date('2026-10-03T09:00:00.000Z'),
          }),
        }),
      );
      expect(result.results[0]).toMatchObject({ id: EXPENSE_ID, status: 'applied' });
      expect(typeof result.cursor).toBe('string');
    });

    it('clears a tombstone when a newer write arrives', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      await service.push(USER_A, [makeChange({ op: 'update' })]);

      const args = mockPrismaService.expense.upsert.mock.calls[0][0];
      expect(args.update.deletedAt).toBeNull();
    });

    it('skips a stale replay via last-write-wins', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-05T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeChange()]);

      expect(mockPrismaService.expense.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'skipped', reason: 'stale' });
    });

    it('is idempotent when an equal timestamp is replayed', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-03T09:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeChange()]);

      expect(result.results[0].status).toBe('skipped');
    });

    it("refuses to touch another account's expense", async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue({
        userId: USER_B,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeChange({ op: 'update' })]);

      expect(mockPrismaService.expense.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'failed', reason: 'not-found' });
    });

    it('tombstones a delete when the clock is newer', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeChange({ op: 'delete', data: undefined })]);

      const args = mockPrismaService.expense.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: EXPENSE_ID });
      expect(args.data.deletedAt).toBeInstanceOf(Date);
      expect(result.results[0].status).toBe('applied');
    });

    it('treats a delete for an unsynced row as a no-op', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);

      const result = await service.push(USER_A, [makeChange({ op: 'delete', data: undefined })]);

      expect(mockPrismaService.expense.update).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'applied', reason: 'noop' });
    });

    it('fails a change whose category is not owned by the caller', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      const result = await service.push(USER_A, [makeChange()]);

      expect(mockPrismaService.expense.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'failed' });
    });

    it('accepts an expense that references an owned recurring rule', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);

      const result = await service.push(USER_A, [
        makeChange({ data: { ...basePayload, recurringExpenseId: RECURRING_ID } }),
      ]);

      expect(mockPrismaService.recurringExpense.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: RECURRING_ID, userId: USER_A } }),
      );
      expect(mockPrismaService.expense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ recurringExpenseId: RECURRING_ID }),
        }),
      );
      expect(result.results[0]).toMatchObject({ status: 'applied' });
    });

    it('fails a change whose recurring rule is not owned by the caller', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValue(null);
      mockPrismaService.recurringExpense.findFirst.mockResolvedValue(null);

      const result = await service.push(USER_A, [
        makeChange({ data: { ...basePayload, recurringExpenseId: RECURRING_ID } }),
      ]);

      expect(mockPrismaService.expense.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({
        status: 'failed',
        reason: 'Recurring rule not found',
      });
    });

    it('keeps processing the rest of the batch after one failure', async () => {
      mockPrismaService.expense.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockPrismaService.expenseCategory.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: CATEGORY_ID });

      const result = await service.push(USER_A, [makeChange(), makeChange({ id: OTHER_ID })]);

      expect(result.results[0].status).toBe('failed');
      expect(result.results[1].status).toBe('applied');
    });
  });

  describe('push budgets', () => {
    it('upserts a client-identified budget', async () => {
      const result = await service.push(USER_A, [makeBudgetChange()]);

      expect(mockPrismaService.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BUDGET_ID },
          create: expect.objectContaining({
            id: BUDGET_ID,
            userId: USER_A,
            categoryId: CATEGORY_ID,
            currency: 'USD',
            period: 'MONTHLY',
            clientUpdatedAt: new Date('2026-10-03T09:00:00.000Z'),
          }),
        }),
      );
      expect(result.results[0]).toMatchObject({ id: BUDGET_ID, status: 'applied' });
    });

    it('allows an overall budget with no category', async () => {
      const result = await service.push(USER_A, [
        makeBudgetChange({ data: { ...baseBudgetPayload, categoryId: null } }),
      ]);

      expect(mockPrismaService.expenseCategory.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.budget.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ categoryId: null }) }),
      );
      expect(result.results[0].status).toBe('applied');
    });

    it('skips a stale replay via last-write-wins', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-05T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeBudgetChange()]);

      expect(mockPrismaService.budget.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'skipped', reason: 'stale' });
    });

    it("refuses to touch another account's budget", async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue({
        userId: USER_B,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeBudgetChange({ op: 'update' })]);

      expect(mockPrismaService.budget.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'failed', reason: 'not-found' });
    });

    it('skips a create whose (category, period) slot is already taken', async () => {
      mockPrismaService.budget.findFirst.mockResolvedValue({ id: OTHER_ID });

      const result = await service.push(USER_A, [makeBudgetChange()]);

      expect(mockPrismaService.budget.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'skipped', reason: 'duplicate' });
    });

    it('hard-deletes a budget when the clock is newer', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [
        makeBudgetChange({ op: 'delete', data: undefined }),
      ]);

      expect(mockPrismaService.budget.delete).toHaveBeenCalledWith({ where: { id: BUDGET_ID } });
      expect(result.results[0].status).toBe('applied');
    });

    it('treats a delete for an unsynced budget as a no-op', async () => {
      const result = await service.push(USER_A, [
        makeBudgetChange({ op: 'delete', data: undefined }),
      ]);

      expect(mockPrismaService.budget.delete).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'applied', reason: 'noop' });
    });

    it('fails a budget whose category is not owned by the caller', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      const result = await service.push(USER_A, [makeBudgetChange()]);

      expect(mockPrismaService.budget.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'failed' });
    });
  });

  describe('push categories', () => {
    it('upserts a client-identified category', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      const result = await service.push(USER_A, [makeCategoryChange({ data: { ...baseCategoryPayload, name: '  Groceries  ' } })]);

      expect(mockPrismaService.expenseCategory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CATEGORY_ID },
          create: expect.objectContaining({
            id: CATEGORY_ID,
            userId: USER_A,
            name: 'Groceries',
            color: '#f59e0b',
            isDefault: false,
            clientUpdatedAt: new Date('2026-10-03T09:00:00.000Z'),
          }),
        }),
      );
      expect(result.results[0]).toMatchObject({ id: CATEGORY_ID, status: 'applied' });
    });

    it('skips a stale replay via last-write-wins', async () => {
      mockPrismaService.expenseCategory.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-05T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeCategoryChange()]);

      expect(mockPrismaService.expenseCategory.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'skipped', reason: 'stale' });
    });

    it("refuses to touch another account's category", async () => {
      mockPrismaService.expenseCategory.findUnique.mockResolvedValue({
        userId: USER_B,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [makeCategoryChange({ op: 'update' })]);

      expect(mockPrismaService.expenseCategory.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'failed', reason: 'not-found' });
    });

    it('skips a create whose name is already taken by another row', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue({ id: OTHER_ID });

      const result = await service.push(USER_A, [makeCategoryChange()]);

      expect(mockPrismaService.expenseCategory.upsert).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'skipped', reason: 'duplicate' });
    });

    it('treats a lost unique-index race as the same duplicate', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);
      mockPrismaService.expenseCategory.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.push(USER_A, [makeCategoryChange()]);

      expect(result.results[0]).toMatchObject({ status: 'skipped', reason: 'duplicate' });
    });

    it('hard-deletes a category when the clock is newer', async () => {
      mockPrismaService.expenseCategory.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });

      const result = await service.push(USER_A, [
        makeCategoryChange({ op: 'delete', data: undefined }),
      ]);

      expect(mockPrismaService.expenseCategory.delete).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID },
      });
      expect(result.results[0].status).toBe('applied');
    });

    it('treats a delete for an unsynced category as a no-op', async () => {
      const result = await service.push(USER_A, [
        makeCategoryChange({ op: 'delete', data: undefined }),
      ]);

      expect(mockPrismaService.expenseCategory.delete).not.toHaveBeenCalled();
      expect(result.results[0]).toMatchObject({ status: 'applied', reason: 'noop' });
    });

    it('fails an in-use delete (FK Restrict) so the device can restore the row', async () => {
      mockPrismaService.expenseCategory.findUnique.mockResolvedValue({
        userId: USER_A,
        clientUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });
      mockPrismaService.expenseCategory.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      const result = await service.push(USER_A, [
        makeCategoryChange({ op: 'delete', data: undefined }),
      ]);

      expect(result.results[0]).toMatchObject({ status: 'failed', reason: 'in-use' });
    });
  });

  describe('pull', () => {
    it('returns a full snapshot when since is omitted', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      const result = await service.pull(USER_A);

      expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_A } }),
      );
      expect(result.expenses).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('returns tombstones and the next cursor', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([
        {
          id: EXPENSE_ID,
          categoryId: CATEGORY_ID,
          amount: new Prisma.Decimal('12.50'),
          currency: 'USD',
          description: 'Groceries',
          incurredOn: new Date('2026-10-03T00:00:00.000Z'),
          paymentMethod: 'CARD',
          recurringExpenseId: null,
          clientUpdatedAt: new Date('2026-10-03T09:00:00.000Z'),
          updatedAt: new Date('2026-10-03T10:00:00.000Z'),
          deletedAt: new Date('2026-10-03T10:00:00.000Z'),
        },
      ]);

      const result = await service.pull(USER_A, '2026-10-03T09:00:00.000Z');

      expect(result.expenses[0].deletedAt).toBe('2026-10-03T10:00:00.000Z');
      expect(result.expenses[0].incurredOn).toBe('2026-10-03');
      expect(result.expenses[0].amount).toBe(12.5);
      expect(result.cursor).toBe('2026-10-03T10:00:00.000Z');
    });

    it('only selects rows changed after the cursor', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([]);

      await service.pull(USER_A, '2026-10-03T09:00:00.000Z');

      expect(mockPrismaService.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A, updatedAt: { gt: new Date('2026-10-03T09:00:00.000Z') } },
        }),
      );
    });

    it('flags hasMore when a page is full', async () => {
      const rows = Array.from({ length: 500 }, (_, i) => ({
        id: `expense-${i}`,
        categoryId: CATEGORY_ID,
        amount: new Prisma.Decimal('1.00'),
        currency: 'USD',
        description: null,
        incurredOn: new Date('2026-10-03T00:00:00.000Z'),
        paymentMethod: null,
        recurringExpenseId: null,
        clientUpdatedAt: new Date('2026-10-03T09:00:00.000Z'),
        updatedAt: new Date('2026-10-03T10:00:00.000Z'),
        deletedAt: null,
      }));
      mockPrismaService.expense.findMany.mockResolvedValue(rows);

      const result = await service.pull(USER_A);

      expect(result.hasMore).toBe(true);
      expect(result.expenses).toHaveLength(500);
    });
  });
});
