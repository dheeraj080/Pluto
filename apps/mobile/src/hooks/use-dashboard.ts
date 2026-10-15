/**
 * Dashboard aggregates.
 *
 * The dashboard is organised around the questions a person actually asks — "how
 * much this month?", "am I on budget?", "faster or slower than last month?" —
 * so the month is compared **month-to-date against the same days of the previous
 * month**, never a partial month against a whole one.
 *
 * The web app coordinates these with hand-rolled keyed state; TanStack Query
 * already does that job here.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { ComparisonRow } from '@/components/charts';
import type { ExpenseComparison, ExpenseSeries } from '@/lib/report-types';
import { compareWindows, monthToDate, type CompareRange, type MonthWindow } from '@/lib/ranges';
import { errorMessage } from '@/lib/errors';
import { useReportSeries } from '@/hooks/use-reports';
import { useSession } from '@/hooks/use-session';

/**
 * Percent change against the same days of last month, or null when a delta
 * would be misleading.
 *
 * A window whose currencies could not all be converted has no single total, and
 * a zero previous month has no meaningful percentage — both read "—" rather
 * than a fabricated figure.
 */
export function comparisonDeltaPct(comparison: ExpenseComparison | null): number | null {
  if (!comparison || !comparison.converted) return null;
  const { current, previous } = comparison;
  if (current.total == null || previous.total == null || previous.total <= 0) return null;
  return Number.isFinite(comparison.delta.totalPct) ? comparison.delta.totalPct : null;
}

export interface MonthComparison {
  comparison: ExpenseComparison | null;
  window: MonthWindow;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Month-to-date in the Pair, compared with the same days of last month. */
export function useMonthComparison(base: string | null, second: string | null): MonthComparison {
  const { status } = useSession();
  const window = useMemo(() => monthToDate(), []);
  const key = useMemo(
    () => ({
      from: window.from,
      to: window.to,
      base: base ?? undefined,
      secondary: second ?? undefined,
    }),
    [window, base, second],
  );

  const query = useQuery({
    queryKey: queryKeys.dashboard.comparison(key),
    enabled: status === 'signed-in',
    queryFn: () =>
      api.get<ExpenseComparison>('/expenses/comparison', {
        query: {
          currentFrom: window.from,
          currentTo: window.to,
          previousFrom: window.prevFrom,
          previousTo: window.prevTo,
          base: key.base,
          secondary: key.secondary,
        },
      }),
  });

  return {
    comparison: query.data ?? null,
    window,
    loading: query.isPending,
    error: query.isError ? (errorMessage(query.error) ?? 'Failed to load your spending.') : null,
    refetch: () => void query.refetch(),
  };
}

export interface ComparisonSeries {
  rows: ComparisonRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Two cumulative series — the selected window and the equivalent one before —
 * aligned index by index so the lines can be read against each other.
 *
 * Two ordinary series queries rather than a bespoke paired loader: each caches
 * under its own bounds, so flipping between This month / 3M / 12M and back is
 * served from cache.
 */
export function useComparisonSeries(
  range: CompareRange,
  base: string | null,
  second: string | null,
): ComparisonSeries {
  const windows = useMemo(() => compareWindows(range), [range]);

  const current = useReportSeries({
    from: windows.current.from,
    to: windows.current.to,
    granularity: windows.granularity,
    base,
    secondary: second,
  });
  const previous = useReportSeries({
    from: windows.previous.from,
    to: windows.previous.to,
    granularity: windows.granularity,
    base,
    secondary: second,
  });

  const rows = useMemo(
    () => cumulativeRows(current.data ?? null, previous.data ?? null),
    [current.data, previous.data],
  );

  return {
    rows,
    loading: current.isPending || previous.isPending,
    error:
      current.isError || previous.isError
        ? (errorMessage(current.error ?? previous.error) ?? 'Failed to load the spending series.')
        : null,
    refetch: () => {
      void current.refetch();
      void previous.refetch();
    },
  };
}

/**
 * Accumulates two bucketed series into the two rising lines the chart draws.
 *
 * Index-aligned rather than date-joined: the two windows are the same length by
 * construction, so bucket *i* of the previous window is the fair comparison for
 * bucket *i* of the current one. A null total leaves the running sum where it
 * was, so a day with no spending reads as "unchanged" rather than a gap.
 */
function cumulativeRows(current: ExpenseSeries | null, previous: ExpenseSeries | null): ComparisonRow[] {
  const cur = current?.points ?? [];
  const prev = previous?.points ?? [];
  const length = Math.max(cur.length, prev.length);
  const rows: ComparisonRow[] = [];

  let sumCurrent = 0;
  let sumPrevious = 0;
  let sumCurrentSecond = 0;
  let sumPreviousSecond = 0;
  let sawCurrentSecond = false;
  let sawPreviousSecond = false;

  for (let index = 0; index < length; index += 1) {
    const c = cur[index];
    const p = prev[index];

    let currentTotal: number | null = null;
    let previousTotal: number | null = null;

    if (c && c.total != null) {
      sumCurrent += c.total;
      currentTotal = sumCurrent;
    }
    if (p && p.total != null) {
      sumPrevious += p.total;
      previousTotal = sumPrevious;
    }
    if (c?.secondaryTotal != null) {
      sumCurrentSecond += c.secondaryTotal;
      sawCurrentSecond = true;
    }
    if (p?.secondaryTotal != null) {
      sumPreviousSecond += p.secondaryTotal;
      sawPreviousSecond = true;
    }

    rows.push({
      key: c?.bucket ?? p?.bucket ?? String(index),
      current: currentTotal,
      previous: previousTotal,
      currentSecond: sawCurrentSecond ? sumCurrentSecond : null,
      previousSecond: sawPreviousSecond ? sumPreviousSecond : null,
    });
  }

  return rows;
}
