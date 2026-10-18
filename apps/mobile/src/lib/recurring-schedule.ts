/**
 * Cadence arithmetic for recurring rules.
 *
 * A rule is an anchor date plus a cadence; each occurrence is derived
 * arithmetically rather than by iterating, and everything works on UTC
 * `YYYY-MM-DD` boundaries. This mirrors the server's
 * `recurring-schedule.util.ts` so a rule created offline can show the same
 * "next due" the server would compute from its own generated occurrences.
 *
 * It is used only for a rule the device has just created: once the rule reaches
 * the server, the next fetch carries its authoritative `nextDueOn` and
 * `pendingCount` and overwrites the local estimate.
 */

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurrenceSpec {
  startDate: string;
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string | null;
}

const MS_PER_DAY = 86_400_000;

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function formatIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Number of days in a UTC month (day 0 of the next month is the last of this one). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `date` shifted by whole UTC days. */
function addDays(date: Date, days: number): Date {
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
export function occurrenceAt(startDate: string, spec: RecurrenceSpec, index: number): string {
  const anchor = parseIso(startDate);
  const step = Math.max(1, Math.trunc(spec.interval));
  switch (spec.frequency) {
    case 'WEEKLY':
      return formatIso(addDays(anchor, index * step * 7));
    case 'YEARLY':
      return formatIso(addMonthsClamped(anchor, index * step * 12));
    default:
      return formatIso(addMonthsClamped(anchor, index * step));
  }
}

/** The first day of the period (week/month/year) that contains `date`, in UTC. */
export function startOfPeriod(date: string, frequency: RecurrenceFrequency): string {
  const value = parseIso(date);
  if (frequency === 'WEEKLY') {
    const offset = (value.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    return formatIso(addDays(value, -offset));
  }
  if (frequency === 'YEARLY') {
    return formatIso(new Date(Date.UTC(value.getUTCFullYear(), 0, 1)));
  }
  return formatIso(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)));
}

/** The later of two ISO dates (lexicographic order is chronological for ISO). */
export function maxIso(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * A rough starting index for the scan, so a rule anchored long ago does not walk
 * one period at a time from the beginning. Off by one on purpose.
 */
function estimateIndex(startDate: Date, from: Date, frequency: RecurrenceFrequency, step: number): number {
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

export interface DueDateWindow extends RecurrenceSpec {
  /** Generate occurrences strictly after this date. */
  fromExclusive: string;
  /** Never generate an occurrence after this date. */
  toInclusive: string;
  /** Safety cap on how many occurrences one call may return. */
  limit?: number;
}

/** Every occurrence due in `(fromExclusive, toInclusive]`, oldest first. */
export function dueDates(window: DueDateWindow): string[] {
  const { startDate, frequency, interval, endDate, fromExclusive, toInclusive } = window;
  const limit = window.limit ?? 400;
  const step = Math.max(1, Math.trunc(interval));
  const start = parseIso(startDate);
  const from = parseIso(fromExclusive);
  const to = parseIso(toInclusive);
  const end = endDate ? parseIso(endDate) : null;
  const out: string[] = [];

  if (to.getTime() < start.getTime()) return out;

  let index = Math.max(0, estimateIndex(start, from, frequency, step) - 1);
  for (let scanned = 0; scanned < limit + 2; scanned += 1) {
    const date = parseIso(occurrenceAt(startDate, { startDate, frequency, interval: step }, index));
    if (end && date.getTime() > end.getTime()) break;
    if (date.getTime() > to.getTime()) break;
    if (date.getTime() > from.getTime()) {
      out.push(formatIso(date));
      if (out.length >= limit) break;
    }
    index += 1;
  }

  return out;
}

/** The first occurrence strictly after `after`, or `null` if the series has ended. */
export function nextDueOn(spec: RecurrenceSpec & { after: string }): string | null {
  const end = spec.endDate ? parseIso(spec.endDate) : null;
  const after = parseIso(spec.after);
  if (end && end.getTime() <= after.getTime()) return null;

  const horizon = formatIso(addMonthsClamped(parseIso(spec.startDate), 12 * 50));
  const [first] = dueDates({ ...spec, fromExclusive: spec.after, toInclusive: horizon, limit: 1 });
  return first ?? null;
}

/**
 * The date of a freshly created rule's next charge.
 *
 * The server seeds a new rule's generation cursor at the current period's start,
 * so the charge it will materialise first is the cadence date in
 * `(max(startDate, periodStart), today]` — or, when the anchor is in the future,
 * the anchor itself. A locally created rule mirrors no occurrences (their
 * server-minted ids are what a confirm needs), so it reports `pendingCount` 0;
 * this is the honest "next" to show in its place until the first sync.
 */
export function nextDueOnForNewRule(spec: RecurrenceSpec, today: string): string | null {
  const fromExclusive = formatIso(
    addDays(parseIso(maxIso(spec.startDate, startOfPeriod(today, spec.frequency))), -1),
  );
  const pending = dueDates({ ...spec, fromExclusive, toInclusive: today, limit: 1 });
  return pending[0] ?? nextDueOn({ ...spec, after: today });
}
