/**
 * The active OS colour scheme, honouring the in-app appearance preference.
 *
 * `system` follows the device; `light`/`dark` pin the palette regardless of the
 * OS. The preference lives in `lib/theme-preference.ts` and is read through
 * `useSyncExternalStore`, so pinning a theme repaints every screen immediately.
 * Anything unknown collapses to `light` so the first frame is deterministic.
 */

import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import {
  readThemePreference,
  subscribeThemePreference,
  themePreferenceSnapshot,
} from '@/lib/theme-preference';

export function useColorScheme(): 'light' | 'dark' {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    themePreferenceSnapshot,
  );
  const system = useRNColorScheme();

  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
