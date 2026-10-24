import { QueryClient } from '@tanstack/react-query';

function shouldRetry(failureCount: number, error: unknown): boolean {
  return false;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30000,
        gcTime: 300000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!client) client = createQueryClient();
  return client;
}
