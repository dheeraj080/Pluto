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
  CategorySeriesResponse,
  CategoryTrendsResponse,
  ConfirmOccurrencesResponse,
  Expense,
  ExpenseCategory,
  ExpenseSeriesResponse,
  ExpenseSummary,
  ExpenseTrend,
  OccurrenceStatus,
  Paginated,
  PaginatedOccurrences,
  RateHistoryResponse,
  RateSnapshot,
  RecurrenceFrequency,
  RecurringExpense,
  RecurringRuleStatus,
  SeriesGranularity,
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
  /**
   * Present only when creating a repeating expense. The server records this
   * expense and makes it the first, already-confirmed occurrence of a new rule.
   */
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval?: number;
    endDate?: string;
  };
}

/** The edit endpoint has no recurrence field — a rule is managed separately. */
export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, "recurrence">>;

export interface RecurringRuleInput {
  categoryId: string;
  amount: number;
  currency: string;
  frequency: RecurrenceFrequency;
  /** Every Nth period; defaults to 1 on the server. */
  interval?: number;
  startDate: string;
  endDate?: string;
  description?: string;
  paymentMethod?: string;
}

export interface UpdateRecurringInput {
  categoryId?: string;
  amount?: number;
  currency?: string;
  frequency?: RecurrenceFrequency;
  interval?: number;
  startDate?: string;
  /** `null` clears the bound; omitting leaves it unchanged. */
  endDate?: string | null;
  description?: string;
  paymentMethod?: string;
  /** Pause or resume generation. */
  status?: RecurringRuleStatus;
}

/** Filters accepted by GET /expenses/recurring/occurrences. */
export type RecurringOccurrenceQuery = {
  status?: OccurrenceStatus;
  from?: string;
  to?: string;
  recurringExpenseId?: string;
  page?: number;
  limit?: number;
};

/** Overrides applied while confirming an occurrence; omit a field to keep it. */
export interface ConfirmOccurrenceInput {
  amount?: number;
  currency?: string;
  categoryId?: string;
  incurredOn?: string;
  description?: string;
  paymentMethod?: string;
}

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
  getSummary: (query: { from?: string; to?: string; base?: string; secondary?: string }) =>
    api.get<ExpenseSummary>(`/expenses/summary${buildQuery(query)}`),
  getTrends: (query: { months?: number; base?: string; secondary?: string }) =>
    api.get<ExpenseTrend>(`/expenses/trends${buildQuery(query)}`),
  getComparison: (query: {
    currentFrom?: string;
    currentTo?: string;
    previousFrom?: string;
    previousTo?: string;
    base?: string;
    secondary?: string;
  }) =>
    api.get<import("./types").ExpenseComparison>(`/expenses/comparison${buildQuery(query)}`),
  getTop: (query: {
    from?: string;
    to?: string;
    limit?: number;
    base?: string;
    secondary?: string;
  }) =>
    api.get<import("./types").TopExpensesResponse>(`/expenses/top${buildQuery(query)}`),
  getByDayOfWeek: (query: {
    from?: string;
    to?: string;
    base?: string;
    secondary?: string;
  }) =>
    api.get<import("./types").ByDayOfWeekResponse>(`/expenses/by-day-of-week${buildQuery(query)}`),
  getSeries: (query: {
    from?: string;
    to?: string;
    granularity?: SeriesGranularity;
    base?: string;
    secondary?: string;
  }) => api.get<ExpenseSeriesResponse>(`/expenses/series${buildQuery(query)}`),
  getCategoryTrends: (query: {
    months?: number;
    top?: number;
    base?: string;
    secondary?: string;
  }) => api.get<CategoryTrendsResponse>(`/expenses/category-trends${buildQuery(query)}`),
  getCategorySeries: (query: {
    from?: string;
    to?: string;
    granularity?: SeriesGranularity;
    base?: string;
    secondary?: string;
  }) => api.get<CategorySeriesResponse>(`/expenses/category-series${buildQuery(query)}`),
  exportCsv: (query: {
    from?: string;
    to?: string;
    categoryId?: string;
    currency?: string;
    search?: string;
    base?: string;
    secondary?: string;
  }) => api.get<string>(`/expenses/export.csv${buildQuery(query)}`),

  /* budgets */
  listBudgets: () => api.get<Budget[]>("/expenses/budgets"),
  createBudget: (body: CreateBudgetInput) => api.post<Budget>("/expenses/budgets", body),
  updateBudget: (id: string, body: { amount: number; startDate?: string }) =>
    api.patch<Budget>(`/expenses/budgets/${id}`, body),
  deleteBudget: (id: string) => api.delete<Ack>(`/expenses/budgets/${id}`),
  getBudgetStatus: (query: { month?: string; base?: string; secondary?: string }) =>
    api.get<BudgetStatusResponse>(`/expenses/budgets/status${buildQuery(query)}`),
};

/**
 * Recurring expenses: rules plus the dated occurrences they produce.
 *
 * Kept in its own object because the feature is a separate surface — a rule id
 * and an expense id never share a namespace, and the occurrence routes live
 * under the same `/expenses/recurring` prefix.
 */
export const recurringApi = {
  listRules: () => api.get<RecurringExpense[]>("/expenses/recurring"),
  createRule: (body: RecurringRuleInput) => api.post<RecurringExpense>("/expenses/recurring", body),
  getRule: (id: string) => api.get<RecurringExpense>(`/expenses/recurring/${id}`),
  updateRule: (id: string, body: UpdateRecurringInput) =>
    api.patch<RecurringExpense>(`/expenses/recurring/${id}`, body),
  deleteRule: (id: string) => api.delete<Ack>(`/expenses/recurring/${id}`),

  listOccurrences: (query: RecurringOccurrenceQuery = {}) =>
    api.get<PaginatedOccurrences>(`/expenses/recurring/occurrences${buildQuery(query)}`),
  confirmOccurrence: (id: string, body: ConfirmOccurrenceInput = {}) =>
    api.post<Expense>(`/expenses/recurring/occurrences/${id}/confirm`, body),
  skipOccurrence: (id: string) => api.post<Ack>(`/expenses/recurring/occurrences/${id}/skip`),
  confirmManyOccurrences: (ids?: string[]) =>
    api.post<ConfirmOccurrencesResponse>("/expenses/recurring/occurrences/confirm", ids ? { ids } : {}),
};

/** Public, unauthenticated list driving every currency dropdown. */
export const ratesApi = {
  getSupportedCurrencies: () => api.get<SupportedCurrency[]>("/rates/supported-currencies"),
  /** Latest published snapshot, used for display-only conversion previews. */
  getLatest: (base?: string) =>
    api.get<RateSnapshot>(`/rates/latest${buildQuery({ base: base ?? undefined })}`),
  /** Exchange-rate history for a pair, oldest first. */
  getHistory: (query: { base?: string; quote: string; from?: string; to?: string }) =>
    api.get<RateHistoryResponse>(`/rates/history${buildQuery(query)}`),
};

/** Current-user profile endpoints (mirrors GET/PATCH /users/me). */
export const usersApi = {
  getMe: () => api.get<UserProfile>("/users/me"),
  updateProfile: (body: { name?: string; avatarUrl?: string; baseCurrency?: string }) =>
    api.patch<UserProfile>("/users/me", body),
};
