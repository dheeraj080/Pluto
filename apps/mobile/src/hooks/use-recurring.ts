import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { getSessionState } from '@/lib/session';
import { localStoreEnabled } from '@/lib/store';
import { getDatabase } from '@/lib/store/local/database';
import {
  listLocalOccurrences,
  occurrenceMirrorSeeded,
  replaceLocalOccurrences,
  upsertLocalOccurrence,
} from '@/lib/store/local/occurrences';
import {
  queueOccurrenceDecision,
  recordServerConfirm,
  recordServerSkip,
  recurringActionDisposition,
} from '@/lib/store/local/recurring-actions';
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

/**
 * Occurrences filtered by status — `PENDING` for the confirm queue.
 *
 * On native this reads the mirror as much as the API: every fetch is written
 * through to the `occurrences` table, and a fetch the server never answered
 * reads the mirror back instead of failing — so the decide-list renders, and
 * decides, with no connection. An empty mirror is *not* taken for an empty
 * list: only a mirror a previous fetch once seeded can answer offline, and
 * anything else surfaces the real error.
 */
export function useOccurrences(status?: 'PENDING' | 'CONFIRMED' | 'SKIPPED', limit = 50) {
  const { status: sessionStatus } = useSession();

  return useQuery({
    queryKey: queryKeys.recurring.occurrences(status),
    enabled: sessionStatus === 'signed-in',
    queryFn: async () => {
      if (!localStoreEnabled) {
        return api.get<Schemas['PaginatedOccurrencesResponseDto']>(
          '/expenses/recurring/occurrences',
          { query: { status, limit } },
        );
      }

      try {
        const response = await api.get<Schemas['PaginatedOccurrencesResponseDto']>(
          '/expenses/recurring/occurrences',
          { query: { status, limit } },
        );
        const database = await getDatabase();
        await replaceLocalOccurrences(database, response, status);
        return response;
      } catch (error) {
        const database = await getDatabase();
        if (!(await occurrenceMirrorSeeded(database))) throw error;
        const items = await listLocalOccurrences(database, status, limit);
        return { items, page: 1, limit, total: items.length };
      }
    },
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

/**
 * Parks a decision the server could not take, or rethrows.
 *
 * Only a failure the server never answered parks anything — a 4xx is a
 * verdict, not a timing problem — and only while a session exists to replay
 * it under. Resolving (rather than rejecting) is deliberate: the queue has
 * already written the mirror, so the screen is right either way, and the sync
 * engine owns the retry.
 */
async function parkDecisionOrThrow(
  error: unknown,
  occurrence: RecurringOccurrence,
  action: 'confirm' | 'skip',
): Promise<void> {
  if (!shouldParkDecision(error)) throw error;

  const database = await getDatabase();
  await queueOccurrenceDecision(database, occurrence, action);
}

/**
 * Whether a failed decision is one to park rather than surface.
 *
 * Only a failure the server never answered parks anything — a 4xx is a
 * verdict, not a timing problem — and only while a session exists to replay
 * it under.
 */
function shouldParkDecision(error: unknown): boolean {
  return (
    localStoreEnabled &&
    recurringActionDisposition(error) === 'retry' &&
    getSessionState().status === 'signed-in'
  );
}

/**
 * Records one occurrence as an expense (`POST …/confirm`).
 *
 * The request is first, as always: online, the server's response is written
 * through to the mirror so Activity shows the new expense at once. Offline
 * (or a server that cannot answer), the decision itself is what queues: the
 * occurrence flips out of the pending list, a stand-in expense appears as a
 * pending row, and the replay posts the stand-in's — possibly edited — values
 * as the confirm's overrides on the next connection. Resolves with the
 * created expense, or `null` when the decision was parked.
 */
export function useConfirmOccurrence() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (occurrence: RecurringOccurrence): Promise<Schemas['ExpenseDto'] | null> => {
      try {
        const expense = await api.post<Schemas['ExpenseDto']>(
          `/expenses/recurring/occurrences/${occurrence.id}/confirm`,
          {},
        );
        if (localStoreEnabled) {
          await recordServerConfirm(await getDatabase(), occurrence, expense);
        }
        return expense;
      } catch (error) {
        await parkDecisionOrThrow(error, occurrence, 'confirm');
        return null;
      }
    },
    onSuccess: () => invalidateRecurring(client),
  });
}

/**
 * Skips one occurrence (`POST …/skip`) — same try-first, park-on-failure
 * shape as {@link useConfirmOccurrence}, without the stand-in expense: a
 * skipped charge records no money.
 */
export function useSkipOccurrence() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (occurrence: RecurringOccurrence): Promise<void> => {
      try {
        await api.post<Record<string, never>>(`/expenses/recurring/occurrences/${occurrence.id}/skip`, {});
        if (localStoreEnabled) {
          await recordServerSkip(await getDatabase(), occurrence);
        }
      } catch (error) {
        await parkDecisionOrThrow(error, occurrence, 'skip');
      }
    },
    onSuccess: () => invalidateRecurring(client),
  });
}

/**
 * Records every listed occurrence as an expense at once.
 *
 * The explicit ids — the ones on screen — travel in the request, so "all"
 * means exactly the charges the user was looking at. Offline, each one parks
 * as its own queued confirm (its own stand-in expense and replay), which is
 * also why the input is the occurrence list and not a bare id list: the queue
 * needs each charge's amounts, not just its name tag. Resolves with the
 * server's count, or with the parked count when nothing reached the server.
 */
export function useConfirmAllOccurrences() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (
      occurrences: RecurringOccurrence[],
    ): Promise<Schemas['ConfirmOccurrencesResponseDto']> => {
      try {
        const response = await api.post<Schemas['ConfirmOccurrencesResponseDto']>(
          '/expenses/recurring/occurrences/confirm',
          { ids: occurrences.map((occurrence) => occurrence.id) },
        );
        if (localStoreEnabled) {
          const database = await getDatabase();
          for (const occurrence of occurrences) {
            // The response carries only a count — the ids the server minted
            // arrive with the next pull — so this flips the rows off the
            // pending list and lets the pull fill in the expenses.
            await upsertLocalOccurrence(database, occurrence, {
              status: 'CONFIRMED',
              expenseId: null,
              confirmedAt: new Date().toISOString(),
            });
          }
        }
        return response;
      } catch (error) {
        if (!shouldParkDecision(error)) throw error;

        const database = await getDatabase();
        for (const occurrence of occurrences) {
          await queueOccurrenceDecision(database, occurrence, 'confirm');
        }
        return { confirmed: occurrences.length };
      }
    },
    onSuccess: () => invalidateRecurring(client),
  });
}
