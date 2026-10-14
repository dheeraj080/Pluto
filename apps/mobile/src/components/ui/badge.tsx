/**
 * A small status pill, matching the web app's `Badge`.
 *
 * The web renders `rounded-full px-2 py-0.5 text-[11px] font-semibold` with a
 * tinted background. Tones are subtle washes with a strong foreground rather
 * than solid fills, so a row of badges never competes with the figure it
 * annotates.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';

export function Badge({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const { background, foreground } = {
    neutral: { background: theme.surfaceMuted, foreground: theme.muted },
    accent: { background: theme.accentSubtle, foreground: theme.accentStrong },
    success: { background: theme.successSubtle, foreground: theme.success },
    danger: { background: theme.dangerSubtle, foreground: theme.danger },
    warning: { background: theme.warningSubtle, foreground: theme.warning },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      <Text numberOfLines={1} style={[text.captionStrong, { color: foreground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
