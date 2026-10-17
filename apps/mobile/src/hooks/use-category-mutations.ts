import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { categoryStore, localStoreEnabled } from '@/lib/store';
import { queryKeys } from '@/lib/query-keys';

/**
 * A rename or a recolour changes the label and the dot on every cached expense
 * row, not just the category list, so both namespaces are invalidated together.
 * `all` is the shared prefix for each, so one call covers the whole namespace.
 */
function invalidateCategories(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.categories.all }),
    client.invalidateQueries({ queryKey: queryKeys.expenses.all }),
  ]).then(() => undefined);
}

/**
 * Realigns the category mirror after a server-side change.
 *
 * On native the list is served from the mirror, so invalidating alone would just
 * re-read the stale copy — refreshing first makes the change visible. A refresh
 * failure is ignored: invalidating still re-reads whatever the mirror holds.
 */
async function refreshCategories(client: QueryClient): Promise<void> {
  if (localStoreEnabled) {
    await categoryStore.refresh().catch(() => undefined);
  }
  await invalidateCategories(client);
}

export function useCreateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: Schemas['CreateCategoryDto']) =>
      api.post<Schemas['ExpenseCategoryDto']>('/expenses/categories', body),
    onSuccess: () => refreshCategories(client),
  });
}

export function useUpdateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas['UpdateCategoryDto'] }) =>
      api.patch<Schemas['ExpenseCategoryDto']>(`/expenses/categories/${id}`, body),
    onSuccess: () => refreshCategories(client),
  });
}

/**
 * Delete.
 *
 * The server answers 409 when a category still has expenses assigned, so the
 * caller must be ready to show that message rather than assume success — the
 * mutation surfaces the rejection through `error`.
 */
export function useDeleteCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: string; reassignTo?: string }) =>
      api.delete<Record<string, never>>(`/expenses/categories/${id}`, {
        query: reassignTo ? { reassignTo } : undefined,
      }),
    onSuccess: () => refreshCategories(client),
  });
}
