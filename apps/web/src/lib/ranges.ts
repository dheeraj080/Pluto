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
function withPrevious(from: string, to: string): DateWindow {
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
