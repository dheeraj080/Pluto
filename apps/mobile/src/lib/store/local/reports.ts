import type * as SQLite from 'expo-sqlite';

import {
  buildCategorySeries,
  buildSeries,
  budgetStatus,
  byDayOfWeek,
  compare,
  formatDate,
  periodWindow,
  type Budget,
  type CategoryIndex,
  type RateTable,
  type ReportRow,
} from '@pluto/domain';

import type {
  ByDayOfWeekResponse,
  CategorySeries,
  ExpenseComparison,
  ExpenseSeries,
} from '@/lib/report-types';
import { listLocalBudgets } from './budgets';
import { getDatabase } from './database';
import { localCategoryIndex, listLocalReportRows } from './report-input';
import { ensureBudgetMirror, ensureRateMirror } from './report-mirror';
import { getLocalRateTables } from './rates';
import { remoteReportStore } from '../remote';
import type { BudgetStatusResponse, ReportStore } from '../types';

/** The server's default when the profile has no base currency. */
const DEFAULT_BASE = 'USD';

interface ReportInputs {
  base: string;
  rows: ReportRow[];
  tables: RateTable[];
  categories: CategoryIndex;
}

/**
 * Loads everything the engine needs for a range, or null when the rate mirror
 * cannot cover it (so the caller falls back to the API).
 */
async function loadInputs(
  database: SQLite.SQLiteDatabase,
  base: string | undefined,
  needFrom: string,
): Promise<ReportInputs | null> {
  const code = (base ?? DEFAULT_BASE).toUpperCase();
  const covered = await ensureRateMirror(database, code, needFrom);
  if (!covered) return null;

  const [rows, categories, tables] = await Promise.all([
    listLocalReportRows(database),
    localCategoryIndex(database),
    getLocalRateTables(database, code),
  ]);
  return { base: code, rows, tables, categories };
}

/** The API runtime shape matches the engine's; only the generated provenance
 *  dates differ (they render as `Record<string, never>`), so a boundary cast is
 *  the honest way to hand an on-device payload to a screen typed against the
 *  spec. */
function asResponse<T>(value: unknown): T {
  return value as T;
}

/**
 * Native report store: aggregates on-device from the expense mirror plus the
 * mirrored rate tables, delegating to the API only when a range reaches back
 * past the rate mirror.
 */
export const localReportStore: ReportStore = {
  async comparison(params, options) {
    const database = await getDatabase();
    const needFrom =
      params.currentFrom < params.previousFrom ? params.currentFrom : params.previousFrom;
    const inputs = await loadInputs(database, params.base, needFrom);
    if (!inputs) return remoteReportStore.comparison(params, options);

    return asResponse<ExpenseComparison>(
      compare({
        rows: inputs.rows,
        tables: inputs.tables,
        categories: inputs.categories,
        base: inputs.base,
        secondary: params.secondary ?? null,
        currentFrom: params.currentFrom,
        currentTo: params.currentTo,
        previousFrom: params.previousFrom,
        previousTo: params.previousTo,
      }),
    );
  },

  async byDayOfWeek(params, options) {
    const database = await getDatabase();
    const inputs = await loadInputs(database, params.base, params.from);
    if (!inputs) return remoteReportStore.byDayOfWeek(params, options);

    return asResponse<ByDayOfWeekResponse>(
      byDayOfWeek({
        rows: inputs.rows,
        tables: inputs.tables,
        base: inputs.base,
        secondary: params.secondary ?? null,
        from: params.from,
        to: params.to,
      }),
    );
  },

  async series(params, options) {
    const database = await getDatabase();
    const inputs = await loadInputs(database, params.base, params.from);
    if (!inputs) return remoteReportStore.series(params, options);

    return asResponse<ExpenseSeries>(
      buildSeries({
        rows: inputs.rows,
        tables: inputs.tables,
        base: inputs.base,
        secondary: params.secondary ?? null,
        from: params.from,
        to: params.to,
        granularity: params.granularity,
      }),
    );
  },

  async categorySeries(params, options) {
    const database = await getDatabase();
    const inputs = await loadInputs(database, params.base, params.from);
    if (!inputs) return remoteReportStore.categorySeries(params, options);

    return asResponse<CategorySeries>(
      buildCategorySeries({
        rows: inputs.rows,
        tables: inputs.tables,
        categories: inputs.categories,
        base: inputs.base,
        secondary: params.secondary ?? null,
        from: params.from,
        to: params.to,
        granularity: params.granularity,
      }),
    );
  },

  async budgetStatus(params, options) {
    const database = await getDatabase();
    const base = (params.base ?? DEFAULT_BASE).toUpperCase();

    // Best-effort: offline uses the last mirrored budgets.
    try {
      await ensureBudgetMirror(database);
    } catch {
      /* keep the cached mirror */
    }

    const budgets = await listLocalBudgets(database);
    const needFrom = windowStart(budgets, params.month);
    const covered = needFrom === null || (await ensureRateMirror(database, base, needFrom));
    if (!covered) return remoteReportStore.budgetStatus(params, options);

    const [rows, categories, tables] = await Promise.all([
      listLocalReportRows(database),
      localCategoryIndex(database),
      getLocalRateTables(database, base),
    ]);

    return asResponse<BudgetStatusResponse>(
      budgetStatus({
        rows,
        tables,
        categories,
        budgets,
        base,
        secondary: params.secondary ?? null,
        month: params.month,
      }),
    );
  },
};

/** Earliest budget window start for the evaluated month, or null with no
 *  budgets (nothing needs a rate snapshot then). */
function windowStart(budgets: readonly Budget[], month: string): string | null {
  if (budgets.length === 0) return null;
  const starts = budgets.map((budget) => periodWindow(budget.period, month).start.getTime());
  return formatDate(new Date(Math.min(...starts)));
}
