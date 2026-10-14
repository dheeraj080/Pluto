/**
 * Pure date-range helpers, ported from `apps/web/src/lib/ranges.ts`.
 *
 * Every bound is an inclusive `YYYY-MM-DD` string and every computation is UTC,
 * matching the server's `from`/`to` semantics: a device an hour ahead of the
 * server must still agree on which day "today" is.
 *
 * Only the helpers the mobile screens need so far live here; the web file's
 * period-preset and report-range resolvers arrive with the Reports screen.
 */

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

/** First day of the current calendar month, as `YYYY-MM-DD` (UTC). */
export function startOfMonthIso(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthEndIso(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
}

/** A `YYYY-MM` bucket shifted by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Bounds of the window of the same length immediately before `[from, to]`. */
export function withPrevious(
  from: string,
  to: string,
): { from: string; to: string; prevFrom: string; prevTo: string } {
  const length = Math.max(1, diffDays(from, to) + 1);
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(length - 1));
  return { from, to, prevFrom, prevTo };
}
