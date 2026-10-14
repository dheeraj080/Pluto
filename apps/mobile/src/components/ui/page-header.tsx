/**
 * The page title block, matching the web app's `AppPageHeader`.
 *
 * The web renders the title in the display face (`font-display text-2xl
 * font-semibold tracking-tight`) and lays any actions out beside it with
 * `flex-wrap items-end justify-between`. At phone width the actions usually
 * wrap onto their own line, which the same rule gives us here.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function AppPageHeader({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  /** Trailing controls: a range switcher, a primary button. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.heading}>
        <Text style={[text.display, { color: theme.ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[text.body, { color: theme.muted }]}>{subtitle}</Text>
        ) : null}
      </View>

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heading: { flexShrink: 1, gap: spacing.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
