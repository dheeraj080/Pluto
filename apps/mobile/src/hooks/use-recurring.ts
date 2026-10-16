import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';

export type RecurringExpense = Schemas['RecurringExpenseDto'];
export type RecurringOccurrence = Schemas['RecurringOccurrenceDto'];
export type RecurrenceFrequency = RecurringExpense['frequency'];

/**
 * The create payload.
 *
 * Hand-written rather than `Schemas['CreateRecurringExpenseDto']` for the same
 * reason as `CreateBudgetInput`: the optional fields are simpler to describe
 * directly, and the client types the request body as `unknown` anyway.
 */
export interface CreateRecurringInput {
  categoryId: string;
  amount: number;
  currency: string;
  frequency: RecurrenceFrequency;
  /** Every Nth period; defaults to 1 on the server. */
  interval?: number;
  startDate: string;
  endDate?: string;
  description?: string;
  paymentMethod?: string;
}

/**
 * The update payload.
 *
 * Hand-written for the same reason as `CreateBudgetInput`: the spec types
 * `endDate` as a nullable `Record<string, never>`, and clearing the bound means
 * sending an explicit `null`, which that generated type cannot express.
 */
export interface UpdateRecurringInput {
  categoryId?: string;
  amount?: number;
  currency?: string;
  frequency?: RecurrenceFrequency;
  interval?: number;
  startDate?: string;
  /** `null` clears the bound; omitting leaves it unchanged. */
  endDate?: string | null;
  description?: string;
  paymentMethod?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ENDED';
}

/**
 * A write to a rule can add or remove pending occurrences, so every mutation
 * invalidates the whole `recurring` namespace once rather than tracking subsets.
 * Confirming an occurrence also creates a real expense, so the `expenses`
 * namespace goes stale too.
 */
function invalidateRecurring(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.recurring.all }),
    client.invalidateQueries({ queryKey: queryKeys.expenses.all }),
  ]).then(() => undefined);
}

export function useRecurringRules() {
  const { status } = useSession();

  return useQuery({
    queryKey: queryKeys.recurring.rules(),
    enabled: status === 'signed-in',
    queryFn: () => api.get<RecurringExpense[]>('/expenses/recurring'),
  });
}

/** Occurrences filtered by status — `PENDING` for the confirm queue. */
export function useOccurrences(status?: 'PENDING' | 'CONFIRMED' | 'SKIPPED', limit = 50) {
  const { status: sessionStatus } = useSession();

  return useQuery({
    queryKey: queryKeys.recurring.occurrences(status),
    enabled: sessionStatus === 'signed-in',
    queryFn: () =>
      api.get<Schemas['PaginatedOccurrencesResponseDto']>('/expenses/recurring/occurrences', {
        query: { status, limit },
      }),
  });
}

export function useCreateRecurring() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRecurringInput) =>
      api.post<RecurringExpense>('/expenses/recurring', body),
    onSuccess: () => invalidateRecurring(client),
  });
}

export function useUpdateRecurring() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRecurringInput }) =>
      api.patch<RecurringExpense>(`/expenses/recurring/${id}`, body),
    onSuccess: () => invalidateRecurring(client),
  });
}

export function useDeleteRecurring() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<Record<string, never>>(`/expenses/recurring/${id}`),
    onSuccess: () => invalidateRecurring(client),
  });
}

export function useConfirmOccurrence() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Schemas['ExpenseDto']>(`/expenses/recurring/occurrences/${id}/confirm`, {}),
    onSuccess: () => invalidateRecurring(client),
  });
}

export function useSkipOccurrence() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Record<string, never>>(`/expenses/recurring/occurrences/${id}/skip`, {}),
    onSuccess: () => invalidateRecurring(client),
  });
}

export function useConfirmAllOccurrences() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) =>
      api.post<Schemas['ConfirmOccurrencesResponseDto']>(
        '/expenses/recurring/occurrences/confirm',
        { ids },
      ),
    onSuccess: () => invalidateRecurring(client),
  });
}
