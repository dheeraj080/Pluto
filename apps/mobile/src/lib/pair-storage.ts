import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * The Pair's second currency.
 *
 * Reports and budgets show every figure in two currencies: the **base**, which
 * the server aggregates in and which lives on the user profile, and the
 * **second**, a display companion the server re-expresses each figure in. Only
 * the second has no server home, so it is kept here.
 *
 * A module-level store read through `useSyncExternalStore` — the same shape as
 * `lib/session.ts` — so a change re-renders every screen without a context
 * provider or an effect-driven refetch.
 *
 * `expo-secure-store` is not a perfect fit for a non-secret preference, but it
 * is already installed; adding AsyncStorage would mean a new native module and
 * a dev-client rebuild for one three-letter string. Web falls back to
 * `localStorage`, which is where the web client keeps the same value.
 */

const SECONDARY_CURRENCY_KEY = 'pluto.secondaryCurrency';

function webStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

let secondaryCurrency: string | null = null;
let hydrated = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeSecondaryCurrency(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The chosen second currency, or null when the user has not picked one.
 *
 * Null is a real state, not a missing value: it means "show a single currency",
 * which is the honest default for someone who never crosses borders.
 */
export function readSecondaryCurrency(): string | null {
  return secondaryCurrency;
}

/**
 * Snapshot for `useSyncExternalStore` before hydration.
 *
 * On web the first client render must match the server render, which has no
 * localStorage — so this stays null and React re-renders once the store has
 * been hydrated.
 */
export function secondaryCurrencySnapshot(): string | null {
  return null;
}

/** Reads the stored preference into memory once, at app start. */
export async function hydrateSecondaryCurrency(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  const stored =
    Platform.OS === 'web'
      ? (webStorage()?.getItem(SECONDARY_CURRENCY_KEY) ?? null)
      : await SecureStore.getItemAsync(SECONDARY_CURRENCY_KEY);

  const next = stored?.toUpperCase() ?? null;
  if (next && next !== secondaryCurrency) {
    secondaryCurrency = next;
    notify();
  }
}

/** Persists a new second currency, or clears it when `code` is null. */
export function writeSecondaryCurrency(code: string | null): void {
  const next = code ? code.toUpperCase() : null;
  if (next === secondaryCurrency) return;
  secondaryCurrency = next;

  if (Platform.OS === 'web') {
    const store = webStorage();
    if (next === null) store?.removeItem(SECONDARY_CURRENCY_KEY);
    else store?.setItem(SECONDARY_CURRENCY_KEY, next);
    return;
  }

  void (next === null
    ? SecureStore.deleteItemAsync(SECONDARY_CURRENCY_KEY)
    : SecureStore.setItemAsync(SECONDARY_CURRENCY_KEY, next));
}
