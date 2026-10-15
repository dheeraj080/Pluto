import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A text input, matching the web app's `Field` + `Input`: an optional `text-sm`
 * label, an inset `surface-muted` control with a hairline border, and an
 * optional hint or error beneath.
 */
export function TextField({
  label,
  hint,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[text.bodyMedium, { color: theme.ink }]}>{label}</Text> : null}

      <TextInput
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          text.body,
          {
            color: theme.ink,
            backgroundColor: theme.surfaceMuted,
            borderColor: error ? theme.danger : theme.border,
          },
          style,
        ]}
        {...rest}
      />

      {error ? (
        <Text style={[text.captionMedium, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[text.caption, { color: theme.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
});
