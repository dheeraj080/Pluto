import type * as SQLite from 'expo-sqlite';

import type { CategoryIndex, ReportRow } from '@pluto/domain';

interface ReportRowRecord {
  amount: number;
  currency: string;
  incurred_on: string;
  category_id: string;
}

/**
 * Every live expense, in the shape the report engine consumes.
 *
 * Soft-deleted rows are excluded here (as the server excludes them in its
 * queries); bucketing into `[from, to]` is left to the engine, which filters in
 * memory so a caller can pass the whole set and still match the server.
 */
export async function listLocalReportRows(database: SQLite.SQLiteDatabase): Promise<ReportRow[]> {
  const rows = await database.getAllAsync<ReportRowRecord>(
    'SELECT amount, currency, incurred_on, category_id FROM expenses WHERE deleted_at IS NULL',
  );
  return rows.map((row) => ({
    amount: row.amount,
    currency: row.currency,
    incurredOn: row.incurred_on,
    categoryId: row.category_id,
  }));
}

/** The category mirror as the engine's lookup index, for names and colours. */
export async function localCategoryIndex(database: SQLite.SQLiteDatabase): Promise<CategoryIndex> {
  const rows = await database.getAllAsync<{ id: string; name: string; color: string }>(
    'SELECT id, name, color FROM categories',
  );
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, color: row.color }]));
}
