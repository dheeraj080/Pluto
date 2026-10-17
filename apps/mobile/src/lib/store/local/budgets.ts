import type * as SQLite from 'expo-sqlite';

import type { Schemas } from '@pluto/api-client';
import type { Budget } from '@pluto/domain';

type BudgetDto = Schemas['BudgetDto'];

interface BudgetRow {
  id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  period: string;
  start_date: string;
  created_at: string;
}

/** Replaces the whole budget mirror. Budgets are few and small, so a wholesale
 *  swap is simpler (and safer) than reconciling row by row. */
export async function replaceLocalBudgets(
  database: SQLite.SQLiteDatabase,
  budgets: readonly BudgetDto[],
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM budgets');
    for (const budget of budgets) {
      await txn.runAsync(
        `INSERT INTO budgets (id, category_id, amount, currency, period, start_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          budget.id,
          budget.categoryId ?? null,
          budget.amount,
          budget.currency,
          budget.period,
          budget.startDate,
          budget.createdAt,
        ],
      );
    }
  });
}

/** The mirrored budgets, in the shape the on-device engine expects. */
export async function listLocalBudgets(database: SQLite.SQLiteDatabase): Promise<Budget[]> {
  const rows = await database.getAllAsync<BudgetRow>('SELECT * FROM budgets ORDER BY start_date ASC');
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    amount: row.amount,
    currency: row.currency,
    period: row.period,
    startDate: row.start_date,
  }));
}
