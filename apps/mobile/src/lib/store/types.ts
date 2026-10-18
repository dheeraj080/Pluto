import type { Schemas } from '@pluto/api-client';

import type { ReportGranularity } from '@/lib/ranges';
import type {
  ByDayOfWeekResponse,
  CategorySeries,
  ExpenseComparison,
  ExpenseSeries,
} from '@/lib/report-types';
import type { ExpenseListFilters } from '@/lib/query-keys';

import type { CreateCategoryInput, UpdateCategoryInput } from './local/index';

export type { CreateCategoryInput, UpdateCategoryInput };

/** The API's expense DTO — the shape every screen already consumes. */
export type ExpenseDto = Schemas['ExpenseDto'];
export type ExpenseCategoryDto = Schemas['ExpenseCategoryDto'];
export type PaginatedExpenses = Schemas['PaginatedExpensesResponseDto'];
export type CreateExpenseInput = Schemas['CreateExpenseDto'];
export type UpdateExpenseInput = Schemas['UpdateExpenseDto'];

/**
 * The expense data seam.
 *
 * Two implementations satisfy it: a SQLite-backed store on native (the source
 * of truth while offline, reconciled by the sync engine) and a straight API
 * store on web, where there is no local database. Screens never branch on the
 * platform — they depend on this interface only.
 */
export interface ExpenseStore {
  list(
    filters: ExpenseListFilters,
    page: number,
    limit: number,
    options?: { signal?: AbortSignal },
  ): Promise<PaginatedExpenses>;
  get(id: string, options?: { signal?: AbortSignal }): Promise<ExpenseDto>;
  create(input: CreateExpenseInput): Promise<ExpenseDto>;
  update(id: string, input: UpdateExpenseInput): Promise<ExpenseDto>;
  remove(id: string): Promise<void>;
}

/**
 * The category seam.
 *
 * `list` reads whatever is available (the local mirror on native), while
 * `refresh` forces a fetch from the API and updates that mirror. Writes are
 * local-first on native (queued for the sync engine) and direct on web.
 */
export interface CategoryStore {
  list(): Promise<ExpenseCategoryDto[]>;
  refresh(): Promise<ExpenseCategoryDto[]>;
  create(input: CreateCategoryInput): Promise<ExpenseCategoryDto>;
  update(id: string, input: UpdateCategoryInput): Promise<ExpenseCategoryDto>;
  remove(id: string, options?: { reassignTo?: string }): Promise<void>;
}

export type BudgetDto = Schemas['BudgetDto'];
export type BudgetPeriod = BudgetDto['period'];

/**
 * The create payload.
 *
 * Hand-written rather than reusing `Schemas['CreateBudgetDto']`: the spec types
 * `categoryId` as a nullable uuid, and the generator renders that as
 * `Record<string, never>`. The store passes it straight through to the API.
 */
export interface CreateBudgetInput {
  /** Omit (or null) for an overall, whole-account budget. */
  categoryId?: string | null;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  /** Defaults to today when omitted. */
  startDate?: string;
}

export interface UpdateBudgetInput {
  amount: number;
  startDate?: string;
}

/**
 * The budget write seam.
 *
 * Native records the create/edit/delete in the local mirror and queues it for
 * the sync engine, so budgets are written offline just like expenses; web is a
 * direct request, exactly as it was before the seam existed. Reads are not here
 * — the Budgets screen renders from the report store's status payload.
 */
export interface BudgetStore {
  create(input: CreateBudgetInput): Promise<BudgetDto>;
  update(id: string, input: UpdateBudgetInput): Promise<BudgetDto>;
  remove(id: string): Promise<void>;
}

export type BudgetStatusResponse = Schemas['BudgetStatusResponseDto'];

/** An inclusive date range a report is computed over. */
export interface ReportRangeParams {
  from: string;
  to: string;
  base?: string;
  secondary?: string;
}

/** The selected window and the equal-length window immediately before it. */
export interface ReportComparisonParams {
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
  base?: string;
  secondary?: string;
}

export interface ReportSeriesStoreParams extends ReportRangeParams {
  granularity: ReportGranularity;
}

export interface BudgetStatusStoreParams {
  /** Evaluated period, `YYYY-MM`. */
  month: string;
  base?: string;
  secondary?: string;
}

/**
 * Period totals over an inclusive range; both dates are optional so the store
 * can apply the same default the server does (current calendar month through
 * today).
 */
export interface ReportSummaryStoreParams {
  from?: string;
  to?: string;
  base?: string;
  secondary?: string;
}

/** A range export as CSV text, ready to be written to a file and shared. */
export interface ExportCsvStoreParams {
  from: string;
  to: string;
  /** Reporting currency the CSV's converted column should use. */
  base?: string | null;
}

/**
 * The report seam.
 *
 * Native computes on-device from the local expense mirror plus the mirrored rate
 * and budget tables, falling back to the API only when a range predates the rate
 * mirror; web is API-only, like every other store here.
 */
export interface ReportStore {
  comparison(
    params: ReportComparisonParams,
    options?: { signal?: AbortSignal },
  ): Promise<ExpenseComparison>;
  byDayOfWeek(
    params: ReportRangeParams,
    options?: { signal?: AbortSignal },
  ): Promise<ByDayOfWeekResponse>;
  series(
    params: ReportSeriesStoreParams,
    options?: { signal?: AbortSignal },
  ): Promise<ExpenseSeries>;
  categorySeries(
    params: ReportSeriesStoreParams,
    options?: { signal?: AbortSignal },
  ): Promise<CategorySeries>;
  budgetStatus(
    params: BudgetStatusStoreParams,
    options?: { signal?: AbortSignal },
  ): Promise<BudgetStatusResponse>;
  summary(
    params: ReportSummaryStoreParams,
    options?: { signal?: AbortSignal },
  ): Promise<Schemas['ExpenseSummaryDto']>;
  exportCsv(params: ExportCsvStoreParams, options?: { signal?: AbortSignal }): Promise<string>;
}
