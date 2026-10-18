/**
 * On-device report aggregation.
 *
 * This is a faithful, framework-free port of the server's
 * `ExpensesReportsService`: the same historical rate resolution, the same
 * per-row conversion and the same folding order, so a report computed on the
 * phone is field-for-field identical to the one the server would return. The
 * server remains the source of truth for HTTP; the parity is pinned by golden
 * tests copied from the server's own suite.
 *
 * Conversion strategy: each row is converted at the *historical* rate for its
 * transaction date (latest published snapshot on-or-before the date, labeled
 * `estimate` when stale or when the row predates the first snapshot). Grouped
 * sums are folded from the converted rows so currency totals are additive.
 *
 * Every report degrades instead of throwing: unconvertible rows are excluded
 * from base totals, reported in `unconvertedCurrencies`, and surfaced via
 * `conversionStatus`. Native amounts always remain the source of truth.
 */

import { divideMultiplyRound2, roundHalfUp2 } from './decimal';
import type { ReportGranularity } from '../ranges';
import type {
  Budget,
  BudgetStatusItem,
  BudgetStatusReport,
  CategoryBreakdown,
  CategoryIndex,
  CategorySeries,
  CategorySeriesItem,
  CategorySeriesPoint,
  ComparisonDelta,
  ConversionStatus,
  CurrencyTotal,
  DayOfWeekItem,
  DayOfWeekReport,
  ExpenseComparison,
  ExpenseSeries,
  ExpenseSummary,
  RatePolicy,
  RateProvenance,
  RateTable,
  ReportRow,
  SeriesPoint,
} from './types';

const UNAVAILABLE = 'exchange rate snapshot unavailable';
const DEFAULT_LOOKBACK_DAYS = 10;
const DAY_MS = 86_400_000;
const MAX_BUCKETS = 800;
const FALLBACK_COLOR = '#64748b';
const FALLBACK_NAME = 'Uncategorised';

/**
 * Rounds a value to 2 decimal places using the same half-up trick the server
 * uses for accumulation, so folded sums match bit-for-bit.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------------- */
/* Calendar helpers (UTC), mirroring `expenses.utils.ts`                      */
/* ------------------------------------------------------------------------- */

/** Formats a `Date` as `YYYY-MM-DD` in UTC. */
export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Formats a `Date` as `YYYY-MM` in UTC. */
export function monthKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}

/** Parses an ISO date into a `Date` pinned to UTC midnight. */
export function toUtcDate(value: string): Date {
  const datePart = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(`${datePart}T00:00:00.000Z`);
}

/** Returns the inclusive `[start, end]` window of a `YYYY-MM` month, in UTC. */
export function monthWindow(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    // Day 0 of the following month is the last day of this one.
    end: new Date(Date.UTC(year, mon, 1) - 1),
  };
}

/** Returns the inclusive `[start, end]` window covered by a budget period. */
export function periodWindow(period: string, month: string): { start: Date; end: Date } {
  if (period === 'YEARLY') {
    const year = Number(month.slice(0, 4));
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year, 11, 31) + 86_399_999),
    };
  }
  return monthWindow(month);
}

/** UTC midnight of the Monday starting the ISO week that contains `date`. */
export function weekStart(date: Date): Date {
  const offset = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset));
}

/** The bucket key a date belongs to at the requested granularity. */
export function seriesKey(date: Date, granularity: ReportGranularity): string {
  if (granularity === 'month') return monthKey(date);
  if (granularity === 'week') return formatDate(weekStart(date));
  return formatDate(date);
}

/**
 * Every bucket key in the inclusive `[start, end]` window, oldest first, so a
 * chart's axis stays continuous through empty days/weeks/months.
 */
export function seriesBuckets(
  granularity: ReportGranularity,
  start: Date,
  end: Date,
): string[] {
  const keys: string[] = [];

  if (granularity === 'month') {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor.getTime() <= last.getTime()) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
  }

  const toDay = (value: Date) =>
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const first = granularity === 'week' ? weekStart(start) : toDay(start);
  const last = granularity === 'week' ? weekStart(end) : toDay(end);
  const step = granularity === 'week' ? 7 : 1;

  const cursor = new Date(first);
  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + step);
  }
  return keys;
}

