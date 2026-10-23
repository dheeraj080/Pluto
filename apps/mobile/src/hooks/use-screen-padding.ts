import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/**
 * Vertical padding for a scrollable screen body.
 *
 * Android 15+ draws the app behind the status and navigation bars and will not
 * let it opt out, so each screen reclaims the space itself.
 *
 * The top of the body is always clear: a drawer screen sits below the app's
 * top bar (`src/components/app-top-bar.tsx`), which clears the status bar, and
 * a root-stack screen sits below the native header, which does the same.
 *
 * The bottom is not. Nothing sits below the body any more — the navigation
 * lives in a drawer, not a bottom bar — so the body clears the navigation bar
 * itself.
 */
export function useScreenPadding(): {
  paddingTop: number;
  paddingBottom: number;
} {
  const insets = useSafeAreaInsets();

  return { paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl };
}
