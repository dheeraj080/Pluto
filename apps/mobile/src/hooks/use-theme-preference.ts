import { useSyncExternalStore } from 'react';

import {
  readThemePreference,
  subscribeThemePreference,
  themePreferenceSnapshot,
  type ThemePreference,
} from '@/lib/theme-preference';

/** The persisted appearance preference (`system` / `light` / `dark`). */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    themePreferenceSnapshot,
  );
}
