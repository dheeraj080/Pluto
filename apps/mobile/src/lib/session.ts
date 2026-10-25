import type { Schemas } from '@pluto/api-client';

import { readOnboardingCompleted, writeOnboardingCompleted } from '@/lib/session-storage';

import { getQueryClient } from './query-client';
import { clearPersistedQueryCache } from './query-persistence';
import {
  deleteProfile,
  deleteRefreshToken,
  readProfile,
  readRefreshToken,
  writeProfile,
  writeRefreshToken,
} from './session-storage';

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out';
export type AppMode = 'local' | 'account';

export interface SessionState {
  /**
   * `loading` until the persisted refresh token has been read from secure
   * storage on launch; screens must not flash the sign-in prompt before then.
   */
  status: SessionStatus;
  user: Schemas['UserProfileDto'] | null;
  mode: AppMode;
  onboardingCompleted?: boolean;
}

/**
 * Session store.
 *
 * Mirrors `apps/web/src/lib/api.ts`: the access token is memory-only; what
 * persists is the refresh token and, beside it, the profile an offline boot
 * restores from. Components observe this via `useSyncExternalStore` (see
 * `src/hooks/use-session.ts`).
 */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let appMode: AppMode = 'local';
let state: SessionState = { status: 'loading', user: null, mode: appMode };
// Seed from storage so the flag survives app restarts
readOnboardingCompleted().then((v) => {
  state = { ...state, onboardingCompleted: v };
  emit();
});

const listeners = new Set<() => void>();
const clearedListeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Registers a callback for the moment the session is *cleared* — sign-out, a
 * refused refresh token, account deletion.
 *
 * Deliberately not a status subscription: an unreachable server can also leave
 * the status reading `signed-out` (or, since offline boots restore to
 * `signed-in`, never reach that state at all), and the local mirror must not
 * be purged for a connection failure. Only credential loss is signed out for
 * real, so only {@link clearSession} fires this.
 */
export function onSessionCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}

export function getSessionState(): SessionState {
  return state;
}

export function getAppMode(): AppMode {
  return appMode;
}

export function setAppMode(mode: AppMode): void {
  appMode = mode;
  state = { ...state, mode: appMode };
  emit();
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
  appMode = 'account';
  state = { status: 'signed-in', user: session.user, mode: 'account' };
  void writeRefreshToken(session.refreshToken);
  void writeProfile(session.user);
  emit();
}

/**
 * Restores a signed-in state from the persisted profile, without a validated
 * session — the held refresh token's fate is unknown because the server could
 * not be reached.
 *
 * This is the offline-first trade: a launch with no connection boots into the
 * app (the local store and the read cache have the data), and the first
 * authenticated call retries the rotation — a real rejection downgrades the
 * session to signed-out and clears everything then. The access token stays
 * null until a rotation succeeds.
 */
export function restoreOfflineSession(profile: Schemas['UserProfileDto'] | null): void {
  appMode = profile ? 'account' : appMode;
  state = { status: 'signed-in', user: profile, mode: appMode };
  emit();
}

export function markSignedOut(): void {
  accessToken = null;
  refreshToken = null;
  state = { status: 'signed-out', user: null, mode: appMode };
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
 * Native listeners (the SQLite mirror, see `src/lib/sync/background-sync.ts`)
 * purge alongside it via {@link onSessionCleared}, which fires here — not on a
 * status change — so a mere connection failure can never wipe the mirror or
 * the queued writes it holds.
 */
export function clearSession(): void {
  markSignedOut();
  void deleteRefreshToken();
  void deleteProfile();
  for (const listener of clearedListeners) listener();
  getQueryClient().clear();
  void clearPersistedQueryCache().catch(() => {
    /* Best-effort: sign-out must not fail. The cache clear above still queues
     * the debounced persistence pass, which sees an empty client and deletes
     * the same file again. */
  });
}

const LOCAL_USER_ID = 'local-user';
const LOCAL_USER_EMAIL = 'local@pluto.app';

export function createLocalSession(baseCurrency = 'USD'): Schemas['UserProfileDto'] {
  const user: Schemas['UserProfileDto'] = {
    id: LOCAL_USER_ID,
    email: LOCAL_USER_EMAIL,
    name: 'Local User',
    avatarUrl: null,
    baseCurrency,
    createdAt: new Date().toISOString(),
  };
  accessToken = null;
  refreshToken = null;
  appMode = 'local';
  state = { status: 'signed-in', user, mode: 'local' };
  void writeProfile(user);
  emit();
  return user;
}

export function ensureLocalSession(baseCurrency = 'USD'): Schemas['UserProfileDto'] {
  if (state.status === 'signed-in' && state.user && appMode === 'local') {
    return state.user;
  }
  if (state.status === 'signed-in' && state.user && appMode === 'account') {
    return state.user;
  }
  return createLocalSession(baseCurrency);
}

/** Reads the persisted refresh token into memory without validating it. */
export async function loadRefreshToken(): Promise<string | null> {
  refreshToken = await readRefreshToken();
  return refreshToken;
}

/** Reads the persisted profile (the offline boot's source of the base currency). */
export async function loadProfile(): Promise<Schemas['UserProfileDto'] | null> {
  return readProfile();
}

/**
 * Replaces the session's profile copy.
 *
 * The persisted profile is written alongside the in-memory one (deleting it
 * for a null), because that disk copy is what an offline boot restores the
 * base currency *from* — a base-currency change that only lived in memory
 * would silently revert on the next cold start with no connection. This is
 * also the path a queued, replayed profile patch settles through.
 */
export function setUser(user: Schemas['UserProfileDto'] | null): void {
  state = { ...state, user, mode: appMode };
  // The disk copy is what an offline boot restores the base currency from, in
  // local mode as well as account mode. A local profile holds no credential.
  if (user) void writeProfile(user);
  else void deleteProfile();
  emit();
}
