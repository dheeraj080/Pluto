/**
 * "Spending over time" — the full-width comparison line.
 *
 * One mint line for the selected range with a soft gradient fill and a dashed
 * grey-blue line for the equal-length period before it. The bucket size follows
 * the global range (daily / weekly / monthly), so a single month never draws
 * twelve points. A "Per period | Cumulative" switch reads the same buckets
 * either way.
 *
 * The web hides exact per-bucket figures behind a hover tooltip and a
 * click-a-point drill-down. Touch has neither, so the figures are stated in the
 * card's data table instead and the card carries no point selection.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ComparisonChart } from '@/components/charts';
import { ReportCard, type ReportTableData } from '@/components/reports/report-card';
import { Chip } from '@/components/ui/chip';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import { granularityLabel, type ReportGranularity } from '@/lib/ranges';
import { bucketAxis, bucketHeading, toCumulative, type TrendRow } from '@/lib/report-utils';

type SeriesMode = 'period' | 'cumulative';

const MODE_OPTIONS: { value: SeriesMode; label: string }[] = [
  { value: 'period', label: 'Per period' },
  { value: 'cumulative', label: 'Cumulative' },
];

/** Money, or an em dash when the column has no currency or no figure. */
function fmt(value: number | null | undefined, code: string | null): string {
  return value == null || !code ? '—' : formatMoney(value, code);
}

export function SpendingOverTime({
  rows,
  granularity,
  base,
  second,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  rows: TrendRow[];
  granularity: ReportGranularity;
  base: string | null;
  second: string | null;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<SeriesMode>('period');

  const chartRows = useMemo(
    () => (mode === 'cumulative' ? toCumulative(rows) : rows),
    [rows, mode],
  );

  // The line leads in the Second currency when a pair is set, so its axis matches
  // the KPIs above; the table shows both currencies side by side.
  const displayCurrency = second ?? base;
  const seriesRows = useMemo(
    () =>
      second
        ? chartRows.map((row) => ({
            key: row.key,
            current: row.currentSecond,
            previous: row.previousSecond,
          }))
        : chartRows,
    [chartRows, second],
  );

  const lastCurrent = (() => {
    for (let index = seriesRows.length - 1; index >= 0; index -= 1) {
      const value = seriesRows[index].current;
      if (value != null) return value;
    }
    return null;
  })();

  const table: ReportTableData = useMemo(() => {
    const columns = [
      { label: 'Bucket' },
      ...(second ? [{ label: `This period (${second})`, align: 'right' as const }] : []),
      { label: `This period (${base ?? '—'})`, align: 'right' as const },
      { label: `Previous (${base ?? '—'})`, align: 'right' as const },
      { label: `Difference (${base ?? '—'})`, align: 'right' as const },
    ];
    return {
      caption: `Spending over time, ${granularity} buckets, ${mode === 'cumulative' ? 'cumulative' : 'per period'}`,
      columns,
      rows: chartRows.map((row) => {
        const cells = [bucketHeading(row.key, granularity)];
        if (second) cells.push(fmt(row.currentSecond, second));
        cells.push(fmt(row.current, base));
        const diff =
          row.current == null && row.previous == null
            ? null
            : (row.current ?? 0) - (row.previous ?? 0);
        cells.push(fmt(row.previous, base), diff == null ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff, base)}`);
        return cells;
      }),
    };
  }, [chartRows, granularity, base, second, mode]);

  const hasSpending = rows.some((row) => (row.current ?? 0) > 0);
  const isEmpty = rows.length === 0 || !hasSpending;
  const unit = granularity === 'day' ? 'day' : granularity;

  return (
    <ReportCard
      title="Spending over time"
      subtitle={`${granularityLabel(granularity)} · ${rangeLabel}`}
      table={table}
      loading={loading}
      skeletonHeight={260}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      empty={
        <Text style={[text.body, styles.empty, { color: theme.muted }]}>
          No spending in this period yet
        </Text>
      }
      footer={`The dashed line is the equal-length ${unit} before.`}
      action={
        <View style={styles.modes}>
          {MODE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={mode === option.value}
              onPress={() => setMode(option.value)}
            />
          ))}
        </View>
      }
    >
      <ComparisonChart
        rows={seriesRows}
        height={260}
        formatXTick={(key) => bucketAxis(key, granularity)}
        currentLabel="This period"
        previousLabel="Previous period"
        formatValue={(value) =>
          displayCurrency ? formatMoney(value, displayCurrency) : String(Math.round(value))
        }
      />

      <View style={[styles.legend, { borderColor: theme.border }]}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <Text style={[text.caption, { color: theme.muted }]} numberOfLines={1}>
            {mode === 'cumulative' ? 'Cumulative' : 'This period'}
            {lastCurrent != null && displayCurrency
              ? ` · ${formatMoney(lastCurrent, displayCurrency)}`
              : ''}
          </Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.dash, { backgroundColor: theme.chartSecondary }]} />
          <Text style={[text.caption, { color: theme.muted }]} numberOfLines={1}>
            Previous period
          </Text>
        </View>
      </View>
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { textAlign: 'center', paddingVertical: spacing.huge },
  legend: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  dash: { width: 14, height: 2, borderRadius: 1 },
});