/* ------------------------------------------------------------------------- */
/* Rate resolution                                                           */
/* ------------------------------------------------------------------------- */

export interface ResolvedSnapshot {
  table: RateTable;
  policy: RatePolicy;
}

/**
 * Picks the snapshot that converts an expense dated `dateIso`.
 *
 * - Latest snapshot with effectiveDate <= expense date → `historical` when its
 *   age is within the lookback, otherwise `estimate`.
 * - Expense predates every snapshot → the earliest snapshot, labeled `estimate`.
 * - No snapshots at all → `null` (conversion status `unavailable`).
 */
export class RateResolver {
  private readonly sorted: RateTable[];

  constructor(
    tables: readonly RateTable[],
    private readonly lookbackDays: number,
  ) {
    this.sorted = [...tables].sort(
      (a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate),
    );
  }

  resolve(dateIso: string): ResolvedSnapshot | null {
    if (this.sorted.length === 0) return null;

    const date = this.parse(dateIso);

    let index = this.sorted.length - 1;
    while (index >= 0 && this.parse(this.sorted[index].effectiveDate) > date) {
      index -= 1;
    }

    if (index >= 0) {
      const table = this.sorted[index];
      return { table, policy: this.policyFor(table.effectiveDate, dateIso) };
    }

    return { table: this.sorted[0], policy: 'estimate' };
  }

  /** Observation date of a single currency within a table. */
  rateDateFor(table: RateTable, currency: string): string {
    return table.dates?.[currency] ?? table.effectiveDate;
  }

  /** Classifies an observation date against an expense date. */
  policyFor(rateDate: string, dateIso: string): RatePolicy {
    const expense = this.parse(dateIso);
    const observed = this.parse(rateDate);
    if (observed > expense) return 'estimate';
    const gapDays = Math.floor((expense - observed) / DAY_MS);
    return gapDays <= this.lookbackDays ? 'historical' : 'estimate';
  }

  private parse(isoDate: string): number {
    return Date.parse(`${isoDate}T00:00:00.000Z`);
  }
}

export interface RateContext {
  base: string;
  resolver: RateResolver;
}

/**
 * Builds a resolver from the mirrored tables for a report ending at `endIso`,
 * matching `RatesService.getRateTablesForRange`: everything on-or-before the
 * end, or — when the whole range predates the data — the single earliest table
 * so rows resolve as a labeled estimate rather than silently today's rate.
 */
export function buildRateContext(
  base: string,
  endIso: string,
  tables: readonly RateTable[],
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
): RateContext {
  const inRange = tables.filter((t) => t.effectiveDate <= endIso);
  let list: RateTable[];
  if (inRange.length > 0) {
    list = inRange;
  } else {
    const earliest = [...tables].sort(
      (a, b) => Date.parse(a.effectiveDate) - Date.parse(b.effectiveDate),
    )[0];
    list = earliest ? [earliest] : [];
  }
  return { base: base.toUpperCase(), resolver: new RateResolver(list, lookbackDays) };
}

/** What one amount (at one date, in one currency) produced during conversion. */
export interface ConversionResolution {
  convertible: boolean;
  value: number | null;
  secondaryValue: number | null;
  rateDate: string | null;
  policy: RatePolicy | null;
  /** Multiplier actually applied (converted = amount × rate), or null when unconvertible. */
  rate?: number | null;
}

const UNCONVERTIBLE: ConversionResolution = {
  convertible: false,
  value: null,
  secondaryValue: null,
  rateDate: null,
  policy: null,
};

/**
 * Converts one amount at one historical date, reporting the rate and policy it
 * used.
 *
 * Exported for line-level consumers that need the same provenance the report
 * engine records — notably the CSV export, whose `Rate Used`/`Rate Date`/
 * `Estimated` columns mirror this resolution field-for-field. `secondary` is
 * null for single-currency output.
 */
