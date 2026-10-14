import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@pluto/api-client';

/**
 * Retries only what can plausibly succeed on a second attempt.
 *
 * A 4xx will fail identically however many times it is sent, and retrying it
 * only delays the error the user needs to see; a dropped connection (status 0)
 * or a 5xx is usually transient.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        // Mobile focus follows navigation, not a browser window.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // A failed write must never be silently repeated: the caller decides.
        retry: false,
      },
    },
  });
}

let client: QueryClient | null = null;

/**
 * The app-wide cache.
 *
 * A module singleton (rather than a ref) so that non-React code — notably the
 * session store, which must drop cached data when the user signs out — can
 * reach the same instance the provider uses.
 */
export function getQueryClient(): QueryClient {
  client ??= createQueryClient();
  return client;
}
