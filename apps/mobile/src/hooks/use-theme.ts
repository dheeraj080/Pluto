/**
 * The active colour tokens for the current OS colour scheme.
 *
 * Falls back to the light palette whenever the scheme is not known yet (web
 * pre-hydration, or a platform that reports `null`), so the first frame is
 * deterministic rather than flashing the dark canvas.
 *
 * Returns the aliased palette from `@/constants/theme` while the screens are
 * still being migrated; once they all read `@/theme` directly this becomes
 * `paletteFor(useColorScheme())`.
 */

import { Colors, type ThemedColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): ThemedColors {
  const scheme = useColorScheme();

  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}