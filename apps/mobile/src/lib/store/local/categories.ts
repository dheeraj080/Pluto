import type * as SQLite from 'expo-sqlite';

import type { ExpenseCategoryDto } from '../types';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_default: number;
  expense_count: number;
}

/** Replaces the whole category mirror. Categories are few and small, so a
 *  wholesale swap is simpler (and safer) than a diff. */
export async function replaceLocalCategories(
  database: SQLite.SQLiteDatabase,
  categories: ExpenseCategoryDto[],
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM categories');
    for (const category of categories) {
      await txn.runAsync(
        `INSERT INTO categories (id, name, color, icon, sort_order, is_default, expense_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          category.id,
          category.name,
          category.color,
          category.icon ?? null,
          category.sortOrder,
          category.isDefault ? 1 : 0,
          category.expenseCount,
        ],
      );
    }
  });
}

/**
 * Reads the mirrored categories.
 *
 * `expenseCount` is recomputed from the local expenses — that is what the user
 * can actually see offline, and it equals the server's count once the mirror is
 * fully synced.
 */
export async function listLocalCategories(
  database: SQLite.SQLiteDatabase,
): Promise<ExpenseCategoryDto[]> {
  const rows = await database.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY sort_order ASC, name ASC',
  );
  const counts = await database.getAllAsync<{ category_id: string; total: number }>(
    'SELECT category_id, COUNT(*) AS total FROM expenses WHERE deleted_at IS NULL GROUP BY category_id',
  );
  const countByCategory = new Map(counts.map((row) => [row.category_id, row.total]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    expenseCount: countByCategory.get(row.id) ?? 0,
  }));
}
