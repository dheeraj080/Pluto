/**
 * Small, shared pieces of report formatting and bucket arithmetic.
 *
 * The bucket bounds and the rate helpers are identical on both clients and live
 * in `@pluto/domain`; the heading/axis helpers stay here because each client
 * words a bucket with its own date formatters. The rate shown beside a bucket
 * is derived from the two amounts actually on screen (secondary ÷ primary), so
 * it can never disagree with the figures next to it.
 */

import { addDaysIso, diffDays, type ReportGranularity } from '@/lib/ranges';
import { formatAsOf, formatDateRange, formatMonth } from '@/lib/format';
import type { DayOfWeekItem } from '@/lib/report-types';

export { bucketBounds, effectiveRate, formatRateValue } from '@pluto/domain';

/** A human heading for a bucket, naming the whole period it covers. */
export function bucketHeading(bucket: string, granularity: ReportGranularity): string {
  if (granularity === 'month') return formatMonth(bucket);
  if (granularity === 'week') return `Week of ${formatDateRange(bucket, addDaysIso(bucket, 6))}`;
  return formatDateRange(bucket, bucket);
}

/** Compact axis tick for a bucket key. */
export function bucketAxis(bucket: string, granularity: ReportGranularity): string {
  if (granularity === 'month') return formatMonth(bucket);
  return formatAsOf(bucket);
}

/**
 * Reads a rate-snapshot date out of a `RateProvenance`.
 *
 * The generator renders the `IsDateString`-typed `earliestRateDate` /
 * `latestRateDate` properties as `Record<string, never>` (the server reflects
 * the union as `Object`), so the runtime string has to be recovered by a shape
 * check rather than trusted from the type.
 */
export function rateDate(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export interface DayOfWeekRow {
  /** JavaScript day-of-week index, 0 = Sunday. */
  dow: number;
  /** Short label for the axis, e.g. "Mon". */
  label: string;
  /** Full name for the insight, e.g. "Monday". */
  full: string;
  /** Average primary-currency spend per occurrence of this weekday. */
  average: number;
  /** Average secondary-currency spend per occurrence, when available. */
  secondaryAverage: number | null;
  /** Total primary-currency spend on this weekday. */
  total: number;
  /** Number of expenses recorded on this weekday. */
  count: number;
  /** How many times this weekday occurs inside the range. */
  occurrences: number;
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Chart order: Monday first, matching the app's week. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Occurrence count for each weekday (indexed by dow) across an inclusive range. */
function weekdayCounts(from: string, to: string): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const days = diffDays(from, to);
  for (let offset = 0; offset <= days; offset += 1) {
    const dow = new Date(`${addDaysIso(from, offset)}T00:00:00Z`).getUTCDay();
    counts[dow] += 1;
  }
  return counts;
}

/**
 * The chart rows: the server's per-weekday totals divided by how often each
 * weekday occurs inside the range, so the line is a fair per-day average.
 */
export function dayOfWeekRows(items: DayOfWeekItem[], from: string, to: string): DayOfWeekRow[] {
  const counts = weekdayCounts(from, to);
  return DOW_ORDER.map((dow) => {
    const item = items.find((entry) => entry.dow === dow);
    const occurrences = counts[dow] || 1;
    const total = item?.total ?? 0;
    const secondaryTotal = item?.secondaryTotal ?? null;
    return {
      dow,
      label: DOW_SHORT[dow],
      full: DOW_FULL[dow],
      average: total / occurrences,
      secondaryAverage: secondaryTotal == null ? null : secondaryTotal / occurrences,
      total,
      count: item?.count ?? 0,
      occurrences,
    };
  });
}

/** The busiest weekday's share of the range total, 0–100. */
export function peakShare(rows: DayOfWeekRow[], peak: DayOfWeekRow | null): number {
  if (!peak) return 0;
  const sum = rows.reduce((total, row) => total + row.total, 0);
  if (sum <= 0) return 0;
  return (peak.total / sum) * 100;
}

export interface TrendRow {
  key: string;
  current: number | null;
  currentSecond: number | null;
  previous: number | null;
  previousSecond: number | null;
}

/**
 * Rows for the comparison line: the current series verbatim, and the previous
 * series aligned from the most recent bucket so equal-length windows line up
 * even when a week/month boundary adds one bucket at the far end.
 */
export function buildTrendRows(
  currentPoints: { bucket: string; total?: number | null; secondaryTotal?: number | null }[],
  previousPoints: { bucket: string; total?: number | null; secondaryTotal?: number | null }[],
): TrendRow[] {
  const offset = previousPoints.length - currentPoints.length;
  return currentPoints.map((point, index) => {
    const prev = previousPoints[index + offset];
    return {
      key: point.bucket,
      current: point.total ?? null,
      currentSecond: point.secondaryTotal ?? null,
      previous: prev?.total ?? null,
      previousSecond: prev?.secondaryTotal ?? null,
    };
  });
}

/** Running totals across the buckets, for the cumulative reading. */
export function toCumulative(rows: TrendRow[]): TrendRow[] {
  let current = 0;
  let previous = 0;
  let currentSecond = 0;
  let previousSecond = 0;
  return rows.map((row) => {
    current += row.current ?? 0;
    previous += row.previous ?? 0;
    currentSecond += row.currentSecond ?? 0;
    previousSecond += row.previousSecond ?? 0;
    return { key: row.key, current, currentSecond, previous, previousSecond };
  });
}
