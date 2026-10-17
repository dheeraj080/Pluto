import type { Schemas } from '@pluto/api-client';

import type { ExpenseListFilters } from '@/lib/query-keys';

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
 * `refresh` forces a fetch from the API and updates that mirror.
 */
export interface CategoryStore {
  list(): Promise<ExpenseCategoryDto[]>;
  refresh(): Promise<ExpenseCategoryDto[]>;
}
