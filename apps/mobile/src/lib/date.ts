/**
 * Date helpers for the Activity list.
 *
 * Everything is computed on the *device's local calendar*: "this month" and
 * "today" must mean what the user is living in, not UTC. Bounds are inclusive
 * `YYYY-MM-DD` strings, matching the server's `from`/`to` semantics.
 */

import { formatDate } from './format';

const MS_PER_DAY = 86_400_000;

/** A `Date` as `YYYY-MM-DD` in local time. */
export function localIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A human label for a calendar date: "Today", "Yesterday", or a formatted date.
 *
 * `formatDate` is UTC-based (it appends `T00:00:00Z`), which is correct here
 * because the value is already a plain calendar date.
 */
export function dateLabel(iso: string, now: Date = new Date()): string {
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return formatDate(iso);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((today.getTime() - day.getTime()) / MS_PER_DAY);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatDate(iso);
}

/** The current calendar month in local time: the 1st through today, inclusive. */
export function thisMonthRange(now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: localIso(from), to: localIso(now) };
}

/** The previous calendar month in local time. */
export function lastMonthRange(now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Day 0 of the current month is the last day of the previous one.
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: localIso(from), to: localIso(to) };
}
