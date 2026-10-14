/**
 * Feedback primitives: spinner, error note, skeleton and empty state.
 *
 * These mirror the web app's equivalents in `components/ui.tsx` so a loading or
 * failed state reads the same on both clients.
 */

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IconAlert } from '@/components/icons';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

/** The one loading indicator. Always the accent colour, so it reads as Pluto. */
export function Spinner({
  size = 'small',
  style,
}: {
  size?: 'small' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return <ActivityIndicator size={size} color={theme.accent} style={style} />;
}

/**
 * An inline error: the danger tint, an alert glyph and the server's message.
 *
 * Used instead of a bare red line so a failure visibly reads as a state rather
 * than as a label.
 */
export function ErrorNote({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();

  return (
    <View style={[styles.note, { backgroundColor: theme.dangerSubtle }, style]}>
      <IconAlert size={16} color={theme.danger} />
      <Text style={[text.captionMedium, styles.noteText, { color: theme.danger }]}>{message}</Text>
    </View>
  );
}

/** A muted placeholder block, sized by its caller. */
export function Skeleton({
  width,
  height = 16,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        { width, height, backgroundColor: theme.surfaceMuted, borderRadius: radius.sm },
        style,
      ]}
    />
  );
}

/**
 * The "nothing here yet" state: a dashed outline, a message, and whatever action
 * the caller wants (usually a button).
 *
 * A dashed border rather than a card, so it reads as absence rather than as
 * content — the same treatment the web uses.
 */
export function EmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.empty, { borderColor: theme.borderStrong }]}>
      <Text style={[text.bodyStrong, { color: theme.ink }]}>{title}</Text>
      {message ? (
        <Text style={[text.caption, styles.emptyText, { color: theme.muted }]}>{message}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  noteText: { flex: 1 },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: borderWidth.thin,
    borderStyle: 'dashed',
  },
  emptyText: { textAlign: 'center' },
});
