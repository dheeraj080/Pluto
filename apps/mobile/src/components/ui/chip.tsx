import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, AccentText, Spacing } from '@/constants/theme';
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
          backgroundColor: selected ? Accent : theme.backgroundElement,
          borderColor: selected ? Accent : theme.backgroundSelected,
        },
        pressed && styles.pressed,
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <ThemedText type="small" style={selected ? styles.selectedLabel : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  selectedLabel: { color: AccentText },
});
