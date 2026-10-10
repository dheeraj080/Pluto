/**
 * Base-currency preference for expense reports and budget status.
 *
 * Resolution order at the call site is: explicit `?base=` URL override →
 * this persisted preference → the server's configured default
 * (`EXCHANGE_RATE_BASE_CURRENCY`). Keeping it in localStorage rather than the
 * user record avoids a migration and lets a user switch reporting currency
 * without a round trip.
 *
 * localStorage is an *external* store, so it is read through
 * `useSyncExternalStore` rather than an effect: that keeps the value correct at
 * render time, avoids a `setState` inside an effect, and gives React an
 * explicit server snapshot to hydrate against (null during prerender, where
 * `window` does not exist).
 */

const STORAGE_KEY = "pluto.baseCurrency";

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to preference changes, including our own writes. */
export function subscribeBaseCurrency(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Reads the persisted preference; safe to call during prerender. */
export function readBaseCurrency(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY)?.toUpperCase() ?? null;
}

/** Reads a `?base=` override, which always wins over the stored preference. */
export function readBaseCurrencyOverride(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("base");
  return value ? value.toUpperCase() : null;
}

/** Effective base: URL override first, then the stored preference. */
export function getBaseCurrency(): string | null {
  return readBaseCurrencyOverride() ?? readBaseCurrency();
}

export function writeBaseCurrency(code: string | null): void {
  if (typeof window === "undefined") return;
  if (code) window.localStorage.setItem(STORAGE_KEY, code.toUpperCase());
  else window.localStorage.removeItem(STORAGE_KEY);
  // Persisting is not enough — notify so active screens re-read the value.
  notify();
}

/** Server snapshot: no `window` during prerender, so fall back to the default. */
export function getBaseCurrencyServerSnapshot(): null {
  return null;
}
