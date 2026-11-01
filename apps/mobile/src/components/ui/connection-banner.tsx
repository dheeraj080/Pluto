/**
 * Connection banner.
 *
 * Shows a non-dismissible banner when the device is offline or a sync is in
 * flight. Offline means changes are queued locally and will be sent when the
 * connection returns; syncing means the sync engine is actively reconciling the
 * local store with the server.
 *
 * Placed at the top of the drawer shell so it is visible on every signed-in
 * screen without each screen needing to opt in.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { isSyncing, subscribeSyncState } from '@/lib/sync/sync-engine';
import { useTheme } from '@/hooks/use-theme';
import { layout, spacing, text } from '@/theme';
import { IconAlert, IconRefresh } from '@/components/icons';

export function ConnectionBanner() {
  const theme = useTheme();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Read initial state and kick off the first sync-state check together so
    // the banner doesn't flash incorrectly between the two reads.
    void NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      setSyncing(isSyncing());
    });

    // Subscribe to connection changes.
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });

    // Subscribe to sync state changes.
    const unsubscribeSync = subscribeSyncState(() => {
      setSyncing(isSyncing());
    });

    return () => {
      unsubscribeNet();
      unsubscribeSync();
    };
  }, []);

  // While the connection status is still being determined, render nothing to
  // avoid a flash of incorrect state.
  if (isConnected === null) return null;

  const offline = !isConnected;
  const show = offline || syncing;

  if (!show) return null;

  const isSyncingOnly = syncing && !offline;

  return (
    <View style={[styles.banner, { backgroundColor: theme.warningSubtle }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          offline
            ? 'Offline — changes are saved locally and will sync when reconnected'
            : 'Syncing with the server'
        }
        onPress={() => {}}
        style={styles.pressable}
      >
        <View style={styles.iconContainer}>
          {isSyncingOnly ? (
            <IconRefresh size={14} color={theme.warning} />
          ) : (
            <IconAlert size={14} color={theme.warning} />
          )}
        </View>
        <View style={styles.textContainer}>
          <Text style={[text.bodyMedium, { color: theme.warning }]}>
            {offline
              ? 'Offline — changes saved locally'
              : syncing
                ? 'Syncing…'
                : ''}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 20,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
});
