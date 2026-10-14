import { useCallback, useEffect, useState } from 'react';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { useSession } from '@/hooks/use-session';

export interface ExpensesSnapshot {
  expenses: Schemas['PaginatedExpensesResponseDto'] | null;
  summary: Schemas['ExpenseSummaryDto'] | null;
}

export interface UseExpensesResult extends ExpensesSnapshot {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}

const EMPTY: ExpensesSnapshot = { expenses: null, summary: null };

/**
 * Loads the first page of expenses plus the current-month summary.
 *
 * Deliberately minimal for the first vertical slice — a query library
 * (TanStack Query) can replace this once caching/optimistic updates are needed.
 *
 * State is only written *after* an `await`, and `loading`/`refreshing` are
 * derived rather than assigned, so the effect never triggers a synchronous
 * cascading render (`react-hooks/set-state-in-effect`).
 */
export function useExpenses(): UseExpensesResult {
  const { status } = useSession();
  const [snapshot, setSnapshot] = useState<ExpensesSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [requestId, setRequestId] = useState(0);

  const signedIn = status === 'signed-in';

  useEffect(() => {
    if (!signedIn) return;

    let active = true;
    void (async () => {
      try {
        const [expenses, summary] = await Promise.all([
          api.get<Schemas['PaginatedExpensesResponseDto']>('/expenses', {
            query: { page: 1, limit: 20, sort: 'date_desc' },
          }),
          api.get<Schemas['ExpenseSummaryDto']>('/expenses/summary'),
        ]);
        if (!active) return;
        setSnapshot({ expenses, summary });
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load expenses.');
      } finally {
        if (active) setSettled(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [signedIn, requestId]);

  const reload = useCallback(() => {
    setSettled(false);
    setRequestId((id) => id + 1);
  }, []);

  // Never surface a previous user's data after signing out.
  const visible = signedIn ? snapshot : EMPTY;
  const hasData = visible.expenses !== null;

  return {
    ...visible,
    loading: signedIn && !settled && !hasData,
    refreshing: signedIn && !settled && hasData,
    error,
    reload,
  };
}
