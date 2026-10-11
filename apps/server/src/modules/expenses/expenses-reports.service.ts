import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyConverterService, round2 } from './currency-converter.service';
import { RatesService } from '../rates/rates.service';
import { RateTableDto } from '../rates/dto/rates-response.dto';
import { RatePolicy, RateResolver } from './rate-resolver';
import {
  BudgetStatusQueryDto,
  ByDayOfWeekQueryDto,
  ComparisonQueryDto,
  ExportQueryDto,
  ReportQueryDto,
  TopQueryDto,
  TrendQueryDto,
} from './dto/expense-query.dto';
import {
  BudgetStatusDto,
  BudgetStatusResponseDto,
  CategoryBreakdownDto,
  ConversionStatus,
  CurrencyTotalDto,
  ExpenseSummaryDto,
  ExpenseTrendDto,
  RateProvenanceDto,
  TopExpenseItemDto,
  TrendPointDto,
} from './dto/report-response.dto';
import {
  formatDate,
  monthKey,
  monthWindow,
  normalizeMonth,
  periodWindow,
  resolveRange,
  toUtcDate,
  trailingMonths,
} from './expenses.utils';

const UNAVAILABLE = 'exchange rate snapshot unavailable';

/** What one amount (at one date, in one currency) produced during conversion. */
interface ConversionResolution {
  convertible: boolean;
  value: number | null;
  rateDate: string | null;
  policy: RatePolicy | null;
}

/** Aggregates per-report conversion health and provenance. */
class ConversionTracker {
  private converted = 0;
  private unconverted = 0;
  private readonly failedCurrencies = new Set<string>();
  private readonly rateDates = new Set<string>();
  private readonly policies = new Set<RatePolicy | 'unavailable'>();

  /** Records a single conversion resolution. */
  accumulate(currency: string, res: ConversionResolution): void {
    if (res.convertible) {
      this.converted += 1;
      if (res.rateDate) this.rateDates.add(res.rateDate);
      if (res.policy) this.policies.add(res.policy);
    } else {
      this.unconverted += 1;
      this.failedCurrencies.add(currency);
    }
  }

  status(): ConversionStatus {
    if (this.unconverted > 0 && this.converted > 0) return 'partially_converted';
    if (this.unconverted > 0) return 'unavailable';
    return 'converted';
  }

  /** True when every recorded conversion succeeded. */
  get fullyConverted(): boolean {
    return this.unconverted === 0;
  }

  unconvertedCurrencies(): string[] {
    return [...this.failedCurrencies].sort();
  }

  provenance(): RateProvenanceDto {
    const dates = [...this.rateDates].sort();
    if (this.unconverted > 0) this.policies.add('unavailable');
    return {
      earliestRateDate: dates.length > 0 ? dates[0] : null,
      latestRateDate: dates.length > 0 ? dates[dates.length - 1] : null,
      policies: [...this.policies],
    };
  }

  /** Converts the aggregate into the legacy-plus-new report fields. */
  toReportFields(): {
    converted: boolean;
    conversionStatus: ConversionStatus;
    unconvertedCurrencies: string[];
    rateProvenance: RateProvenanceDto;
  } {
    const status = this.status();
    return {
      converted: status === 'converted',
      conversionStatus: status,
      unconvertedCurrencies: this.unconvertedCurrencies(),
      rateProvenance: this.provenance(),
    };
  }
}

/** Snapshot tables + resolver ready for a report's date range. */
interface RateContext {
  base: string;
  resolver: RateResolver;
}

/**
 * Aggregation endpoints.
 *
 * Conversion strategy: load expenses at row level with their dates, then
 * convert each row at the *historical* rate for its transaction date (latest
 * published snapshot on-or-before the date, labeled `estimate` when stale or
 * when the row predates the first snapshot). Grouped sums are folded from the
 * converted rows so currency totals are additive and auditable.
 *
 * Every report degrades instead of 500ing: unconvertible rows are excluded
 * from base totals, reported in `unconvertedCurrencies`, and surfaced via
 * `conversionStatus` (`converted` | `partially_converted` | `unavailable`).
 * Native amounts always remain the source of truth.
 */
