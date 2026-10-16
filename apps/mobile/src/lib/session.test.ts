/**
 * The session store.
 *
 * Each status flip must notify subscribers and — when the user actually leaves —
 * discard the query cache, so the next sign-in never flashes the last account's
 * data.
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

    storage.readRefreshToken.mockReset();
    storage.readRefreshToken.mockResolvedValue(null);
    storage.writeRefreshToken.mockReset();
    storage.deleteRefreshToken.mockReset();

    // Import after `doMock` so the store binds to the mocked storage.
    session = await import('./session');

    // The store reaches the query client through a module singleton; spy on the
    // instance this fresh registry created.
    const { getQueryClient } = await import('./query-client');
    clearSpy = vi.spyOn(getQueryClient(), 'clear');
  });

  it('starts as loading with no user', () => {
    expect(session.getSessionState()).toEqual({ status: 'loading', user: null });
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

  it('holds the previous state until saveSession, even after reading a token', async () => {
    storage.readRefreshToken.mockResolvedValue('old-refresh-');

    expect(await session.loadRefreshToken()).toBe('old-refresh-');
    // Reading a token is not signing in — only `saveSession` may do that.
    expect(session.getSessionState().status).toBe('loading');

    session.saveSession(authResponse({ accessToken: 'fresh-', refreshToken: 'fresh-refresh-' }));

    expect(storage.writeRefreshToken).toHaveBeenCalledWith('fresh-refresh-');
    expect(session.getSessionState().status).toBe('signed-in');
  });
});
