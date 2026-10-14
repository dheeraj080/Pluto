import { useCallback, useSyncExternalStore } from 'react';

import {
  readSecondaryCurrency,
  secondaryCurrencySnapshot,
  subscribeSecondaryCurrency,
  writeSecondaryCurrency,
} from '@/lib/pair-storage';
import { useSession } from '@/hooks/use-session';
import { useUpdateProfile } from '@/hooks/use-user';

export interface Pair {
  /** Reporting currency the server aggregates in; null lets the server default apply. */
  base: string | null;
  /** Display companion the server re-expresses each figure in; null for single-currency display. */
  second: string | null;
  /** Persist a new base currency (`PATCH /users/me`). */
  setBase: (code: string) => void;
  /** Persist a new second currency, client-side only. */
  setSecond: (code: string) => void;
  /** Swap base ⇄ second so a header control can flip the pair. */
  swap: () => void;
}

/**
 * The Pair: the two currencies every report and budget figure is shown in.
 *
 * `base` is read from the session profile rather than mirrored into local
 * storage — the server already persists it, so mobile has one source of truth
 * and a `setBase` is a single `PATCH /users/me`. The second currency has no
 * server home and lives in `lib/pair-storage`.
 *
 * `swap` writes both halves: the new base goes to the server and the old base
 * becomes the second currency, so the two are never briefly equal.
 */
export function usePair(): Pair {
  const { status, user } = useSession();
  const { mutate: updateProfile } = useUpdateProfile();
  const second = useSyncExternalStore(
    subscribeSecondaryCurrency,
    readSecondaryCurrency,
    secondaryCurrencySnapshot,
  );

  const base = status === 'signed-in' ? (user?.baseCurrency ?? null) : null;

  const setBase = useCallback(
    (code: string) => {
      updateProfile({ baseCurrency: code });
    },
    [updateProfile],
  );

  const setSecond = useCallback((code: string) => writeSecondaryCurrency(code), []);

  const swap = useCallback(() => {
    if (!second) return;
    const previousBase = base;
    updateProfile({ baseCurrency: second });
    writeSecondaryCurrency(previousBase);
  }, [base, second, updateProfile]);

  return { base, second, setBase, setSecond, swap };
}
