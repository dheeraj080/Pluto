import { ApiError } from '@pluto/api-client';

/**
 * Whether a failed request is one worth trying again later.
 *
 * The offline queues (profile patch, recurring decisions) share one rule for
 * what "the server could not take this" means:
 *
 * - `status 0` — the server was never reached (offline, DNS, TLS), so nothing
 *   was read and nothing was refused;
 * - `401` — the access token was not accepted; the client will rotate it and
 *   retry, so this is a timing problem, not a verdict on the payload;
 * - `5xx` — the server failed *handling* the request;
 * - a non-`ApiError` — the failure never produced an HTTP answer at all.
 *
 * Everything else is a 4xx the server did answer: the request was understood
 * and refused, and replaying it verbatim can only fail the same way.
 */
export function isTransientApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.status === 0) return true;
  if (error.status === 401) return true;
  return error.status >= 500;
}
