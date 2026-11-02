/**
 * The tabs shell.
 *
 * All five destinations — Dashboard, Activity, Reports, Budgets, Settings —
 * live in the floating bottom navigation bar. There is no drawer and no
 * hamburger menu; every screen carries its own `BottomNavBar`.
 *
 * The redirect lives here rather than in each screen so a signed-out user never
 * briefly mounts a screen that would fire authenticated requests.
 */

import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';

import { Spinner } from '@/components/ui/feedback';
import { ConnectionBanner } from '@/components/ui/connection-banner';
import { spacing } from '@/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { ensureLocalSession } from '@/lib/session';

export default function TabsLayout() {
  const { status, user } = useSession();
  const theme = useTheme();

  useEffect(() => {
    if (status === 'signed-out' || !user) {
      try {
        ensureLocalSession();
      } catch (error) {
        // Best-effort: ensureLocalSession may fail if the device has no
        // persistent storage, which is not a critical failure for the tabs.
        /* eslint-disable no-console */
        if (__DEV__) console.warn('Failed to ensure local session in tabs:', error);
        /* eslint-enable no-console */
      }
    }
  }, [status, user]);

  if (status === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.canvas }]}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <>
      <ConnectionBanner />
      <View style={styles.spacer} />
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spacer: { height: spacing.xs },
});
