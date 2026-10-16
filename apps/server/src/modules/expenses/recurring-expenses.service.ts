import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OccurrenceStatus, Prisma, RecurringExpense, RecurringRuleStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverterService } from './currency-converter.service';
import { ExpensesService } from './expenses.service';
import { ExpenseDto } from './dto/expense-response.dto';
import { formatDate, toUtcDate } from './expenses.utils';
import { addDays, computeDueDates, nextDueDate, startOfPeriod } from './recurring-schedule.util';
import {
  ConfirmOccurrenceDto,
  CreateRecurringExpenseDto,
  RecurringOccurrenceQueryDto,
  UpdateRecurringExpenseDto,
} from './dto/recurring-expense.dto';
import {
  ConfirmOccurrencesResponseDto,
  PaginatedOccurrencesResponseDto,
  RecurringExpenseDto,
  RecurringOccurrenceDto,
} from './dto/recurring-expense-response.dto';

type Ack = { success: boolean; message: string };

const CATEGORY_SELECT = { name: true, color: true } as const;

type RuleWithCategory = Prisma.RecurringExpenseGetPayload<{
  include: { category: { select: typeof CATEGORY_SELECT } };
}>;

type CategoryLookup = Map<string, { name: string; color: string }>;

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Recurring-expense rules and their pending occurrences.
 *
 * A rule never posts an expense on its own: it materialises *pending
 * occurrences* that the user confirms (optionally editing them first) or skips.
 * Confirming hands the expense payload to `ExpensesService` inside the same
 * transaction, so reports and budgets — which only read confirmed `Expense`
 * rows — need no changes.
 *
 * Generation is lazy and idempotent: any read calls `ensureGenerated`, which
 * catches a rule up to today. The `(recurringExpenseId, dueOn)` unique key makes
 * re-running safe, so no scheduler or cross-instance lock is required.
 */
