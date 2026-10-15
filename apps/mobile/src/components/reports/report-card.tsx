/**
 * The report card shell.
 *
 * The web's `ReportCard`, brought to touch. Every report card is the same
 * object: a normal-case title with an optional subtitle and trailing action, a
 * body that is either its content, a skeleton, an empty state or an inline
 * failure, and an optional footer.
 *
 * The one structural difference is the chart/table toggle. The web reveals
 * exact figures in a hover tooltip and offers the table as the keyboard/reader
 * alternative; touch has no hover, so the table is the *only* way to read the
 * unrounded numbers and the toggle sits on every chart that carries one.
 */

import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CardError } from '@/components/dashboard/card';
import { IconChartLine, IconTable } from '@/components/icons';
import { Skeleton } from '@/components/ui/feedback';
import { borderWidth, radius, spacing, tabularNums, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAsOf } from '@/lib/format';
import { rateDate } from '@/lib/report-utils';
import type { RateProvenance } from '@/lib/report-types';

/** One column of a card's data table. */
export interface ReportTableColumn {
  label: string;
  /** Right-aligned columns are the numeric ones. */
  align?: 'left' | 'right';
}

/** A chart's numbers, in both currencies, for the table alternative. */
export interface ReportTableData {
  caption: string;
  columns: ReportTableColumn[];
  rows: string[][];
}

/**
 * The accessible alternative to a chart: the same numbers, as text.
 *
 * Horizontally scrollable, because a report table on a phone is wider than the
 * card and squeezing it would make every figure unreadable.
 */
export function ReportTable({ table }: { table: ReportTableData }) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={table.caption}>
      <View>
        <View style={[styles.tableRow, styles.tableHead, { borderColor: theme.border }]}>
          {table.columns.map((column) => (
            <Text
              key={column.label}
              style={[
                text.captionMedium,
                styles.tableCell,
                styles.tableHeadCell,
                { color: theme.muted },
                column.align === 'right' && styles.tableCellRight,
              ]}
            >
              {column.label}
            </Text>
          ))}
        </View>
        {table.rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[styles.tableRow, { borderColor: theme.border }]}
          >
            {row.map((cell, cellIndex) => (
              <Text
                key={`cell-${rowIndex}-${cellIndex}`}
                style={[
                  text.caption,
                  tabularNums,
                  styles.tableCell,
                  { color: cellIndex === 0 ? theme.ink : theme.muted },
                  table.columns[cellIndex]?.align === 'right' && styles.tableCellRight,
                ]}
                numberOfLines={1}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** The small chart ⇄ table switch shown in a chart card's header. */
function ViewToggle({
  showTable,
  onChange,
}: {
  showTable: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  const options: { value: boolean; label: string; Icon: typeof IconChartLine }[] = [
    { value: false, label: 'Chart', Icon: IconChartLine },
    { value: true, label: 'Table', Icon: IconTable },
  ];

  return (
    <View style={[styles.toggle, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      {options.map(({ value, label, Icon }) => {
        const active = showTable === value;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Show ${label.toLowerCase()}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(value)}
            style={[
              styles.toggleOption,
              active && { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Icon size={14} color={active ? theme.ink : theme.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReportCard({
  title,
  subtitle,
  action,
  loading = false,
  skeletonHeight = 200,
  empty,
  isEmpty = false,
  error,
  onRetry,
  footer,
  table,
  style,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Trailing control in the header, left of the chart/table toggle. */
  action?: ReactNode;
  loading?: boolean;
  skeletonHeight?: number;
  /** Shown instead of the body when `isEmpty` is true. */
  empty?: ReactNode;
  isEmpty?: boolean;
  error?: string | null;
  onRetry?: () => void;
  footer?: ReactNode;
  /** When present, the header carries the chart/table toggle. */
  table?: ReportTableData;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const [showTable, setShowTable] = useState(false);

  const canToggle = Boolean(table) && !loading && !error && !isEmpty;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>{title}</Text>
          {subtitle ? <Text style={[text.caption, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>

        <View style={styles.headerActions}>
          {action}
          {canToggle ? (
            <ViewToggle showTable={showTable} onChange={setShowTable} />
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {loading ? (
          <Skeleton height={skeletonHeight} />
        ) : error ? (
          <CardError message={error} onRetry={onRetry} />
        ) : isEmpty ? (
          (empty ?? null)
        ) : showTable && table ? (
          <ReportTable table={table} />
        ) : (
          children
        )}
      </View>

      {footer && !loading && !error && !isEmpty ? (
        <View style={styles.footer}>{footer}</View>
      ) : null}
    </View>
  );
}

/**
 * The rate caveat that lives under the Reports header.
 *
 * It always names the most recent snapshot the figures used, so "as of" is
 * never a guess, and states whether any conversion had to fall back — the
 * mobile stand-in for the web's `RatesPill`/`EstimatePill` pair.
 */
export function RatesNote({
  provenance,
  fallbackDate,
}: {
  provenance?: RateProvenance | null;
  /** Snapshot date to name while the range's own provenance is still loading. */
  fallbackDate?: string | null;
}) {
  const theme = useTheme();
  const asOf =
    rateDate(provenance?.latestRateDate) ?? rateDate(provenance?.earliestRateDate) ?? fallbackDate ?? null;
  const policies = provenance?.policies ?? [];
  const estimated = policies.includes('estimate') || policies.includes('unavailable');
  const message = policies.includes('unavailable')
    ? 'Some amounts could not be converted.'
    : policies.includes('estimate')
      ? 'Includes estimated rates.'
      : 'All figures converted at published rates.';

  if (!asOf) return null;

  return (
    <View style={styles.rates}>
      <Text style={[text.caption, { color: theme.muted }]}>Rates as of {formatAsOf(asOf)}</Text>
      <Text style={[text.caption, { color: estimated ? theme.warning : theme.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: borderWidth.hairline,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  heading: { flexShrink: 1, gap: spacing.xs / 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: borderWidth.hairline,
    padding: 2,
    gap: 2,
  },
  toggleOption: {
    width: 30,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xs,
    borderWidth: borderWidth.hairline,
    borderColor: 'transparent',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: borderWidth.hairline,
  },
  tableHead: {
    borderTopWidth: borderWidth.hairline,
  },
  tableHeadCell: { textTransform: 'uppercase', letterSpacing: 0.4 },
  tableCell: {
    minWidth: 96,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  tableCellRight: { textAlign: 'right' },
  rates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
