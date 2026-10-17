import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import type {
  ByDayOfWeekResponse,
  CategorySeries,
  ExpenseComparison,
  ExpenseSeries,
} from '@/lib/report-types';
import { expenseQueryParams } from '@/lib/query-keys';
import type { CategoryStore, ExpenseStore, ReportStore } from './types';

type ExpenseCategoryDto = Schemas['ExpenseCategoryDto'];

/**
 * Web fallback: every operation is a direct request.
 *
 * The browser has no local database (`expo-sqlite` needs COOP/COEP headers the
 * web target does not set), so the web build keeps the original online-only
 * behaviour behind the same seam the native build exposes.
 */
export const remoteExpenseStore: ExpenseStore = {
  list: (filters, page, limit, options) =>
    api.get<Schemas['PaginatedExpensesResponseDto']>('/expenses', {
      query: expenseQueryParams(filters, page, limit),
      signal: options?.signal,
    }),
  get: (id, options) =>
    api.get<Schemas['ExpenseDto']>(`/expenses/${id}`, { signal: options?.signal }),
  create: (input) => api.post<Schemas['ExpenseDto']>('/expenses', input),
  update: (id, input) => api.patch<Schemas['ExpenseDto']>(`/expenses/${id}`, input),
  remove: (id) => api.delete<unknown>(`/expenses/${id}`).then(() => undefined),
};

export const remoteCategoryStore: CategoryStore = {
  list: () => api.get<ExpenseCategoryDto[]>('/expenses/categories'),
  refresh: () => api.get<ExpenseCategoryDto[]>('/expenses/categories'),
};

/**
 * Web fallback for reports: the original online-only behaviour, behind the same
 * seam the native build exposes.
 */
export const remoteReportStore: ReportStore = {
  comparison: (params, options) =>
    api.get<ExpenseComparison>('/expenses/comparison', {
      query: {
        currentFrom: params.currentFrom,
        currentTo: params.currentTo,
        previousFrom: params.previousFrom,
        previousTo: params.previousTo,
        base: params.base,
        secondary: params.secondary,
      },
      signal: options?.signal,
    }),
  byDayOfWeek: (params, options) =>
    api.get<ByDayOfWeekResponse>('/expenses/by-day-of-week', {
      query: {
        from: params.from,
        to: params.to,
        base: params.base,
        secondary: params.secondary,
      },
      signal: options?.signal,
    }),
  series: (params, options) =>
    api.get<ExpenseSeries>('/expenses/series', {
      query: {
        from: params.from,
        to: params.to,
        base: params.base,
        secondary: params.secondary,
        granularity: params.granularity,
      },
      signal: options?.signal,
    }),
  categorySeries: (params, options) =>
    api.get<CategorySeries>('/expenses/category-series', {
      query: {
        from: params.from,
        to: params.to,
        base: params.base,
        secondary: params.secondary,
        granularity: params.granularity,
      },
      signal: options?.signal,
    }),
  budgetStatus: (params, options) =>
    api.get<Schemas['BudgetStatusResponseDto']>('/expenses/budgets/status', {
      query: {
        month: params.month,
        base: params.base,
        secondary: params.secondary,
      },
      signal: options?.signal,
    }),
};
