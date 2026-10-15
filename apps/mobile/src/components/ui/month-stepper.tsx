/**
 * A compact month stepper: `‹ Oct 2026 ›`.
 *
 * Two tap targets and a label in one pill, the same shape as the Reports range
 * button. Budgets evaluates one month at a time and stepping is the common case,
 * so a sheet would be more taps than the control it replaces.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconArrowLeft, IconArrowRight } from '@/components/icons';
import { borderWidth, controlHeight, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function MonthStepper({
  label,
  onPrevious,
  onNext,
}: {
  /** The resolved month, already formatted for display. */
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <Step direction="previous" onPress={onPrevious} />
      <Text numberOfLines={1} style={[text.bodyMedium, styles.label, { color: theme.ink }]}>
        {label}
      </Text>
      <Step direction="next" onPress={onNext} />
    </View>
  );
}

/**
 * One chevron. A plain `Pressable` rather than the `Button` primitive, whose
 * label is required — an icon-only control carries its name in the accessibility
 * label instead.
 */
function Step({ direction, onPress }: { direction: 'previous' | 'next'; onPress: () => void }) {
  const theme = useTheme();
  const Glyph = direction === 'previous' ? IconArrowLeft : IconArrowRight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'previous' ? 'Previous month' : 'Next month'}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.step, pressed && { backgroundColor: theme.surface }]}
    >
      <Glyph size={16} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: controlHeight.md,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  step: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  label: { minWidth: 84, textAlign: 'center' },
});
