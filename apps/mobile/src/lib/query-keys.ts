import type { ReportGranularity } from './ranges';

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

/** Filters for `GET /expenses/budgets/status`. */
export interface BudgetStatusParams {
  /** Evaluated month, `YYYY-MM`. */
  month: string;
  base?: string;
  secondary?: string;
}

/**
 * Report filters shared by every aggregate endpoint.
 *
 * A `type` alias rather than an `interface`, deliberately: only aliases get an
 * implicit index signature, which is what makes this object assignable to the
 * API client's `Record<string, QueryValue>` query parameter. `base`/`secondary`
 * are `string | undefined` rather than `string | null`, so one object can both
 * key the query cache and build the request — `null` and `undefined` would be
 * two cache entries for one logical request.
 */
export type ReportQueryParams = {
  from: string;
  to: string;
  base?: string;
  secondary?: string;
};

/** A report query that also chooses the chart bucket size. */
export type ReportSeriesParams = ReportQueryParams & {
  granularity: ReportGranularity;
};

/**
 * Filters for `GET /rates/history`.
 *
 * A type alias, like `ReportQueryParams`, so it is assignable to the API
 * client's query record; `quote` is optional so the key can be built before a
 * second currency is chosen (the query stays disabled until one is).
 */
export type RateHistoryParams = {
  base?: string;
  quote?: string;
  from?: string;
  to?: string;
};

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
  recurring: {
    all: ['recurring'] as const,
    rules: () => ['recurring', 'rules'] as const,
    occurrences: (status?: string) => ['recurring', 'occurrences', status ?? 'all'] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },
  currencies: {
    all: ['currencies'] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    status: (params: BudgetStatusParams) => ['budgets', 'status', params] as const,
  },
  reports: {
    all: ['reports'] as const,
    comparison: (params: ReportQueryParams) => ['reports', 'comparison', params] as const,
    byDayOfWeek: (params: ReportQueryParams) => ['reports', 'by-day-of-week', params] as const,
    series: (params: ReportSeriesParams) => ['reports', 'series', params] as const,
    categorySeries: (params: ReportSeriesParams) => ['reports', 'category-series', params] as const,
  },
  /**
   * Keys the dashboard owns.
   *
   * Deliberately separate from `reports.comparison`: both compare two windows,
   * but the dashboard pairs month-to-date with *the same days of last month*
   * while a report range pairs with the trailing window of equal length. Same
   * parameters, different requests — so they must not share a cache entry.
   */
  dashboard: {
    all: ['dashboard'] as const,
    comparison: (params: ReportQueryParams) => ['dashboard', 'comparison', params] as const,
  },
  rates: {
    all: ['rates'] as const,
    latest: (base?: string) => ['rates', 'latest', base ?? null] as const,
    history: (params: RateHistoryParams) => ['rates', 'history', params] as const,
  },
};
