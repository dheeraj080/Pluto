import { Platform } from 'react-native';

import { localCategoryStore, localExpenseStore, localReportStore } from './local';
import { remoteCategoryStore, remoteExpenseStore, remoteReportStore } from './remote';
import type { CategoryStore, ExpenseStore, ReportStore } from './types';

export type { CategoryStore, ExpenseStore, ReportStore } from './types';

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

export const reportStore: ReportStore = localStoreEnabled ? localReportStore : remoteReportStore;
