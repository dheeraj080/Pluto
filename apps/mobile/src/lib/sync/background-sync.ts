import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import {
  getSessionState,
  onSessionCleared,
  subscribeSession,
  type SessionStatus,
} from '@/lib/session';
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
 * The mirror is purged when the session is *cleared* (sign-out, a refused
 * refresh token, account deletion) — not whenever the status reads
 * signed-out: an unreachable-server launch leaves the credential in place and
 * restores to signed-in (see `bootstrapSession`), and a status-based purge
 * once wiped a full offline queue on exactly such a relaunch.
 *
 * A no-op on web, where there is no local store to reconcile.
 */
export function startBackgroundSync(): () => void {
  if (!localStoreEnabled) return () => {};
  // The free plan keeps everything on-device: there is no account to reconcile
  // with, so no trigger (reconnect, foreground, timer) should ever call the API.
  if ((getSessionState() as any).mode === 'local') return () => {};

  // Registrations that outlive a signed-in period (the purge listener) versus
  // those that must be dropped when the session ends (connectivity, timers).
  const lifetimeDisposers: (() => void)[] = [];
  const attachDisposers: (() => void)[] = [];
  let attached = false;

  // Registered for the whole lifetime, not just while signed in: the clearing
  // that needs it happens *because* the session ended.
  lifetimeDisposers.push(
    onSessionCleared(() => {
      // A local session has no server copy — wiping the mirror here would
      // delete the free plan's only data on a routine sign-out. Only an
      // account's credentials loss purges.
      try {
        if ((getSessionState() as any).mode === 'local') return;
      } catch {}
      // Best-effort, like the rest of sign-out: a purge that fails leaves
      // rows for the next sign-in's clear to retry, never wrong data — the
      // query cache and the persisted snapshot are dropped independently.
      void clearLocalDatabase().catch(() => undefined);
    }),
  );

  // A launch that settles signed-out - no credential, or one the server
  // refused - may have been killed mid-clear by the previous process, so
  // sweep whatever it left. A launch that merely *reached* an unreachable
  // server is signed-in by now (see `bootstrapSession`) and is deliberately
  // not purged: that is the offline relaunch which once wiped the queue.
  if (getSessionState().status === 'signed-out') {
    void clearLocalDatabase().catch(() => undefined);
  }

  const attach = () => {
    if (attached) return;
    attached = true;

    attachDisposers.push(
      NetInfo.addEventListener((state) => {
        // `isInternetConnection` alone can be true on a captive portal, so the
        // reachability flag is honoured when the platform provides it.
        if (state.isConnected && state.isInternetReachable !== false) {
          void syncNow();
        }
      }),
    );

    attachDisposers.push(
      AppState.addEventListener('change', (next) => {
        if (next === 'active') void syncNow();
      }).remove,
    );

    const timer = setInterval(() => void syncNow(), PERIODIC_SYNC_MS);
    attachDisposers.push(() => clearInterval(timer));

    // Catch the queue up immediately rather than waiting for the first tick.
    void syncNow();
  };

  const detach = () => {
    if (!attached) return;
    attached = false;
    for (const dispose of attachDisposers.splice(0)) dispose();
  };

  const applyStatus = (status: SessionStatus) => {
    if (status === 'signed-in') {
      attach();
      return;
    }
    detach();
  };

  applyStatus(getSessionState().status);
  const unsubscribe = subscribeSession(() => {
    if ((getSessionState() as any).mode === 'local') {
      detach();
      return;
    }
    applyStatus(getSessionState().status);
  });

  return () => {
    unsubscribe();
    detach();
    for (const dispose of lifetimeDisposers.splice(0)) dispose();
  };
}
