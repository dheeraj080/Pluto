import { useCallback, useSyncExternalStore } from 'react';

import {
  readSecondaryCurrency,
  secondaryCurrencySnapshot,
  subscribeSecondaryCurrency,
  writeSecondaryCurrency,
} from '@/lib/pair-storage';
import { useSession } from '@/hooks/use-session';
import { useUpdateProfile } from '@/hooks/use-user';
import { getSessionState, setUser } from '@/lib/session';

export interface Pair {
  /** Reporting currency the server aggregates in; null lets the server default apply. */
  base: string | null;
  /** Display companion the server re-expresses each figure in; null for single-currency display. */
  second: string | null;
  /** Persist a new base currency (`PATCH /users/me`). */
  setBase: (code: string) => void;
  /** Persist (or clear, with `null`) the second currency, client-side only. */
  setSecond: (code: string | null) => void;
  /** Swap base ⇄ second so a header control can flip the pair. */
  swap: () => void;
  /** True while a base-currency change is being persisted to the server. */
  savingBase: boolean;
  /** The last base-currency save's error, or null when it succeeded. */
  baseError: unknown;
}

/**
 * The Pair: the two currencies every report and budget figure is shown in.
 *
 * `base` is read from the session profile rather than mirrored into local
 * storage — the server already persists it, so mobile has one source of truth
 * and a `setBase` is a single `PATCH /users/me`. The second currency has no
 * server home and lives in `lib/pair-storage`.
 */
export function usePair(): Pair {
  const { status, user } = useSession();
  const { mutate: updateProfile, isPending, error } = useUpdateProfile();
  const second = useSyncExternalStore(
    subscribeSecondaryCurrency,
    readSecondaryCurrency,
    secondaryCurrencySnapshot,
  );

  const base = status === 'signed-in' ? (user?.baseCurrency ?? null) : null;

  const setBase = useCallback(
    (code: string) => {
      const current = getSessionState().user;
      if (current) {
        setUser({ ...current, baseCurrency: code });
      }
      updateProfile({ baseCurrency: code });
    },
    [updateProfile],
  );

  const setSecond = useCallback((code: string | null) => writeSecondaryCurrency(code), []);

  const swap = useCallback(() => {
    if (!second) return;
    const previousBase = base;
    updateProfile({ baseCurrency: second });
    writeSecondaryCurrency(previousBase);
  }, [base, second, updateProfile]);

  return { base, second, setBase, setSecond, swap, savingBase: isPending, baseError: error };
}