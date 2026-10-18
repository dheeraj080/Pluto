import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query';

import { deleteQueryCache, readQueryCache, writeQueryCache } from './query-cache-storage';
import { getQueryClient } from './query-client';

/**
 * A disk-backed read cache.
 *
 * Restores the last *successful* reads on disk, so a cold start with no
 * connection still paints the dashboard, the list and the budgets from what
 * they showed last time instead of an error. It is only ever a read cache —
 * the server remains the source of truth through the sync engine's pull, and
 * nothing here is ever replayed at the server.
 *
 * Every restored query keeps its original `dataUpdatedAt`, so it arrives
 * already stale and refetches in the background as screens mount. Offline that
 * refetch fails quietly and the cached figures stay put: a card only falls
 * back to its error state when it has nothing to show, so stale data always
 * outranks a retry prompt.
 *
 * Only successful *queries* are kept — mutations, pending queries and errors
 * are never serialised.
 *
 * The horizon is a week: long enough to bridge a short offline stretch (a
 * flight, a few days off-grid) and still bounded, so a device dormant for
 * months opens on fetches rather than month-old figures.
 */
export const MAX_SNAPSHOT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** A burst of cache events collapses into a single write. */
const WRITE_DEBOUNCE_MS = 1_500;

/** Above this the snapshot is a bug, not a cache; the previous one is kept. */
const MAX_SNAPSHOT_LENGTH = 2 * 1024 * 1024;

interface Snapshot {
  savedAt: number;
  state: DehydratedState;
}

export type SnapshotDecision =
  | { kind: 'write'; text: string }
  | { kind: 'clear' }
  | { kind: 'skip' };

/**
 * What to do with the file given the client's current contents.
 *
 * `clear` is what makes sign-out safe: `clearSession` empties the client, this
 * sees an empty cache and deletes the file, so the next account never boots
 * from the previous one's data.
 */
export function snapshotFor(client: QueryClient): SnapshotDecision {
  const state = dehydrate(client, {
    shouldDehydrateMutation: () => false,
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  });

  if (state.queries.length === 0) return { kind: 'clear' };

  const text = JSON.stringify({ savedAt: Date.now(), state } satisfies Snapshot);
  return text.length > MAX_SNAPSHOT_LENGTH ? { kind: 'skip' } : { kind: 'write', text };
}

async function applySnapshot(client: QueryClient): Promise<void> {
  const decision = snapshotFor(client);
  if (decision.kind === 'write') {
    await writeQueryCache(decision.text);
  } else if (decision.kind === 'clear') {
    await deleteQueryCache();
  }
}

/**
 * Mirrors the read cache to disk whenever it changes, debounced.
 *
 * Subscribing to the whole cache (rather than each query) is what keeps this
 * to one seam: there is no per-query bookkeeping to forget when a hook is
 * added. Returns an unsubscribe function.
 */
export function startQueryPersistence(client: QueryClient = getQueryClient()): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void applySnapshot(client);
    }, WRITE_DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribe();
  };
}

/** Drops the snapshot without touching the in-memory client. */
export async function clearPersistedQueryCache(): Promise<void> {
  await deleteQueryCache();
}

/**
 * Puts the last snapshot back into the client.
 *
 * Best-effort throughout: a cache that cannot be read is a slower first paint,
 * never a crash, so every failure removes the unusable file and leaves the
 * client empty.
 */
export async function restoreQueryCache(client: QueryClient = getQueryClient()): Promise<void> {
  const text = await readQueryCache().catch(() => null);
  if (!text) return;

  const snapshot = parseSnapshot(text);
  if (!snapshot || Date.now() - snapshot.savedAt > MAX_SNAPSHOT_AGE_MS) {
    await clearPersistedQueryCache();
    return;
  }

  hydrate(client, snapshot.state);
}

function parseSnapshot(text: string): Snapshot | null {
  try {
    const value = JSON.parse(text) as Partial<Snapshot> | null;
    if (!value || typeof value.savedAt !== 'number' || !value.state) return null;

    const { state } = value;
    if (!Array.isArray(state.queries) || !Array.isArray(state.mutations)) return null;

    return { savedAt: value.savedAt, state };
  } catch {
    return null;
  }
}
