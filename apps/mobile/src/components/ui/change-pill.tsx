/**
 * ChangePill, matching the web app's `components/pill.tsx`.
 *
 * The percent move against the previous period, on a small pill. A fall is the
 * good outcome for spending, so it reads mint; a rise reads soft amber — never
 * red, because spending more than last month is information, not an error.
 */

import { StyleSheet, Text, View } from 'react-native';

import { IconTrendUp } from '@/components/icons';
import { borderWidth, radius, spacing, tabularNums, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function ChangePill({
  /** Percent change versus the previous period; negative means spending fell. */
  percent,
  /** Whether a decrease is the good outcome. Defaults to true (spending). */
  downIsGood = true,
  /** Optional caption after the pill, e.g. "vs last month". */
  caption,
}: {
  percent: number | null;
  downIsGood?: boolean;
  caption?: string;
}) {
  const theme = useTheme();

  if (percent == null || !Number.isFinite(percent)) return null;

  const down = percent < 0;
  const flat = percent === 0;
  const good = flat ? null : down === downIsGood;

  const tone = flat
    ? { border: theme.border, surface: theme.surfaceMuted, ink: theme.muted }
    : good
      ? { border: theme.success, surface: theme.successSubtle, ink: theme.success }
      : { border: theme.warning, surface: theme.warningSubtle, ink: theme.warning };

  const magnitude = `${percent > 0 ? '+' : ''}${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;

  return (
    <View style={styles.row}>
      <View
        accessible
        accessibilityLabel={`${magnitude} versus the previous period`}
        style={[styles.pill, { backgroundColor: tone.surface, borderColor: tone.border }]}
      >
        {!flat ? (
          <IconTrendUp size={14} color={tone.ink} style={down ? styles.flipped : undefined} />
        ) : null}
        <Text style={[text.captionMedium, tabularNums, { color: tone.ink }]}>{magnitude}</Text>
      </View>

      {caption ? <Text style={[text.caption, { color: theme.muted }]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  flipped: { transform: [{ rotate: '180deg' }] },
});
