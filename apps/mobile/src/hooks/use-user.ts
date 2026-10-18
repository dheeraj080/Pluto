import { useMutation } from '@tanstack/react-query';
import type { Schemas } from '@pluto/api-client';

import { api } from '@/lib/api';
import { getSessionState, setUser } from '@/lib/session';
import { localStoreEnabled } from '@/lib/store';
import { getDatabase } from '@/lib/store/local/database';
import {
  clearProfilePatch,
  profilePatchDisposition,
  queueProfilePatch,
} from '@/lib/store/local/profile-patch';

/**
 * The profile with this patch applied — what the user should see while, and
 * if, the server has not taken it yet.
 */
function appliedProfile(
  patch: Schemas['UpdateUserDto'],
): Schemas['UserProfileDto'] | null {
  const current = getSessionState().user;
  if (!current) return null;
  const merged = { ...current };
  if (patch.name !== undefined) merged.name = patch.name;
  if (patch.avatarUrl !== undefined) merged.avatarUrl = patch.avatarUrl;
  if (patch.baseCurrency !== undefined) merged.baseCurrency = patch.baseCurrency;
  return merged;
}

/**
 * Updates the signed-in user's profile (`PATCH /v1/users/me`).
 *
 * The session store is the only place the app reads the profile from, so the
 * server's response is written straight back into it. That keeps the greeting
 * and the default expense currency in step without a follow-up `GET /users/me`.
 *
 * There is no query to invalidate: the profile does not live in the query cache.
 *
 * The request is still the first and preferred path, and a server-side
 * rejection behaves exactly as it always did: the optimistic value rolls back
 * and the error surfaces. What is new is the *unreachable* server — on native,
 * a failure the server never answered (`isTransientApiError`) parks the patch
 * in the offline queue instead of losing the choice; the mutation resolves with
 * the optimistic profile, so the pickers keep the selection, and the sync
 * engine replays the patch against `/users/me` on the next connection. A 4xx
 * the server *did* answer voids anything queued: it refused this user's
 * profile edits, and retrying the parked copy could only fail the same way.
 */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (patch: Schemas['UpdateUserDto']) => {
      try {
        return await api.patch<Schemas['UserProfileDto']>('/users/me', patch);
      } catch (error) {
        if (!localStoreEnabled || profilePatchDisposition(error) !== 'keep') throw error;
        if (getSessionState().status !== 'signed-in') throw error;

        const database = await getDatabase();
        await queueProfilePatch(database, patch);
        return appliedProfile(patch);
      }
    },
    /**
     * Echo a base-currency choice into the session store before the round-trip
     * finishes.
     *
     * The Pair pickers read `baseCurrency` straight from the session, so without
     * this the control keeps showing the previous currency for the whole `PATCH`
     * — which reads as the selection not sticking. The request stays the source
     * of truth: `onSuccess` writes the server's copy (or, for a queued patch,
     * writes the same optimistic value again) and `onError` restores the
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
    onError: async (error, _patch, context) => {
      if (context) setUser(context.previousUser);
      // A definitive refusal also voids whatever an earlier offline attempt
      // parked: it would fail exactly the same way on replay.
      if (localStoreEnabled && profilePatchDisposition(error) === 'drop') {
        try {
          const database = await getDatabase();
          await clearProfilePatch(database);
        } catch {
          /* Best-effort: the rollback above must not fail on a storage error. */
        }
      }
    },
    onSuccess: (profile) => {
      if (profile) setUser(profile);
    },
  });
}
