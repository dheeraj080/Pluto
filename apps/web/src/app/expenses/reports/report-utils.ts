"use client";

/**
 * Small, shared pieces of report formatting and bucket arithmetic.
 *
 * The rate shown in a tooltip is derived from the very two amounts on screen
 * (secondary ÷ primary), so it can never disagree with the numbers beside it:
 * for a day bucket it is the day's rate, and for a wider bucket it is the
 * blended average across the days in that bucket.
 */

import { addDaysIso, type ReportGranularity } from "@/lib/ranges";
import { formatBucket, formatMonth, formatRangeLabel } from "@/lib/format";

/** Inclusive `YYYY-MM-DD` bounds of one chart bucket. */
export function bucketBounds(bucket: string, granularity: ReportGranularity): { from: string; to: string } {
  if (granularity === "month") {
    const [year, month] = bucket.split("-").map(Number);
    const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${bucket}-01`, to: `${bucket}-${String(end).padStart(2, "0")}` };
  }
  if (granularity === "week") {
    return { from: bucket, to: addDaysIso(bucket, 6) };
  }
  return { from: bucket, to: bucket };
}

/** A human heading for a bucket, naming the whole period it covers. */
export function bucketHeading(bucket: string, granularity: ReportGranularity): string {
  if (granularity === "month") return formatMonth(bucket);
  if (granularity === "week") return `Week of ${formatRangeLabel(bucket, addDaysIso(bucket, 6))}`;
  return formatRangeLabel(bucket, bucket);
}

/** Compact axis tick for a bucket key. */
export function bucketAxis(bucket: string, granularity: ReportGranularity): string {
  if (granularity === "month") return formatMonth(bucket);
  return formatBucket(bucket);
}

/** A rate value with just enough precision to be useful. */
export function formatRateValue(rate: number): string {
  return rate.toLocaleString(undefined, {
    maximumFractionDigits: rate >= 100 ? 2 : 4,
    minimumFractionDigits: 0,
  });
}

/**
 * The effective Pair rate implied by a primary/secondary pair of amounts, or
 * null when it cannot be derived (no secondary, or nothing spent).
 */
export function effectiveRate(
  primary: number | null | undefined,
  secondary: number | null | undefined,
): number | null {
  if (primary == null || secondary == null || primary <= 0) return null;
  return secondary / primary;
}

/** Tolerance for treating two independently-rounded totals as equal. */
export const CONSISTENCY_TOLERANCE = 0.05;

/** True when two figures agree to within a cent or two of rounding. */
export function agree(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return true;
  return Math.abs(a - b) <= CONSISTENCY_TOLERANCE;
}
