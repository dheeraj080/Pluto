import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import type {
  ByDayOfWeekResponse,
  CategorySeries,
  ExpenseComparison,
  ExpenseSeries,
} from '@/lib/report-types';
import { expenseQueryParams } from '@/lib/query-keys';
import type {
  BudgetStore,
  CategoryStore,
  CreateBudgetInput,
  CreateCategoryInput,
  CreateExpenseInput,
  ExpenseStore,
  ReportStore,
  UpdateBudgetInput,
  UpdateCategoryInput,
  UpdateExpenseInput,
} from './types';

type ExpenseCategoryDto = Schemas['ExpenseCategoryDto'];

/**
 * Web fallback: every operation is a direct request.
 *
 * The browser has no local database (`expo-sqlite` needs COOP/COEP headers the
 * web target does not set), so the web build keeps the original online-only
 * behaviour behind the same seam the native build exposes.
 */
export const remoteExpenseStore: ExpenseStore = {
  list: (filters: any, page: number, limit: number, options?: any) =>
    api.get<Schemas['PaginatedExpensesResponseDto']>('/expenses', {
      query: expenseQueryParams(filters, page, limit),
      signal: options?.signal,
    }),
  get: (id: string, options?: { signal?: AbortSignal }) =>
    api.get<Schemas['ExpenseDto']>(`/expenses/${id}`, { signal: options?.signal }),
  create: (input: CreateExpenseInput) => api.post<Schemas['ExpenseDto']>('/expenses', input),
  update: (id: string, input: UpdateExpenseInput) => api.patch<Schemas['ExpenseDto']>(`/expenses/${id}`, input),
  remove: (id: string) => api.delete<unknown>(`/expenses/${id}`).then(() => undefined),
};

export const remoteCategoryStore: CategoryStore = {
  list: () => api.get<ExpenseCategoryDto[]>('/expenses/categories'),
  refresh: () => api.get<ExpenseCategoryDto[]>('/expenses/categories'),
  create: (input: CreateCategoryInput) => api.post<Schemas['ExpenseCategoryDto']>('/expenses/categories', input),
  update: (id: string, input: UpdateCategoryInput) => api.patch<Schemas['ExpenseCategoryDto']>(`/expenses/categories/${id}`, input),
  remove: (id: string, options?: { reassignTo?: string }) =>
    api.delete<Record<string, never>>(`/expenses/categories/${id}`, {
      query: options?.reassignTo ? { reassignTo: options.reassignTo } : undefined,
    }).then(() => undefined),
};

/** Web fallback for budget writes: the original online-only requests. */
export const remoteBudgetStore: BudgetStore = {
  create: (input: CreateBudgetInput) => api.post<Schemas['BudgetDto']>('/expenses/budgets', input),
  update: (id: string, input: UpdateBudgetInput) => api.patch<Schemas['BudgetDto']>(`/expenses/budgets/${id}`, input),
  remove: (id: string) => api.delete<unknown>(`/expenses/budgets/${id}`).then(() => undefined),
};

/**
 * Web fallback for reports: the original online-only behaviour, behind the same
 * seam the native build exposes.
 */
export const remoteReportStore: ReportStore = {
  comparison: (params: any, options: any) =>
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
  byDayOfWeek: (params: any, options: any) =>
    api.get<ByDayOfWeekResponse>('/expenses/by-day-of-week', {
      query: {
        from: params.from,
        to: params.to,
        base: params.base,
        secondary: params.secondary,
      },
      signal: options?.signal,
    }),
  series: (params: any, options: any) =>
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
  categorySeries: (params: any, options: any) =>
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
  budgetStatus: (params: any, options: any) =>
    api.get<Schemas['BudgetStatusResponseDto']>('/expenses/budgets/status', {
      query: {
        month: params.month,
        base: params.base,
        secondary: params.secondary,
      },
      signal: options?.signal,
    }),
  summary: (params: any, options: any) =>
    api.get<Schemas['ExpenseSummaryDto']>('/expenses/summary', {
      query: {
        from: params.from,
        to: params.to,
        base: params.base,
        secondary: params.secondary,
      },
      signal: options?.signal,
    }),
  exportCsv: (params, options) =>
    api.get<string>('/expenses/export.csv', {
      query: {
        from: params.from,
        to: params.to,
        base: params.base ?? undefined,
      },
      signal: options?.signal,
    }),
};
