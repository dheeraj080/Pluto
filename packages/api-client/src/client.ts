import { extractErrorMessage, unwrapEnvelope } from './envelope';

/** Every DTO in the server's OpenAPI document, keyed by schema name. */
export type { components, paths, operations } from './schema';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-serialized automatically. */
  body?: unknown;
  /** Appended as a query string; `undefined`/`null` entries are dropped. */
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  /** Base URL including the API prefix, e.g. `http://localhost:3000/v1`. */
  baseUrl: string;
  /** Resolves the current access token. Called per request. */
  getAccessToken?: () => string | null | Promise<string | null>;
  /**
   * Invoked once when a request answers `401`. Return `true` if a refresh
   * succeeded and the request should be replayed, `false` to give up.
   * Sign-out side effects belong in the implementation (see the app's
   * `session` module).
   */
  onUnauthorized?: () => boolean | Promise<boolean>;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!query) return `${base}${suffix}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}${suffix}?${qs}` : `${base}${suffix}`;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;

  async function execute<T>(path: string, opts: RequestOptions, retried: boolean): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };

    const token = await options.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const hasBody = opts.body !== undefined && opts.body !== null;
    if (hasBody) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await doFetch(buildUrl(options.baseUrl, path, opts.query), {
        method: opts.method ?? 'GET',
        headers,
        body: hasBody ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      // For offline scenarios, don't show scary errors
      throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
    }

    if (response.status === 401 && !retried && options.onUnauthorized) {
      const refreshed = await options.onUnauthorized();
      if (refreshed) return execute<T>(path, opts, true);
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
    return unwrapEnvelope<T>(await response.json());
  }

  return {
    request: (path, opts = {}) => execute(path, opts, false),
    get: (path, opts = {}) => execute(path, { ...opts, method: 'GET' }, false),
    post: (path, body, opts = {}) => execute(path, { ...opts, method: 'POST', body }, false),
    patch: (path, body, opts = {}) => execute(path, { ...opts, method: 'PATCH', body }, false),
    delete: (path, opts = {}) => execute(path, { ...opts, method: 'DELETE' }, false),
  };
}
