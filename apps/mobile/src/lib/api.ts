import { ApiError, createApiClient, type Schemas } from '@pluto/api-client';

import { API_URL } from './env';
import * as session from './session';

/**
 * The app's configured API client.
 *
 * `onUnauthorized` rotates the refresh token once and asks the client to replay
 * the original request; a failed rotation signs the user out. This is the same
 * contract as the web client, but sourced from the generated OpenAPI types.
 */
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => session.getAccessToken(),
  onUnauthorized: async () => {
    const refreshed = await refreshSession();
    if (!refreshed) session.clearSession();
    return refreshed;
  },
});

let refreshPromise: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const token = session.getRefreshToken() ?? (await session.loadRefreshToken());
  if (!token) return false;
  try {
    const rotated = await api.post<Schemas['AuthResponseDto']>('/auth/refresh', {
      refreshToken: token,
    });
    session.saveSession(rotated);
    return true;
  } catch {
    return false;
  }
}

/** Deduplicates concurrent rotations (one-time tokens must not race). */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Restores a session on launch: read the persisted refresh token, then
 * exchange it for a fresh pair. Falls back to signed-out on any failure.
 */
export async function bootstrapSession(): Promise<void> {
  const stored = await session.loadRefreshToken();
  if (!stored) {
    session.markSignedOut();
    return;
  }
  const restored = await refreshSession();
  if (!restored) session.clearSession();
}

/** Dev-only mock sign-in — requires `ENABLE_DEV_AUTH=true` on the server. */
export async function devLogin(): Promise<void> {
  const result = await api.post<Schemas['AuthResponseDto']>('/auth/dev-login', {});
  session.saveSession(result);
}

export async function signOut(): Promise<void> {
  const token = session.getRefreshToken();
  if (token) {
    try {
      await api.post('/auth/logout', { refreshToken: token });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      // Best-effort: the local session is cleared regardless.
    }
  }
  session.clearSession();
}
