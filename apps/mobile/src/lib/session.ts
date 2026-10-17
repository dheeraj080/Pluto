import type { Schemas } from '@pluto/api-client';

import { getQueryClient } from './query-client';
import { clearPersistedQueryCache } from './query-persistence';
import { deleteRefreshToken, readRefreshToken, writeRefreshToken } from './session-storage';

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out';

export interface SessionState {
  /**
   * `loading` until the persisted refresh token has been read from secure
   * storage on launch; screens must not flash the sign-in prompt before then.
   */
  status: SessionStatus;
  user: Schemas['UserProfileDto'] | null;
}

/**
 * Session store.
 *
 * Mirrors `apps/web/src/lib/api.ts`: the access token is memory-only and the
 * refresh token is the only persisted credential. Components observe this via
 * `useSyncExternalStore` (see `src/hooks/use-session.ts`).
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let state: SessionState = { status: 'loading', user: null };

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionState(): SessionState {
  return state;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** In-memory cache; may be null before `bootstrapSession` has run. */
export function getRefreshToken(): string | null {
  return refreshToken;
}

export function saveSession(session: Schemas['AuthResponseDto']): void {
  accessToken = session.accessToken;
  refreshToken = session.refreshToken;
  state = { status: 'signed-in', user: session.user };
  void writeRefreshToken(session.refreshToken);
  emit();
}

export function markSignedOut(): void {
  accessToken = null;
  refreshToken = null;
  state = { status: 'signed-out', user: null };
  emit();
}

/**
 * Ends the session: credentials are dropped and cached API data is discarded.
 *
 * Dropping the cache matters as much as dropping the tokens — without it,
 * signing in as a second account would briefly render the first account's
 * expenses. The disk copy is deleted here rather than left to the debounced
 * persistence writer: a kill inside the debounce window would otherwise leave
 * this account's snapshot on disk for the next one to hydrate.
 *
 * The on-device store is purged alongside it, from the native-only sync module
 * that watches this state — see `src/lib/sync/background-sync.ts`.
 */
export function clearSession(): void {
  markSignedOut();
  void deleteRefreshToken();
  getQueryClient().clear();
  void clearPersistedQueryCache().catch(() => {
    /* Best-effort: sign-out must not fail. The cache clear above still queues
     * the debounced persistence pass, which sees an empty client and deletes
     * the same file again. */
  });
}

/** Reads the persisted refresh token into memory without validating it. */
export async function loadRefreshToken(): Promise<string | null> {
  refreshToken = await readRefreshToken();
  return refreshToken;
}

export function setUser(user: Schemas['UserProfileDto'] | null): void {
  state = { ...state, user };
  emit();
}
