/**
 * "This period vs the last one": two cumulative spending lines.
 *
 * The solid mint line is the window in force; the dashed grey one is the
 * equivalent window immediately before it. Both are cumulative, so the gap
 * between them at any point is the answer to "am I ahead or behind?".
 *
 * The web renders this with Recharts and reveals exact per-bucket figures in a
 * hover tooltip. Touch has no hover, so the figures are not hidden behind a
 * gesture that cannot happen: the two lines are labelled directly, and the
 * latest point is announced through the chart's accessibility label.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ComparisonChart, type ComparisonRow } from '@/components/charts';
import { CardError, DashboardCard } from '@/components/dashboard/card';
import { Chip } from '@/components/ui/chip';
import { borderWidth, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatMonth } from '@/lib/format';
import { compareWindows, type CompareRange } from '@/lib/ranges';

const RANGES: { value: CompareRange; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '3m', label: '3M' },
  { value: '12m', label: '12M' },
];

export function ComparisonCard({
  rows,
  range,
  onRangeChange,
  base,
  loading,
  error,
  onRetry,
}: {
  rows: ComparisonRow[];
  range: CompareRange;
  onRangeChange: (range: CompareRange) => void;
  base: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const granularity = useMemo(() => compareWindows(range).granularity, [range]);

  const currentLabel =
    range === 'month' ? 'This month' : range === '3m' ? 'Last 3 months' : 'Last 12 months';
  const previousLabel =
    range === 'month' ? 'Last month' : range === '3m' ? 'Previous 3' : 'Previous 12';
  const title =
    range === 'month'
      ? 'This month vs last month'
      : `${currentLabel} vs ${previousLabel.toLowerCase()}`;
  const subtitle =
    granularity === 'month' ? 'Cumulative spending by month' : 'Cumulative spending by day';

  /** Day-of-month for a month view, "Oct 3" for a broader day view, "Oct" for months. */
  const formatXTick = (key: string): string => {
    if (granularity === 'month') return formatMonth(key).split(' ')[0];
    if (range === 'month') return String(Number(key.slice(8, 10)));
    return `${formatMonth(key).split(' ')[0]} ${Number(key.slice(8, 10))}`;
  };

  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      skeletonHeight={220}
      loading={loading}
      action={
        <View style={styles.ranges}>
          {RANGES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={option.value === range}
              onPress={() => onRangeChange(option.value)}
            />
          ))}
        </View>
      }
      empty={
        <Text style={[text.body, styles.centered, { color: theme.muted }]}>
          No spending in this window yet.
        </Text>
      }
    >
      {error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : (
        <>
          <ComparisonChart
            rows={rows}
            height={220}
            formatXTick={formatXTick}
            currentLabel={currentLabel}
            previousLabel={previousLabel}
            formatValue={(value) => formatMoney(value, base)}
          />

          <View style={[styles.legend, { borderTopColor: theme.border }]}>
            <Legend label={currentLabel} color={theme.primary} />
            <Legend label={previousLabel} color={theme.chartSecondary} dashed />
          </View>
        </>
      )}
    </DashboardCard>
  );
}

function Legend({ label, color, dashed = false }: { label: string; color: string; dashed?: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.legendRow}>
      <View
        style={[
          styles.swatch,
          dashed ? { borderColor: color, borderWidth: borderWidth.thick } : { backgroundColor: color },
        ]}
      />
      <Text style={[text.caption, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ranges: { flexDirection: 'row', gap: spacing.xs },
  centered: { paddingVertical: spacing.xxxl, textAlign: 'center' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 8, height: 8, borderRadius: 4 },
});
