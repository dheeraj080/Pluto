import { useMutation, useQuery } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

/**
 * The completed cloud backups belonging to the signed-in user.
 *
 * Only the Delete-account screen reads this today: it is the last chance to
 * keep a copy of the data the server is about to erase, so the list is fetched
 * there rather than on launch — an account with nothing to lose pays nothing
 * for it.
 */
export function useBackups() {
  return useQuery({
    queryKey: queryKeys.backups.list(),
    queryFn: () =>
      api.get<Schemas['PaginatedBackupsResponseDto']>('/backups', { query: { limit: 5 } }),
  });
}

/**
 * Resolves one backup to a short-lived presigned S3 URL.
 *
 * The download itself is the browser's job (the URL needs no Authorization
 * header and expires in minutes), so this hook stops at the URL and the caller
 * opens it.
 */
export function useBackupDownload() {
  return useMutation({
    mutationFn: (id: string) => api.get<Schemas['DownloadBackupResponseDto']>(`/backups/${id}/download`),
  });
}