@Injectable()
export class RecurringExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConverter: CurrencyConverterService,
    private readonly expensesService: ExpensesService,
  ) {}

  // ------------------------------------------------------------------- rules

  async listRules(userId: string): Promise<RecurringExpenseDto[]> {
    await this.ensureGenerated(userId);
    const today = this.today();

    const rules = await this.prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
      include: { category: { select: CATEGORY_SELECT } },
    });
    if (rules.length === 0) return [];

    const pending = await this.prisma.recurringExpenseOccurrence.findMany({
      where: {
        recurringExpenseId: { in: rules.map((rule) => rule.id) },
        status: OccurrenceStatus.PENDING,
      },
      select: { recurringExpenseId: true, dueOn: true },
    });
    const byRule = new Map<string, Date[]>();
    for (const occurrence of pending) {
      const dates = byRule.get(occurrence.recurringExpenseId) ?? [];
      dates.push(occurrence.dueOn);
      byRule.set(occurrence.recurringExpenseId, dates);
    }

    return rules.map((rule) => this.toRuleDto(rule, byRule.get(rule.id) ?? [], today));
  }

  async getRule(userId: string, id: string): Promise<RecurringExpenseDto> {
    await this.ensureGenerated(userId);
    const rule = await this.findOwnedRule(userId, id);
    return this.toRuleDto(rule, await this.pendingDates(rule.id), this.today());
  }

  async createRule(userId: string, dto: CreateRecurringExpenseDto): Promise<RecurringExpenseDto> {
    const category = await this.assertOwnedCategory(userId, dto.categoryId);
    const currency = this.currencyConverter.assertValidCode(dto.currency);
    const startDate = toUtcDate(dto.startDate);
    const endDate = dto.endDate ? toUtcDate(dto.endDate) : null;
    this.assertEndAfterStart(startDate, endDate);

    const frequency = dto.frequency;
    const interval = dto.interval ?? 1;
    const today = this.today();
    // "Start from the current period": seed the cursor so the first generated
    // occurrence is this period's (or the start date's), never a back-fill.
    const lastGeneratedOn = addDays(maxDate(startDate, startOfPeriod(today, frequency)), -1);

    const created = await this.prisma.recurringExpense.create({
      data: {
        userId,
        categoryId: category.id,
        amount: new Prisma.Decimal(dto.amount.toFixed(2)),
        currency,
        description: dto.description,
        paymentMethod: dto.paymentMethod,
        frequency,
        interval,
        startDate,
        endDate,
        status: RecurringRuleStatus.ACTIVE,
        lastGeneratedOn,
      },
      include: { category: { select: CATEGORY_SELECT } },
    });

    await this.generateForRule(created, today);
    const fresh = await this.findOwnedRule(userId, created.id);
    return this.toRuleDto(fresh, await this.pendingDates(fresh.id), today);
  }

  async updateRule(
    userId: string,
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<RecurringExpenseDto> {
    const rule = await this.findOwnedRule(userId, id);
    const today = this.today();

    let categoryId = rule.categoryId;
    if (dto.categoryId !== undefined && dto.categoryId !== rule.categoryId) {
      const category = await this.assertOwnedCategory(userId, dto.categoryId);
      categoryId = category.id;
    }

    const currency =
      dto.currency !== undefined
        ? this.currencyConverter.assertValidCode(dto.currency)
        : rule.currency;
    const frequency = dto.frequency ?? rule.frequency;
    const interval = dto.interval ?? rule.interval;
    const startDate = dto.startDate !== undefined ? toUtcDate(dto.startDate) : rule.startDate;
    const endDate =
      dto.endDate !== undefined ? (dto.endDate ? toUtcDate(dto.endDate) : null) : rule.endDate;
    this.assertEndAfterStart(startDate, endDate);

    const cadenceChanged =
      dto.frequency !== undefined ||
      dto.interval !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined;
    const status = dto.status ?? rule.status;

    const data: Prisma.RecurringExpenseUpdateInput = {
      category: { connect: { id: categoryId } },
      currency,
      frequency,
      interval,
      startDate,
      endDate,
      status,
      ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount.toFixed(2)) } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
    };

    if (status === RecurringRuleStatus.PAUSED && rule.status !== RecurringRuleStatus.PAUSED) {
      data.pausedAt = new Date();
    } else if (dto.status === RecurringRuleStatus.ACTIVE) {
      // Resuming skips the paused gap rather than back-filling it.
      data.pausedAt = null;
      data.lastGeneratedOn = addDays(startOfPeriod(today, frequency), -1);
    } else if (cadenceChanged) {
      data.lastGeneratedOn = addDays(maxDate(startDate, startOfPeriod(today, frequency)), -1);
    }

    const payloadChanged =
      dto.amount !== undefined ||
      dto.currency !== undefined ||
      dto.categoryId !== undefined ||
      dto.description !== undefined ||
      dto.paymentMethod !== undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.recurringExpense.update({
        where: { id: rule.id },
        data,
        include: { category: { select: CATEGORY_SELECT } },
      });

      // Occurrences are snapshots taken at generation time, so confirmed and
      // skipped history is frozen. Pending ones are not history yet, so they
      // follow a payload edit to stay in step with the rule the user sees.
      if (payloadChanged) {
        await tx.recurringExpenseOccurrence.updateMany({
          where: { recurringExpenseId: rule.id, status: OccurrenceStatus.PENDING },
          data: {
            ...(dto.amount !== undefined
              ? { amount: new Prisma.Decimal(dto.amount.toFixed(2)) }
              : {}),
            ...(currency !== rule.currency ? { currency } : {}),
            ...(categoryId !== rule.categoryId ? { categoryId } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
          },
        });
      }

      return row;
    });

    if (updated.status === RecurringRuleStatus.ACTIVE) {
      await this.generateForRule(updated, today);
    }

    const fresh = await this.findOwnedRule(userId, id);
    return this.toRuleDto(fresh, await this.pendingDates(fresh.id), today);
  }

  async deleteRule(userId: string, id: string): Promise<Ack> {
    const rule = await this.findOwnedRule(userId, id);
    await this.prisma.$transaction(async (tx) => {
      // Keep the expenses a rule already produced; they live on as ordinary
      // history once unlinked. Occurrences cascade away with the rule.
      await tx.expense.updateMany({
        where: { recurringExpenseId: rule.id },
        data: { recurringExpenseId: null },
      });
      await tx.recurringExpense.delete({ where: { id: rule.id } });
    });
    return { success: true, message: 'Recurring expense deleted successfully' };
  }

  // ------------------------------------------------------------- occurrences

  async listOccurrences(
    userId: string,
    query: RecurringOccurrenceQueryDto,
  ): Promise<PaginatedOccurrencesResponseDto> {
    await this.ensureGenerated(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RecurringExpenseOccurrenceWhereInput = {
      recurringExpense: { userId },
      ...(query.status ? { status: query.status } : {}),
      ...(query.recurringExpenseId ? { recurringExpenseId: query.recurringExpenseId } : {}),
      ...(query.from || query.to
        ? {
            dueOn: {
              ...(query.from ? { gte: toUtcDate(query.from) } : {}),
              ...(query.to ? { lte: toUtcDate(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recurringExpenseOccurrence.findMany({
        where,
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.recurringExpenseOccurrence.count({ where }),
    ]);

    const categories = await this.categoryLookup(userId);
    return {
      items: items.map((occurrence) => this.toOccurrenceDto(occurrence, categories)),
      page,
      limit,
      total,
    };
  }

  async confirmOccurrence(
    userId: string,
    id: string,
    dto: ConfirmOccurrenceDto,
  ): Promise<ExpenseDto> {
    const occurrence = await this.prisma.recurringExpenseOccurrence.findFirst({
      where: { id, recurringExpense: { userId } },
    });
    if (!occurrence) throw new NotFoundException('Occurrence not found');
    if (occurrence.status !== OccurrenceStatus.PENDING) {
      throw new ConflictException('This occurrence has already been handled');
    }

    const categoryId = dto.categoryId ?? occurrence.categoryId;
    const amount = dto.amount ?? Number(occurrence.amount);
    const currency = this.currencyConverter.assertValidCode(dto.currency ?? occurrence.currency);
    const incurredOn = dto.incurredOn ? toUtcDate(dto.incurredOn) : occurrence.dueOn;
    const description = dto.description ?? occurrence.description;
    const paymentMethod = dto.paymentMethod ?? occurrence.paymentMethod;

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.recurringExpenseOccurrence.updateMany({
        where: { id: occurrence.id, status: OccurrenceStatus.PENDING },
        data: {
          status: OccurrenceStatus.CONFIRMED,
          confirmedAt: new Date(),
          amount: new Prisma.Decimal(amount.toFixed(2)),
          currency,
          categoryId,
          description,
          paymentMethod,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('This occurrence has already been handled');
      }

      const expense = await this.expensesService.createExpenseRecord(
        userId,
        {
          categoryId,
          amount,
          currency,
          description,
          paymentMethod,
          incurredOn,
          recurringExpenseId: occurrence.recurringExpenseId,
        },
        tx,
      );

      await tx.recurringExpenseOccurrence.update({
        where: { id: occurrence.id },
        data: { expenseId: expense.id },
      });

      return expense;
    });
  }

  async skipOccurrence(userId: string, id: string): Promise<Ack> {
    const occurrence = await this.prisma.recurringExpenseOccurrence.findFirst({
      where: { id, recurringExpense: { userId } },
      select: { id: true, status: true },
    });
    if (!occurrence) throw new NotFoundException('Occurrence not found');
    if (occurrence.status !== OccurrenceStatus.PENDING) {
      throw new ConflictException('This occurrence has already been handled');
    }

    await this.prisma.recurringExpenseOccurrence.update({
      where: { id: occurrence.id },
      data: { status: OccurrenceStatus.SKIPPED },
    });
    return { success: true, message: 'Occurrence skipped' };
  }

  async confirmMany(userId: string, ids?: string[]): Promise<ConfirmOccurrencesResponseDto> {
    await this.ensureGenerated(userId);

    const pending = await this.prisma.recurringExpenseOccurrence.findMany({
      where: {
        recurringExpense: { userId },
        status: OccurrenceStatus.PENDING,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      select: { id: true },
    });

    let confirmed = 0;
    for (const occurrence of pending) {
      try {
        await this.confirmOccurrence(userId, occurrence.id, {});
        confirmed += 1;
      } catch {
        // Another request may have claimed it between the read and the write.
      }
    }
    return { confirmed };
  }

  /**
   * Materialises every occurrence that has come due for the caller's active
   * rules. Safe to call on any read; the unique key absorbs repeat runs.
   */
  async ensureGenerated(userId: string): Promise<void> {
    const today = this.today();
    const rules = await this.prisma.recurringExpense.findMany({
      where: { userId, status: RecurringRuleStatus.ACTIVE },
    });
    for (const rule of rules) {
      await this.generateForRule(rule, today);
    }
  }

  // ----------------------------------------------------------------- helpers

  private async generateForRule(rule: RecurringExpense, today: Date): Promise<void> {
    const endDate = rule.endDate ?? null;
    // A null cursor only happens for rows written before the cursor existed;
    // falling back to the current period keeps the no-back-fill guarantee.
    const fromExclusive = rule.lastGeneratedOn ?? addDays(startOfPeriod(today, rule.frequency), -1);

    const due = computeDueDates({
      startDate: rule.startDate,
      frequency: rule.frequency,
      interval: rule.interval,
      endDate,
      fromExclusive,
      toInclusive: today,
    });

    const ended = endDate !== null && today.getTime() > endDate.getTime();
    if (due.length === 0) {
      if (ended) {
        await this.prisma.recurringExpense.update({
          where: { id: rule.id },
          data: { status: RecurringRuleStatus.ENDED },
        });
      }
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recurringExpenseOccurrence.createMany({
        data: due.map((dueOn) => ({
          recurringExpenseId: rule.id,
          dueOn,
          amount: rule.amount,
          currency: rule.currency,
          categoryId: rule.categoryId,
          description: rule.description,
          paymentMethod: rule.paymentMethod,
        })),
        skipDuplicates: true,
      });
      await tx.recurringExpense.update({
        where: { id: rule.id },
        data: {
          lastGeneratedOn: due[due.length - 1],
          ...(ended ? { status: RecurringRuleStatus.ENDED } : {}),
        },
      });
    });
  }

  private async pendingDates(recurringExpenseId: string): Promise<Date[]> {
    const pending = await this.prisma.recurringExpenseOccurrence.findMany({
      where: { recurringExpenseId, status: OccurrenceStatus.PENDING },
      select: { dueOn: true },
    });
    return pending.map((occurrence) => occurrence.dueOn);
  }

  private async categoryLookup(userId: string): Promise<CategoryLookup> {
    const categories = await this.prisma.expenseCategory.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
    });
    return new Map(
      categories.map((category) => [category.id, { name: category.name, color: category.color }]),
    );
  }

  private async findOwnedRule(userId: string, id: string): Promise<RuleWithCategory> {
    const rule = await this.prisma.recurringExpense.findFirst({
      where: { id, userId },
      include: { category: { select: CATEGORY_SELECT } },
    });
    // 404 (not 403) so a foreign id is indistinguishable from a missing one.
    if (!rule) throw new NotFoundException('Recurring expense not found');
    return rule;
  }

  private async assertOwnedCategory(userId: string, id: string): Promise<{ id: string }> {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private assertEndAfterStart(startDate: Date, endDate: Date | null): void {
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private today(): Date {
    return toUtcDate(formatDate(new Date()));
  }

  private toRuleDto(
    rule: RuleWithCategory,
    pendingDates: Date[],
    today: Date,
  ): RecurringExpenseDto {
    const sorted = [...pendingDates].sort((a, b) => a.getTime() - b.getTime());
    const next =
      sorted[0] ??
      nextDueDate({
        startDate: rule.startDate,
        frequency: rule.frequency,
        interval: rule.interval,
        endDate: rule.endDate,
        after: today,
      });

    return {
      id: rule.id,
      categoryId: rule.categoryId,
      categoryName: rule.category.name,
      categoryColor: rule.category.color,
      amount: Number(rule.amount),
      currency: rule.currency,
      description: rule.description,
      paymentMethod: rule.paymentMethod,
      frequency: rule.frequency,
      interval: rule.interval,
      startDate: formatDate(rule.startDate),
      endDate: rule.endDate ? formatDate(rule.endDate) : null,
      status: rule.status,
      nextDueOn: next ? formatDate(next) : null,
      pendingCount: sorted.length,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private toOccurrenceDto(
    occurrence: {
      id: string;
      recurringExpenseId: string;
      dueOn: Date;
      status: OccurrenceStatus;
      amount: Prisma.Decimal;
      currency: string;
      categoryId: string;
      description: string | null;
      paymentMethod: string | null;
      expenseId: string | null;
      confirmedAt: Date | null;
      createdAt: Date;
    },
    categories: CategoryLookup,
  ): RecurringOccurrenceDto {
    const category = categories.get(occurrence.categoryId);
    return {
      id: occurrence.id,
      recurringExpenseId: occurrence.recurringExpenseId,
      dueOn: formatDate(occurrence.dueOn),
      status: occurrence.status,
      amount: Number(occurrence.amount),
      currency: occurrence.currency,
      categoryId: occurrence.categoryId,
      categoryName: category?.name ?? 'Uncategorized',
      categoryColor: category?.color ?? '#94a3b8',
      description: occurrence.description,
      paymentMethod: occurrence.paymentMethod,
      expenseId: occurrence.expenseId,
      confirmedAt: occurrence.confirmedAt,
      createdAt: occurrence.createdAt,
    };
  }
}