export function convertAtDate(
  ctx: RateContext,
  amount: number | string,
  currency: string,
  dateIso: string,
  secondary: string | null = null,
): ConversionResolution {
  const code = currency.toUpperCase();
  const sec = secondary ? secondary.toUpperCase() : null;
  const wantsSecondary = sec !== null && sec !== ctx.base;

  if (code === ctx.base) {
    let secondaryValue: number | null = null;
    if (wantsSecondary) {
      const resolvedBase = ctx.resolver.resolve(dateIso);
      const secRaw = resolvedBase?.table.rates[sec];
      const baseRaw = resolvedBase?.table.rates[ctx.base];
      if (secRaw && baseRaw && Number(secRaw) !== 0 && Number(baseRaw) !== 0) {
        secondaryValue = divideMultiplyRound2(amount, baseRaw, secRaw);
      }
    }
    return {
      convertible: true,
      value: roundHalfUp2(amount),
      secondaryValue,
      rateDate: null,
      policy: 'historical',
      rate: 1,
    };
  }

  const resolved = ctx.resolver.resolve(dateIso);
  if (!resolved) return UNCONVERTIBLE;

  const fromRaw = resolved.table.rates[code];
  const toRaw = resolved.table.rates[ctx.base];
  if (!fromRaw || !toRaw || Number(fromRaw) === 0 || Number(toRaw) === 0) return UNCONVERTIBLE;

  try {
    const value = divideMultiplyRound2(amount, fromRaw, toRaw);

    let secondaryValue: number | null = null;
    if (wantsSecondary) {
      const secRaw = resolved.table.rates[sec];
      if (secRaw && Number(secRaw) !== 0) {
        secondaryValue = divideMultiplyRound2(amount, fromRaw, secRaw);
      }
    }

    // Provenance follows the *staler* of the two legs.
    const codeDate = ctx.resolver.rateDateFor(resolved.table, code);
    const baseDate = ctx.resolver.rateDateFor(resolved.table, ctx.base);
    const rateDate = codeDate < baseDate ? codeDate : baseDate;

    return {
      convertible: true,
      value,
      secondaryValue,
      rateDate,
      policy: ctx.resolver.policyFor(rateDate, dateIso),
      rate: Number(toRaw) / Number(fromRaw),
    };
  } catch {
    return UNCONVERTIBLE;
  }
}

/** Aggregates per-report conversion health and provenance. */
class ConversionTracker {
  private converted = 0;
  private unconverted = 0;
  private readonly failedCurrencies = new Set<string>();
  private readonly rateDates = new Set<string>();
  private readonly policies = new Set<RatePolicy | 'unavailable'>();

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

  get fullyConverted(): boolean {
    return this.unconverted === 0;
  }

  unconvertedCurrencies(): string[] {
    return [...this.failedCurrencies].sort();
  }

  provenance(): RateProvenance {
    const dates = [...this.rateDates].sort();
    if (this.unconverted > 0) this.policies.add('unavailable');
    return {
      earliestRateDate: dates.length > 0 ? dates[0] : null,
      latestRateDate: dates.length > 0 ? dates[dates.length - 1] : null,
      policies: [...this.policies],
    };
  }

