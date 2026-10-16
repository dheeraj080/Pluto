// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from './types';

type Store = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  clear(): void;
};

function jsonResponse(
  body: unknown,
  init: { status?: number; ok?: boolean } = {},
): Response {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function state(code: number, message: string, extra: Record<string, unknown> = {}) {
  return { statusCode: code, error: message, ...extra } as const;
}

describe('web api client (api.ts)', () => {
  const REFRESH_KEY = 'pluto.refreshToken';
  let store: Map<string, string>;
  let storage: Store;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    store = new Map<string, string>();
    storage = {
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
  });

  async function loadApi(fetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    vi.stubGlobal('fetch', fetchHandler as unknown as typeof fetch);
    (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
    vi.stubGlobal('localStorage', storage);
    return import('./api');
  }

  it('unwraps the success envelope, not the raw response', async () => {
    const handler = vi.fn(async () =>
      jsonResponse({ success: true, data: { id: 'x', name: 'ok' }, timestamp: new Date().toISOString() }),
    );
    const { api } = await loadApi(handler);
    await expect(api.get<{ id: string }>('/expenses/1')).resolves.toEqual({ id: 'x', name: 'ok' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('saveSession / clearSession / hasStoredSession reflect localStorage + memoised access token', async () => {
    const { saveSession, clearSession, getSessionSnapshot, getAccessToken, getRefreshToken, hasStoredSession, subscribeSession } =
      await loadApi(async () => jsonResponse({ success: true, data: { pending: 'never consumed' }, timestamp: '' }));

    expect(getSessionSnapshot()).toBe(false);
    expect(hasStoredSession()).toBe(false);
    expect(getAccessToken()).toBeNull();

    let notified = 0;
    const unsub = subscribeSession(() => notified++);

    saveSession({ accessToken: 'a', refreshToken: 'r', user: { id: 'u' } } as unknown as AuthSession);

    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    expect(getSessionSnapshot()).toBe(true);
    expect(hasStoredSession()).toBe(true);
    expect(notified).toBe(1);

    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getSessionSnapshot()).toBe(false);
    expect(notified).toBe(2);

    unsub();
    saveSession({ accessToken: 'b', refreshToken: 'r2', user: { id: 'u2' } } as unknown as AuthSession);
    expect(notified).toBe(2); // no extra call after unsubscribe
  });

  it('401 → rotation succeeds → the original request is replayed and the new tokens are persisted', async () => {
    let refreshCalls = 0;
    const handler = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith('/auth/refresh')) {
        refreshCalls++;
        return jsonResponse({
          success: true,
          data: { accessToken: 'newAccess', refreshToken: 'newRefresh' },
          timestamp: new Date().toISOString(),
        });
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === 'Bearer newAccess') {
        return jsonResponse({
          success: true,
          data: [{ id: 'ok' }],
          timestamp: new Date().toISOString(),
        });
      }
      return jsonResponse({ success: false, ...state(401, 'Unauthorized') }, { status: 401, ok: false });
    });

    const mod = await loadApi(handler);
    mod.saveSession({ accessToken: 'stale', refreshToken: 'r1', user: { id: 'u' } } as unknown as AuthSession);

    await expect(mod.api.get<unknown>('/expenses')).resolves.toEqual([{ id: 'ok' }]);

    expect(refreshCalls).toBe(1);
    expect(mod.getAccessToken()).toBe('newAccess');
    expect(mod.getRefreshToken()).toBe('newRefresh');
    expect(handler).toHaveBeenCalledWith(expect.stringContaining('/expenses'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer newAccess' }) }));
  });

  it('401 → refresh refused on the wire (401) → the credential is discarded and the original 401 is re-thrown', async () => {
    const handler = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/auth/refresh')) {
        return jsonResponse({ success: false, ...state(401, 'refused') }, { status: 401, ok: false });
      }
      return jsonResponse({ success: false, ...state(401, 'gone') }, { status: 401, ok: false });
    });

    const mod = await loadApi(handler);
    mod.saveSession({ accessToken: 'bad', refreshToken: 'badRefresh', user: { id: 'u' } } as unknown as AuthSession);

    await expect(mod.api.get('/expenses')).rejects.toMatchObject({ status: 401 });
    expect(mod.getRefreshToken()).toBeNull();
    expect(mod.getAccessToken()).toBeNull();
  });

  it('cannot reach the auth endpoint (status 0 / network) → the credential is kept for the next attempt', async () => {
    const { ApiError } = await import('@pluto/api-client');

    const handler = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/auth/refresh')) throw new ApiError(0, 'Could not reach the server.');
      return jsonResponse({ success: false, ...state(401, 'stale') }, { status: 401, ok: false });
    });

    const mod = await loadApi(handler);
    mod.saveSession({ accessToken: 'stale', refreshToken: 'keep-me', user: { id: 'u' } } as unknown as AuthSession);

    await expect(mod.api.get('/expenses')).rejects.toMatchObject({ status: 401 });
    expect(mod.getRefreshToken()).toBe('keep-me');
    expect(mod.hasStoredSession()).toBe(true);
  });

  it('5xx from /auth/refresh → unreachable, not a refusal: the refresh token is kept', async () => {
    const handler = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/auth/refresh')) {
        return jsonResponse({ success: false, ...state(500, 'up') }, { status: 500, ok: false });
      }
      return jsonResponse({ success: false, ...state(401, 'need refresh') }, { status: 401, ok: false });
    });

    const mod = await loadApi(handler);
    mod.saveSession({ accessToken: 'old', refreshToken: 'stay', user: { id: 'u' } } as unknown as AuthSession);

    await expect(mod.api.get('/expenses')).rejects.toMatchObject({ status: 401 });
    expect(mod.getRefreshToken()).toBe('stay');
  });

  it('deduplicates concurrent refreshes: two 401s race, only one POST /auth/refresh', async () => {
    let refreshCalls = 0;
    const handler = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith('/auth/refresh')) {
        refreshCalls++;
        await new Promise<void>((r) => setTimeout(r, 10));
        return jsonResponse(
          {
            success: true,
            data: { accessToken: 'shared', refreshToken: 'sharedRefresh' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 },
        );
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === 'Bearer shared') {
        return jsonResponse({
          success: true,
          data: [{ id: 'x' }],
          timestamp: new Date().toISOString(),
        });
      }
      return jsonResponse({ success: false, ...state(401, 'stale') }, { status: 401, ok: false });
    });

    const mod = await loadApi(handler);
    mod.saveSession({ accessToken: 'old', refreshToken: 'r', user: { id: 'u' } } as unknown as AuthSession);

    const [a, b] = await Promise.all([mod.api.get<unknown>('/a'), mod.api.get<unknown>('/b')]);
    expect(a).toEqual([{ id: 'x' }]);
    expect(b).toEqual([{ id: 'x' }]);
    expect(refreshCalls).toBe(1);
  });

  it('getSessionServerSnapshot() is always false (prerender has no localStorage)', async () => {
    const { getSessionServerSnapshot } = await loadApi(async () => jsonResponse({ success: true, data: null, timestamp: '' }));
    expect(getSessionServerSnapshot()).toBe(false);
  });
});
