/**
 * The Overview's Trend block: one card, two readings of the same range.
 *
 * `Over time` is the comparison line — the selected window against the
 * equal-length one before it, bucketed daily / weekly / monthly, with a
 * `Per period | Cumulative` switch that reads the same buckets either way.
 * `By weekday` is the average per weekday, with the busiest and quietest days
 * stated beneath the line.
 *
 * Merging the two into one card (rather than two stacked cards plus a separate
 * "what this says" card) is the point of the Overview: one trend surface, one
 * place to look. The two data sets are fetched lazily by the screen, so opening
 * on Over time never pays for the weekday request.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { ComparisonChart, DowChart } from '@/components/charts';
import { InlineAmounts } from '@/components/amount';
import { ReportCard, type ReportTableData } from '@/components/reports/report-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import { granularityLabel, type ReportGranularity } from '@/lib/ranges';
import {
  bucketAxis,
  bucketHeading,
  peakShare,
  toCumulative,
  type DayOfWeekRow,
  type TrendRow,
} from '@/lib/report-utils';

export type TrendMode = 'overTime' | 'weekday';

type SeriesMode = 'period' | 'cumulative';

const MODE_OPTIONS: { value: TrendMode; label: string }[] = [
  { value: 'overTime', label: 'Over time' },
  { value: 'weekday', label: 'By weekday' },
];

const SERIES_OPTIONS: { value: SeriesMode; label: string }[] = [
  { value: 'period', label: 'Per period' },
  { value: 'cumulative', label: 'Cumulative' },
];

/** Money, or an em dash when the column has no currency or no figure. */
function fmt(value: number | null | undefined, code: string | null): string {
  return value == null || !code ? '—' : formatMoney(value, code);
}

function busiest(rows: DayOfWeekRow[]): DayOfWeekRow | null {
  return rows.length > 0 ? rows.reduce((max, row) => (row.average > max.average ? row : max)) : null;
}

function quietest(rows: DayOfWeekRow[]): DayOfWeekRow | null {
  return rows.length > 0 ? rows.reduce((min, row) => (row.average < min.average ? row : min)) : null;
}

