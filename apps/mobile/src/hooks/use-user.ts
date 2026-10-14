import { useMutation } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { setUser } from '@/lib/session';

/**
 * Updates the signed-in user's profile (`PATCH /v1/users/me`).
 *
 * The session store is the only place the app reads the profile from, so the
 * server's response is written straight back into it. That keeps the greeting
 * and the default expense currency in step without a follow-up `GET /users/me`.
 *
 * There is no query to invalidate: the profile does not live in the query cache.
 */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: (patch: Schemas['UpdateUserDto']) =>
      api.patch<Schemas['UserProfileDto']>('/users/me', patch),
    onSuccess: (profile) => {
      setUser(profile);
    },
  });
}
