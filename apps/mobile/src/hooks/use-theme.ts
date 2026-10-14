/**
 * The active colour tokens for the current OS colour scheme.
 *
 * Falls back to the light palette whenever the scheme is not known yet (web
 * pre-hydration, or a platform that reports `null`), so the first frame is
 * deterministic rather than flashing the dark canvas.
 */

import { paletteFor, type Palette } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme(): Palette {
  return paletteFor(useColorScheme());
}
