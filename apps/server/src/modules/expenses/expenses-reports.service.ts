import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverter, CurrencyConverterService, round2 } from './currency-converter.service';
import { BudgetStatusQueryDto, ReportQueryDto, TrendQueryDto } from './dto/expense-query.dto';
import {
  BudgetStatusDto,
  BudgetStatusResponseDto,
  CategoryBreakdownDto,
  CurrencyTotalDto,
  ExpenseSummaryDto,
  ExpenseTrendDto,
  TrendPointDto,
} from './dto/report-response.dto';
import {
  monthKey,
  monthWindow,
  normalizeMonth,
  periodWindow,
  resolveRange,
  toUtcDate,
  trailingMonths,
} from './expenses.utils';

const UNAVAILABLE = 'exchange rate snapshot unavailable';

/**
 * Aggregation endpoints.
 *
 * Conversion strategy: group by `(category, currency)` or `(month, currency)`
 * in SQL, then convert each group exactly once. That keeps the number of
 * roundings proportional to the number of groups rather than the number of
 * expenses, and guarantees the sum of the visible rows matches the rendered
 * total.
 *
 * Every lookup is allowed to degrade: if no rate snapshot can be produced the
 * payload comes back with `converted: false` and null totals rather than a 500,
 * because a dashboard must stay renderable when the rate provider is down.
 */