@Injectable()
export class ExpensesReportsService {
  private readonly lookbackDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConverter: CurrencyConverterService,
    private readonly ratesService: RatesService,
    configService: ConfigService,
  ) {
    this.lookbackDays =
      configService.get<number>('EXCHANGE_RATE_HISTORICAL_LOOKBACK_DAYS', 10) ?? 10;
  }

  // -------------------------------------------------------------------------
  // Shared plumbing
  // -------------------------------------------------------------------------

  private async buildRateContext(base: string, end: Date): Promise<RateContext> {
    const tables: RateTableDto[] = await this.ratesService.getRateTablesForRange(base, end);
    return { base, resolver: new RateResolver(tables, this.lookbackDays) };
  }

  private convertAtDate(
    ctx: RateContext,
    amount: Prisma.Decimal,
    currency: string,
    dateIso: string,
  ): ConversionResolution {
    const code = currency.toUpperCase();
    if (code === ctx.base) {
      // Identity: the base currency never needs a rate, so it can always be
      // converted exactly.
      return {
        convertible: true,
        value: Number(amount.toFixed(2)),
        rateDate: null,
        policy: 'historical',
      };
    }

    const resolved = ctx.resolver.resolve(dateIso);
    if (!resolved) {
      return { convertible: false, value: null, rateDate: null, policy: null };
    }

    const fromRateRaw = resolved.table.rates[code];
    const toRateRaw = resolved.table.rates[ctx.base];
    if (!fromRateRaw || !toRateRaw) {
      return { convertible: false, value: null, rateDate: null, policy: null };
    }

    try {
      const fromRate = new Prisma.Decimal(fromRateRaw);
      const toRate = new Prisma.Decimal(toRateRaw);
      if (fromRate.isZero() || toRate.isZero()) {
        return { convertible: false, value: null, rateDate: null, policy: null };
      }
      const value = Number(amount.div(fromRate).mul(toRate).toFixed(2));
      return {
        convertible: true,
        value,
        rateDate: resolved.table.effectiveDate,
        policy: resolved.policy,
      };
    } catch {
      return { convertible: false, value: null, rateDate: null, policy: null };
    }
  }

  private parseDateIso(value: Date): string {
    return formatDate(value);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  /** Period totals and a per-category breakdown over an inclusive date range. */
  async getSummary(userId: string, query: ReportQueryDto): Promise<ExpenseSummaryDto> {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const { start, end } = resolveRange(query.from, query.to);
    const ctx = await this.buildRateContext(baseCurrency, end);

    const rows = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: start, lte: end } },
      select: { amount: true, currency: true, incurredOn: true, categoryId: true },
    });

    const tracker = new ConversionTracker();
    const categoryBuckets = new Map<string, { value: number; count: number }>();
    const nativeByCurrency = new Map<string, { total: Prisma.Decimal; count: number }>();

    for (const row of rows) {
      const res = this.convertAtDate(
        ctx,
        row.amount,
        row.currency,
        this.parseDateIso(row.incurredOn),
      );
      tracker.accumulate(row.currency, res);

      const native = nativeByCurrency.get(row.currency);
      nativeByCurrency.set(row.currency, {
        total: native ? native.total.add(row.amount) : row.amount,
        count: (native?.count ?? 0) + 1,
      });

      const bucket = categoryBuckets.get(row.categoryId) ?? { value: 0, count: 0 };
      bucket.count += 1;
      if (res.value !== null) bucket.value = round2(bucket.value + res.value);
      categoryBuckets.set(row.categoryId, bucket);
    }

    const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
      tracker.toReportFields();

    const byCurrency: CurrencyTotalDto[] = [...nativeByCurrency.entries()]
      .map(([currency, v]) => ({ currency, total: Number(v.total.toFixed(2)), count: v.count }))
      .sort((a, b) => b.total - a.total);

    // Leave the total null when nothing could be converted — a null total and
    // an empty zero-filled breakdown both say "unavailable" without lying.
    if (conversionStatus === 'unavailable') {
      return {
        baseCurrency,
        converted,
        conversionUnavailableReason: UNAVAILABLE,
        conversionStatus,
        unconvertedCurrencies,
        rateProvenance,
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        total: null,
        count: rows.length,
        average: null,
        byCategory: [],
        byCurrency,
      };
    }

    const byCategory = await this.aggregateByCategory(userId, categoryBuckets);
    const total = round2(byCategory.reduce((sum, c) => sum + c.total, 0));
    for (const entry of byCategory) {
      entry.percentage = total > 0 ? round2((entry.total / total) * 100) : 0;
    }

    return {
      baseCurrency,
      converted,
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance,
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      total,
      count: rows.length,
      average: rows.length > 0 ? round2(total / rows.length) : 0,
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
    const ctx = await this.buildRateContext(baseCurrency, end);

    const rows = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: start, lte: end } },
      select: { amount: true, currency: true, incurredOn: true },
    });

    const tracker = new ConversionTracker();
    const buckets = new Map<string, { total: number; convertedCount: number; count: number }>();

    for (const row of rows) {
      const res = this.convertAtDate(
        ctx,
        row.amount,
        row.currency,
        this.parseDateIso(row.incurredOn),
      );
      tracker.accumulate(row.currency, res);

      const key = monthKey(row.incurredOn);
      const bucket = buckets.get(key) ?? { total: 0, convertedCount: 0, count: 0 };
      bucket.count += 1;
      if (res.value !== null) {
        bucket.total = round2(bucket.total + res.value);
        bucket.convertedCount += 1;
      }
      buckets.set(key, bucket);
    }

    // Empty (or fully-unconverted) months keep the axis continuous with a 0
    // total as long as rates are available at all; when nothing converts they
    // become null so the UI can show the empty state honestly.
    const globallyUnavailable = tracker.status() === 'unavailable';
    const zeroTotal = globallyUnavailable ? null : 0;

    const points: TrendPointDto[] = keys.map((month) => {
      const bucket = buckets.get(month);
      const monthCount = bucket?.count ?? 0;
      const total = bucket && bucket.convertedCount > 0 ? round2(bucket.total) : zeroTotal;
      return { month, total, count: monthCount };
    });

    const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
      tracker.toReportFields();

    return {
      baseCurrency,
      converted,
      ...(conversionStatus === 'unavailable' ? { conversionUnavailableReason: UNAVAILABLE } : {}),
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance,
      months: keys.length,
      points,
    };
  }

  /** Budget-vs-actual for every budget that overlaps the evaluated period. */
  async getBudgetStatus(
    userId: string,
    query: BudgetStatusQueryDto,
  ): Promise<BudgetStatusResponseDto> {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const month = normalizeMonth(query.month);

    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: { select: { name: true, color: true } } },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (budgets.length === 0) {
      return {
        baseCurrency,
        converted: true,
        conversionStatus: 'converted',
        unconvertedCurrencies: [],
        rateProvenance: { earliestRateDate: null, latestRateDate: null, policies: [] },
        month,
        items: [],
      };
    }

    const windows = budgets.map((b) => periodWindow(b.period, month));
    const rangeStart = new Date(Math.min(...windows.map((w) => w.start.getTime())));
    const rangeEnd = new Date(Math.max(...windows.map((w) => w.end.getTime())));
    const ctx = await this.buildRateContext(baseCurrency, rangeEnd);

    const expenses = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: rangeStart, lte: rangeEnd } },
      select: { amount: true, currency: true, categoryId: true, incurredOn: true },
    });

    const reportTracker = new ConversionTracker();

    const items: BudgetStatusDto[] = budgets.map((budget, index) => {
      const window = windows[index];
      // A budget only governs spending from the moment it takes effect.
      const effectiveStart = budget.startDate > window.start ? budget.startDate : window.start;
      const applied = effectiveStart <= window.end;

      const itemTracker = new ConversionTracker();
      let spent = 0;
      if (applied) {
        for (const expense of expenses) {
          if (budget.categoryId && expense.categoryId !== budget.categoryId) continue;
          if (expense.incurredOn < effectiveStart || expense.incurredOn > window.end) continue;

          const res = this.convertAtDate(
            ctx,
            expense.amount,
            expense.currency,
            this.parseDateIso(expense.incurredOn),
          );
          itemTracker.accumulate(expense.currency, res);
          reportTracker.accumulate(expense.currency, res);
          if (res.value !== null) spent = round2(spent + res.value);
        }
      }

      // The budget target itself is dated to the start of the evaluated window
      // (or the budget's own start date, whichever is later).
      const budgetRes = this.convertAtDate(
        ctx,
        budget.amount,
        budget.currency,
        this.parseDateIso(effectiveStart),
      );

      const budgetConvertible = budgetRes.convertible;
      const budgetAmount = budgetConvertible ? (budgetRes.value as number) : Number(budget.amount);
      const spentConvertible = itemTracker.fullyConverted;

      const remaining = round2(budgetAmount - spent);
      const percentage = budgetAmount > 0 ? round2((spent / budgetAmount) * 100) : 0;

      return {
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
        currency: budgetConvertible ? baseCurrency : budget.currency,
        overBudget: spent > budgetAmount,
        applied,
        convertedAmount: budgetConvertible ? budgetAmount : null,
        convertedCurrency: budgetConvertible ? baseCurrency : null,
        rateDate: budgetRes.rateDate,
        ratePolicy: budgetRes.policy,
        conversionStatus: budgetConvertible && spentConvertible ? 'converted' : 'unavailable',
      };
    });

    const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
      reportTracker.toReportFields();

    return {
      baseCurrency,
      converted,
      ...(conversionStatus === 'unavailable' ? { conversionUnavailableReason: UNAVAILABLE } : {}),
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance,
      month,
      items,
    };
  }

  /**
   * Fetches category display metadata and folds the per-category converted
   * buckets into a breakdown sorted largest first.
   */
  private async aggregateByCategory(
    userId: string,
    buckets: Map<string, { value: number; count: number }>,
  ): Promise<CategoryBreakdownDto[]> {
    const categoryIds = [...buckets.keys()];
    const categories =
      categoryIds.length > 0
        ? await this.prisma.expenseCategory.findMany({
            where: { id: { in: categoryIds }, userId },
            select: { id: true, name: true, color: true },
          })
        : [];
    const byId = new Map(categories.map((c) => [c.id, c]));

    return [...buckets.entries()]
      .map(([categoryId, v]) => {
        const category = byId.get(categoryId);
        return {
          categoryId,
          // A deleted-but-referenced category should still render rather than vanish.
          categoryName: category?.name ?? 'Uncategorised',
          color: category?.color ?? '#64748b',
          total: round2(v.value),
          count: v.count,
          percentage: 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  /** Compare two arbitrary periods (e.g. MoM). */
  async getComparison(userId: string, query: ComparisonQueryDto) {
    const current = resolveRange(query.currentFrom, query.currentTo);
    const previous = resolveRange(query.previousFrom, query.previousTo);

    const [currentSummary, previousSummary] = await Promise.all([
      this.getSummary(userId, {
        from: current.start.toISOString().slice(0, 10),
        to: current.end.toISOString().slice(0, 10),
        base: query.base,
      }),
      this.getSummary(userId, {
        from: previous.start.toISOString().slice(0, 10),
        to: previous.end.toISOString().slice(0, 10),
        base: query.base,
      }),
    ]);

    const delta = this.calculateDelta(currentSummary, previousSummary);

    const merged = this.mergeStatus(currentSummary, previousSummary);

    return {
      baseCurrency: currentSummary.baseCurrency,
      converted: merged.converted,
      ...(merged.conversionStatus === 'unavailable'
        ? { conversionUnavailableReason: UNAVAILABLE }
        : {}),
      conversionStatus: merged.conversionStatus,
      unconvertedCurrencies: merged.unconvertedCurrencies,
      rateProvenance: merged.rateProvenance,
      current: currentSummary,
      previous: previousSummary,
      delta,
    };
  }

  private mergeStatus(
    current: ExpenseSummaryDto,
    previous: ExpenseSummaryDto,
  ): {
    converted: boolean;
    conversionStatus: ConversionStatus;
    unconvertedCurrencies: string[];
    rateProvenance: RateProvenanceDto;
  } {
    const statuses = [current.conversionStatus, previous.conversionStatus];
    const conversionStatus: ConversionStatus = statuses.every((s) => s === 'converted')
      ? 'converted'
      : statuses.every((s) => s === 'unavailable')
        ? 'unavailable'
        : 'partially_converted';

    const unconvertedCurrencies = [
      ...new Set([
        ...(current.unconvertedCurrencies ?? []),
        ...(previous.unconvertedCurrencies ?? []),
      ]),
    ].sort();

    const rateDates = [
      current.rateProvenance?.earliestRateDate,
      current.rateProvenance?.latestRateDate,
      previous.rateProvenance?.earliestRateDate,
      previous.rateProvenance?.latestRateDate,
    ].filter((d): d is string => Boolean(d));

    const policies = [
      ...new Set([
        ...(current.rateProvenance?.policies ?? []),
        ...(previous.rateProvenance?.policies ?? []),
      ]),
    ];

    return {
      converted: conversionStatus === 'converted',
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance: {
        earliestRateDate: rateDates.length > 0 ? rateDates.sort()[0] : null,
        latestRateDate: rateDates.length > 0 ? rateDates.sort()[rateDates.length - 1] : null,
        policies,
      },
    };
  }

  private calculateDelta(current: ExpenseSummaryDto, previous: ExpenseSummaryDto) {
    const currentTotal = current.total ?? 0;
    const previousTotal = previous.total ?? 0;
    const currentCount = current.count;
    const previousCount = previous.count;

    const totalAbs = round2(currentTotal - previousTotal);
    const totalPct =
      previousTotal === 0
        ? currentTotal === 0
          ? 0
          : 100
        : round2((currentTotal / previousTotal - 1) * 100);
    const countAbs = currentCount - previousCount;
    const countPct =
      previousCount === 0
        ? currentCount === 0
          ? 0
          : 100
        : round2((currentCount / previousCount - 1) * 100);

    return {
      totalAbs,
      totalPct,
      countAbs,
      countPct,
    };
  }

  async getTopExpenses(userId: string, query: TopQueryDto) {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const { start, end } = resolveRange(query.from, query.to);
    const ctx = await this.buildRateContext(baseCurrency, end);

    const expenses = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: start, lte: end } },
      include: { category: { select: { name: true } } },
      orderBy: [{ amount: 'desc' }, { incurredOn: 'desc' }],
      take: query.limit ?? 10,
    });

    const tracker = new ConversionTracker();
    const items: TopExpenseItemDto[] = expenses.map((e) => {
      const res = this.convertAtDate(ctx, e.amount, e.currency, this.parseDateIso(e.incurredOn));
      tracker.accumulate(e.currency, res);
      const value = res.value !== null ? round2(res.value) : null;

      return {
        id: e.id,
        description: e.description,
        categoryName: e.category?.name ?? null,
        categorySlug: null as string | null,
        amountNative: Number(e.amount),
        currency: e.currency,
        amount: value,
        convertedAmount: value,
        convertedCurrency: res.convertible ? baseCurrency : null,
        rateDate: res.rateDate,
        ratePolicy: res.policy,
        conversionStatus: res.convertible ? 'converted' : 'unavailable',
        incurredOn: e.incurredOn.toISOString().slice(0, 10),
      };
    });

    const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
      tracker.toReportFields();

    return {
      baseCurrency,
      converted,
      ...(conversionStatus === 'unavailable' ? { conversionUnavailableReason: UNAVAILABLE } : {}),
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance,
      items,
    };
  }

  async getByDayOfWeek(userId: string, query: ByDayOfWeekQueryDto) {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);
    const { start, end } = resolveRange(query.from, query.to);
    const ctx = await this.buildRateContext(baseCurrency, end);

    const expenses = await this.prisma.expense.findMany({
      where: { userId, incurredOn: { gte: start, lte: end } },
      select: { amount: true, currency: true, incurredOn: true },
    });

    const tracker = new ConversionTracker();
    const buckets = new Map<number, { total: number; count: number }>();

    for (const e of expenses) {
      const res = this.convertAtDate(ctx, e.amount, e.currency, this.parseDateIso(e.incurredOn));
      tracker.accumulate(e.currency, res);

      const dow = e.incurredOn.getUTCDay(); // 0 Sunday
      const val = res.value !== null ? res.value : 0;
      const b = buckets.get(dow);
      if (b) {
        b.total = round2(b.total + val);
        b.count += 1;
      } else {
        buckets.set(dow, { total: round2(val), count: 1 });
      }
    }

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const items = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
      const b = buckets.get(dow);
      const total = b?.total ?? 0;
      const count = b?.count ?? 0;
      return {
        dow,
        label: labels[dow],
        total: round2(total),
        count,
        average: count > 0 ? round2(total / count) : 0,
      };
    });

    const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
      tracker.toReportFields();

    return {
      baseCurrency,
      converted,
      ...(conversionStatus === 'unavailable' ? { conversionUnavailableReason: UNAVAILABLE } : {}),
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance,
      items,
    };
  }

  async exportCsv(userId: string, query: ExportQueryDto): Promise<string> {
    const baseCurrency = this.currencyConverter.resolveBase(query.base);

    const where: Prisma.ExpenseWhereInput = { userId };
    const { start, end } = resolveRange(query.from, query.to);
    where.incurredOn = { gte: start, lte: end };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.currency) where.currency = query.currency;
    if (query.search) where.description = { contains: query.search, mode: 'insensitive' };

    const expenses = await this.prisma.expense.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: [{ incurredOn: 'desc' }, { createdAt: 'desc' }],
    });

    const ctx = await this.buildRateContext(baseCurrency, end);

    const headers = [
      'Date',
      'Description',
      'Category',
      'Amount',
      'Currency',
      'BaseAmount',
      'BaseCurrency',
      'Converted',
      'RateDate',
      'RatePolicy',
      'ConversionStatus',
    ];
    const lines = [headers.join(',')];

    for (const e of expenses) {
      const date = e.incurredOn.toISOString().slice(0, 10);
      const description = (e.description ?? '').replace(/"/g, '""');
      const category = e.category?.name ?? 'Uncategorised';
      const amount = Number(e.amount).toFixed(2);
      const currency = e.currency;

      const res = this.convertAtDate(ctx, e.amount, currency, date);
      const baseAmount = res.value !== null ? res.value.toFixed(2) : '';
      const base = res.convertible ? baseCurrency : '';
      const rateDate = res.rateDate ?? '';
      const ratePolicy = res.policy ?? '';
      const conversionStatus = res.convertible ? 'converted' : 'unavailable';

      lines.push(
        `"${date}","${description}","${category}",${amount},${currency},${baseAmount},${base},${res.convertible},${rateDate},${ratePolicy},${conversionStatus}`,
      );
    }

    return lines.join('\n');
  }
}
