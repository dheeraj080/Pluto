import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { categoryStore } from '@/lib/store';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export type ExpenseCategory = Schemas['ExpenseCategoryDto'];

/**
 * The caller's categories, ordered by sort order.
 *
 * On native this is the mirrored copy, populated by the sync engine (and fetched
 * once on first read). The server seeds a default set on its first call, so an
 * empty list means the mirror has not been filled yet rather than that the
 * account has none.
 */
export function useCategories() {
  const { status, mode } = useSession();

  return useQuery({
    queryKey: queryKeys.categories.all,
    enabled: status === 'signed-in' || mode === 'local',
    queryFn: () => categoryStore.list(),
  });
}
