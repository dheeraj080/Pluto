import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/**
 * Vertical padding for a scrollable screen body.
 *
 * Android 15+ draws the app behind the status and navigation bars and will not
 * let it opt out, so each screen reclaims the space itself.
 */
export function useScreenPadding(): {
  paddingTop: number;
  paddingBottom: number;
} {
  const insets = useSafeAreaInsets();

  return { paddingTop: insets.top + spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.lg };
}
