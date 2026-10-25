/**
 * The page title block, matching the web app's `AppPageHeader`.
 *
 * The web renders the title in the display face (`font-display text-2xl
 * font-semibold tracking-tight`) and lays any actions out beside it with
 * `flex-wrap items-end justify-between`. At phone width the actions usually
 * wrap onto their own line, which the same rule gives us here.
 *
 * Drawer screens pass `onOpenDrawer` to render a hamburger menu beside the
 * page title.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { IconMenu } from '@/components/icons';
import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function AppPageHeader({
  title,
  subtitle,
  children,
  onOpenDrawer,
  style,
}: {
  title: string;
  subtitle?: string;
  /** Trailing controls: a range switcher, a primary button. */
  children?: ReactNode;
  /** Opens the navigation drawer; drawer screens pass this in. */
  onOpenDrawer?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.titleRow}>
        {onOpenDrawer ? (
          <Pressable
            accessibilityLabel="Open navigation menu"
            hitSlop={8}
            onPress={onOpenDrawer}
            style={styles.menu}
            testID="open-navigation-menu"
          >
            <IconMenu size={20} color={theme.ink} />
          </Pressable>
        ) : null}
        <View style={styles.heading}>
          <Text style={[text.display, { color: theme.ink }]}>{title}</Text>
          {subtitle ? (
            <Text style={[text.caption, { color: theme.muted }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  menu: {
    padding: spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
