/**
 * Button, matching the web app's `components/ui.tsx` button.
 *
 * Variants: `primary` (solid mint), `secondary` (muted surface with a hairline
 * border), `ghost` (text only) and `danger` (solid red). Sizes `sm`/`md`/`lg`
 * are the web's `h-8`/`h-10`/`h-11`.
 *
 * The web expresses hover and active as separate colours; touch has only
 * pressed, so pressing swaps to the hover colour and the text darkens on the
 * ghost variant the way `hover:text-ink` does.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { borderWidth, controlHeight, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** The web's danger button is `text-white` on `bg-danger-solid`. */
const ON_DANGER_SOLID = '#FFFFFF';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  busy = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  disabled?: boolean;
  /** Optional leading glyph, e.g. `IconPlus`. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const inactive = busy || disabled;

  const resting = {
    primary: theme.primary,
    secondary: theme.surfaceMuted,
    ghost: 'transparent',
    danger: theme.dangerSolid,
  }[variant];

  const pressedSurface = {
    primary: theme.primaryHover,
    secondary: theme.surface,
    ghost: theme.surfaceMuted,
    danger: theme.dangerSolidHover,
  }[variant];

  const foreground = {
    primary: theme.onPrimary,
    secondary: theme.ink,
    ghost: theme.muted,
    danger: ON_DANGER_SOLID,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          height: controlHeight[size],
          paddingHorizontal: { sm: spacing.md, md: spacing.lg, lg: spacing.xl }[size],
          borderRadius: radius.lg,
          backgroundColor: pressed && !inactive ? pressedSurface : resting,
          borderWidth: variant === 'secondary' ? borderWidth.hairline : 0,
          borderColor: theme.borderStrong,
          opacity: inactive ? 0.45 : 1,
        },
        style,
      ]}
    >
      {({ pressed }) =>
        busy ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : (
          <View style={styles.content}>
            {icon}
            <Text
              numberOfLines={1}
              style={[
                size === 'lg' ? text.bodyLarge : text.bodyMedium,
                { color: pressed && variant === 'ghost' ? theme.ink : foreground },
              ]}
            >
              {label}
            </Text>
          </View>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
