import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverterService } from '../expenses/currency-converter.service';
import { formatDate, toUtcDate } from '../expenses/expenses.utils';
import {
  SYNC_EPOCH,
  SyncBudgetPayloadDto,
  SyncChangeDto,
  SyncExpensePayloadDto,
  SyncPullResponseDto,
  SyncPushResponseDto,
  SyncPushResultDto,
  SyncedExpenseDto,
} from './dto/sync.dto';

/** Upper bound on rows returned by a single pull; the client pages with the cursor. */
const PULL_PAGE_SIZE = 500;

type SyncableExpense = {
  id: string;
  categoryId: string;
  amount: Prisma.Decimal;
  currency: string;
  description: string | null;
  incurredOn: Date;
  paymentMethod: string | null;
  recurringExpenseId: string | null;
  clientUpdatedAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/**
 * Device <-> server reconciliation for offline writes.
 *
 * The phone is the primary writer and its local store is authoritative while it
 * is offline, so the protocol is deliberately simple: the device replays its
 * queue through {@link push} and mirrors server state through {@link pull}.
 * Conflicts resolve by last-write-wins on `clientUpdatedAt`; expense deletions
 * are soft tombstones and budget deletions are hard, both of which keep
 * replaying the queue safe at any time. `pull` only carries expenses — budgets
 * are small enough that the device refreshes them wholesale from the REST list.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConverter: CurrencyConverterService,
  ) {}

  /**
   * Applies a batch of queued device changes in order.
   *
   * Each change is independent: one failure never rolls back the others, and
   * every change is idempotent so an interrupted sync can be retried whole.
   */
  async push(userId: string, changes: SyncChangeDto[]): Promise<SyncPushResponseDto> {
    const results: SyncPushResultDto[] = [];
    for (const change of changes) {
      results.push(await this.applyChange(userId, change));
    }
    return { results, cursor: new Date().toISOString() };
  }

  /**
   * Returns every expense (including tombstones) modified after `since`.
   *
   * Omitting `since` yields a full snapshot, which is how a fresh install seeds
   * its local store. `updatedAt` is server-managed, so it is a reliable change
   * marker; tombstones travel with it because deletes are soft.
   */
  async pull(userId: string, since?: string): Promise<SyncPullResponseDto> {
    const where: Prisma.ExpenseWhereInput = { userId };
    if (since) where.updatedAt = { gt: new Date(since) };

    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: PULL_PAGE_SIZE,
      select: {
        id: true,
        categoryId: true,
        amount: true,
        currency: true,
        description: true,
        incurredOn: true,
        paymentMethod: true,
        recurringExpenseId: true,
        clientUpdatedAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    const last = rows[rows.length - 1];
    const cursor = last ? last.updatedAt.toISOString() : (since ?? SYNC_EPOCH);

    return {
      expenses: rows.map((row) => this.toSyncedExpense(row)),
      cursor,
      hasMore: rows.length === PULL_PAGE_SIZE,
    };
  }

  private async applyChange(userId: string, change: SyncChangeDto): Promise<SyncPushResultDto> {
    const clientUpdatedAt = new Date(change.clientUpdatedAt);
    if (Number.isNaN(clientUpdatedAt.getTime())) {
      return { id: change.id, status: 'failed', reason: 'Invalid clientUpdatedAt' };
    }

    if (change.entity === 'budget') {
      return this.applyBudgetChange(userId, change, clientUpdatedAt);
    }
    return this.applyExpenseChange(userId, change, clientUpdatedAt);
  }

  /** Applies one queued expense change (soft-deleted via tombstones). */
  private async applyExpenseChange(
    userId: string,
    change: SyncChangeDto,
    clientUpdatedAt: Date,
  ): Promise<SyncPushResultDto> {
    const existing = await this.prisma.expense.findUnique({
      where: { id: change.id },
      select: { userId: true, clientUpdatedAt: true },
    });

    // A foreign row is indistinguishable from a missing one: never leak or
    // clobber another account's data by guessing at a UUID.
    if (existing && existing.userId !== userId) {
      return { id: change.id, status: 'failed', reason: 'not-found' };
    }

    // Last-write-wins: anything not strictly newer is a stale replay.
    if (existing && existing.clientUpdatedAt.getTime() >= clientUpdatedAt.getTime()) {
      return { id: change.id, status: 'skipped', reason: 'stale' };
    }

    if (change.op === 'delete') {
      // A delete for a row that never reached the server is a no-op; the device
      // still drops it locally, so both sides end up agreeing.
      if (!existing) return { id: change.id, status: 'applied', reason: 'noop' };

      const updated = await this.prisma.expense.update({
        where: { id: change.id },
        data: { deletedAt: new Date(), clientUpdatedAt },
        select: { updatedAt: true },
      });
      return { id: change.id, status: 'applied', serverUpdatedAt: updated.updatedAt.toISOString() };
    }

    if (!change.data) {
      return { id: change.id, status: 'failed', reason: 'Missing payload' };
    }

    try {
      const data = await this.buildExpenseData(
        userId,
        change.data as SyncExpensePayloadDto,
        clientUpdatedAt,
      );
      const saved = await this.prisma.expense.upsert({
        where: { id: change.id },
        create: { id: change.id, userId, ...data },
        // A newer write supersedes an earlier tombstone, mirroring LWW.
        update: { ...data, deletedAt: null },
        select: { updatedAt: true },
      });
      return { id: change.id, status: 'applied', serverUpdatedAt: saved.updatedAt.toISOString() };
    } catch (error) {
      const reason = this.describeError(error, change.id);
      this.logger.warn(`Sync push rejected expense ${change.id}: ${reason}`);
      return { id: change.id, status: 'failed', reason };
    }
  }

  /**
   * Applies one queued budget change.
   *
   * Budgets are hard-deleted rather than tombstoned: a soft delete would keep
   * the unique (userId, categoryId, period) row alive and block the user from
   * recreating a budget they deliberately removed. The phone is the only writer,
   * so the resurrection a tombstone guards against cannot happen here.
   */
  private async applyBudgetChange(
    userId: string,
    change: SyncChangeDto,
    clientUpdatedAt: Date,
  ): Promise<SyncPushResultDto> {
    const existing = await this.prisma.budget.findUnique({
      where: { id: change.id },
      select: { userId: true, clientUpdatedAt: true },
    });

    if (existing && existing.userId !== userId) {
      return { id: change.id, status: 'failed', reason: 'not-found' };
    }

    // Last-write-wins: anything not strictly newer is a stale replay.
    if (existing && existing.clientUpdatedAt.getTime() >= clientUpdatedAt.getTime()) {
      return { id: change.id, status: 'skipped', reason: 'stale' };
    }

    if (change.op === 'delete') {
      if (!existing) return { id: change.id, status: 'applied', reason: 'noop' };

      await this.prisma.budget.delete({ where: { id: change.id } });
      return { id: change.id, status: 'applied' };
    }

    const payload = change.data as SyncBudgetPayloadDto | undefined;
    if (!payload) {
      return { id: change.id, status: 'failed', reason: 'Missing payload' };
    }

    // Only one budget per (category, period) is allowed. A *different* row
    // already holding the slot means this create is redundant — skip it rather
    // than failing the queue forever; the device retires it and adopts the
    // winner from the next mirror refresh.
    const categoryId = payload.categoryId ?? null;
    const conflict = await this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId,
        period: payload.period,
        id: { not: change.id },
      },
      select: { id: true },
    });
    if (conflict) {
      return { id: change.id, status: 'skipped', reason: 'duplicate' };
    }

    try {
      const data = await this.buildBudgetData(userId, payload, clientUpdatedAt);
      const saved = await this.prisma.budget.upsert({
        where: { id: change.id },
        create: { id: change.id, userId, ...data },
        update: data,
        select: { updatedAt: true },
      });
      return { id: change.id, status: 'applied', serverUpdatedAt: saved.updatedAt.toISOString() };
    } catch (error) {
      // The pre-check above cannot close the race between two simultaneous
      // pushes; the unique indexes are the real arbiter. Losing that race is the
      // same duplicate, not a failure.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { id: change.id, status: 'skipped', reason: 'duplicate' };
      }
      const reason = this.describeError(error, change.id);
      this.logger.warn(`Sync push rejected budget ${change.id}: ${reason}`);
      return { id: change.id, status: 'failed', reason };
    }
  }

  private async buildBudgetData(
    userId: string,
    payload: SyncBudgetPayloadDto,
    clientUpdatedAt: Date,
  ): Promise<Omit<Prisma.BudgetUncheckedCreateInput, 'id' | 'userId'>> {
    const categoryId = payload.categoryId ?? null;
    if (categoryId) {
      const category = await this.prisma.expenseCategory.findFirst({
        where: { id: categoryId, userId },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Category not found');
    }

    return {
      categoryId,
      amount: new Prisma.Decimal(payload.amount.toFixed(2)),
      currency: this.currencyConverter.assertValidCode(payload.currency),
      period: payload.period,
      startDate: toUtcDate(payload.startDate),
      clientUpdatedAt,
    };
  }

  private async buildExpenseData(
    userId: string,
    payload: SyncExpensePayloadDto,
    clientUpdatedAt: Date,
  ): Promise<Omit<Prisma.ExpenseUncheckedCreateInput, 'id' | 'userId'>> {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: payload.categoryId, userId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Category not found');

    const currency = this.currencyConverter.assertValidCode(payload.currency);

    return {
      categoryId: category.id,
      amount: new Prisma.Decimal(payload.amount.toFixed(2)),
      currency,
      description: payload.description ?? null,
      paymentMethod: payload.paymentMethod ?? null,
      incurredOn: toUtcDate(payload.incurredOn),
      recurringExpenseId: payload.recurringExpenseId ?? null,
      clientUpdatedAt,
    };
  }

  private toSyncedExpense(row: SyncableExpense): SyncedExpenseDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      amount: Number(row.amount),
      currency: row.currency,
      description: row.description,
      incurredOn: formatDate(row.incurredOn),
      paymentMethod: row.paymentMethod,
      recurringExpenseId: row.recurringExpenseId,
      clientUpdatedAt: row.clientUpdatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private describeError(error: unknown, id: string): string {
    if (error instanceof BadRequestException) {
      return Array.isArray(error.message) ? error.message.join('; ') : error.message;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2003' ? 'Unknown category or recurring rule' : `db:${error.code}`;
    }
    if (error instanceof Error) return error.message;
    this.logger.error(`Unexpected sync error for ${id}`);
    return 'error';
  }
}
