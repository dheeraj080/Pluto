/**
 * The session store.
 *
 * Each status flip must notify subscribers and — when the user actually leaves —
 * discard the query cache, so the next sign-in never flashes the last account's
 * data. "Actually leaves" is the sharp edge: the purge fires from
 * `clearSession` (credential loss), never from a status change alone, and an
 * unreachable server restores to a usable signed-in state instead of signing
 * the user out.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '@pluto/api-client';

// The store reads the refresh token through `expo-secure-store` (iOS Keychain /
// Android Keystore), which has no device in a node test environment. The three
// helpers are replaced with in-memory mocks; each test decides what the storage
// holds and then inspects what it was asked to do.
const storage = vi.hoisted(() => ({
  readRefreshToken: vi.fn<() => Promise<string | null>>(async () => null),
  writeRefreshToken: vi.fn<() => Promise<void>>(async () => {}),
  deleteRefreshToken: vi.fn<() => Promise<void>>(async () => {}),
  readProfile: vi.fn<() => Promise<unknown>>(async () => null),
  writeProfile: vi.fn<(profile: unknown) => Promise<void>>(async () => {}),
  deleteProfile: vi.fn<() => Promise<void>>(async () => {}),
}));

// Sign-out also deletes the disk read-cache, and that module reaches for
// `expo-file-system` — the same native seam `query-persistence.test.ts` mocks.
// Replaced here so `session.ts` can be imported without a device behind it.
const persistence = vi.hoisted(() => ({
  clearPersistedQueryCache: vi.fn<() => Promise<void>>(async () => {}),
}));

function authResponse(overrides: Partial<Schemas['AuthResponseDto']> = {}): Schemas['AuthResponseDto'] {
  return {
    accessToken: 'access-',
    expiresIn: 900,
    refreshToken: 'refresh-',
    user: {
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      avatarUrl: null,
      baseCurrency: 'USD',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('session store', () => {
  let session: typeof import('./session');
  let clearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('./session-storage', () => storage);
    vi.doMock('./query-persistence', () => persistence);

    storage.readRefreshToken.mockReset();
    storage.readRefreshToken.mockResolvedValue(null);
    storage.writeRefreshToken.mockReset();
    storage.deleteRefreshToken.mockReset();
    storage.readProfile.mockReset();
    storage.readProfile.mockResolvedValue(null);
    storage.writeProfile.mockReset();
    storage.deleteProfile.mockReset();
    persistence.clearPersistedQueryCache.mockReset();
    persistence.clearPersistedQueryCache.mockResolvedValue(undefined);

    // Import after `doMock` so the store binds to the mocked storage.
    session = await import('./session');

    // The store reaches the query client through a module singleton; spy on the
    // instance this fresh registry created.
    const { getQueryClient } = await import('./query-client');
    clearSpy = vi.spyOn(getQueryClient(), 'clear');
  });

  it('starts as loading with no user', () => {
    expect(session.getSessionState()).toEqual({ status: 'loading', user: null, mode: 'local' });
  });

  it('notifies subscribers when the session flips', () => {
    const listener = vi.fn();
    const unsubscribe = session.subscribeSession(listener);

    session.saveSession(authResponse());
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    session.markSignedOut();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('drops the query cache and the stored refresh token on sign-out', () => {
    session.saveSession(authResponse());
    expect(session.getAccessToken()).toBe('access-');

    session.clearSession();

    expect(session.getAccessToken()).toBeNull();
    expect(session.getSessionState().status).toBe('signed-out');
    expect(storage.deleteRefreshToken).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('deletes the persisted snapshot immediately, not via the debounce', () => {
    session.saveSession(authResponse());

    session.clearSession();

    // The debounced writer would reach the file 1.5s later; a kill inside that
    // window is exactly the case this call closes.
    expect(persistence.clearPersistedQueryCache).toHaveBeenCalledTimes(1);
  });

  it('signs out even when the snapshot cannot be deleted', () => {
    session.saveSession(authResponse());
    persistence.clearPersistedQueryCache.mockRejectedValue(new Error('disk gone'));

    // The rejection is swallowed inside `clearSession`, so nothing escapes and
    // the tokens are dropped regardless.
    expect(() => session.clearSession()).not.toThrow();
    expect(session.getSessionState().status).toBe('signed-out');
    expect(storage.deleteRefreshToken).toHaveBeenCalled();
  });

  it('holds the previous state until saveSession, even after reading a token', async () => {
    storage.readRefreshToken.mockResolvedValue('old-refresh-');

    expect(await session.loadRefreshToken()).toBe('old-refresh-');
    // Reading a token is not signing in — only `saveSession` may do that.
    expect(session.getSessionState().status).toBe('loading');

    session.saveSession(authResponse({ accessToken: 'fresh-', refreshToken: 'fresh-refresh-' }));

    expect(storage.writeRefreshToken).toHaveBeenCalledWith('fresh-refresh-');
    expect(session.getSessionState().status).toBe('signed-in');
  });

  it('persists the profile alongside the token', () => {
    const response = authResponse();

    session.saveSession(response);

    // The profile is the offline boot's only source of the base currency, so
    // it must reach storage with the same durability as the token.
    expect(storage.writeProfile).toHaveBeenCalledWith(response.user);
  });

  it('deletes the stored profile on sign-out', () => {
    session.saveSession(authResponse());

    session.clearSession();

    expect(storage.deleteProfile).toHaveBeenCalled();
  });

  it('fires session-cleared listeners only on real credential loss', () => {
    const cleared = vi.fn();
    const unsubscribe = session.onSessionCleared(cleared);
    session.saveSession(authResponse());

    // A status flip alone is not credential loss — an unreachable server can
    // produce one, and the mirror must survive it.
    session.markSignedOut();
    expect(cleared).not.toHaveBeenCalled();

    session.saveSession(authResponse());
    session.clearSession();
    expect(cleared).toHaveBeenCalledTimes(1);

    unsubscribe();
    session.saveSession(authResponse());
    session.clearSession();
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('restores an offline session from the persisted profile without new credentials', () => {
    const profile = authResponse().user;
    session.restoreOfflineSession(profile);

    // Signed in enough to mount the app; no access token until a rotation
    // succeeds, and nothing written or deleted behind it.
    expect(session.getSessionState()).toEqual({ status: 'signed-in', user: profile, mode: 'account' });
    expect(session.getAccessToken()).toBeNull();
    expect(storage.writeRefreshToken).not.toHaveBeenCalled();
    expect(storage.deleteRefreshToken).not.toHaveBeenCalled();
  });
});
