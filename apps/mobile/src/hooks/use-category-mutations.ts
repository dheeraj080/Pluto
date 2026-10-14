import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
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

export function useCreateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: Schemas['CreateCategoryDto']) =>
      api.post<Schemas['ExpenseCategoryDto']>('/expenses/categories', body),
    onSuccess: () => invalidateCategories(client),
  });
}

export function useUpdateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas['UpdateCategoryDto'] }) =>
      api.patch<Schemas['ExpenseCategoryDto']>(`/expenses/categories/${id}`, body),
    onSuccess: () => invalidateCategories(client),
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
    mutationFn: (id: string) =>
      api.delete<Record<string, never>>(`/expenses/categories/${id}`),
    onSuccess: () => invalidateCategories(client),
  });
}