export function ReportTrend({
  mode,
  onModeChange,
  compare,
  rows,
  dowRows,
  granularity,
  base,
  second,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  mode: TrendMode;
  onModeChange: (mode: TrendMode) => void;
  /** Whether the comparison line is meaningful (drives the "previous" series). */
  compare: boolean;
  /** Over-time buckets (current window, with the previous window aligned). */
  rows: TrendRow[];
  /** Weekday rows, each already averaged over its occurrences. */
  dowRows: DayOfWeekRow[];
  granularity: ReportGranularity;
  base: string | null;
  second: string | null;
  rangeLabel: string;
  /** Loading / error for the *active* mode; the screen supplies it. */
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('period');
  const isDow = mode === 'weekday';

  const chartRows = useMemo(
    () => (seriesMode === 'cumulative' ? toCumulative(rows) : rows),
    [rows, seriesMode],
  );

  // The line leads in the Second currency when a pair is set, so its axis matches
  // the Summary above; the tables still show both currencies side by side.
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

  const trendTable: ReportTableData = useMemo(() => {
    const columns = [
      { label: 'Bucket' },
      ...(second ? [{ label: `This period (${second})`, align: 'right' as const }] : []),
      { label: `This period (${base ?? '—'})`, align: 'right' as const },
      ...(compare
        ? [
            { label: `Previous (${base ?? '—'})`, align: 'right' as const },
            { label: `Difference (${base ?? '—'})`, align: 'right' as const },
          ]
        : []),
    ];
    return {
      caption: `Spending over time, ${granularity} buckets, ${seriesMode === 'cumulative' ? 'cumulative' : 'per period'}`,
      columns,
      rows: chartRows.map((row) => {
        const cells = [bucketHeading(row.key, granularity)];
        if (second) cells.push(fmt(row.currentSecond, second));
        cells.push(fmt(row.current, base));
        if (compare) {
          const diff =
            row.current == null && row.previous == null
              ? null
              : (row.current ?? 0) - (row.previous ?? 0);
          cells.push(fmt(row.previous, base), diff == null ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff, base)}`);
        }
        return cells;
      }),
    };
  }, [chartRows, granularity, base, second, seriesMode, compare]);

  const dowTable: ReportTableData = useMemo(() => {
    const columns = [
      { label: 'Day' },
      ...(second ? [{ label: `Average (${second})`, align: 'right' as const }] : []),
      { label: `Average (${base ?? '—'})`, align: 'right' as const },
      { label: 'Expenses', align: 'right' as const },
      { label: `Total (${base ?? '—'})`, align: 'right' as const },
    ];
    return {
      caption: 'Spending by day of week, average per weekday',
      columns,
      rows: dowRows.map((row) => [
        row.full,
        ...(second ? [fmt(row.secondaryAverage, second)] : []),
        fmt(row.average, base),
        String(row.count),
        fmt(row.total, base),
      ]),
    };
  }, [dowRows, base, second]);

  const dowValues = dowRows.map((row) => (second ? (row.secondaryAverage ?? row.average) : row.average));
  const peakIndex = dowValues.length > 0 ? dowValues.indexOf(Math.max(...dowValues)) : -1;

  const peak = useMemo(() => busiest(dowRows), [dowRows]);
  const calmest = useMemo(() => quietest(dowRows), [dowRows]);
  const share = peakShare(dowRows, peak);

  const hasTrend = rows.some((row) => (row.current ?? 0) > 0);
  const hasDow = dowRows.some((row) => row.average > 0);

  const isEmpty = isDow ? dowRows.length === 0 || !hasDow : rows.length === 0 || !hasTrend;
  const unit = granularity === 'day' ? 'day' : granularity;

  const strong: StyleProp<TextStyle> = [text.bodyMedium, { color: theme.ink }];

  return (
    <ReportCard
      title="Trend"
      subtitle={isDow ? `${rangeLabel} · average per weekday` : `${rangeLabel} · ${granularityLabel(granularity)}`}
      action={
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={onModeChange} label="Trend view" />
      }
      table={isDow ? dowTable : trendTable}
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
      footer={
        isDow ? (
          peak && calmest ? (
            <View style={styles.insight}>
              <Text style={[text.body, { color: theme.muted }]}>
                You spend the most on <Text style={strong}>{peak.full}s</Text> —{' '}
                <InlineAmounts
                  homeAmount={peak.average}
                  homeCurrency={base}
                  secondAmount={peak.secondaryAverage}
                  secondCurrency={second}
                  textStyle={text.body}
                />{' '}
                on average
                {share > 0 ? (
                  <>
                    , <Text style={[text.body, { color: theme.ink }]}>{share.toFixed(0)}%</Text> of the
                    total
                  </>
                ) : null}
                .
              </Text>
              <Text style={[text.body, { color: theme.muted }]}>
                The quietest day is <Text style={strong}>{calmest.full}</Text> —{' '}
                <InlineAmounts
                  homeAmount={calmest.average}
                  homeCurrency={base}
                  secondAmount={calmest.secondaryAverage}
                  secondCurrency={second}
                  textStyle={text.body}
                />{' '}
                on average.
              </Text>
            </View>
          ) : null
        ) : compare ? (
          <Text style={[text.caption, { color: theme.muted }]}>
            {`The dashed line is the equal-length ${unit} before.`}
          </Text>
        ) : undefined
      }
    >
      {isDow ? (
        <DowChart
          points={dowRows.map((row) => ({
            label: row.label,
            value: second ? (row.secondaryAverage ?? row.average) : row.average,
          }))}
          height={240}
          peakIndex={peakIndex}
          formatValue={(value) =>
            displayCurrency ? formatMoney(value, displayCurrency) : String(Math.round(value))
          }
        />
      ) : (
        <View style={styles.trendBody}>
          <SegmentedControl
            options={SERIES_OPTIONS}
            value={seriesMode}
            onChange={setSeriesMode}
            label="Trend series"
          />
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
                {seriesMode === 'cumulative' ? 'Cumulative' : 'This period'}
                {lastCurrent != null && displayCurrency
                  ? ` · ${formatMoney(lastCurrent, displayCurrency)}`
                  : ''}
              </Text>
            </View>
            {compare ? (
              <View style={styles.legendRow}>
                <View style={[styles.dash, { backgroundColor: theme.chartSecondary }]} />
                <Text style={[text.caption, { color: theme.muted }]} numberOfLines={1}>
                  Previous period
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  trendBody: { gap: spacing.md },
  empty: { textAlign: 'center', paddingVertical: spacing.huge },
  insight: { gap: spacing.sm },
  legend: {
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
