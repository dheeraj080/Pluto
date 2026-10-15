import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * The appearance preference: `system`, `light` or `dark`.
 *
 * A module-level store read through `useSyncExternalStore` — the same shape as
 * `lib/pair-storage.ts` — so the whole app repaints when the choice changes and
 * no context provider is needed. `use-color-scheme` folds this preference into
 * the OS scheme and `useTheme` turns that into a palette.
 *
 * `expo-secure-store` is not a perfect fit for a non-secret preference, but it
 * is already installed; adding AsyncStorage for one short string would mean a
 * new native module and a dev-client rebuild. Web falls back to `localStorage`,
 * which is where the web client keeps the same value.
 */

const THEME_KEY = 'pluto.theme';

export type ThemePreference = 'system' | 'light' | 'dark';

function webStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function normalise(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

let preference: ThemePreference = 'system';
let hydrated = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeThemePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The chosen preference. `system` is a real state, not a missing value: it
 * means "follow the device", which is the honest default.
 */
export function readThemePreference(): ThemePreference {
  return preference;
}

/**
 * Snapshot for `useSyncExternalStore` before hydration.
 *
 * On web the first client render must match the server render, which has no
 * localStorage — so this stays `system` and React re-renders once the store has
 * been hydrated.
 */
export function themePreferenceSnapshot(): ThemePreference {
  return 'system';
}

/** Reads the stored preference into memory once, at app start. */
export async function hydrateThemePreference(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  const stored =
    Platform.OS === 'web'
      ? (webStorage()?.getItem(THEME_KEY) ?? null)
      : await SecureStore.getItemAsync(THEME_KEY);

  const next = normalise(stored);
  if (next !== preference) {
    preference = next;
    notify();
  }
}

/** Persists a new preference (`system` clears the stored value) and notifies. */
export function writeThemePreference(next: ThemePreference): void {
  if (next === preference) return;
  preference = next;

  if (Platform.OS === 'web') {
    const store = webStorage();
    if (next === 'system') store?.removeItem(THEME_KEY);
    else store?.setItem(THEME_KEY, next);
    notify();
    return;
  }

  void (next === 'system'
    ? SecureStore.deleteItemAsync(THEME_KEY)
    : SecureStore.setItemAsync(THEME_KEY, next));
  notify();
}
