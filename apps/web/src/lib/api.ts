/**
 * Minimal typed API client for pluto-server.
 *
 * - Access token lives in memory only (module scope).
 * - Refresh token is persisted in localStorage (mirrors the Android client's
 *   EncryptedSharedPreferences usage described in the server runbook).
 * - On a 401, the client transparently rotates the refresh token once and
 *   replays the original request; a failed rotation clears the session.
 * - Every response is unwrapped from pluto-server's global envelope.
 */
import { ApiError, createApiClient } from '@pluto/api-client';
import type { AuthSession } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
const REFRESH_TOKEN_KEY = 'pluto.refreshToken';

/* ------------------------------------------------------------------ */
/* Session state                                                       */
/* ------------------------------------------------------------------ */

let accessToken: string | null = null;

/**
 * Session-presence store for React.
 *
 * The persisted refresh token lives in localStorage, which is an external
 * store — components observe it through `useSyncExternalStore` rather than
 * reading it in an effect. Every mutation below notifies, so the header flips
 * between "Sign in" and "My expenses" the moment the session changes.
 */
const sessionListeners = new Set<() => void>();

function notifySessionChange(): void {
  for (const listener of sessionListeners) listener();
}

export function subscribeSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/** True when a refresh token is persisted. Optimistic — not a validity check. */
export function getSessionSnapshot(): boolean {
  return getRefreshToken() !== null;
}

/** Prerender has no localStorage, so assume signed out. */
export function getSessionServerSnapshot(): boolean {
  return false;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveSession(session: AuthSession): void {
  accessToken = session.accessToken;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  }
  notifySessionChange();
}

export function clearSession(): void {
  accessToken = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  notifySessionChange();
}

/** True when a persisted refresh token exists (used to offer session restore). */
export function hasStoredSession(): boolean {
  return getRefreshToken() !== null;
}

export { ApiError };

/* ------------------------------------------------------------------ */
/* Refresh (single-flight, mirrors mobile tri-state)                   */
/* ------------------------------------------------------------------ */

type RefreshOutcome = 'refreshed' | 'rejected' | 'unreachable';

/**
 * Status 0 is "could not reach the server", 5xx is the server failing — neither
 * implies the token is bad. Only 4xx means the server refused this token.
 */
function classifyRefreshFailure(error: unknown): RefreshOutcome {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return 'rejected';
  }
  return 'unreachable';
}

const authApi = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
});

async function performRefresh(): Promise<RefreshOutcome> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return 'rejected';
  try {
    const rotated = await authApi.post<AuthSession>('/auth/refresh', {
      refreshToken,
    });
    saveSession(rotated);
    return 'refreshed';
  } catch (error) {
    return classifyRefreshFailure(error);
  }
}

let refreshPromise: Promise<RefreshOutcome> | null = null;

/** Deduplicates concurrent refresh attempts (one rotation, many callers). */
function rotateSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/* ------------------------------------------------------------------ */
/* Shared API client                                                   */
/* ------------------------------------------------------------------ */

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  onUnauthorized: async () => {
    const outcome = await rotateSession();
    if (outcome === 'rejected') clearSession();
    else if (outcome !== 'refreshed') {
      // Cannot reach the server: keep the credential and reflect signed-out
      // until a successful refresh. notifySessionChange() is already implied by
      // accessToken being null? We keep refreshToken in localStorage and
      // setAccessToken(null) if needed. Already done.
      accessToken = null;
      notifySessionChange();
    }
    return outcome === 'refreshed';
  },
});
