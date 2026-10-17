/**
 * The disk-backed read cache.
 *
 * The storage seam is mocked — it reaches for a real filesystem
 * (`expo-file-system` on native, `localStorage` on web) that a node test has
 * neither of. What matters here is the policy rather than the writing: which
 * reads are kept, that a cleared client takes the file with it so the next
 * account cannot boot from it, and that an unreadable or stale snapshot is
 * dropped instead of trusted.
 */
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_SNAPSHOT_AGE_MS,
  clearPersistedQueryCache,
  restoreQueryCache,
  snapshotFor,
  startQueryPersistence,
} from './query-persistence';

const storage = vi.hoisted(() => ({
  readQueryCache: vi.fn<() => Promise<string | null>>(async () => null),
  writeQueryCache: vi.fn<(snapshot: string) => Promise<void>>(async () => {}),
  deleteQueryCache: vi.fn<() => Promise<void>>(async () => {}),
}));

vi.mock('./query-cache-storage', () => storage);

/** Debounce is 1.5s; a comfortably larger advance flushes it exactly once. */
const AFTER_DEBOUNCE_MS = 2_000;

/** A client whose queries never expire behind the test's back. */
function client(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

/** Writes one successful query and returns the decision's text. */
function snapshotText(value: unknown): string {
  const qc = client();
  qc.setQueryData(['expenses'], value);
  const decision = snapshotFor(qc);
  if (decision.kind !== 'write') throw new Error(`expected a write, got ${decision.kind}`);
  return decision.text;
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.readQueryCache.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('snapshotFor', () => {
  it('keeps successful queries and their data, and no mutations', () => {
    const text = snapshotText([{ id: 'e1', amount: 12.5 }]);
    const parsed = JSON.parse(text);

    expect(parsed.savedAt).toBeTypeOf('number');
    expect(parsed.state.queries).toHaveLength(1);
    expect(parsed.state.queries[0].queryKey).toEqual(['expenses']);
    expect(parsed.state.queries[0].state.data).toEqual([{ id: 'e1', amount: 12.5 }]);
    expect(parsed.state.mutations).toEqual([]);
  });

  it('leaves out a query that failed, keeping the ones that answered', async () => {
    const qc = client();
    qc.setQueryData(['expenses'], [1]);

    await expect(
      qc.fetchQuery({
        queryKey: ['categories'],
        queryFn: () => Promise.reject(new Error('offline')),
        retry: false,
      }),
    ).rejects.toThrow('offline');

    const decision = snapshotFor(qc);
    if (decision.kind !== 'write') throw new Error(`expected a write, got ${decision.kind}`);
    expect(JSON.parse(decision.text).state.queries.map((q: { queryKey: unknown[] }) => q.queryKey)).toEqual([
      ['expenses'],
    ]);
  });

  it('asks for a clear when there is nothing worth keeping', () => {
    expect(snapshotFor(client())).toEqual({ kind: 'clear' });
  });

  it('skips rather than growing without bound', () => {
    const qc = client();
    qc.setQueryData(['big'], 'x'.repeat(2 * 1024 * 1024 + 16));

    expect(snapshotFor(qc)).toEqual({ kind: 'skip' });
  });
});

describe('startQueryPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('coalesces a burst of cache changes into one write', async () => {
    const qc = client();
    const stop = startQueryPersistence(qc);

    qc.setQueryData(['a'], 1);
    qc.setQueryData(['b'], 2);
    qc.setQueryData(['c'], 3);

    expect(storage.writeQueryCache).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(AFTER_DEBOUNCE_MS);

    expect(storage.writeQueryCache).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(storage.writeQueryCache.mock.calls[0][0]);
    expect(parsed.state.queries).toHaveLength(3);

    stop();
  });

  it('forgets a pending write once it is stopped', async () => {
    const qc = client();
    const stop = startQueryPersistence(qc);

    qc.setQueryData(['a'], 1);
    stop();

    await vi.advanceTimersByTimeAsync(AFTER_DEBOUNCE_MS);

    expect(storage.writeQueryCache).not.toHaveBeenCalled();
  });

  it('deletes the snapshot when the client is emptied, as on sign-out', async () => {
    const qc = client();
    qc.setQueryData(['expenses'], [1]);
    startQueryPersistence(qc);

    // `clearSession` clears the in-memory client; the writer must follow it to
    // disk, or the next account would boot from this one's figures.
    qc.clear();

    await vi.advanceTimersByTimeAsync(AFTER_DEBOUNCE_MS);

    expect(storage.deleteQueryCache).toHaveBeenCalled();
    expect(storage.writeQueryCache).not.toHaveBeenCalled();
  });
});

describe('restoreQueryCache', () => {
  it('puts a fresh snapshot back into the client', async () => {
    storage.readQueryCache.mockResolvedValueOnce(snapshotText([{ id: 'e1' }]));

    const qc = client();
    await restoreQueryCache(qc);

    expect(qc.getQueryData(['expenses'])).toEqual([{ id: 'e1' }]);
    expect(storage.deleteQueryCache).not.toHaveBeenCalled();
  });

  it('does nothing when there is no snapshot', async () => {
    await expect(restoreQueryCache(client())).resolves.toBeUndefined();

    expect(storage.deleteQueryCache).not.toHaveBeenCalled();
  });

  it('drops a snapshot past its age rather than showing it as truth', async () => {
    const snapshot = JSON.parse(snapshotText([{ id: 'e1' }]));
    snapshot.savedAt = Date.now() - MAX_SNAPSHOT_AGE_MS - 1;
    storage.readQueryCache.mockResolvedValueOnce(JSON.stringify(snapshot));

    const qc = client();
    await restoreQueryCache(qc);

    expect(qc.getQueryData(['expenses'])).toBeUndefined();
    expect(storage.deleteQueryCache).toHaveBeenCalled();
  });

  it.each([['not json at all'], ['null'], ['{"savedAt":1}'], ['{"savedAt":"x","state":{}}']])(
    'drops %p as unusable',
    async (text) => {
      storage.readQueryCache.mockResolvedValueOnce(text);

      const qc = client();
      await expect(restoreQueryCache(qc)).resolves.toBeUndefined();

      expect(qc.getQueryData(['expenses'])).toBeUndefined();
      expect(storage.deleteQueryCache).toHaveBeenCalled();
    },
  );

  it('survives a storage read that fails', async () => {
    storage.readQueryCache.mockRejectedValueOnce(new Error('disk on fire'));

    await expect(restoreQueryCache(client())).resolves.toBeUndefined();
  });
});

describe('clearPersistedQueryCache', () => {
  it('removes the file', async () => {
    await clearPersistedQueryCache();

    expect(storage.deleteQueryCache).toHaveBeenCalledTimes(1);
  });
});
