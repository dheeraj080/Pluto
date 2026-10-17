/**
 * Structural report shapes shared by the clients.
 *
 * These mirror the server's report DTOs field-for-field so a payload computed
 * on-device is assignable to the API type the screens already consume. They are
 * stated here rather than imported from `@pluto/api-client` because this
 * package is framework-free and dependency-light by design.
 */

import type { ReportGranularity } from '../ranges';

/** Whether a conversion used the true transaction-date cycle or a labeled approximation. */
export type RatePolicy = 'historical' | 'estimate';

/**
 * Aggregated conversion health of a report payload:
 * - `converted`           — every line converted
 * - `partially_converted` — some lines converted, some could not
 * - `unavailable`         — nothing could be converted
 */
export type ConversionStatus = 'converted' | 'partially_converted' | 'unavailable';

/**
 * One immutable, already-persisted rate snapshot ready for point-in-time
 * conversion. `rates` maps a quote currency to "units per 1 unit of
 * `baseCurrency`", serialized as exact decimal strings.
 */
export interface RateTable {
  version: number;
  baseCurrency: string;
  effectiveDate: string;
  provider: string;
  rates: Record<string, string>;
  /** Per-currency observation date; falls back to `effectiveDate` when absent. */
  dates?: Record<string, string>;
}

/** Which snapshots/policies actually fed a report, for auditability. */
export interface RateProvenance {
  earliestRateDate: string | null;
  latestRateDate: string | null;
  policies: (RatePolicy | 'unavailable')[];
}

/** Category display metadata joined into a report. */
export interface ReportCategory {
  id: string;
  name: string;
  color: string;
}

export type CategoryIndex = ReadonlyMap<string, ReportCategory>;

/** One expense line as the aggregation needs it. */
export interface ReportRow {
  amount: number | string;
  currency: string;
  /** Calendar date (`YYYY-MM-DD`). */
  incurredOn: string;
  categoryId: string;
  description?: string | null;
}

/** One budget as the status report needs it. */
export interface Budget {
  id: string;
  categoryId: string | null;
  amount: number | string;
  currency: string;
  /** `MONTHLY` | `YEARLY`. */
  period: string;
  /** Calendar date (`YYYY-MM-DD`) the budget takes effect. */
  startDate: string;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
  convertedTotal: number | null;
  secondaryTotal?: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
  secondaryTotal?: number | null;
}

export interface ExpenseSummary {
  baseCurrency: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  from: string;
  to: string;
  total: number | null;
  count: number;
  average: number | null;
  byCategory: CategoryBreakdown[];
  byCurrency: CurrencyTotal[];
  secondaryCurrency?: string;
  secondaryTotal?: number | null;
  secondaryAverage?: number | null;
}

export interface SeriesPoint {
  bucket: string;
  total: number | null;
  count: number;
  secondaryTotal?: number | null;
}

export interface ExpenseSeries {
  baseCurrency: string;
  secondaryCurrency?: string;
  granularity: ReportGranularity;
  from: string;
  to: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  points: SeriesPoint[];
}

export interface CategorySeriesPoint {
  bucket: string;
  total: number | null;
  secondaryTotal?: number | null;
}

export interface CategorySeriesItem {
  categoryId: string;
  categoryName: string;
  color: string;
  points: CategorySeriesPoint[];
}

export interface CategorySeries {
  baseCurrency: string;
  secondaryCurrency?: string;
  granularity: ReportGranularity;
  from: string;
  to: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  buckets: string[];
  series: CategorySeriesItem[];
}

export interface DayOfWeekItem {
  dow: number;
  label: string;
  total: number;
  count: number;
  average: number;
  secondaryTotal?: number;
}

export interface DayOfWeekReport {
  baseCurrency: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  secondaryCurrency?: string;
  items: DayOfWeekItem[];
}

export interface ComparisonDelta {
  totalAbs: number;
  totalPct: number;
  countAbs: number;
  countPct: number;
}

export interface ExpenseComparison {
  baseCurrency: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  current: ExpenseSummary;
  previous: ExpenseSummary;
  delta: ComparisonDelta;
}

export interface BudgetStatusItem {
  budgetId: string;
  categoryId: string | null;
  categoryName: string | null;
  color: string | null;
  period: string;
  budgetAmount: number;
  budgetAmountNative: number;
  budgetCurrency: string;
  spent: number;
  remaining: number;
  percentage: number;
  currency: string;
  overBudget: boolean;
  applied: boolean;
  convertedAmount: number | null;
  convertedCurrency: string | null;
  rateDate: string | null;
  ratePolicy: RatePolicy | null;
  conversionStatus: ConversionStatus;
  secondaryBudgetAmount?: number | null;
  secondarySpent?: number | null;
  secondaryRemaining?: number | null;
}

export interface BudgetStatusReport {
  baseCurrency: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  secondaryCurrency?: string;
  month: string;
  items: BudgetStatusItem[];
}
