import { RecurrenceFrequency } from '@prisma/client';

/**
 * Date arithmetic for recurring-expense rules.
 *
 * Everything here works in UTC on `@db.Date` boundaries, matching the rest of
 * the expense module (see `expenses.utils.ts`). A rule is an anchor date plus a
 * cadence; the `index`-th occurrence is derived arithmetically rather than by
 * iterating, so a rule anchored years ago costs nothing to evaluate.
 */

const MS_PER_DAY = 86_400_000;

/** Number of days in a UTC month (day 0 of the next month is the last of this one). */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `date` shifted by whole UTC days. */
export function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** `date` shifted by whole UTC months, clamping the day to the target month's length. */
function addMonthsClamped(anchor: Date, monthsToAdd: number): Date {
  const total = anchor.getUTCMonth() + monthsToAdd;
  const year = anchor.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

/**
 * The occurrence at 0-based `index` in the series anchored at `startDate`.
 *
 * `MONTHLY`/`YEARLY` clamp to the target month's last day, so a rule anchored
 * on the 31st yields the 30th in April and recovers the 31st in May.
 */
export function occurrenceAt(
  startDate: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  index: number,
): Date {
  const step = Math.max(1, Math.trunc(interval));
  switch (frequency) {
    case 'WEEKLY':
      return addDays(startDate, index * step * 7);
    case 'YEARLY':
      return addMonthsClamped(startDate, index * step * 12);
    case 'MONTHLY':
    default:
      return addMonthsClamped(startDate, index * step);
  }
}

/** The first day of the period (week/month/year) that contains `date`, in UTC. */
export function startOfPeriod(date: Date, frequency: RecurrenceFrequency): Date {
  if (frequency === 'WEEKLY') {
    const offset = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    return addDays(date, -offset);
  }
  if (frequency === 'YEARLY') {
    return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * A rough starting index for the scan, so a rule anchored long ago does not
 * walk one period at a time from the beginning. Off by one on purpose: the
 * caller starts here and skips anything not strictly after `from`.
 */
function estimateIndex(
  startDate: Date,
  from: Date,
  frequency: RecurrenceFrequency,
  step: number,
): number {
  if (from.getTime() <= startDate.getTime()) return 0;
  if (frequency === 'WEEKLY') {
    return Math.floor(Math.floor((from.getTime() - startDate.getTime()) / MS_PER_DAY) / (7 * step));
  }
  if (frequency === 'YEARLY') {
    return Math.floor((from.getUTCFullYear() - startDate.getUTCFullYear()) / step);
  }
  const months =
    (from.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (from.getUTCMonth() - startDate.getUTCMonth());
  return Math.floor(months / step);
}

export interface DueDateWindow {
  startDate: Date;
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: Date | null;
  /** Generate occurrences strictly after this date. */
  fromExclusive: Date;
  /** Never generate an occurrence after this date. */
  toInclusive: Date;
  /** Safety cap on how many occurrences one call may return. */
  limit?: number;
}

/** Every occurrence due in `(fromExclusive, toInclusive]`, oldest first. */
export function computeDueDates(window: DueDateWindow): Date[] {
  const { startDate, frequency, interval, endDate, fromExclusive, toInclusive } = window;
  const limit = window.limit ?? 400;
  const step = Math.max(1, Math.trunc(interval));
  const out: Date[] = [];

  if (toInclusive.getTime() < startDate.getTime()) return out;

  let index = Math.max(0, estimateIndex(startDate, fromExclusive, frequency, step) - 1);
  for (let scanned = 0; scanned < limit + 2; scanned += 1) {
    const date = occurrenceAt(startDate, frequency, step, index);
    if (endDate && date.getTime() > endDate.getTime()) break;
    if (date.getTime() > toInclusive.getTime()) break;
    if (date.getTime() > fromExclusive.getTime()) {
      out.push(date);
      if (out.length >= limit) break;
    }
    index += 1;
  }

  return out;
}

/** The first occurrence strictly after `after`, or `null` if the series has ended. */
export function nextDueDate(params: {
  startDate: Date;
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: Date | null;
  after: Date;
}): Date | null {
  if (params.endDate && params.endDate.getTime() <= params.after.getTime()) return null;
  const horizon = addMonthsClamped(params.startDate, 12 * 50);
  const [first] = computeDueDates({
    ...params,
    fromExclusive: params.after,
    toInclusive: horizon,
    limit: 1,
  });
  return first ?? null;
}
