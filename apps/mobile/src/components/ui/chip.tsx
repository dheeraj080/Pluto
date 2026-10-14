import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function Chip({
  label,
  selected = false,
  onPress,
  dotColor,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional colour swatch, used for category chips. */
  dotColor?: string | null;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.surfaceMuted,
          borderColor: selected ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text
        numberOfLines={1}
        style={[text.bodyMedium, { color: selected ? theme.onPrimary : theme.muted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
