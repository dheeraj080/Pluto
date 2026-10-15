/**
 * The Breakdown's category block: a share donut (with a stacked-area "over
 * time" alternative) and the ranked list beneath it.
 *
 * Share draws every category as a donut wedge with the range total in the
 * centre; Over time stacks the top five categories plus "Other" so the bands
 * never overlap. The ranked list is the legend: a colour chip, the name, the
 * grey count, a thin share bar, the share, and the amounts in both currencies,
 * with the range total as a footer.
 *
 * The over-time series is fetched lazily — only when that view is chosen — so
 * opening Breakdown costs nothing until the user asks for it. Every ranked row
 * is tappable: it opens the Activity list filtered to that category and range,
 * which is the drill-down the web reaches through a side drawer.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DualAmount } from '@/components/amount';
import { DonutChart, StackedAreaChart, type StackedSeries } from '@/components/charts';
import { ReportCard, type ReportTableData } from '@/components/reports/report-card';
import { Chip } from '@/components/ui/chip';
import { IconArrowRight } from '@/components/icons';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { summaryAmounts } from '@/lib/convert';
import { errorMessage } from '@/lib/errors';
import { formatMoney, formatPercent } from '@/lib/format';
import { granularityLabel, type ReportGranularity } from '@/lib/ranges';
import { useReportCategorySeries } from '@/hooks/use-reports';
import { bucketAxis, bucketHeading } from '@/lib/report-utils';
import type { CategoryBreakdown } from '@/lib/report-types';

type CategoryView = 'share' | 'overTime';

/** Muted donut palette, matching the web's `report-categories.tsx`. */
const PALETTE = ['#2fbf9d', '#35b7bf', '#4aa8e8', '#dcae4e', '#e5829a', '#8b98a8', '#9a8cd9'];
const OTHER_COLOR = '#8b98a8';
const OTHER_ID = '__other';

const VIEW_OPTIONS: { value: CategoryView; label: string }[] = [
  { value: 'share', label: 'Share' },
  { value: 'overTime', label: 'Over time' },
];

function fmt(value: number | null | undefined, code: string | null): string {
  return value == null || !code ? '—' : formatMoney(value, code);
}

