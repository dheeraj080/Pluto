import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

/**
 * Vertical padding for a scrollable screen body.
 *
 * Android 15+ draws the app behind the status and navigation bars and will not
 * let it opt out, so each screen reclaims the space itself. The app has two
 * screen shapes:
 *
 * - `tab` — a tab-shell screen. There is no header, so the body clears the
 *   status bar at the top. The tab bar is a flex sibling that already rests
 *   above the navigation bar, so the body only needs ordinary scroll clearance
 *   at the bottom.
 * - `stack` — a root-stack screen. A native header handles the status bar, and
 *   nothing sits below, so the body clears the navigation bar itself.
 */
export function useScreenPadding(kind: 'tab' | 'stack'): {
  paddingTop: number;
  paddingBottom: number;
} {
  const insets = useSafeAreaInsets();

  return kind === 'tab'
    ? { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl }
    : { paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl };
}
