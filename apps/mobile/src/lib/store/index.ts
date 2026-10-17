import { Platform } from 'react-native';

import {
  localBudgetStore,
  localCategoryStore,
  localExpenseStore,
  localReportStore,
} from './local';
import {
  remoteBudgetStore,
  remoteCategoryStore,
  remoteExpenseStore,
  remoteReportStore,
} from './remote';
import type { BudgetStore, CategoryStore, ExpenseStore, ReportStore } from './types';

export type {
  BudgetStore,
  CategoryStore,
  CreateBudgetInput,
  ExpenseStore,
  ReportStore,
  UpdateBudgetInput,
} from './types';

/**
 * Whether writes go to the on-device store.
 *
 * Native builds are offline-first. The web build keeps the original online-only
 * behaviour, because `expo-sqlite` on the web needs COOP/COEP headers the static
 * web target does not serve.
 */
export const localStoreEnabled = Platform.OS !== 'web';

export const expenseStore: ExpenseStore = localStoreEnabled
  ? localExpenseStore
  : remoteExpenseStore;

export const categoryStore: CategoryStore = localStoreEnabled
  ? localCategoryStore
  : remoteCategoryStore;

export const budgetStore: BudgetStore = localStoreEnabled
  ? localBudgetStore
  : remoteBudgetStore;

export const reportStore: ReportStore = localStoreEnabled ? localReportStore : remoteReportStore;
