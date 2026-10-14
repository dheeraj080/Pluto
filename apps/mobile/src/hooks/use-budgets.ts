import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys, type BudgetStatusParams } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export type Budget = Schemas['BudgetDto'];
export type BudgetStatus = Schemas['BudgetStatusDto'];
export type BudgetStatusResponse = Schemas['BudgetStatusResponseDto'];
export type BudgetPeriod = Budget['period'];

/**
 * The create payload.
 *
 * Declared here rather than reusing `Schemas['CreateBudgetDto']`: the spec types
 * `categoryId` as a nullable uuid, and the generator renders that as
 * `Record<string, never>`. The mutation body is typed `unknown` by the client
 * anyway, so a hand-written shape is both accurate and honest about the null.
 */
export interface CreateBudgetInput {
  /** Omit (or null) for an overall, whole-account budget. */
  categoryId?: string | null;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  startDate?: string;
}

/**
 * How the current month is tracking against each budget.
 *
 * One request covers every budget — the payload already carries each row's id,
 * so the screen can render and delete straight from it without a second list
 * call.
 */
export function useBudgetStatus(params: BudgetStatusParams) {
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.budgets.status(params),
    enabled: status === 'signed-in',
    queryFn: () =>
      api.get<BudgetStatusResponse>('/expenses/budgets/status', {
        query: {
          month: params.month,
          base: params.base,
          secondary: params.secondary,
        },
      }),
  });
}

function invalidateBudgets(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.budgets.all });
}

export function useCreateBudget() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBudgetInput) => api.post<Budget>('/expenses/budgets', body),
    onSuccess: () => invalidateBudgets(client),
  });
}

export function useUpdateBudget() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas['UpdateBudgetDto'] }) =>
      api.patch<Budget>(`/expenses/budgets/${id}`, body),
    onSuccess: () => invalidateBudgets(client),
  });
}

export function useDeleteBudget() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<Record<string, never>>(`/expenses/budgets/${id}`),
    onSuccess: () => invalidateBudgets(client),
  });
}
