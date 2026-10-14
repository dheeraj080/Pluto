import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export type ExpenseCategory = Schemas['ExpenseCategoryDto'];

/**
 * The caller's categories, ordered by sort order.
 *
 * The server seeds a default set on first call, so an empty list here means the
 * request preceded that seeding rather than that the account has no categories.
 */
export function useCategories() {
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.categories.all,
    enabled: status === 'signed-in',
    queryFn: () => api.get<ExpenseCategory[]>('/expenses/categories'),
  });
}
