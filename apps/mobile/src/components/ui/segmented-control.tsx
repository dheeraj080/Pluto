import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, controlHeight, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Pill-style single-choice switcher, the native twin of the web's
 * `SegmentedControl`: a `surface-muted` track with the active option raised on
 * the surface colour. Used for compact choices like the appearance preference.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessibility label for the group. */
  label: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              active && { backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                text.bodyMedium,
                { color: active ? theme.ink : theme.muted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    padding: 2,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  segment: {
    minHeight: controlHeight.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
});
