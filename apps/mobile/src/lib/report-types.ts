/**
 * Report payload types.
 *
 * The generated spec publishes no content type for `GET /expenses/comparison` or
 * `GET /expenses/by-day-of-week` — both operations declare `content?: never` —
 * so those two shapes are stated here, mirroring `apps/web/src/lib/types.ts`.
 * Everywhere the spec does have a schema it is reused rather than restated, so
 * a server-side field addition reaches this file for free.
 */

import type { Schemas } from '@pluto/api-client';

export type ExpenseSummary = Schemas['ExpenseSummaryDto'];
export type CategoryBreakdown = Schemas['CategoryBreakdownDto'];
export type CurrencyTotal = Schemas['CurrencyTotalDto'];
export type RateProvenance = Schemas['RateProvenanceDto'];
export type ConversionStatus = ExpenseSummary['conversionStatus'];

export type ExpenseSeries = Schemas['ExpenseSeriesDto'];
export type SeriesPoint = Schemas['SeriesPointDto'];
export type CategorySeries = Schemas['CategorySeriesResponseDto'];
export type CategorySeriesItem = Schemas['CategorySeriesItemDto'];
export type CategorySeriesPoint = Schemas['CategorySeriesPointDto'];

/** One weekday's spend over a range, averaged across the weekdays it contains. */
export interface DayOfWeekItem {
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  label: string;
  total: number;
  count: number;
  average: number;
  secondaryTotal?: number | null;
}

export interface ByDayOfWeekResponse {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  secondaryCurrency?: string | null;
  items: DayOfWeekItem[];
}

/** How far the selected window moved against the one before it. */
export interface ComparisonDelta {
  totalAbs: number;
  totalPct: number;
  countAbs: number;
  countPct: number;
}

/**
 * The selected window against the equal-length one before it.
 *
 * One request carries both summaries and the delta between them, so a "vs
 * previous" figure can never be computed from two responses that disagree about
 * the rate snapshot.
 */
export interface ExpenseComparison {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  current: ExpenseSummary;
  previous: ExpenseSummary;
  delta: ComparisonDelta;
}
