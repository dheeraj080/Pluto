import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

/**
 * A single write can change the list, the summary, and any cached detail view,
 * so invalidate the whole `expenses` namespace rather than guessing at subsets.
 * The generated `queryKeys` keep every expense query under that prefix.
 */
function invalidateExpenses(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.expenses.all });
}

export function useCreateExpense() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: Schemas['CreateExpenseDto']) =>
      api.post<Schemas['ExpenseDto']>('/expenses', body),
    onSuccess: () => invalidateExpenses(client),
  });
}

export function useUpdateExpense() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas['UpdateExpenseDto'] }) =>
      api.patch<Schemas['ExpenseDto']>(`/expenses/${id}`, body),
    onSuccess: (expense) => {
      // Seed the detail cache so popping back shows the saved values at once.
      client.setQueryData(queryKeys.expenses.detail(expense.id), expense);
      return invalidateExpenses(client);
    },
  });
}

export function useDeleteExpense() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/expenses/${id}`),
    onSuccess: (_result, id) => {
      // Drop the detail outright: refetching a deleted id would 404.
      client.removeQueries({ queryKey: queryKeys.expenses.detail(id) });
      return invalidateExpenses(client);
    },
  });
}
