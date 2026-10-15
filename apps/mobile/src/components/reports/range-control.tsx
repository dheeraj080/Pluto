/**
 * The one global range control for Reports.
 *
 * Its selection is the single source of truth for every card on the screen, so
 * it lives in the header. Four presets cover the common windows; "Custom"
 * reveals two `YYYY-MM-DD` fields, the touch equivalent of the web's two-month
 * calendar popover (a raw pair of date fields is exactly what the web avoids,
 * but React Native has no date picker in the shared component set, so the
 * fields are validated instead and the resolved range is echoed beneath).
 */

import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { REPORT_PRESETS, type ReportPreset } from '@/lib/ranges';
import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function ReportRangeControl({
  preset,
  rangeLabel,
  customFrom,
  customTo,
  fromError,
  toError,
  onSelectPreset,
  onCustomFrom,
  onCustomTo,
}: {
  preset: ReportPreset;
  /** The resolved window, echoed so every card's days are never a guess. */
  rangeLabel: string;
  customFrom: string;
  customTo: string;
  fromError?: string;
  toError?: string;
  onSelectPreset: (preset: ReportPreset) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.presets}>
        {REPORT_PRESETS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={preset === option.value}
            onPress={() => onSelectPreset(option.value)}
          />
        ))}
      </View>

      {preset === 'custom' ? (
        <View style={styles.custom}>
          <View style={styles.field}>
            <TextField
              label="From"
              value={customFrom}
              onChangeText={onCustomFrom}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              error={fromError}
            />
          </View>
          <View style={styles.field}>
            <TextField
              label="To"
              value={customTo}
              onChangeText={onCustomTo}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              error={toError}
            />
          </View>
        </View>
      ) : null}

      <Text style={[text.caption, { color: theme.muted }]}>{rangeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  custom: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexGrow: 1, flexBasis: 0, minWidth: 140 },
});
