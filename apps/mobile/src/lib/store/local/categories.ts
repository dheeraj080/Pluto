import type * as SQLite from 'expo-sqlite';

import { randomUuid } from '@/lib/uuid';
import type { ExpenseCategoryDto } from '../types';

export const DEFAULT_CATEGORIES: Array<Omit<ExpenseCategoryDto, 'expenseCount'>> = [
  { id: 'local-cat-food', name: 'Food & Dining', color: '#fcd34d', icon: 'utensils', isDefault: true, sortOrder: 10 },
  { id: 'local-cat-transport', name: 'Transport', color: '#7dd3fc', icon: 'car', isDefault: true, sortOrder: 20 },
  { id: 'local-cat-shopping', name: 'Shopping', color: '#fda4af', icon: 'bag', isDefault: true, sortOrder: 30 },
  { id: 'local-cat-bills', name: 'Bills & Utilities', color: '#c4b5fd', icon: 'receipt', isDefault: true, sortOrder: 40 },
  { id: 'local-cat-entertainment', name: 'Entertainment', color: '#34d399', icon: 'film', isDefault: true, sortOrder: 50 },
  { id: 'local-cat-health', name: 'Health', color: '#94a3b8', icon: 'heart', isDefault: true, sortOrder: 60 },
  { id: 'local-cat-other', name: 'Other', color: '#94a3b8', icon: 'ellipsis', isDefault: true, sortOrder: 900 },
];
import {
  deleteActionFor,
  deleteMutations,
  editOp,
  getPendingOp,
  hasPendingMutation,
  listPendingEntityIds,
  replaceMutation,
  type CategoryMutationPayload,
  type PendingMutation,
} from './mutations';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_default: number;
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export function planCategoryMirror(
  localIds: readonly string[],
  remote: readonly ExpenseCategoryDto[],
  pendingIds: ReadonlySet<string>,
): { deleteIds: string[]; upsert: ExpenseCategoryDto[] } {
  const remoteIds = new Set(remote.map((category) => category.id));
  return {
    deleteIds: localIds.filter((id) => !remoteIds.has(id) && !pendingIds.has(id)),
    upsert: remote.filter((category) => !pendingIds.has(category.id)),
  };
}

