import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { getSessionState, subscribeSession, type SessionStatus } from '@/lib/session';
import { localStoreEnabled } from '@/lib/store';
import { clearLocalDatabase } from '@/lib/store/local/database';
import { syncNow } from './sync-engine';

/** Backstop cadence; reconnect and foreground events are the primary triggers. */
const PERIODIC_SYNC_MS = 5 * 60 * 1000;

/**
 * Starts automatic reconciliation and returns a teardown function.
 *
 * Sync runs on sign-in, whenever connectivity returns, whenever the app comes
 * back to the foreground, and on a slow timer. Every trigger funnels through
 * {@link syncNow}, which collapses concurrent calls into one run.
 *
 * A no-op on web, where there is no local store to reconcile.
 */
export function startBackgroundSync(): () => void {
  if (!localStoreEnabled) return () => {};

  const disposers: (() => void)[] = [];
  let attached = false;

  const attach = () => {
    if (attached) return;
    attached = true;

    disposers.push(
      NetInfo.addEventListener((state) => {
        // `isInternetConnection` alone can be true on a captive portal, so the
        // reachability flag is honoured when the platform provides it.
        if (state.isConnected && state.isInternetReachable !== false) {
          void syncNow();
        }
      }),
    );

    disposers.push(
      AppState.addEventListener('change', (next) => {
        if (next === 'active') void syncNow();
      }).remove,
    );

    const timer = setInterval(() => void syncNow(), PERIODIC_SYNC_MS);
    disposers.push(() => clearInterval(timer));

    // Catch the queue up immediately rather than waiting for the first tick.
    void syncNow();
  };

  const detach = () => {
    if (!attached) return;
    attached = false;
    for (const dispose of disposers.splice(0)) dispose();
  };

  const applyStatus = (status: SessionStatus) => {
    if (status === 'signed-in') {
      attach();
      return;
    }

    detach();

    if (status === 'signed-out') {
      // The account that owned the mirror is gone: drop it so the next sign-in
      // cannot read the previous account's expenses — nor push a mutation it
      // left queued under a different token. Best-effort, like the rest of
      // sign-out. This also runs on a signed-out launch, which clears anything
      // a kill left behind.
      void clearLocalDatabase().catch(() => undefined);
    }
  };

  applyStatus(getSessionState().status);
  const unsubscribe = subscribeSession(() => applyStatus(getSessionState().status));

  return () => {
    unsubscribe();
    detach();
  };
}
