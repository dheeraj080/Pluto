import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import {
  expenseQueryParams,
  queryKeys,
  type ExpenseListFilters,
  type ExpenseSummaryParams,
} from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

/** The server caps `limit` at 50. */
const PAGE_SIZE = 20;

/**
 * Paged, filtered expense list.
 *
 * The next page is derived from `total` rather than "a short page means the
 * end", because `limit` is clamped server-side and a page can legitimately come
 * back shorter than requested.
 */
export function useExpenseList(filters: ExpenseListFilters) {
  const { status } = useSession();

  const query = useInfiniteQuery({
    queryKey: queryKeys.expenses.list(filters),
    enabled: status === 'signed-in',
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.get<Schemas['PaginatedExpensesResponseDto']>('/expenses', {
        query: expenseQueryParams(filters, pageParam, PAGE_SIZE),
        signal,
      }),
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  };
}

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
