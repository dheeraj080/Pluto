import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web needs the color scheme recalculated on the client for static rendering.
 *
 * Uses `useSyncExternalStore` to detect hydration rather than a `useEffect`
 * that calls `setState`, which the React Compiler lint rules reject
 * (`react-hooks/set-state-in-effect`). The store never changes: the server
 * snapshot is `false`, the client snapshot is `true`.
 */
const subscribe = (): (() => void) => () => {};
const getSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const colorScheme = useRNColorScheme();

  return hydrated ? colorScheme : 'light';
}
