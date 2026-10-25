import { useQuery } from '@tanstack/react-query';

import { expenseStore } from '@/lib/store';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export function useExpense(id: string | undefined) {
  const { status, mode } = useSession();

  return useQuery({
    queryKey: queryKeys.expenses.detail(id ?? ''),
    enabled: (status === 'signed-in' || mode === 'local') && Boolean(id),
    queryFn: ({ signal }) => {
      if (!id) throw new Error('Expense id is required');
      return expenseStore.get(id, { signal });
    },
  });
}
