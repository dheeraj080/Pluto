import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import {
  budgetStore,
  localStoreEnabled,
  reportStore,
  type CreateBudgetInput,
  type UpdateBudgetInput,
} from '@/lib/store';
import { syncNow } from '@/lib/sync/sync-engine';
import { queryKeys, type BudgetStatusParams } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

function requestSync(): void {
  if (localStoreEnabled) void syncNow();
}

export type { CreateBudgetInput } from '@/lib/store';

export type Budget = Schemas['BudgetDto'];
export type BudgetStatus = Schemas['BudgetStatusDto'];
export type BudgetStatusResponse = Schemas['BudgetStatusResponseDto'];
export type BudgetPeriod = Budget['period'];

/**
 * How the current month is tracking against each budget.
 *
 * One request covers every budget — the payload already carries each row's id,
 * so the screen can render and delete straight from it without a second list
 * call.
 */
export function useBudgetStatus(params: BudgetStatusParams) {
  const { status, mode } = useSession();

  return useQuery({
    queryKey: queryKeys.budgets.status(params),
    enabled: status === 'signed-in' || mode === 'local',
    queryFn: ({ signal }) =>
      reportStore.budgetStatus(
        { month: params.month, base: params.base, secondary: params.secondary },
        { signal },
      ),
  });
}

function invalidateBudgets(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.budgets.all });
}

export function useCreateBudget() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBudgetInput) => budgetStore.create(body),
    onSuccess: () => {
      void invalidateBudgets(client);
      requestSync();
    },
  });
}

export function useUpdateBudget() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBudgetInput }) =>
      budgetStore.update(id, body),
    onSuccess: () => {
      void invalidateBudgets(client);
      requestSync();
    },
  });
}

export function useDeleteBudget() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => budgetStore.remove(id),
    onSuccess: () => {
      void invalidateBudgets(client);
      requestSync();
    },
  });
}
