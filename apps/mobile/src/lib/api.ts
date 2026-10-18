import { ApiError, createApiClient, type Schemas } from '@pluto/api-client';

import { API_URL } from './env';
import * as session from './session';

/**
 * The app's configured API client.
 *
 * `onUnauthorized` rotates the refresh token once and asks the client to replay
 * the original request; a failed rotation signs the user out. This is the same
 * contract as the web client, but sourced from the generated OpenAPI types.
 *
 * A rotation that cannot reach the server does *not* sign the user out: the
 * 401 proved the access token stale, but says nothing about the refresh
 * token, so the session is left untouched and the request simply fails. The
 * next attempt rotates again — signing out here would park a flaky
 * connection at the sign-in screen.
 */
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => session.getAccessToken(),
  onUnauthorized: async () => {
    const outcome = await rotateSession();
    if (outcome === 'rejected') session.clearSession();
    return outcome === 'refreshed';
  },
});

/**
 * Rotation runs on a client without the 401 interceptor.
 *
 * A refused refresh token answers 401, and the intercepted client would answer
 * that by calling `onUnauthorized` — which would await the very rotation
 * promise that is waiting on it. This is the same reason the web client builds
 * its refresh request by hand.
 */
const authApi = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => session.getAccessToken(),
});

type RefreshOutcome = 'refreshed' | 'rejected' | 'unreachable';

/**
 * Status 0 is the client's "could not reach the server" and a 5xx is the server
 * failing — neither says anything about the token, so the credential is kept.
 * Only a 4xx means the server refused this token.
 */
function classifyRefreshFailure(error: unknown): RefreshOutcome {
  const refused = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return refused ? 'rejected' : 'unreachable';
}

async function performRefresh(): Promise<RefreshOutcome> {
  const token = session.getRefreshToken() ?? (await session.loadRefreshToken());
  if (!token) return 'rejected';
  try {
    const rotated = await authApi.post<Schemas['AuthResponseDto']>('/auth/refresh', {
      refreshToken: token,
    });
    session.saveSession(rotated);
    return 'refreshed';
  } catch (error) {
    return classifyRefreshFailure(error);
  }
}

let refreshPromise: Promise<RefreshOutcome> | null = null;

/** Deduplicates concurrent rotations (one-time tokens must not race). */
function rotateSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Restores a session on launch: read the persisted refresh token, then
 * exchange it for a fresh pair.
 *
 * A token the server refuses is discarded — that is real credential loss. An
 * unreachable server is not: the session restores to signed-in from the
 * persisted profile so a launch without connectivity boots into the app
 * (local store, mirrored figures, queued writes intact) instead of parking at
 * the sign-in screen. The first authenticated call retries the rotation; a
 * real rejection downgrades the session and clears everything then.
 */
export async function bootstrapSession(): Promise<void> {
  const stored = await session.loadRefreshToken();
  if (!stored) {
    session.markSignedOut();
    return;
  }

  const outcome = await rotateSession();
  if (outcome === 'refreshed') return;
  if (outcome === 'rejected') {
    session.clearSession();
    return;
  }
  session.restoreOfflineSession(await session.loadProfile());
}

/**
 * Exchanges a Google ID token for a session.
 *
 * The token comes from the native Google Sign-In SDK; the server verifies its
 * signature and audience before issuing tokens. Same endpoint as the web client.
 */
export async function googleLogin(idToken: string): Promise<void> {
  const result = await api.post<Schemas['AuthResponseDto']>('/auth/google', { idToken });
  session.saveSession(result);
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

/**
 * Permanently deletes the signed-in account (web parity: `/delete-account`).
 *
 * `DELETE /v1/users/me` cascades the profile, cloud backups and refresh
 * sessions on the server, so — unlike `signOut` — there is no token left to
 * revoke afterwards: the best-effort `/auth/logout` call the web client makes
 * would only 404 against a row that no longer exists. The local session is
 * cleared only once the server confirms, so a failed delete (S3 unreachable,
 * for instance, which the server refuses to half-do) leaves the user signed in
 * and able to retry rather than stranded with a live account they think is
 * gone.
 */
export async function deleteAccount(): Promise<void> {
  await api.delete<{ success: boolean; message: string }>('/users/me');
  session.clearSession();
}
