import { ApiError } from '@pluto/api-client';

/**
 * Turns anything thrown by a request or a mutation into text for the UI.
 *
 * `ApiError` already carries a server-authored message (`extractErrorMessage`
 * unwraps the envelope), so it is preferred over the generic `Error.message`.
 * Returns `null` for a falsy value so callers can pass a query's `error` field
 * straight through.
 */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
