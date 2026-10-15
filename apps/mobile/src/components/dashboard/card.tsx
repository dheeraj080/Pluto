/**
 * The dashboard card frame, ported from the web app's `ChartFrame` (compact
 * variant) and `dashboard-error.tsx`.
 *
 * Every dashboard card is the same object: an overline title, an optional
 * trailing action, a body that is either its content, a skeleton while loading,
 * an empty state, or a failure note, and an optional footer. Keeping that shape
 * in one component is what makes the six cards read as one surface.
 *
 * The web's non-compact frame also carries a `Table` toggle for its big report
 * charts. The dashboard cards all pass `compact` and the comparison card passes
 * `hideTableToggle`, so there is nothing to port here.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { IconRefresh } from '@/components/icons';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function DashboardCard({
  title,
  subtitle,
  action,
  loading = false,
  skeletonHeight = 128,
  empty,
  isEmpty = false,
  footer,
  glow = false,
  style,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Trailing control in the header: a link, a range switch. */
  action?: ReactNode;
  loading?: boolean;
  skeletonHeight?: number;
  /** Shown instead of `children` when `isEmpty` is true. */
  empty?: ReactNode;
  /**
   * True when there is genuinely nothing to draw. Like `ReportCard`, the empty
   * state is gated on this rather than on `empty` merely being provided, so a
   * placeholder never shadows real content.
   */
  isEmpty?: boolean;
  footer?: ReactNode;
  /** The soft emerald wash. Reserved for the headline card. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {glow ? (
        <View
          pointerEvents="none"
          style={[styles.glow, { backgroundColor: theme.glow }]}
        />
      ) : null}

      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={[text.overline, { color: theme.muted }]}>{title}</Text>
          {subtitle ? (
            <Text style={[text.caption, { color: theme.muted }]}>{subtitle}</Text>
          ) : null}
        </View>

        {action ? <View style={styles.action}>{action}</View> : null}
      </View>

      <View style={styles.body}>
        {loading ? (
          <Skeleton height={skeletonHeight} />
        ) : isEmpty ? (
          (empty ?? null)
        ) : (
          children
        )}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

/**
 * The small inline failure note shown inside a single card.
 *
 * A fetch that fails only degrades its own card, so the message and its Retry
 * live there rather than in a page-wide banner.
 */
export function CardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.error}>
      <Text accessibilityRole="alert" style={[text.body, { color: theme.muted }]}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Retry"
          variant="secondary"
          size="sm"
          onPress={onRetry}
          icon={(color) => <IconRefresh size={14} color={color} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: borderWidth.hairline,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -70,
    left: 12,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  heading: { flexShrink: 1, gap: spacing.xs / 2 },
  action: { flexShrink: 0 },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  error: { alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.lg },
});
