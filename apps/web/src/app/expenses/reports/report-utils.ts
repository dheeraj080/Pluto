"use client";

/**
 * Small, shared pieces of report formatting and bucket arithmetic.
 *
 * The bucket bounds and the rate helpers are identical on both clients and live
 * in `@pluto/domain`. The heading/axis helpers stay here because each client
 * words a bucket with its own date formatters.
 *
 * The rate shown in a tooltip is derived from the very two amounts on screen
 * (secondary ÷ primary), so it can never disagree with the numbers beside it:
 * for a day bucket it is the day's rate, and for a wider bucket it is the
 * blended average across the days in that bucket.
 */

import { addDaysIso, type ReportGranularity } from "@/lib/ranges";
import { formatBucket, formatMonth, formatRangeLabel } from "@/lib/format";

export { bucketBounds, effectiveRate, formatRateValue } from "@pluto/domain";

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

/** Tolerance for treating two independently-rounded totals as equal. */
export const CONSISTENCY_TOLERANCE = 0.05;

/** True when two figures agree to within a cent or two of rounding. */
export function agree(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return true;
  return Math.abs(a - b) <= CONSISTENCY_TOLERANCE;
}
