/**
 * "Spending by day of week" and its companion insight card.
 *
 * The line plots the *average* per weekday across the selected range, so a
 * range with five Wednesdays never looks heavier than a range with four. The
 * axis is categorical, so the line is straight segments with dots and no
 * smoothing; the peak day's dot is mint.
 *
 * The insight reads the same rows: the busiest weekday with its share of the
 * range total, plus the quietest one.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DowChart } from '@/components/charts';
import { InlineAmounts } from '@/components/amount';
import { ReportCard, type ReportTableData } from '@/components/reports/report-card';
import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import type { DayOfWeekRow } from '@/lib/report-utils';

/** Money, or an em dash when the column has no currency or no figure. */
function money(value: number | null | undefined, code: string | null): string {
  return value == null || !code ? '—' : formatMoney(value, code);
}

function busiest(rows: DayOfWeekRow[]): DayOfWeekRow | null {
  return rows.length > 0 ? rows.reduce((max, row) => (row.average > max.average ? row : max)) : null;
}

function quietest(rows: DayOfWeekRow[]): DayOfWeekRow | null {
  return rows.length > 0 ? rows.reduce((min, row) => (row.average < min.average ? row : min)) : null;
}

/** The busiest weekday's share of the range total, 0–100. */
function peakShare(rows: DayOfWeekRow[], peak: DayOfWeekRow | null): number {
  if (!peak) return 0;
  const sum = rows.reduce((total, row) => total + row.total, 0);
  if (sum <= 0) return 0;
  return (peak.total / sum) * 100;
}

export function DayOfWeekCard({
  rows,
  base,
  second,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  rows: DayOfWeekRow[];
  base: string | null;
  second: string | null;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();

  // The line and its axis read in the leading (Second) currency when a pair is
  // set, so the shape matches the figures above; a weekday falls back to its Home
  // average when the server could not convert it.
  const displayCurrency = second ?? base;
  const chartValues = rows.map((row) => (second ? (row.secondaryAverage ?? row.average) : row.average));
  const peakIndex =
    chartValues.length > 0 ? chartValues.indexOf(Math.max(...chartValues)) : -1;

  const table: ReportTableData = useMemo(() => {
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
      rows: rows.map((row) => [
        row.full,
        ...(second ? [money(row.secondaryAverage, second)] : []),
        money(row.average, base),
        String(row.count),
        money(row.total, base),
      ]),
    };
  }, [rows, base, second]);

  const isEmpty = rows.length === 0 || !rows.some((row) => row.average > 0);

  return (
    <ReportCard
      title="Spending by day of week"
      subtitle={`${rangeLabel} · average per weekday`}
      table={table}
      loading={loading}
      skeletonHeight={240}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      empty={
        <Text style={[text.body, styles.empty, { color: theme.muted }]}>
          No spending in this period yet
        </Text>
      }
    >
      <DowChart
        points={rows.map((row) => ({
          label: row.label,
          value: second ? (row.secondaryAverage ?? row.average) : row.average,
        }))}
        height={240}
        peakIndex={peakIndex}
        formatValue={(value) =>
          displayCurrency ? formatMoney(value, displayCurrency) : String(Math.round(value))
        }
      />
    </ReportCard>
  );
}

export function DayOfWeekInsight({
  rows,
  base,
  second,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  rows: DayOfWeekRow[];
  base: string | null;
  second: string | null;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const peak = useMemo(() => busiest(rows), [rows]);
  const calmest = useMemo(() => quietest(rows), [rows]);
  const share = peakShare(rows, peak);
  const isEmpty = rows.length === 0 || !rows.some((row) => row.average > 0);

  const strong = [text.bodyMedium, { color: theme.ink }];
  const figures = [text.body, { color: theme.ink }];

  return (
    <ReportCard
      title="What this says"
      subtitle={rangeLabel}
      loading={loading}
      skeletonHeight={72}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      empty={<Text style={[text.body, { color: theme.muted }]}>No spending in this period yet.</Text>}
    >
      {peak && calmest ? (
        <View style={styles.insight}>
          <Text style={[text.body, { color: theme.muted }]}>
            You spend the most on{' '}
            <Text style={strong}>{peak.full}s</Text> (
            <InlineAmounts
              homeAmount={peak.average}
              homeCurrency={base}
              secondAmount={peak.secondaryAverage}
              secondCurrency={second}
              textStyle={text.body}
            />
            {share > 0 ? (
              <>
                {' '}
                on average, <Text style={figures}>{share.toFixed(0)}%</Text> of the total
              </>
            ) : null}
            ).
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
      ) : null}
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: spacing.huge },
  insight: { gap: spacing.sm },
});
