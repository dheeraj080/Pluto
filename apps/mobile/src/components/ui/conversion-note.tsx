/**
 * The rate-health notice, matching the web app's `ConversionAlert`.
 *
 * Only the two states worth interrupting for get a note: rates wholly
 * unavailable, and some currencies excluded from the converted total. A healthy
 * conversion or a fully converted one renders nothing.
 *
 * Shaped like `ErrorNote` but in the warning palette, because an unconvertible
 * currency is information about the figure, not a failure of the screen.
 */

import { StyleSheet, Text, View } from 'react-native';

import { IconAlert } from '@/components/icons';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ConversionStatus = 'converted' | 'partially_converted' | 'unavailable';

export function ConversionNote({
  status,
  unconvertedCurrencies = [],
}: {
  status?: ConversionStatus;
  unconvertedCurrencies?: string[];
}) {
  const theme = useTheme();

  const message =
    status === 'unavailable'
      ? 'Exchange rates are unavailable, so totals are shown per currency only. Converted totals and charts appear once rates can be fetched again.'
      : status === 'partially_converted' && unconvertedCurrencies.length > 0
        ? `Some currencies cannot be converted right now (${unconvertedCurrencies.join(', ')}). Converted totals cover the rest; native amounts are always shown exactly as recorded.`
        : null;

  if (!message) return null;

  return (
    <View style={[styles.note, { backgroundColor: theme.warningSubtle }]}>
      <IconAlert size={16} color={theme.warning} />
      <Text style={[text.captionMedium, styles.text, { color: theme.warning }]}>{message}</Text>
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
  text: { flex: 1 },
});
