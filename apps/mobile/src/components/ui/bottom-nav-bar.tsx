/**
 * Bottom navigation bar.
 *
 * Floating pill-shaped bar for Pluto's four main destinations — Dashboard,
 * Activity, Reports, Budgets. Settings stays in the drawer, so it has no tab
 * here.
 *
 * The bar floats above the screen content: it is inset from the left and right
 * edges, sits above the bottom edge (clearing the bottom safe-area inset), has
 * rounded corners, a hairline border, and a shadow so it reads as a separate
 * layer.
 *
 * The active tab carries a subtle accent-subtle wash behind its icon and label,
 * so the current destination is obvious at a glance.
 *
 * Tabs switch with `router.replace` so the history stack never grows when the
 * user taps between destinations.
 *
 * Because the bar is absolutely positioned and taken out of document flow, each
 * screen must pad the bottom of its scrollable content by `BAR_HEIGHT` plus the
 * floating gap (`spacing.md`) so the last item never hides behind it.
 */

import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';

import { IconChart, IconHome, IconReceipt, IconWallet } from '@/components/icons';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

type Tab = {
  /** Canonical pathname served by the router (see `apps/mobile/src/lib/routes`). */
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
};

const TABS: Tab[] = [
  { path: '/', label: 'Dashboard', icon: IconHome },
  { path: '/transactions', label: 'Activity', icon: IconReceipt },
  { path: '/reports', label: 'Reports', icon: IconChart },
  { path: '/budgets', label: 'Budgets', icon: IconWallet },
];

/** Height of the bar excluding the bottom safe-area inset. */
export const BAR_HEIGHT = 64;

/** Gap between the floating bar and the screen edges. */
export const FLOAT_GAP = spacing.md;

export function BottomNavBar() {
  const pathname = usePathname();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  // Keep the bar above the home indicator on devices with large bottom insets.
  const bottom = Math.max(FLOAT_GAP, bottomInset);

  const active = TABS.find((tab) => pathname === tab.path) ?? TABS[0];

  return (
    <View
      style={[
        styles.container,
        {
          bottom,
          height: BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.path === active.path;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.path}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            testID={`bottom-nav-${tab.label.toLowerCase()}`}
            onPress={() => void router.replace(tab.path as unknown as Href)}
            hitSlop={12}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: pressed
                  ? theme.surfaceMuted
                  : isActive
                    ? theme.accentSubtle
                    : 'transparent',
              },
            ]}
          >
            <Icon size={20} color={isActive ? theme.accent : theme.muted} />
            <Text
              style={[
                text.captionStrong,
                { color: isActive ? theme.accent : theme.muted },
                isActive && styles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: FLOAT_GAP,
    right: FLOAT_GAP,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    // Android elevation
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: BAR_HEIGHT,
    borderRadius: radius.md,
  },
  activeLabel: {
    fontWeight: '600',
  },
});