export function ReportCategories({
  from,
  to,
  granularity,
  rangeLabel,
  categories,
  count,
  total,
  secondaryTotal,
  base,
  second,
  loading,
  error,
  onRetry,
  onOpenCategory,
}: {
  from: string;
  to: string;
  granularity: ReportGranularity;
  rangeLabel: string;
  categories: CategoryBreakdown[];
  count: number;
  total: number | null;
  secondaryTotal: number | null;
  base: string | null;
  second: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Open the Activity list filtered to one category and the current range. */
  onOpenCategory: (categoryId: string) => void;
}) {
  const theme = useTheme();
  const [view, setView] = useState<CategoryView>('share');
  const [isolated, setIsolated] = useState<string | null>(null);

  // Idle until the over-time view is chosen.
  const categorySeries = useReportCategorySeries({
    from,
    to,
    granularity,
    base,
    secondary: second,
    enabled: view === 'overTime',
  });

  // `isLoading` (pending *and* fetching), not `isPending`: a query that is
  // disabled because the Share view is active still reports `isPending`, and
  // that would pin the card to its skeleton forever.
  const seriesLoading = loading || (view === 'overTime' && categorySeries.isLoading);
  const seriesError =
    error ?? (view === 'overTime' && categorySeries.error ? errorMessage(categorySeries.error) : null);
  const retryAll = () => {
    onRetry();
    if (view === 'overTime') void categorySeries.refetch();
  };

  const rankOf = useMemo(
    () => new Map(categories.map((entry, index) => [entry.categoryId, index])),
    [categories],
  );
  const colorFor = (id: string) => PALETTE[(rankOf.get(id) ?? 0) % PALETTE.length];

  const donutSlices = useMemo(
    () =>
      categories
        .filter((entry) => entry.total > 0)
        .map((entry) => ({
          id: entry.categoryId,
          label: entry.categoryName,
          value: entry.total,
          color: PALETTE[(rankOf.get(entry.categoryId) ?? 0) % PALETTE.length],
        })),
    [categories, rankOf],
  );

  const seriesItems = useMemo(() => categorySeries.data?.series ?? [], [categorySeries.data]);
  const buckets = useMemo(() => categorySeries.data?.buckets ?? [], [categorySeries.data]);

  // The stacked chart and its table read in the leading (Second) currency when a
  // pair is set, so the axis matches the totals above; a point falls back to its
  // Home value when the server could not convert it.
  const displayCurrency = second ?? base;

  const topEntries: StackedSeries[] = useMemo(
    () =>
      seriesItems.slice(0, 5).map((item) => ({
        id: item.categoryId,
        label: item.categoryName,
        color: PALETTE[(rankOf.get(item.categoryId) ?? 0) % PALETTE.length],
        values: item.points.map(
          (point) => (second ? (point.secondaryTotal ?? point.total) : point.total) ?? 0,
        ),
      })),
    [seriesItems, rankOf, second],
  );

  const visibleStack: StackedSeries[] = useMemo(() => {
    const rest = seriesItems.slice(5);
    if (rest.length === 0) return topEntries;
    const other: StackedSeries = {
      id: OTHER_ID,
      label: 'Other',
      color: OTHER_COLOR,
      values: buckets.map((_, index) =>
        rest.reduce((sum, item) => {
          const point = item.points[index];
          return sum + ((second ? (point?.secondaryTotal ?? point?.total) : point?.total) ?? 0);
        }, 0),
      ),
    };
    return [...topEntries, other];
  }, [seriesItems, buckets, topEntries, second]);

  const isolatedEntry = visibleStack.find((entry) => entry.id === isolated) ?? null;
  const renderStack = isolatedEntry ? [isolatedEntry] : visibleStack;

  const stackRows = buckets.map((bucket, index) => ({
    bucket,
    values: renderStack.map((entry) => entry.values[index] ?? 0),
  }));

  const isEmpty = categories.length === 0 || !categories.some((entry) => entry.total > 0);
  const max = categories[0]?.total ?? 0;
  const centrePair = summaryAmounts(total, base, secondaryTotal, second);

  const shareTable: ReportTableData | undefined =
    categories.length > 0
      ? {
          caption: `Spending by category, ${rangeLabel}`,
          columns: [
            { label: 'Category' },
            ...(second ? [{ label: `Spent (${second})`, align: 'right' as const }] : []),
            { label: `Spent (${base ?? '—'})`, align: 'right' },
            { label: 'Share', align: 'right' },
          ],
          rows: categories.map((entry) => [
            entry.categoryName,
            ...(second ? [fmt(entry.secondaryTotal, second)] : []),
            fmt(entry.total, base),
            formatPercent(entry.percentage),
          ]),
        }
      : undefined;

  const overTimeTable: ReportTableData | undefined =
    stackRows.length > 0 && renderStack.length > 0
      ? {
          caption: `Spending by category over time, ${rangeLabel}, ${granularity} buckets`,
          columns: [
            { label: 'Bucket' },
            ...renderStack.map((entry) => ({ label: entry.label, align: 'right' as const })),
          ],
          rows: stackRows.map((row) => [
            bucketHeading(row.bucket, granularity),
            ...row.values.map((value) => fmt(value, displayCurrency)),
          ]),
        }
      : undefined;

  return (
    <ReportCard
      title="Categories"
      subtitle={`${rangeLabel} · ${granularityLabel(granularity)}`}
      action={
        <View style={styles.views}>
          {VIEW_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={view === option.value}
              onPress={() => setView(option.value)}
            />
          ))}
        </View>
      }
      table={view === 'share' ? shareTable : overTimeTable}
      loading={seriesLoading}
      skeletonHeight={320}
      error={seriesError}
      onRetry={retryAll}
      isEmpty={isEmpty}
      empty={
        <Text style={[text.body, styles.empty, { color: theme.muted }]}>
          No spending in this period yet
        </Text>
      }
    >
      {view === 'share' ? (
        <View style={styles.donutWrap}>
          <DonutChart slices={donutSlices} size={220}>
            {centrePair ? (
              <View style={styles.donutCenter}>
                <DualAmount {...centrePair} size="kpi" layout="stack" align="center" />
                <Text style={[text.caption, { color: theme.muted }]}>
                  {count} {count === 1 ? 'expense' : 'expenses'}
                </Text>
              </View>
            ) : null}
          </DonutChart>
        </View>
      ) : (
        <View style={styles.stackWrap}>
          <View style={styles.legend}>
            {visibleStack.map((entry) => (
              <Chip
                key={entry.id}
                label={entry.label}
                dotColor={entry.color}
                selected={isolatedEntry?.id === entry.id}
                onPress={() => setIsolated(isolatedEntry?.id === entry.id ? null : entry.id)}
              />
            ))}
          </View>
          {isolatedEntry ? (
            <Text style={[text.caption, { color: theme.muted }]}>
              Showing only {isolatedEntry.label} — tap it again to show all.
            </Text>
          ) : null}
          <StackedAreaChart
            buckets={buckets}
            series={renderStack}
            height={240}
            formatXTick={(key) => bucketAxis(key, granularity)}
            formatValue={(value) =>
              displayCurrency ? formatMoney(value, displayCurrency) : String(Math.round(value))
            }
          />
        </View>
      )}

      <View style={[styles.list, { borderColor: theme.border }]}>
        {categories.map((entry) => {
          const barWidth = max > 0 ? (entry.total / max) * 100 : 0;
          const entryPair = summaryAmounts(entry.total, base, entry.secondaryTotal, second);
          return (
            <Pressable
              key={entry.categoryId}
              accessibilityRole="button"
              accessibilityLabel={`Show ${entry.categoryName} expenses`}
              onPress={() => onOpenCategory(entry.categoryId)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.rowHead}>
                <View style={[styles.swatch, { backgroundColor: colorFor(entry.categoryId) }]} />
                <Text style={[text.bodyMedium, styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                  {entry.categoryName}
                </Text>
                {entryPair ? (
                  <DualAmount {...entryPair} size="sm" layout="stack" align="right" />
                ) : null}
                <IconArrowRight size={16} color={theme.muted} />
              </View>
              <View style={styles.rowBar}>
                <Text style={[text.caption, { color: theme.muted }]}>
                  {entry.count} {entry.count === 1 ? 'expense' : 'expenses'}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${barWidth}%`, backgroundColor: colorFor(entry.categoryId) },
                    ]}
                  />
                </View>
                <Text style={[text.caption, styles.rowShare, { color: theme.muted }]}>
                  {formatPercent(entry.percentage)}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {categories.length > 0 ? (
          <View style={[styles.total, { borderColor: theme.borderStrong }]}>
            <Text style={[text.bodyMedium, { color: theme.ink }]}>Total</Text>
            {centrePair ? (
              <DualAmount {...centrePair} size="sm" layout="stack" align="right" />
            ) : null}
          </View>
        ) : null}
      </View>
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  views: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { textAlign: 'center', paddingVertical: spacing.huge },
  donutWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  donutCenter: { alignItems: 'center', gap: spacing.xs },
  stackWrap: { gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { marginTop: spacing.lg, borderTopWidth: 1, paddingTop: spacing.sm },
  row: {
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 8, height: 8, borderRadius: radius.pill },
  rowName: { flex: 1 },
  rowBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barTrack: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  rowShare: { width: 44, textAlign: 'right' },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
