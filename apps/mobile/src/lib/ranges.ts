/**
 * Date-range helpers for the dashboard and reports.
 *
 * The implementations live in `@pluto/domain` so both clients share one
 * definition; this module keeps the `@/lib/ranges` import path stable.
 *
 * The *anchor* is local — "today" and the "this month / this week" windows
 * follow the device calendar, so "This month" means the month the user is
 * living in. Stored and bucketed values stay UTC (see the domain source).
 */

export {
  ISO_DATE,
  REPORT_PRESETS,
  addDaysIso,
  bucketBounds,
  compareWindows,
  diffDays,
  granularityFor,
  granularityLabel,
  isoDaysAgo,
  monthEndIso,
  monthStartIso,
  monthToDate,
  periodRange,
  reportRange,
  shiftMonth,
  startOfMonthIso,
  startOfMonthsAgoIso,
  startOfWeekIso,
  startOfYearIso,
  todayIso,
  windowFor,
  withPrevious,
} from '@pluto/domain';
export type {
  CompareRange,
  CompareWindows,
  DateWindow,
  MonthWindow,
  Period,
  Range,
  ReportGranularity,
  ReportPreset,
  ReportRange,
  WindowKind,
} from '@pluto/domain';
