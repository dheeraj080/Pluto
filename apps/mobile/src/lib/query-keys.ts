/** Matches the server's `EXPENSE_SORTS`; the spec types it as a string union. */
export type ExpenseSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export const SORT_OPTIONS: { value: ExpenseSort; label: string }[] = [
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
  { value: 'amount_desc', label: 'Highest' },
  { value: 'amount_asc', label: 'Lowest' },
];

export interface ExpenseListFilters {
  sort: ExpenseSort;
  search?: string;
  categoryId?: string;
  currency?: string;
  from?: string;
  to?: string;
}

export interface ExpenseSummaryParams {
  from?: string;
  to?: string;
  base?: string;
}

/**
 * Builds the query object for `GET /expenses`.
 *
 * Absent filters are omitted rather than sent as empty strings: the server
 * validates `from`/`to` as ISO dates and `currency` as exactly three letters,
 * so a blank value would be a 400 rather than "no filter".
 */
export function expenseQueryParams(
  filters: ExpenseListFilters,
  page: number,
  limit: number,
): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit, sort: filters.sort };

  const search = filters.search?.trim();
  if (search) params.search = search;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.currency) params.currency = filters.currency;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;

  return params;
}

export const queryKeys = {
  expenses: {
    all: ['expenses'] as const,
    list: (filters: ExpenseListFilters) => ['expenses', 'list', filters] as const,
    detail: (id: string) => ['expenses', 'detail', id] as const,
    summary: (params: ExpenseSummaryParams) => ['expenses', 'summary', params] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },
  currencies: {
    all: ['currencies'] as const,
  },
};
