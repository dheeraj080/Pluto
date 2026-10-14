/**
 * Card and StatCard, matching the web app's `components/ui.tsx`.
 *
 * `Card` is the raised panel everything sits in: `rounded-2xl border
 * border-border bg-surface` with the web's `p-4` padding (the `md:p-6` step is
 * desktop-only). `StatCard` is the label-plus-figure variant used across the
 * dashboard and reports.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Skeleton } from '@/components/ui/feedback';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function Card({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/**
 * A single figure with its label.
 *
 * The value is tabular so a column of stat cards does not jitter as the numbers
 * change, and it shrinks to `numberOfLines={1}` rather than wrapping — a wrapped
 * currency amount is unreadable.
 */
export function StatCard({
  label,
  value,
  caption,
  loading = false,
  style,
}: {
  label: string;
  value: string;
  /** Optional second line: a comparison, a count, a secondary currency. */
  caption?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <Card style={style}>
      <Text style={[text.overline, { color: theme.muted }]}>{label}</Text>

      {loading ? (
        <Skeleton width={132} height={32} />
      ) : (
        <Text numberOfLines={1} style={[text.title, { color: theme.ink }]}>
          {value}
        </Text>
      )}

      {!loading && caption ? (
        <Text numberOfLines={2} style={[text.caption, { color: theme.muted }]}>
          {caption}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
  },
});
