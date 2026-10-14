import { useSyncExternalStore } from 'react';

import { getSessionState, subscribeSession, type SessionState } from '@/lib/session';

/** Observes the module-level session store. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionState, getSessionState);
}
