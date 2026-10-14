import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export function useExpense(id: string | undefined) {
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.expenses.detail(id ?? ''),
    enabled: status === 'signed-in' && Boolean(id),
    queryFn: () => api.get<Schemas['ExpenseDto']>(`/expenses/${id}`),
  });
}