  toReportFields(): {
    converted: boolean;
    conversionStatus: ConversionStatus;
    unconvertedCurrencies: string[];
    rateProvenance: RateProvenance;
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

/** Resolves a secondary currency, treating it as absent when it equals the base. */
export function resolveSecondary(
  secondary: string | null | undefined,
  base: string,
): string | null {
  if (!secondary) return null;
  const code = secondary.toUpperCase();
  return code === base ? null : code;
}

/** The calendar date part of an ISO date or datetime. */
function datePart(value: string): string {
  return value.length > 10 ? value.slice(0, 10) : value;
}

/**
 * Whether a row falls in the inclusive window. The server narrows each report
 * to `[from, to]` in the query; the engine does it in memory so a caller can
 * hand over every local row and still get identical aggregates.
 */
function inRange(incurredOn: string, from: string, to: string): boolean {
  const date = datePart(incurredOn);
  return date >= from && date <= to;
}

function filterRange(rows: readonly ReportRow[], from: string, to: string): ReportRow[] {
  return rows.filter((row) => inRange(row.incurredOn, from, to));
}

function metaFor(
  categories: CategoryIndex | undefined,
  categoryId: string,
): { name: string; color: string } {
  const category = categories?.get(categoryId);
  return { name: category?.name ?? FALLBACK_NAME, color: category?.color ?? FALLBACK_COLOR };
}

/* ------------------------------------------------------------------------- */
/* Summary                                                                   */
/* ------------------------------------------------------------------------- */

interface CategoryBucket {
  value: number;
  count: number;
  secondaryValue: number;
  secondaryCount: number;
}

export interface SummaryInput {
  rows: readonly ReportRow[];
  tables: readonly RateTable[];
  categories?: CategoryIndex;
  base: string;
  secondary?: string | null;
  from: string;
  to: string;
  lookbackDays?: number;
}

/** Period totals and a per-category breakdown over an inclusive date range. */
export function summarize(input: SummaryInput): ExpenseSummary {
  const baseCurrency = input.base.toUpperCase();
  const secondaryCurrency = resolveSecondary(input.secondary, baseCurrency);
  const start = toUtcDate(input.from);
  const end = toUtcDate(input.to);
  const ctx = buildRateContext(
    baseCurrency,
    formatDate(end),
    input.tables,
    input.lookbackDays,
  );

  const rows = filterRange(input.rows, formatDate(start), formatDate(end));
  const tracker = new ConversionTracker();
  const categoryBuckets = new Map<string, CategoryBucket>();
  const nativeByCurrency = new Map<string, { total: number; count: number }>();
  const convertedByCurrency = new Map<
    string,
    { total: number; secondaryTotal: number; convertedCount: number; secondaryCount: number }
  >();
  let secondarySum = 0;
  let secondaryCount = 0;

  for (const row of rows) {
    const res = convertAtDate(ctx, row.amount, row.currency, formatDate(toUtcDate(row.incurredOn)), secondaryCurrency);
    tracker.accumulate(row.currency, res);

    const native = nativeByCurrency.get(row.currency) ?? { total: 0, count: 0 };
    native.total += Number(row.amount);
    native.count += 1;
    nativeByCurrency.set(row.currency, native);

    const conv =
      convertedByCurrency.get(row.currency) ??
      { total: 0, secondaryTotal: 0, convertedCount: 0, secondaryCount: 0 };
    if (res.value !== null) {
      conv.total = round2(conv.total + res.value);
      conv.convertedCount += 1;
    }
    if (res.secondaryValue !== null) {
      conv.secondaryTotal = round2(conv.secondaryTotal + res.secondaryValue);
      conv.secondaryCount += 1;
    }
    convertedByCurrency.set(row.currency, conv);

    const bucket =
      categoryBuckets.get(row.categoryId) ??
      { value: 0, count: 0, secondaryValue: 0, secondaryCount: 0 };
    bucket.count += 1;
    if (res.value !== null) bucket.value = round2(bucket.value + res.value);
    if (res.secondaryValue !== null) {
      bucket.secondaryValue = round2(bucket.secondaryValue + res.secondaryValue);
      bucket.secondaryCount += 1;
      secondarySum = round2(secondarySum + res.secondaryValue);
      secondaryCount += 1;
    }
    categoryBuckets.set(row.categoryId, bucket);
  }

  const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
    tracker.toReportFields();

  const byCurrency: CurrencyTotal[] = [...nativeByCurrency.entries()]
    .map(([currency, v]) => {
      const conv = convertedByCurrency.get(currency);
      return {
        currency,
        total: roundHalfUp2(v.total),
        count: v.count,
        convertedTotal: conv && conv.convertedCount > 0 ? round2(conv.total) : null,
        ...(secondaryCurrency && conv && conv.secondaryCount > 0
          ? { secondaryTotal: round2(conv.secondaryTotal) }
          : {}),
      };
    })
    .sort((a, b) => b.total - a.total);

  const secondaryFields = secondaryCurrency
    ? {
        secondaryCurrency,
        secondaryTotal: secondaryCount > 0 ? secondarySum : null,
        secondaryAverage:
          secondaryCount > 0 && rows.length > 0 ? round2(secondarySum / rows.length) : null,
      }
    : {};

  if (conversionStatus === 'unavailable') {
    return {
      baseCurrency,
      converted,
      conversionUnavailableReason: UNAVAILABLE,
      conversionStatus,
      unconvertedCurrencies,
      rateProvenance,
      from: formatDate(start),
      to: formatDate(end),
      total: null,
      count: rows.length,
      average: null,
      byCategory: [],
      byCurrency,
      ...secondaryFields,
    };
  }

  const byCategory = aggregateByCategory(categoryBuckets, input.categories, secondaryCurrency);
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
    from: formatDate(start),
    to: formatDate(end),
    total,
    count: rows.length,
    average: rows.length > 0 ? round2(total / rows.length) : 0,
    byCategory,
    byCurrency,
    ...secondaryFields,
  };
}

function aggregateByCategory(
  buckets: Map<string, CategoryBucket>,
  categories: CategoryIndex | undefined,
  secondaryCurrency: string | null,
): CategoryBreakdown[] {
  return [...buckets.entries()]
    .map(([categoryId, v]) => {
      const meta = metaFor(categories, categoryId);
      return {
        categoryId,
        categoryName: meta.name,
        color: meta.color,
        total: round2(v.value),
        count: v.count,
        percentage: 0,
        ...(secondaryCurrency
          ? { secondaryTotal: v.secondaryCount > 0 ? round2(v.secondaryValue) : null }
          : {}),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------------------------------------------------- */
/* Series                                                                    */
/* ------------------------------------------------------------------------- */

export interface SeriesInput {
  rows: readonly ReportRow[];
  tables: readonly RateTable[];
  base: string;
  secondary?: string | null;
  from: string;
  to: string;
  granularity: ReportGranularity;
  lookbackDays?: number;
}

interface SeriesBucketAccumulator {
  total: number;
  convertedCount: number;
  count: number;
  secondaryTotal: number;
  secondaryCount: number;
}

function emptyAccumulator(): SeriesBucketAccumulator {
  return { total: 0, convertedCount: 0, count: 0, secondaryTotal: 0, secondaryCount: 0 };
}

/** Spending bucketed by day, week or month across an inclusive range. */
export function buildSeries(input: SeriesInput): ExpenseSeries {
  const baseCurrency = input.base.toUpperCase();
  const secondaryCurrency = resolveSecondary(input.secondary, baseCurrency);
  const start = toUtcDate(input.from);
  const end = toUtcDate(input.to);

  const buckets = seriesBuckets(input.granularity, start, end);
  if (buckets.length > MAX_BUCKETS) {
    throw new Error(
      'Requested range yields too many buckets; narrow the range or use a coarser granularity',
    );
  }

  const ctx = buildRateContext(baseCurrency, formatDate(end), input.tables, input.lookbackDays);
  const tracker = new ConversionTracker();
  const acc = new Map<string, SeriesBucketAccumulator>();

  const rows = filterRange(input.rows, formatDate(start), formatDate(end));
  for (const row of rows) {
    const res = convertAtDate(ctx, row.amount, row.currency, formatDate(toUtcDate(row.incurredOn)), secondaryCurrency);
    tracker.accumulate(row.currency, res);

    const key = seriesKey(toUtcDate(row.incurredOn), input.granularity);
    const entry = acc.get(key) ?? emptyAccumulator();
    entry.count += 1;
    if (res.value !== null) {
      entry.total = round2(entry.total + res.value);
      entry.convertedCount += 1;
    }
    if (res.secondaryValue !== null) {
      entry.secondaryTotal = round2(entry.secondaryTotal + res.secondaryValue);
      entry.secondaryCount += 1;
    }
    acc.set(key, entry);
  }

  const globallyUnavailable = tracker.status() === 'unavailable';
  const zeroTotal = globallyUnavailable ? null : 0;

  const points: SeriesPoint[] = buckets.map((bucket) => {
    const entry = acc.get(bucket);
    const point: SeriesPoint = {
      bucket,
      total: entry && entry.convertedCount > 0 ? round2(entry.total) : zeroTotal,
      count: entry?.count ?? 0,
    };
    if (secondaryCurrency) {
      point.secondaryTotal =
        entry && entry.secondaryCount > 0 ? round2(entry.secondaryTotal) : zeroTotal;
    }
    return point;
  });

  const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
    tracker.toReportFields();

  return {
    baseCurrency,
    ...(secondaryCurrency ? { secondaryCurrency } : {}),
    granularity: input.granularity,
    from: formatDate(start),
    to: formatDate(end),
    converted,
    ...(conversionStatus === 'unavailable' ? { conversionUnavailableReason: UNAVAILABLE } : {}),
    conversionStatus,
    unconvertedCurrencies,
    rateProvenance,
    points,
  };
}

export interface CategorySeriesInput extends SeriesInput {
  categories?: CategoryIndex;
}

/**
 * Per-category spending bucketed by day, week or month across an inclusive
 * range — every category the reader spent in, largest first, each with a
 * continuous zero-filled series.
 */
export function buildCategorySeries(input: CategorySeriesInput): CategorySeries {
  const baseCurrency = input.base.toUpperCase();
  const secondaryCurrency = resolveSecondary(input.secondary, baseCurrency);
  const start = toUtcDate(input.from);
  const end = toUtcDate(input.to);

  const buckets = seriesBuckets(input.granularity, start, end);
  if (buckets.length > MAX_BUCKETS) {
    throw new Error(
      'Requested range yields too many buckets; narrow the range or use a coarser granularity',
    );
  }

  const ctx = buildRateContext(baseCurrency, formatDate(end), input.tables, input.lookbackDays);
  const tracker = new ConversionTracker();
  const byCategory = new Map<string, Map<string, SeriesBucketAccumulator>>();
  const categoryTotals = new Map<string, number>();

  const rows = filterRange(input.rows, formatDate(start), formatDate(end));
  for (const row of rows) {
    const res = convertAtDate(ctx, row.amount, row.currency, formatDate(toUtcDate(row.incurredOn)), secondaryCurrency);
    tracker.accumulate(row.currency, res);

    const month = seriesKey(toUtcDate(row.incurredOn), input.granularity);
    let months = byCategory.get(row.categoryId);
    if (!months) {
      months = new Map();
      byCategory.set(row.categoryId, months);
    }
    const entry = months.get(month) ?? emptyAccumulator();
    entry.count += 1;
    if (res.value !== null) {
      entry.total = round2(entry.total + res.value);
      entry.convertedCount += 1;
      categoryTotals.set(row.categoryId, round2((categoryTotals.get(row.categoryId) ?? 0) + res.value));
    }
    if (res.secondaryValue !== null) {
      entry.secondaryTotal = round2(entry.secondaryTotal + res.secondaryValue);
      entry.secondaryCount += 1;
    }
    months.set(month, entry);
  }

  const topIds = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const globallyUnavailable = tracker.status() === 'unavailable';
  const zeroTotal = globallyUnavailable ? null : 0;

  const series: CategorySeriesItem[] = topIds.map((categoryId) => {
    const months = byCategory.get(categoryId);
    const meta = metaFor(input.categories, categoryId);
    const categoryPoints: CategorySeriesPoint[] = buckets.map((bucket) => {
      const entry = months?.get(bucket);
      const point: CategorySeriesPoint = {
        bucket,
        total: entry && entry.convertedCount > 0 ? round2(entry.total) : zeroTotal,
      };
      if (secondaryCurrency) {
        point.secondaryTotal =
          entry && entry.secondaryCount > 0 ? round2(entry.secondaryTotal) : zeroTotal;
      }
      return point;
    });
    return {
      categoryId,
      categoryName: meta.name,
      color: meta.color,
      points: categoryPoints,
    };
  });

  const { converted, conversionStatus, unconvertedCurrencies, rateProvenance } =
    tracker.toReportFields();

  return {
    baseCurrency,
    ...(secondaryCurrency ? { secondaryCurrency } : {}),
    granularity: input.granularity,
    from: formatDate(start),
    to: formatDate(end),
    converted,
    ...(conversionStatus === 'unavailable' ? { conversionUnavailableReason: UNAVAILABLE } : {}),
    conversionStatus,
    unconvertedCurrencies,
    rateProvenance,
    buckets,
    series,
  };
}

/* ------------------------------------------------------------------------- */
/* Day of week                                                               */
/* ------------------------------------------------------------------------- */

export interface DayOfWeekInput {
  rows: readonly ReportRow[];
  tables: readonly RateTable[];
  base: string;
  secondary?: string | null;
  from: string;
  to: string;
  lookbackDays?: number;
}

/** Totals bucketed into the seven UTC weekdays. */
export function byDayOfWeek(input: DayOfWeekInput): DayOfWeekReport {
  const baseCurrency = input.base.toUpperCase();
  const secondaryCurrency = resolveSecondary(input.secondary, baseCurrency);
  const start = toUtcDate(input.from);
  const end = toUtcDate(input.to);
  const ctx = buildRateContext(baseCurrency, formatDate(end), input.tables, input.lookbackDays);

  const tracker = new ConversionTracker();
  const buckets = new Map<number, { total: number; count: number; secondaryTotal: number }>();

  const rows = filterRange(input.rows, formatDate(start), formatDate(end));
  for (const row of rows) {
    const incurredOn = toUtcDate(row.incurredOn);
    const res = convertAtDate(ctx, row.amount, row.currency, formatDate(incurredOn), secondaryCurrency);
    tracker.accumulate(row.currency, res);

    const dow = incurredOn.getUTCDay();
    const value = res.value !== null ? res.value : 0;
    const secondaryValue = res.secondaryValue !== null ? res.secondaryValue : 0;
    const bucket = buckets.get(dow);
    if (bucket) {
      bucket.total = round2(bucket.total + value);
      bucket.secondaryTotal = round2(bucket.secondaryTotal + secondaryValue);
      bucket.count += 1;
    } else {
      buckets.set(dow, {
        total: round2(value),
        count: 1,
        secondaryTotal: round2(secondaryValue),
      });
    }
  }

  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const items: DayOfWeekItem[] = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const bucket = buckets.get(dow);
    const total = bucket?.total ?? 0;
    const count = bucket?.count ?? 0;
    return {
      dow,
      label: labels[dow],
      total: round2(total),
      count,
      average: count > 0 ? round2(total / count) : 0,
      ...(secondaryCurrency ? { secondaryTotal: round2(bucket?.secondaryTotal ?? 0) } : {}),
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
    ...(secondaryCurrency ? { secondaryCurrency } : {}),
    items,
  };
}

/* ------------------------------------------------------------------------- */
/* Comparison                                                                */
/* ------------------------------------------------------------------------- */

export interface ComparisonInput {
  rows: readonly ReportRow[];
  tables: readonly RateTable[];
  categories?: CategoryIndex;
  base: string;
  secondary?: string | null;
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
  lookbackDays?: number;
}

/** Compare two arbitrary periods (e.g. MoM). */
export function compare(input: ComparisonInput): ExpenseComparison {
  const current = summarize({
    rows: input.rows,
    tables: input.tables,
    categories: input.categories,
    base: input.base,
    secondary: input.secondary,
    from: input.currentFrom,
    to: input.currentTo,
    lookbackDays: input.lookbackDays,
  });
  const previous = summarize({
    rows: input.rows,
    tables: input.tables,
    categories: input.categories,
    base: input.base,
    secondary: input.secondary,
    from: input.previousFrom,
    to: input.previousTo,
    lookbackDays: input.lookbackDays,
  });

  const delta = calculateDelta(current, previous);
  const merged = mergeStatus(current, previous);

  return {
    baseCurrency: current.baseCurrency,
    converted: merged.converted,
    ...(merged.conversionStatus === 'unavailable'
      ? { conversionUnavailableReason: UNAVAILABLE }
      : {}),
    conversionStatus: merged.conversionStatus,
    unconvertedCurrencies: merged.unconvertedCurrencies,
    rateProvenance: merged.rateProvenance,
    current,
    previous,
    delta,
  };
}

function mergeStatus(
  current: ExpenseSummary,
  previous: ExpenseSummary,
): {
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
} {
  const statuses = [current.conversionStatus, previous.conversionStatus];
  const conversionStatus: ConversionStatus = statuses.every((s) => s === 'converted')
    ? 'converted'
    : statuses.every((s) => s === 'unavailable')
      ? 'unavailable'
      : 'partially_converted';

  const unconvertedCurrencies = [
    ...new Set([...(current.unconvertedCurrencies ?? []), ...(previous.unconvertedCurrencies ?? [])]),
  ].sort();

  const rateDates = [
    current.rateProvenance?.earliestRateDate,
    current.rateProvenance?.latestRateDate,
    previous.rateProvenance?.earliestRateDate,
    previous.rateProvenance?.latestRateDate,
  ].filter((d): d is string => Boolean(d));

  const policies = [
    ...new Set([...(current.rateProvenance?.policies ?? []), ...(previous.rateProvenance?.policies ?? [])]),
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

function calculateDelta(current: ExpenseSummary, previous: ExpenseSummary): ComparisonDelta {
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

  return { totalAbs, totalPct, countAbs, countPct };
}

/* ------------------------------------------------------------------------- */
/* Budget status                                                             */
/* ------------------------------------------------------------------------- */

export interface BudgetStatusInput {
  budgets: readonly Budget[];
  rows: readonly ReportRow[];
  tables: readonly RateTable[];
  categories?: CategoryIndex;
  base: string;
  secondary?: string | null;
  month: string;
  lookbackDays?: number;
}

/** Budget-vs-actual for every budget that overlaps the evaluated period. */
export function budgetStatus(input: BudgetStatusInput): BudgetStatusReport {
  const baseCurrency = input.base.toUpperCase();
  const secondaryCurrency = resolveSecondary(input.secondary, baseCurrency);
  const month = input.month;

  if (input.budgets.length === 0) {
    return {
      baseCurrency,
      converted: true,
      conversionStatus: 'converted',
      unconvertedCurrencies: [],
      rateProvenance: { earliestRateDate: null, latestRateDate: null, policies: [] },
      ...(secondaryCurrency ? { secondaryCurrency } : {}),
      month,
      items: [],
    };
  }

  const windows = input.budgets.map((b) => periodWindow(b.period, month));
  const rangeStart = new Date(Math.min(...windows.map((w) => w.start.getTime())));
  const rangeEnd = new Date(Math.max(...windows.map((w) => w.end.getTime())));
  const ctx = buildRateContext(baseCurrency, formatDate(rangeEnd), input.tables, input.lookbackDays);

  const reportTracker = new ConversionTracker();

  const items: BudgetStatusItem[] = input.budgets.map((budget, index) => {
    const window = windows[index];
    const budgetStart = toUtcDate(budget.startDate);
    const effectiveStart = budgetStart > window.start ? budgetStart : window.start;
    const applied = effectiveStart <= window.end;

    const itemTracker = new ConversionTracker();
    let spent = 0;
    let secondarySpent = 0;
    let secondarySpentRows = 0;

    if (applied) {
      for (const expense of input.rows) {
        if (budget.categoryId && expense.categoryId !== budget.categoryId) continue;
        const incurredOn = toUtcDate(expense.incurredOn);
        if (incurredOn < effectiveStart || incurredOn > window.end) continue;

        const res = convertAtDate(ctx, expense.amount, expense.currency, formatDate(incurredOn), secondaryCurrency);
        itemTracker.accumulate(expense.currency, res);
        reportTracker.accumulate(expense.currency, res);
        if (res.value !== null) spent = round2(spent + res.value);
        if (res.secondaryValue !== null) {
          secondarySpent = round2(secondarySpent + res.secondaryValue);
          secondarySpentRows += 1;
        }
      }
    }

    const budgetRes = convertAtDate(
      ctx,
      budget.amount,
      budget.currency,
      formatDate(effectiveStart),
      secondaryCurrency,
    );

    const budgetConvertible = budgetRes.convertible;
    const budgetAmount = budgetConvertible ? (budgetRes.value as number) : Number(budget.amount);
    const spentConvertible = itemTracker.fullyConverted;

    const remaining = round2(budgetAmount - spent);
    const percentage = budgetAmount > 0 ? round2((spent / budgetAmount) * 100) : 0;

    const meta = budget.categoryId ? input.categories?.get(budget.categoryId) : undefined;

    const secondaryFields = secondaryCurrency
      ? {
          secondaryBudgetAmount: budgetRes.secondaryValue,
          secondarySpent: secondarySpentRows > 0 ? secondarySpent : null,
          secondaryRemaining:
            budgetRes.secondaryValue !== null && secondarySpentRows > 0
              ? round2(budgetRes.secondaryValue - secondarySpent)
              : null,
        }
      : {};

    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      categoryName: meta?.name ?? null,
      color: meta?.color ?? null,
      period: budget.period,
      budgetAmount,
      budgetAmountNative: Number(budget.amount),
      budgetCurrency: budget.currency,
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
      ...secondaryFields,
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
    ...(secondaryCurrency ? { secondaryCurrency } : {}),
    month,
    items,
  };
}
