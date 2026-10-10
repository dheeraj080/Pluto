/**
 * Minimal typed API client for pluto-server.
 *
 * - Access token lives in memory only (module scope).
 * - Refresh token is persisted in localStorage (mirrors the Android client's
 *   EncryptedSharedPreferences usage described in the server runbook).
 * - On a 401, the client transparently rotates the refresh token once and
 *   replays the original request; a failed rotation clears the session.
 * - Every response is unwrapped from pluto-server's global envelope:
 *   { success, data, timestamp }.
 */

import type { AuthSession } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/v1";
const REFRESH_TOKEN_KEY = "pluto.refreshToken";

interface Envelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

interface ErrorEnvelope {
  success: false;
  statusCode: number;
  path: string;
  method: string;
  error: string | string[] | Record<string, unknown>;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ------------------------------------------------------------------ */
/* Session state                                                       */
/* ------------------------------------------------------------------ */

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

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
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveSession(session: AuthSession): void {
  accessToken = session.accessToken;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  }
  notifySessionChange();
}

export function clearSession(): void {
  accessToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  notifySessionChange();
}

/** True when a persisted refresh token exists (used to offer session restore). */
export function hasStoredSession(): boolean {
  return getRefreshToken() !== null;
}

/* ------------------------------------------------------------------ */
/* Error handling                                                      */
/* ------------------------------------------------------------------ */

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed.";
  const { error } = body as Partial<ErrorEnvelope>;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return error.join(" ");
  if (error && typeof error === "object") {
    const messages = Object.values(error)
      .flat()
      .map(String)
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  }
  return "Request failed.";
}

/* ------------------------------------------------------------------ */
/* Refresh (single-flight, rotates one-time refresh tokens)            */
/* ------------------------------------------------------------------ */

async function performRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as Envelope<AuthSession>;
    saveSession(json.data);
    return true;
  } catch {
    return false;
  }
}

/** Deduplicates concurrent refresh attempts (one rotation, many callers). */
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /** Serialized as JSON; Content-Type is set automatically. */
  body?: unknown;
}

export async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined || options.body === null ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }

  if (response.status === 401 && !retried && getRefreshToken()) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, options, true);
    clearSession();
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, extractErrorMessage(body));
  }

  if (response.status === 204) return undefined as T;
  const json = (await response.json()) as Envelope<T>;
  return json.data;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: ApiRequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "DELETE" }),
};
