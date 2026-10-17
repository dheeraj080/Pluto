import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { SyncService } from './sync.service';
import { CurrencyConverterService } from '../expenses/currency-converter.service';
import { PrismaService } from '../../database/prisma.service';
import { SyncChangeDto } from './dto/sync.dto';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXPENSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OTHER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const basePayload = {
  categoryId: CATEGORY_ID,
  amount: 12.5,
  currency: 'USD',
  description: 'Groceries',
  paymentMethod: 'CARD',
  incurredOn: '2026-10-03',
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

describe('SyncService', () => {
  let service: SyncService;

  const mockPrismaService = {
    expense: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    expenseCategory: { findFirst: jest.fn() },
  };

  const mockConverter = { assertValidCode: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConverter.assertValidCode.mockImplementation((currency: string) =>
      currency.trim().toUpperCase(),
    );
    mockPrismaService.expenseCategory.findFirst.mockResolvedValue({ id: CATEGORY_ID });
    mockPrismaService.expense.upsert.mockResolvedValue({
      updatedAt: new Date('2026-10-03T10:00:00.000Z'),
    });
    mockPrismaService.expense.update.mockResolvedValue({
      updatedAt: new Date('2026-10-03T10:00:00.000Z'),
    });

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
