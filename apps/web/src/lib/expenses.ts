/**
 * Typed wrappers over pluto-server's /v1/expenses endpoints and the public
 * currency list from /v1/rates.
 *
 * Query strings are built with `buildQuery`, which drops empty values — this
 * matters because the server enables `forbidNonWhitelisted`, so an empty
 * `?categoryId=` would be rejected as an unknown parameter.
 */

import { api } from "./api";
import type {
  Budget,
  BudgetPeriod,
  BudgetStatusResponse,
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  ExpenseTrend,
  Paginated,
  RateSnapshot,
  SupportedCurrency,
  UserProfile,
} from "./types";

export type ExpenseSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

/**
 * Filters accepted by GET /expenses.
 *
 * A `type` alias rather than an `interface`: only aliases get an implicit
 * index signature, so this stays assignable to buildQuery's `Record` parameter.
 */
export type ExpenseQuery = {
  page?: number;
  limit?: number;
  categoryId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  search?: string;
  sort?: ExpenseSort;
};

export interface CreateExpenseInput {
  categoryId: string;
  amount: number;
  currency: string;
  incurredOn: string;
  description?: string;
  paymentMethod?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput> & { sortOrder?: number };

export interface CreateBudgetInput {
  /** Omit for an overall (whole-account) budget. */
  categoryId?: string | null;
  amount: number;
  currency: string;
  period?: BudgetPeriod;
  startDate?: string;
}

export interface Ack {
  success: boolean;
  message: string;
}

/** Serialises params, skipping undefined/empty so nothing invalid is sent. */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const expensesApi = {
  /* categories */
  listCategories: () => api.get<ExpenseCategory[]>("/expenses/categories"),
  createCategory: (body: CreateCategoryInput) =>
    api.post<ExpenseCategory>("/expenses/categories", body),
  updateCategory: (id: string, body: UpdateCategoryInput) =>
    api.patch<ExpenseCategory>(`/expenses/categories/${id}`, body),
  deleteCategory: (id: string) => api.delete<Ack>(`/expenses/categories/${id}`),

  /* expenses */
  listExpenses: (query: ExpenseQuery) =>
    api.get<Paginated<Expense>>(`/expenses${buildQuery(query)}`),
  getExpense: (id: string) => api.get<Expense>(`/expenses/${id}`),
  createExpense: (body: CreateExpenseInput) => api.post<Expense>("/expenses", body),
  updateExpense: (id: string, body: UpdateExpenseInput) =>
    api.patch<Expense>(`/expenses/${id}`, body),
  deleteExpense: (id: string) => api.delete<Ack>(`/expenses/${id}`),

  /* reports */
  getSummary: (query: { from?: string; to?: string; base?: string }) =>
    api.get<ExpenseSummary>(`/expenses/summary${buildQuery(query)}`),
  getTrends: (query: { months?: number; base?: string }) =>
    api.get<ExpenseTrend>(`/expenses/trends${buildQuery(query)}`),
  getComparison: (query: {
    currentFrom?: string;
    currentTo?: string;
    previousFrom?: string;
    previousTo?: string;
    base?: string;
  }) =>
    api.get<import("./types").ExpenseComparison>(`/expenses/comparison${buildQuery(query)}`),
  getTop: (query: { from?: string; to?: string; limit?: number; base?: string }) =>
    api.get<import("./types").TopExpensesResponse>(`/expenses/top${buildQuery(query)}`),
  getByDayOfWeek: (query: { from?: string; to?: string; base?: string }) =>
    api.get<import("./types").ByDayOfWeekResponse>(`/expenses/by-day-of-week${buildQuery(query)}`),
  exportCsv: (query: {
    from?: string;
    to?: string;
    categoryId?: string;
    currency?: string;
    search?: string;
    base?: string;
  }) => api.get<string>(`/expenses/export.csv${buildQuery(query)}`, { responseType: "text" }),

  /* budgets */
  listBudgets: () => api.get<Budget[]>("/expenses/budgets"),
  createBudget: (body: CreateBudgetInput) => api.post<Budget>("/expenses/budgets", body),
  updateBudget: (id: string, body: { amount: number; startDate?: string }) =>
    api.patch<Budget>(`/expenses/budgets/${id}`, body),
  deleteBudget: (id: string) => api.delete<Ack>(`/expenses/budgets/${id}`),
  getBudgetStatus: (query: { month?: string; base?: string }) =>
    api.get<BudgetStatusResponse>(`/expenses/budgets/status${buildQuery(query)}`),
};

/** Public, unauthenticated list driving every currency dropdown. */
export const ratesApi = {
  getSupportedCurrencies: () => api.get<SupportedCurrency[]>("/rates/supported-currencies"),
  /** Latest published snapshot, used for display-only conversion previews. */
  getLatest: (base?: string) =>
    api.get<RateSnapshot>(`/rates/latest${buildQuery({ base: base ?? undefined })}`),
};

/** Current-user profile endpoints (mirrors GET/PATCH /users/me). */
export const usersApi = {
  getMe: () => api.get<UserProfile>("/users/me"),
  updateProfile: (body: { name?: string; avatarUrl?: string; baseCurrency?: string }) =>
    api.patch<UserProfile>("/users/me", body),
};
