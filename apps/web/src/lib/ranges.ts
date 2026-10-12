/**
 * Date-range helpers for the expense screens.
 *
 * Every bound is an inclusive `YYYY-MM-DD` string, matching the server's
 * `from`/`to` semantics. Dates are computed in UTC so a range cannot shift
 * across a timezone boundary (a browser an hour ahead of the server must still
 * agree on which day "today" is).
 *
 * Extracted from the dashboard so the day/week/month windows, the period
 * picker and any future screen all agree on what a range means.
 */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as `YYYY-MM-DD` (UTC). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** `days` days before `now`, as `YYYY-MM-DD` (UTC). */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** First day of the current calendar month, as `YYYY-MM-DD` (UTC). */
export function startOfMonthIso(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** January 1st of the current year, as `YYYY-MM-DD` (UTC). */
export function startOfYearIso(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-01-01`;
}

/** Monday of the current ISO week, as `YYYY-MM-DD` (UTC). */
export function startOfWeekIso(now: Date = new Date()): string {
  const day = now.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const daysSinceMonday = (day + 6) % 7;
  return isoDaysAgo(daysSinceMonday, now);
}

/** `iso` shifted by `days` (which may be negative), as `YYYY-MM-DD`. */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** First day of the month `monthsBack` months before `now`, as `YYYY-MM-DD`. */
export function monthStartIso(monthsBack: number, now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
    .toISOString()
    .slice(0, 10);
}

/** Last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthEndIso(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
}

export interface MonthWindow {
  /** 1st of the current month. */
  from: string;
  /** Today. */
  to: string;
  /** The same day-of-month range in the previous month (clamped to its length). */
  prevFrom: string;
  prevTo: string;
  /** Total days in the current month. */
  daysInMonth: number;
  /** Days after today, for a "per day" budget breakdown. */
  daysLeft: number;
  /** Day-of-month of today, 1–31. */
  todayDay: number;
}

/**
 * Month-to-date, paired with the *same days of the previous month* rather than
 * a full month. Comparing 1–12 Oct with all of September would make a partial
 * month look like a saving; this keeps the two windows the same length.
 */
export function monthToDate(now: Date = new Date()): MonthWindow {
  const from = startOfMonthIso(now);
  const to = todayIso(now);
  const todayDay = now.getUTCDate();

  const prevMonthKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
  const prevFrom = `${prevMonthKey}-01`;
  const prevEnd = monthEndIso(prevMonthKey);
  const candidate = addDaysIso(prevFrom, todayDay - 1);
  const prevTo = candidate <= prevEnd ? candidate : prevEnd;

  const daysInMonth = Number(monthEndIso(from.slice(0, 7)).slice(8, 10));
  return { from, to, prevFrom, prevTo, daysInMonth, daysLeft: daysInMonth - todayDay, todayDay };
}

export type CompareRange = "month" | "3m" | "12m";

export interface CompareWindows {
  current: { from: string; to: string };
  previous: { from: string; to: string };
  /** Bucket size the series endpoint should use for both windows. */
  granularity: "day" | "month";
}

/**
 * The two windows behind the "this period vs the last one" chart.
 *
 * - `month`: day buckets, this month-to-date against the same days last month.
 * - `3m`: day buckets over the trailing three months against the three before.
 * - `12m`: month buckets over the trailing twelve months against the twelve
 *   before, which keeps the point count readable without thinning ticks.
 */
export function compareWindows(range: CompareRange, now: Date = new Date()): CompareWindows {
  const today = todayIso(now);

  if (range === "month") {
    const window = monthToDate(now);
    return {
      current: { from: window.from, to: window.to },
      previous: { from: window.prevFrom, to: window.prevTo },
      granularity: "day",
    };
  }

  if (range === "3m") {
    const from = monthStartIso(2, now);
    const length = diffDays(from, today) + 1;
    const prevTo = addDaysIso(from, -1);
    const prevFrom = addDaysIso(prevTo, -(length - 1));
    return {
      current: { from, to: today },
      previous: { from: prevFrom, to: prevTo },
      granularity: "day",
    };
  }

  const from = monthStartIso(11, now);
  return {
    current: { from, to: today },
    previous: { from: monthStartIso(23, now), to: addDaysIso(from, -1) },
    granularity: "month",
  };
}

/** Whole days between two `YYYY-MM-DD` bounds (`to - from`). */
export function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

export interface DateWindow {
  from: string;
  to: string;
  /** Immediately preceding window of the same length, for like-for-like deltas. */
  prevFrom: string;
  prevTo: string;
}

/** Pairs `[from, to]` with the equal-length window directly before it. */
export function withPrevious(from: string, to: string): DateWindow {
  const length = Math.max(1, diffDays(from, to) + 1);
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(length - 1));
  return { from, to, prevFrom, prevTo };
}

export type WindowKind = "day" | "week" | "month";

/**
 * The current day / ISO week (Mon–Sun) / calendar month, each paired with the
 * immediately preceding window of the same length so deltas compare like with
 * like.
 */
export function windowFor(kind: WindowKind, now: Date = new Date()): DateWindow {
  const today = todayIso(now);
  switch (kind) {
    case "day":
      return withPrevious(today, today);
    case "week":
      return withPrevious(startOfWeekIso(now), today);
    case "month":
      return withPrevious(startOfMonthIso(now), today);
  }
}

export type Period = "month" | "30d" | "year" | "all" | "custom";

export interface Range extends DateWindow {
  /** False when a comparison window is not meaningful (all time / open range). */
  comparable: boolean;
}

/** Resolves the period picker's selection into concrete bounds. */
export function periodRange(
  period: Period,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): Range {
  const today = todayIso(now);
  let from = today;
  let to = today;
  let comparable = true;

  switch (period) {
    case "month":
      from = startOfMonthIso(now);
      break;
    case "30d":
      from = isoDaysAgo(29, now);
      break;
    case "year":
      from = startOfYearIso(now);
      break;
    case "all":
      from = "1970-01-01";
      comparable = false;
      break;
    case "custom":
      from = customFrom || "1970-01-01";
      to = customTo || today;
      comparable = Boolean(customFrom && customTo);
      break;
  }

  return { ...withPrevious(from, to), comparable };
}

/* ------------------------------------------------------------------ */
/* Reports: one global range control                                   */
/* ------------------------------------------------------------------ */

export type ReportPreset = "month" | "3m" | "6m" | "12m" | "custom";

export const REPORT_PRESETS: ReadonlyArray<{ value: ReportPreset; label: string }> = [
  { value: "month", label: "This month" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "custom", label: "Custom" },
];

/** First day of the month `monthsBack` months ago, as `YYYY-MM-DD` (UTC). */
export function startOfMonthsAgoIso(monthsBack: number, now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
    .toISOString()
    .slice(0, 10);
}

export interface ReportRange extends DateWindow {
  preset: ReportPreset;
}

/**
 * Resolves the Reports range control into concrete bounds, always paired with
 * the immediately preceding window of equal length so every "vs previous"
 * figure compares like with like.
 */
export function reportRange(
  preset: ReportPreset,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): ReportRange {
  const today = todayIso(now);
  let from: string;
  let to = today;

  switch (preset) {
    case "month":
      from = startOfMonthIso(now);
      break;
    case "3m":
      from = startOfMonthsAgoIso(2, now);
      break;
    case "6m":
      from = startOfMonthsAgoIso(5, now);
      break;
    case "12m":
      from = startOfMonthsAgoIso(11, now);
      break;
    case "custom":
      from = customFrom || startOfMonthsAgoIso(11, now);
      to = customTo || today;
      break;
  }

  // Keep a custom range well-formed no matter which bound was set first.
  if (from > to) [from, to] = [to, from];

  return { preset, ...withPrevious(from, to) };
}

export type ReportGranularity = "day" | "week" | "month";

/**
 * Chart bucket size for a range: daily for about a month, weekly through a
 * quarter, monthly beyond that. So This month draws every day, 3M draws weeks,
 * and 6M / 12M draw months — never twelve points for a single month. Keeps the
 * axis readable at every preset without the caller choosing.
 */
export function granularityFor(from: string, to: string): ReportGranularity {
  const days = Math.max(1, diffDays(from, to) + 1);
  if (days <= 45) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** Human label for a granularity, used in card subtitles. */
export function granularityLabel(granularity: ReportGranularity): string {
  switch (granularity) {
    case "day":
      return "daily";
    case "week":
      return "weekly";
    case "month":
      return "monthly";
  }
}
