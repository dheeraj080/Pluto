import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys, type ReportQueryParams, type ReportSeriesParams } from '@/lib/query-keys';
import type {
  ByDayOfWeekResponse,
  CategorySeries,
  ExpenseComparison,
  ExpenseSeries,
} from '@/lib/report-types';
import { withPrevious, type ReportGranularity } from '@/lib/ranges';
import { useSession } from '@/hooks/use-session';

/**
 * Report aggregates.
 *
 * The web app coordinates these with hand-rolled keyed state; TanStack Query
 * already does that job here, so each loader is a plain `useQuery` keyed by its
 * parameters. Changing the range therefore reuses the cache for windows already
 * seen instead of refetching one the user just left.
 *
 * Every request passes `secondary` through, so the server can express each
 * figure in both halves of the Pair from one resolved rate snapshot.
 *
 * The comparison is the anchor: `ExpenseComparisonDto.current` is a full
 * summary (its `byCategory` and `byCurrency` are the same figures the stand-alone
 * `/expenses/summary` returns), so the Overview and the Breakdown read from one
 * request instead of two that could disagree. Everything else is lazy — each
 * hook takes an `enabled` flag so a chart that is not on screen fires nothing.
 */

interface RangeParams {
  from: string;
  to: string;
  base?: string | null;
  secondary?: string | null;
  /** False to keep the query idle until the view that needs it is shown. */
  enabled?: boolean;
}

/**
 * Narrow `null` to `undefined` before the parameters reach the key or the
 * request: `?base=` would be a 400, and `null` vs `undefined` would otherwise
 * be two cache entries for one logical request.
 */
function normalize(params: RangeParams): ReportQueryParams {
  return {
    from: params.from,
    to: params.to,
    base: params.base ?? undefined,
    secondary: params.secondary ?? undefined,
  };
}

/**
 * The range in force against the equal-length window immediately before it.
 *
 * One request returns both summaries, so the "vs previous" pills and the deltas
 * they show can never be built from two responses that disagree about the rate
 * snapshot.
 */
export function useReportComparison(params: RangeParams) {
  const { status } = useSession();
  const query = normalize(params);
  const window = useMemo(() => withPrevious(query.from, query.to), [query.from, query.to]);

  return useQuery({
    queryKey: queryKeys.reports.comparison(query),
    enabled: status === 'signed-in' && (params.enabled ?? true),
    queryFn: () =>
      api.get<ExpenseComparison>('/expenses/comparison', {
        query: {
          currentFrom: window.from,
          currentTo: window.to,
          previousFrom: window.prevFrom,
          previousTo: window.prevTo,
          base: query.base,
          secondary: query.secondary,
        },
      }),
  });
}

/** The weekday profile: spend per weekday, averaged over its occurrences. */
export function useReportByDayOfWeek(params: RangeParams) {
  const { status } = useSession();
  const query = normalize(params);

  return useQuery({
    queryKey: queryKeys.reports.byDayOfWeek(query),
    enabled: status === 'signed-in' && (params.enabled ?? true),
    queryFn: () => api.get<ByDayOfWeekResponse>('/expenses/by-day-of-week', { query }),
  });
}

/**
 * One bucketed series.
 *
 * Called twice by the Reports screen — once for the selected window and once for
 * the window before it — rather than through a combined loader: two plain
 * queries cache independently and are each reused when the range returns to a
 * window already fetched.
 */
export function useReportSeries(params: RangeParams & { granularity: ReportGranularity }) {
  const { status } = useSession();
  const query = normalize(params);
  const keyed: ReportSeriesParams = { ...query, granularity: params.granularity };

  return useQuery({
    queryKey: queryKeys.reports.series(keyed),
    enabled: status === 'signed-in' && (params.enabled ?? true),
    queryFn: () =>
      api.get<ExpenseSeries>('/expenses/series', {
        query: { ...query, granularity: params.granularity },
      }),
  });
}

/** Per-category totals per bucket, for the category section's "over time" view. */
export function useReportCategorySeries(params: RangeParams & { granularity: ReportGranularity }) {
  const { status } = useSession();
  const query = normalize(params);
  const keyed: ReportSeriesParams = { ...query, granularity: params.granularity };

  return useQuery({
    queryKey: queryKeys.reports.categorySeries(keyed),
    enabled: status === 'signed-in' && (params.enabled ?? true),
    queryFn: () =>
      api.get<CategorySeries>('/expenses/category-series', {
        query: { ...query, granularity: params.granularity },
      }),
  });
}