export async function replaceLocalCategories(
  database: SQLite.SQLiteDatabase,
  categories: ExpenseCategoryDto[],
): Promise<void> {
  await database.withExclusiveTransactionAsync(async (txn) => {
    const pending = await listPendingEntityIds(txn, 'category');
    const localRows = await txn.getAllAsync<{ id: string }>('SELECT id FROM categories');

    const plan = planCategoryMirror(
      localRows.map((row) => row.id),
      categories,
      pending,
    );

    for (const id of plan.deleteIds) {
      await txn.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    }

    for (const category of plan.upsert) {
      await txn.runAsync(
        `INSERT INTO categories (id, name, color, icon, sort_order, is_default, expense_count)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           color = excluded.color,
           icon = excluded.icon,
           sort_order = excluded.sort_order,
           is_default = excluded.is_default,
           expense_count = excluded.expense_count`,
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

export async function seedDefaultLocalCategories(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const existing = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (existing && existing.count > 0) return;

  await database.withExclusiveTransactionAsync(async (txn) => {
    for (const category of DEFAULT_CATEGORIES) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO categories (id, name, color, icon, sort_order, is_default, expense_count)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [category.id, category.name, category.color, category.icon ?? null, category.sortOrder, category.isDefault ? 1 : 0],
      );
    }
  });
}

export async function listLocalCategories(
  database: SQLite.SQLiteDatabase,
): Promise<ExpenseCategoryDto[]> {
  await seedDefaultLocalCategories(database);
  const rows = await database.getAllAsync<CategoryRow>(
    'SELECT id, name, color, icon, sort_order, is_default FROM categories ORDER BY sort_order ASC, name ASC',
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

export async function createLocalCategory(
  database: SQLite.SQLiteDatabase,
  input: CreateCategoryInput,
): Promise<ExpenseCategoryDto> {
  const id = randomUuid();
  const now = new Date().toISOString();
  const name = input.name.trim();
  const color = input.color ?? '#34d399';
  const icon = input.icon ?? null;
  const sortOrder = input.sortOrder ?? 0;

  const payload: CategoryMutationPayload = { name, color, icon, sortOrder };

  await database.withExclusiveTransactionAsync(async (txn) => {
    await assertCategoryNameFree(txn, name, id);
    await txn.runAsync(
      `INSERT INTO categories (id, name, color, icon, sort_order, is_default, expense_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, name, color, icon, sortOrder, 0],
    );
    await replaceMutation(txn, 'category', {
      entityId: id,
      op: 'create',
      clientUpdatedAt: now,
      payload,
    });
  });

  return getLocalCategoryDto(database, id);
}

export async function updateLocalCategory(
  database: SQLite.SQLiteDatabase,
  id: string,
  input: UpdateCategoryInput,
): Promise<ExpenseCategoryDto> {
  const now = new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) throw new Error('Category not found');

    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const color = input.color !== undefined ? input.color : existing.color;
    const icon = input.icon !== undefined ? input.icon : existing.icon;
    const sortOrder = input.sortOrder !== undefined ? input.sortOrder : existing.sort_order;

    if (name !== existing.name) {
      await assertCategoryNameFree(txn, name, id);
    }

    const payload: CategoryMutationPayload = { name, color, icon, sortOrder };
    const op = editOp(await getPendingOp(txn, 'category', id));

    await txn.runAsync(
      'UPDATE categories SET name = ?, color = ?, icon = ?, sort_order = ? WHERE id = ?',
      [name, color, icon, sortOrder, id],
    );
    await replaceMutation(txn, 'category', {
      entityId: id,
      op,
      clientUpdatedAt: now,
      payload,
    });
  });

  return getLocalCategoryDto(database, id);
}

export async function deleteLocalCategory(
  database: SQLite.SQLiteDatabase,
  id: string,
  options?: { reassignTo?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const targetId = options?.reassignTo;

  await database.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existing) return;

    if (targetId) {
      await reassignCategoryExpenses(txn, id, targetId);
    }
    await reassignCategoryBudgets(txn);

    const queuedOp = await getPendingOp(txn, 'category', id);
    await txn.runAsync('DELETE FROM categories WHERE id = ?', [id]);

    if (deleteActionFor(queuedOp) === 'drop') {
      await deleteMutations(txn, 'category', id);
      return;
    }

    await replaceMutation(txn, 'category', {
      entityId: id,
      op: 'delete',
      clientUpdatedAt: now,
      payload: null,
    });
  });
}

export async function resolvePushedCategoryMutation(
  database: SQLite.SQLiteDatabase,
  mutation: PendingMutation,
  result: { status: string; reason?: string | null },
): Promise<void> {
  if (result.status === 'failed') {
    await deleteMutations(database, 'category', mutation.entityId);
    return;
  }

  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM mutations WHERE id = ?', [mutation.id]);

    const stillQueued = await hasPendingMutation(txn, 'category', mutation.entityId);
    if (stillQueued) return;

    if (mutation.op === 'delete' || result.reason === 'duplicate') {
      await txn.runAsync('DELETE FROM categories WHERE id = ?', [mutation.entityId]);
    }
  });
}

async function getLocalCategoryDto(database: SQLite.SQLiteDatabase, id: string): Promise<ExpenseCategoryDto> {
  const categories = await listLocalCategories(database);
  const found = categories.find((category) => category.id === id);
  if (!found) throw new Error('Category not found');
  return found;
}

async function assertCategoryNameFree(
  txn: SQLite.SQLiteDatabase,
  name: string,
  excludeId: string,
): Promise<void> {
  const normalized = name.trim();
  const duplicate = await txn.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
    [normalized, excludeId],
  );
  if (!duplicate) return;
  throw new Error(`A category named "${normalized}" already exists`);
}

async function reassignCategoryExpenses(
  txn: SQLite.SQLiteDatabase,
  fromId: string,
  toId: string,
): Promise<void> {
  const expenses = await txn.getAllAsync<{ id: string }>(
    'SELECT id FROM expenses WHERE category_id = ? AND deleted_at IS NULL',
    [fromId],
  );
  for (const expense of expenses) {
    const existing = await txn.getFirstAsync<{
      id: string;
      amount: number;
      currency: string;
      description: string | null;
      payment_method: string | null;
      incurred_on: string;
      recurring_expense_id: string | null;
    }>('SELECT * FROM expenses WHERE id = ?', [expense.id]);

    if (!existing) continue;

    const pendingOp = await getPendingOp(txn, 'expense', expense.id);
    const op = pendingOp === 'create' ? 'create' : 'update';
    const now = new Date().toISOString();

    const payload = {
      categoryId: toId,
      amount: existing.amount,
      currency: existing.currency,
      description: existing.description,
      paymentMethod: existing.payment_method,
      incurredOn: existing.incurred_on,
      recurringExpenseId: existing.recurring_expense_id,
    };

    await txn.runAsync(
      'UPDATE expenses SET category_id = ?, sync_state = "pending", client_updated_at = ?, updated_at = ? WHERE id = ?',
      [toId, now, now, expense.id],
    );
    await replaceMutation(txn, 'expense', {
      entityId: expense.id,
      op,
      clientUpdatedAt: now,
      payload,
    });
  }
}

async function reassignCategoryBudgets(txn: SQLite.SQLiteDatabase): Promise<void> {
  const budgets = await txn.getAllAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE category_id IS NOT NULL',
  );
  for (const budget of budgets) {
    const existing = await txn.getFirstAsync<{ category_id: string | null }>(
      'SELECT category_id FROM budgets WHERE id = ?',
      [budget.id],
    );
    if (!existing || !existing.category_id) continue;
    const queuedOp = await getPendingOp(txn, 'budget', budget.id);
    await txn.runAsync('DELETE FROM budgets WHERE id = ?', [budget.id]);
    if (deleteActionFor(queuedOp) === 'drop') {
      await deleteMutations(txn, 'budget', budget.id);
    } else {
      const now = new Date().toISOString();
      await replaceMutation(txn, 'budget', {
        entityId: budget.id,
        op: 'delete',
        clientUpdatedAt: now,
        payload: null,
      });
    }
  }
}