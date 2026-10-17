import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { expenseStore, localStoreEnabled } from '@/lib/store';
import { syncNow } from '@/lib/sync/sync-engine';
import { queryKeys } from '@/lib/query-keys';

/**
 * A single write can change the list, the summary, and any cached detail view,
 * so invalidate the whole `expenses` namespace rather than guessing at subsets.
 * The generated `queryKeys` keep every expense query under that prefix.
 */
function invalidateExpenses(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.expenses.all });
}

/**
 * Nudges the sync engine after a local write.
 *
 * Fire-and-forget: the entry is already durable in the on-device store, so a
 * failed push (offline) loses nothing — the mutation stays queued and is retried
 * on the next reconnect, foreground, or timer tick.
 */
function requestSync(): void {
  if (localStoreEnabled) void syncNow();
}

export function useCreateExpense() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: Schemas['CreateExpenseDto']) => {
      // A recurring rule is generated server-side, so an entry that also starts
      // one cannot ride the offline queue yet — send it straight to the API.
      if (body.recurrence) return api.post<Schemas['ExpenseDto']>('/expenses', body);
      return expenseStore.create(body);
    },
    onSuccess: () => {
      requestSync();
      return invalidateExpenses(client);
    },
  });
}

export function useUpdateExpense() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas['UpdateExpenseDto'] }) =>
      expenseStore.update(id, body),
    onSuccess: (expense) => {
      // Seed the detail cache so popping back shows the saved values at once.
      client.setQueryData(queryKeys.expenses.detail(expense.id), expense);
      requestSync();
      return invalidateExpenses(client);
    },
  });
}

export function useDeleteExpense() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expenseStore.remove(id),
    onSuccess: (_result, id) => {
      // Drop the detail outright: refetching a deleted id would fail.
      client.removeQueries({ queryKey: queryKeys.expenses.detail(id) });
      requestSync();
      return invalidateExpenses(client);
    },
  });
}
