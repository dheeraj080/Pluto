import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import type { BudgetStore, CategoryStore, ExpenseStore } from '../types';
import { createLocalBudget, deleteLocalBudget, updateLocalBudget } from './budgets';
import {
  createLocalCategory,
  deleteLocalCategory,
  listLocalCategories,
  replaceLocalCategories,
  updateLocalCategory,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './categories';
import { getDatabase } from './database';
import {
  createLocalExpense,
  deleteLocalExpense,
  getLocalExpense,
  listLocalExpenses,
  updateLocalExpense,
} from './expenses';
import { localReportStore } from './reports';
import { createLocalExpenseWithRecurrence } from './recurring-rules';

export {
  localReportStore,
};
export type { CreateCategoryInput, UpdateCategoryInput };

/**
 * Native implementation of the expense seam: SQLite is the source of truth and
 * the sync engine reconciles it with the server in the background.
 */
export const localExpenseStore: ExpenseStore = {
  list: async (filters, page, limit) =>
    listLocalExpenses(await getDatabase(), filters, page, limit),
  get: async (id) => getLocalExpense(await getDatabase(), id),
  create: async (input) =>
    input.recurrence
      ? createLocalExpenseWithRecurrence(await getDatabase(), input)
      : createLocalExpense(await getDatabase(), input),
  update: async (id, input) => updateLocalExpense(await getDatabase(), id, input),
  remove: async (id) => deleteLocalExpense(await getDatabase(), id),
};

/**
 * Native budget writes: the local mirror is written immediately and the change
 * is queued, so a budget can be created or edited with no connection.
 */
export const localBudgetStore: BudgetStore = {
  create: async (input) => createLocalBudget(await getDatabase(), input),
  update: async (id, input) => updateLocalBudget(await getDatabase(), id, input),
  remove: async (id) => deleteLocalBudget(await getDatabase(), id),
};

export const localCategoryStore: CategoryStore = {
  list: async () => {
    const database = await getDatabase();
    const cached = await listLocalCategories(database);
    if (cached.length > 0) return cached;

    try {
      const remote = await api.get<Schemas['ExpenseCategoryDto'][]>('/expenses/categories');
      await replaceLocalCategories(database, remote);
      return remote;
    } catch {
      return cached;
    }
  },
  refresh: async () => {
    try {
      const categories = await api.get<Schemas['ExpenseCategoryDto'][]>('/expenses/categories');
      await replaceLocalCategories(await getDatabase(), categories);
      return await listLocalCategories(await getDatabase());
    } catch {
      return listLocalCategories(await getDatabase());
    }
  },
  create: async (input) => createLocalCategory(await getDatabase(), input),
  update: async (id, input) => updateLocalCategory(await getDatabase(), id, input),
  remove: async (id: string, options?: { reassignTo?: string }) => deleteLocalCategory(await getDatabase(), id, options),
};
