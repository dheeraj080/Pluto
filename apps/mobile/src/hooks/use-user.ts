import { useMutation } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { getSessionState, setUser } from '@/lib/session';

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
    /**
     * Echo a base-currency choice into the session store before the round-trip
     * finishes.
     *
     * The Pair pickers read `baseCurrency` straight from the session, so without
     * this the control keeps showing the previous currency for the whole `PATCH`
     * — which reads as the selection not sticking. The request stays the source
     * of truth: `onSuccess` writes the server's copy and `onError` restores the
     * snapshot taken here.
     */
    onMutate: (patch) => {
      if (patch.baseCurrency === undefined) return undefined;
      const previousUser = getSessionState().user;
      if (previousUser) {
        setUser({ ...previousUser, baseCurrency: patch.baseCurrency });
      }
      return { previousUser };
    },
    onError: (_error, _patch, context) => {
      if (context) setUser(context.previousUser);
    },
    onSuccess: (profile) => {
      setUser(profile);
    },
  });
}