@Injectable()
export class ExpensesReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConverter: CurrencyConverterService,
  ) {}

  /** Period totals and a per-category breakdown over an inclusive date range. */
  async getSummary(userId: string, query: ReportQueryDto): Promise<ExpenseSummaryDto> {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const { start, end } = resolveRange(query.from, query.to);
    const converter = await this.currencyConverter.tryGetConverter(query.base);

    const groups = await this.prisma.expense.groupBy({
      by: ['categoryId', 'currency'],
      where: { userId, incurredOn: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });

    let count = 0;
    const nativeByCurrency = new Map<string, { total: Prisma.Decimal; count: number }>();
    for (const group of groups) {
      const amount = group._sum.amount ?? new Prisma.Decimal(0);
      const groupCount = group._count._all;
      count += groupCount;

      const bucket = nativeByCurrency.get(group.currency);
      if (bucket) {
        bucket.total = bucket.total.add(amount);
        bucket.count += groupCount;
      } else {
        nativeByCurrency.set(group.currency, { total: amount, count: groupCount });
      }
    }

    const byCurrency: CurrencyTotalDto[] = [...nativeByCurrency.entries()]
      .map(([currency, v]) => ({ currency, total: Number(v.total.toFixed(2)), count: v.count }))
      .sort((a, b) => b.total - a.total);

    if (!converter) {
      return {
        baseCurrency,
        converted: false,
        conversionUnavailableReason: UNAVAILABLE,
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        total: null,
        count,
        average: null,
        byCategory: [],
        byCurrency,
      };
    }

    const byCategory = await this.aggregateByCategory(userId, groups, converter);

    const total = round2(byCategory.reduce((sum, c) => sum + c.total, 0));
    for (const entry of byCategory) {
      entry.percentage = total > 0 ? round2((entry.total / total) * 100) : 0;
    }

    return {
      baseCurrency: converter.baseCurrency,
      converted: true,
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      total,
      count,
      average: count > 0 ? round2(total / count) : 0,
      byCategory,
      byCurrency,
    };
  }

  /** Trailing monthly totals for time-series charts, oldest first. */
  async getTrends(userId: string, query: TrendQueryDto): Promise<ExpenseTrendDto> {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const keys = trailingMonths(query.months);
    const start = toUtcDate(`${keys[0]}-01`);
    const end = monthWindow(keys[keys.length - 1]).end;
    const converter = await this.currencyConverter.tryGetConverter(query.base);

    const rows = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: start, lte: end } },
      select: { amount: true, currency: true, incurredOn: true },
    });

    // Bucket natively first so each (month, currency) total converts exactly once.
    const buckets = new Map<string, { totals: Map<string, Prisma.Decimal>; count: number }>();
    for (const row of rows) {
      const key = monthKey(row.incurredOn);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { totals: new Map(), count: 0 };
        buckets.set(key, bucket);
      }
      const running = bucket.totals.get(row.currency);
      bucket.totals.set(row.currency, running ? running.add(row.amount) : row.amount);
      bucket.count += 1;
    }

    const points: TrendPointDto[] = keys.map((month) => {
      const bucket = buckets.get(month);
      const monthCount = bucket?.count ?? 0;

      if (!bucket || !converter) {
        return { month, total: converter ? 0 : null, count: monthCount };
      }

      let monthTotal = 0;
      for (const [currency, amount] of bucket.totals) {
        monthTotal += converter.convert(amount, currency);
      }
      return { month, total: round2(monthTotal), count: monthCount };
    });

    return {
      baseCurrency: converter?.baseCurrency ?? baseCurrency,
      converted: converter !== null,
      ...(converter ? {} : { conversionUnavailableReason: UNAVAILABLE }),
      months: keys.length,
      points,
    };
  }

  /** Budget-vs-actual for every budget that overlaps the evaluated period. */
  async getBudgetStatus(
    userId: string,
    query: BudgetStatusQueryDto,
  ): Promise<BudgetStatusResponseDto> {
    const month = normalizeMonth(query.month);
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const converter = await this.currencyConverter.tryGetConverter(query.base);

    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: { select: { name: true, color: true } } },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (budgets.length === 0) {
      return {
        baseCurrency,
        converted: converter !== null,
        ...(converter ? {} : { conversionUnavailableReason: UNAVAILABLE }),
        month,
        items: [],
      };
    }

    const windows = budgets.map((b) => periodWindow(b.period, month));
    const rangeStart = new Date(Math.min(...windows.map((w) => w.start.getTime())));
    const rangeEnd = new Date(Math.max(...windows.map((w) => w.end.getTime())));

    const expenses = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: rangeStart, lte: rangeEnd } },
      select: { amount: true, currency: true, categoryId: true, incurredOn: true },
    });

    const items = budgets.map((budget, index) => {
      const window = windows[index];
      // A budget only governs spending from the moment it takes effect.
      const effectiveStart = budget.startDate > window.start ? budget.startDate : window.start;
      const applied = effectiveStart <= window.end;

      const nativeByCurrency = new Map<string, Prisma.Decimal>();
      if (applied) {
        for (const expense of expenses) {
          if (budget.categoryId && expense.categoryId !== budget.categoryId) continue;
          if (expense.incurredOn < effectiveStart || expense.incurredOn > window.end) continue;

          const running = nativeByCurrency.get(expense.currency);
          nativeByCurrency.set(
            expense.currency,
            running ? running.add(expense.amount) : expense.amount,
          );
        }
      }

      let budgetAmount: number;
      let spent: number;
      let currency: string;

      if (converter) {
        currency = converter.baseCurrency;
        budgetAmount = converter.convert(budget.amount, budget.currency);
        spent = round2(
          [...nativeByCurrency.entries()].reduce(
            (sum, [code, amount]) => sum + converter.convert(amount, code),
            0,
          ),
        );
      } else {
        // Without rates we can still be exact when everything shares the budget's currency.
        currency = budget.currency;
        budgetAmount = Number(budget.amount);
        spent = Number((nativeByCurrency.get(budget.currency) ?? new Prisma.Decimal(0)).toFixed(2));
      }

      const remaining = round2(budgetAmount - spent);
      const percentage = budgetAmount > 0 ? round2((spent / budgetAmount) * 100) : 0;

      const dto: BudgetStatusDto = {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? null,
        color: budget.category?.color ?? null,
        period: budget.period,
        budgetAmount,
        budgetAmountNative: Number(budget.amount),
        spent,
        remaining,
        percentage,
        currency,
        overBudget: spent > budgetAmount,
        applied,
      };
      return dto;
    });

    return {
      baseCurrency: converter?.baseCurrency ?? baseCurrency,
      converted: converter !== null,
      ...(converter ? {} : { conversionUnavailableReason: UNAVAILABLE }),
      month,
      items,
    };
  }

  /**
   * Converts each `(category, currency)` group once and folds the currencies
   * together per category. Categories are fetched only when they are referenced.
   */
  private async aggregateByCategory(
    userId: string,
    groups: Array<{
      categoryId: string;
      currency: string;
      _sum: { amount: Prisma.Decimal | null };
      _count: { _all: number };
    }>,
    converter: CurrencyConverter,
  ): Promise<CategoryBreakdownDto[]> {
    const categoryIds = [...new Set(groups.map((g) => g.categoryId))];
    const categories =
      categoryIds.length > 0
        ? await this.prisma.expenseCategory.findMany({
            where: { id: { in: categoryIds }, userId },
            select: { id: true, name: true, color: true },
          })
        : [];
    const byId = new Map(categories.map((c) => [c.id, c]));

    const totals = new Map<string, { total: number; count: number }>();
    for (const group of groups) {
      const native = group._sum.amount ?? new Prisma.Decimal(0);
      const converted = converter.convert(native, group.currency);

      const bucket = totals.get(group.categoryId);
      if (bucket) {
        bucket.total = round2(bucket.total + converted);
        bucket.count += group._count._all;
      } else {
        totals.set(group.categoryId, { total: converted, count: group._count._all });
      }
    }

    return [...totals.entries()]
      .map(([categoryId, v]) => {
        const category = byId.get(categoryId);
        return {
          categoryId,
          // A deleted-but-referenced category should still render rather than vanish.
          categoryName: category?.name ?? 'Uncategorised',
          color: category?.color ?? '#64748b',
          total: round2(v.total),
          count: v.count,
          percentage: 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }
}
