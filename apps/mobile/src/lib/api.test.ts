/**
 * Token handling at the boundary: the API surface itself (`/auth/refresh`,
 * `DELETE /users/me`) is tested plain — no hooks, no timers, just the fetch
 * envelope the server actually sends.
 *
 * `api.ts` captures `fetch` when it builds the client (`options.fetch ?? fetch`),
 * so each test drains the module registry, stubs `globalThis.fetch` to route the
 * request, and re-imports the module with a fresh session singleton.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Schemas } from '@pluto/api-client';

// The storage layer is the one native seam — SecureStore has no device in a node
// environment, so it is mocked. Each test controls which token it holds and then
// inspects whether the client cleared it.
const storage = vi.hoisted(() => ({
  readRefreshToken: vi.fn<() => Promise<string | null>>(async () => null),
  writeRefreshToken: vi.fn<() => Promise<void>>(async () => {}),
  deleteRefreshToken: vi.fn<() => Promise<void>>(async () => {}),
}));

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function envelope(data: unknown): Record<string, unknown> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

function errorEnvelope(message: string): Record<string, unknown> {
  return {
    success: false,
    statusCode: 400,
    path: '/',
    method: 'POST',
    error: message,
    timestamp: new Date().toISOString(),
  };
}

function authDto(overrides: Partial<Schemas['AuthResponseDto']> = {}): Schemas['AuthResponseDto'] {
  return {
    accessToken: 'fresh-access',
    expiresIn: 900,
    refreshToken: 'fresh-refresh',
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

/** The one call shape the client makes; narrow enough to assert on the args. */
type Route = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** A fresh module registry wired to `route`, so each test starts clean. */
async function loadApis(route: Route) {
  vi.resetModules();
  vi.doMock('./session-storage', () => storage);
  globalThis.fetch = route as unknown as typeof fetch;

  const api = await import('./api');
  const session = await import('./session');
  return { api, session };
}

describe('api', () => {
  beforeEach(() => {
    storage.readRefreshToken.mockReset();
    storage.readRefreshToken.mockResolvedValue(null);
    storage.writeRefreshToken.mockReset();
    storage.deleteRefreshToken.mockReset();
  });

  it('replays a 401 after a successful rotation', async () => {
    const fetchMock = vi.fn<Route>(async (url, init) => {
      const href = typeof url === 'string' ? url : String(url);
      if (href.endsWith('/auth/refresh')) return response(200, envelope(authDto()));

      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (authorization === 'Bearer stale-access') return response(401, errorEnvelope('Unauthorized'));
      return response(200, envelope({ hello: 'world' }));
    });

    const { api, session } = await loadApis(fetchMock);
    // Start signed in with a token the server has already rejected.
    session.saveSession(authDto({ accessToken: 'stale-access', refreshToken: 'live-refresh' }));

    await expect(api.api.get<{ hello: string }>('/expenses')).resolves.toEqual({ hello: 'world' });

    // The original request plus its replay, with exactly one rotation between.
    const requests = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requests.filter((url) => !url.endsWith('/auth/refresh'))).toHaveLength(2);
    expect(requests.filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('clears the local session when the refresh is rejected', async () => {
    const fetchMock = vi.fn<Route>(async () => response(401, errorEnvelope('Unauthorized')));

    const { api, session } = await loadApis(fetchMock);
    session.saveSession(authDto({ accessToken: 'stale-access', refreshToken: 'dead' }));

    await expect(api.api.get('/expenses')).rejects.toThrow();

    expect(session.getSessionState().status).toBe('signed-out');
    expect(storage.deleteRefreshToken).toHaveBeenCalled();
  });

  it('keeps the credential when the server cannot be reached', async () => {
    const fetchMock = vi.fn<Route>(async () => {
      throw new ApiError(0, 'Could not reach the server.');
    });

    // A fresh registry, unreachable server — bootstrap must keep the token.
    const { api, session } = await loadApis(fetchMock);
    storage.readRefreshToken.mockResolvedValue('kept-token');

    await api.bootstrapSession();

    // The in-memory token is dropped, but the stored one survives, so the next
    // launch can retry instead of forcing a fresh sign-in.
    expect(session.getSessionState().status).toBe('signed-out');
    expect(storage.readRefreshToken).toHaveBeenCalled();
    expect(storage.deleteRefreshToken).not.toHaveBeenCalled();
  });

  it('deletes the account only once the server confirms', async () => {
    let confirmed = false;
    const fetchMock = vi.fn<Route>(async (url, init) => {
      const href = typeof url === 'string' ? url : String(url);
      if (init?.method === 'DELETE' && href.endsWith('/users/me')) {
        if (!confirmed) {
          confirmed = true;
          return response(400, errorEnvelope('Backup store unreachable'));
        }
        return response(200, envelope({ success: true, message: 'User account deleted.' }));
      }
      return response(200, envelope({}));
    });

    const { api, session } = await loadApis(fetchMock);
    session.saveSession(authDto());

    // A refused delete leaves the user signed in, able to retry.
    await expect(api.deleteAccount()).rejects.toThrow();
    expect(session.getSessionState().status).toBe('signed-in');

    await expect(api.deleteAccount()).resolves.toBeUndefined();
    expect(session.getSessionState().status).toBe('signed-out');
  });

  it('signs out even when the revoke call fails', async () => {
    const fetchMock = vi.fn<Route>(async (url) => {
      const href = typeof url === 'string' ? url : String(url);
      if (href.endsWith('/auth/logout')) return response(500, errorEnvelope('Down'));
      return response(200, envelope({}));
    });

    const { api, session } = await loadApis(fetchMock);
    session.saveSession(authDto());

    await expect(api.signOut()).resolves.toBeUndefined();
    expect(session.getSessionState().status).toBe('signed-out');
  });
});
