/**
 * Dashboard aggregates.
 *
 * The dashboard is organised around the questions a person actually asks — "how
 * much this month?", "am I on budget?", "faster or slower than last month?" —
 * so the month is compared **month-to-date against the same days of the previous
 * month**, never a partial month against a whole one.
 *
 * The deeper series — spending over time — belong to the Reports tab and are
 * loaded through `use-reports`, not here.
 *
 * The web app coordinates these with hand-rolled keyed state; TanStack Query
 * already does that job here.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { reportStore } from '@/lib/store';
import { queryKeys } from '@/lib/query-keys';
import type { ExpenseComparison } from '@/lib/report-types';
import { monthToDate, type MonthWindow } from '@/lib/ranges';
import { errorMessage } from '@/lib/errors';
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
    queryFn: ({ signal }) =>
      reportStore.comparison(
        {
          currentFrom: window.from,
          currentTo: window.to,
          previousFrom: window.prevFrom,
          previousTo: window.prevTo,
          base: key.base,
          secondary: key.secondary,
        },
        { signal },
      ),
  });

  return {
    comparison: query.data ?? null,
    window,
    loading: query.isPending,
    error: query.isError ? (errorMessage(query.error) ?? 'Failed to load your spending.') : null,
    refetch: () => void query.refetch(),
  };
}
