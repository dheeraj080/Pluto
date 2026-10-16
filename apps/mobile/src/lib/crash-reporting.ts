import * as Sentry from '@sentry/react-native';

/**
 * Crash reporting, behind a DSN so the app runs the same with or without it.
 *
 * `EXPO_PUBLIC_SENTRY_DSN` is inlined by Metro at build time (see
 * `.env.example`). Every export here is a no-op when it is unset — local
 * development, Expo Go, and CI all keep working with no Sentry project, and a
 * release that wants reporting only has to set the variable on its EAS profile.
 *
 * Only the *user id* is attached (never the email or name): an opaque id is
 * enough to ask "is this one account or many?" without shipping PII to a third
 * party, and it keeps the Play data-safety declaration to crash logs alone.
 */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

let initialized = false;

/** Starts the SDK. Safe to call more than once; the second call is ignored. */
export function initCrashReporting(): void {
  if (initialized) return;
  initialized = true;
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    // Error capture only. Performance tracing would add a sampling decision and
    // a second class of payload for a v1; it can be switched on later by raising
    // this above 0.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/**
 * Ties subsequent reports to the signed-in account, or detaches them.
 *
 * Called from the root layout, which observes the session store — so signing
 * in, signing out and account deletion all keep Sentry's copy in step without
 * the session module knowing the SDK exists.
 */
export function setCrashReportingUser(user: { id: string } | null): void {
  if (!SENTRY_DSN) return;
  Sentry.setUser(user ? { id: user.id } : null);
}

/**
 * Reports a caught error by hand.
 *
 * Render errors reach Sentry through the `ErrorBoundary` in the root layout and
 * crashes through the global handler; this is for the third case — an error the
 * app recovers from (a failed export, a dropped request) that is still worth
 * counting.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
