import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import {
  readThemePreference,
  subscribeThemePreference,
  themePreferenceSnapshot,
} from '@/lib/theme-preference';

/**
 * Web needs the colour scheme recalculated on the client for static rendering.
 *
 * Uses `useSyncExternalStore` to detect hydration rather than a `useEffect`
 * that calls `setState`, which the React Compiler lint rules reject
 * (`react-hooks/set-state-in-effect`). The store never changes: the server
 * snapshot is `false`, the client snapshot is `true`.
 *
 * The appearance preference is read through its own external store, so a pinned
 * `light`/`dark` survives hydration without a mismatch: until hydrated we render
 * the server's `light`, then React re-renders with the stored value.
 */
const subscribe = (): (() => void) => () => {};
const getSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export function useColorScheme(): 'light' | 'dark' {
  const hydrated = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    themePreferenceSnapshot,
  );
  const system = useRNColorScheme();

  if (!hydrated) return 'light';
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
