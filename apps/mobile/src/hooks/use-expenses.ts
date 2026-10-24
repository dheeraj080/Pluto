import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { expenseStore, reportStore } from '@/lib/store';
import { queryKeys, type ExpenseListFilters, type ExpenseSummaryParams } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

/** Page size for the expense list. */
const PAGE_SIZE = 20;

/**
 * Paged, filtered expense list.
 *
 * Reads the local store on native — so it works offline and reflects a write the
 * moment it is made — and the API on web. The next page is still derived from
 * `total` rather than "a short page means the end", because `limit` can be
 * clamped server-side and a page can legitimately come back shorter.
 */
export function useExpenseList(filters: ExpenseListFilters) {
  const { status, mode } = useSession();

  const query = useInfiniteQuery({
    queryKey: queryKeys.expenses.list(filters),
    enabled: status === 'signed-in' || mode === 'local',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      expenseStore.list(filters, pageParam, PAGE_SIZE, { signal }),
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  };
}

/**
 * Period totals and the per-category breakdown.
 *
 * Reads the report store: computed on-device from the expense mirror on
 * native — so the figures load with no connection at all — and a
 * `GET /expenses/summary` request on web. The dateless default (current
 * calendar month through today) is applied by the store, keeping both
 * platforms on the window the server would have chosen.
 */
export function useExpenseSummary(params: ExpenseSummaryParams = {}) {
  const { status, mode } = useSession();

  return useQuery({
    queryKey: queryKeys.expenses.summary(params),
    enabled: status === 'signed-in' || mode === 'local',
    queryFn: ({ signal }) => reportStore.summary(params, { signal }),
  });
}
