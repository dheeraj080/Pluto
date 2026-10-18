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

/** The API's expense DTO — the shape every screen already consumes. */
export type ExpenseDto = Schemas['ExpenseDto'];
export type ExpenseCategoryDto = Schemas['ExpenseCategoryDto'];
export type PaginatedExpenses = Schemas['PaginatedExpensesResponseDto'];
export type CreateExpenseInput = Schemas['CreateExpenseDto'];
export type UpdateExpenseInput = Schemas['UpdateExpenseDto'];