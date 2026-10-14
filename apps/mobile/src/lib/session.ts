import type { Schemas } from '@pluto/api-client';

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
 * `useSyncExternalStore` (see `src/features/session/use-session.ts`).
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

export function clearSession(): void {
  markSignedOut();
  void deleteRefreshToken();
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
