import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { expenseStore } from '@/lib/store';
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
  const { status } = useSession();

  const query = useInfiniteQuery({
    queryKey: queryKeys.expenses.list(filters),
    enabled: status === 'signed-in',
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
 * Server-computed totals for the dashboard.
 *
 * Still a request in this phase (reports move on-device later), so it needs a
 * connection and reflects synced expenses only.
 */
export function useExpenseSummary(params: ExpenseSummaryParams = {}) {
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.expenses.summary(params),
    enabled: status === 'signed-in',
    queryFn: () =>
      api.get<Schemas['ExpenseSummaryDto']>('/expenses/summary', {
        query: { from: params.from, to: params.to, base: params.base },
      }),
  });
}
