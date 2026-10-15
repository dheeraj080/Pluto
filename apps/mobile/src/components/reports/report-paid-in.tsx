/**
 * The Breakdown's "Paid in" block: one line per original currency behind the
 * total.
 *
 * Each line shows the currency's code, how many expenses were paid in it, the
 * native subtotal, the subtotal converted into the reporting currency, and a
 * thin share bar against the range total. The three largest currencies are
 * listed; everything else folds under a single expandable "Other currencies"
 * line.
 *
 * The converted totals reconcile with the Total figure by construction: the
 * "Other" line carries exactly `total - (sum of the listed converted totals)`,
 * so this card can never disagree with it. A row opens the Activity list
 * filtered to that currency and the current range.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReportCard, type ReportTableData } from '@/components/reports/report-card';
import { IconChevronDown } from '@/components/icons';
import { borderWidth, fontFamily, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import type { CurrencyTotal } from '@/lib/report-types';

/** How many currencies stand alone before "Other currencies" takes over. */
const TOP = 3;

const FOOTER = 'Native amounts as recorded. Converted using daily ECB rates.';

function fmt(value: number | null | undefined, code: string | null): string {
  return value == null || !code ? '—' : formatMoney(value, code);
}

function shareOf(converted: number | null | undefined, total: number | null): number {
  if (converted == null || total == null || total <= 0) return 0;
  return (converted / total) * 100;
}

function plural(count: number): string {
  return `${count} ${count === 1 ? 'expense' : 'expenses'}`;
}

/** The small currency-code badge on the left of every line. */
function CodeBadge({ children, strong = false }: { children: string; strong?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
      <Text style={[styles.badgeText, { color: strong ? theme.ink : theme.muted }]}>{children}</Text>
    </View>
  );
}

/** One currency's line: code, count, share bar, native total, converted total. */
function CurrencyLine({
  entry,
  base,
  total,
  onPress,
}: {
  entry: CurrencyTotal;
  base: string | null;
  total: number | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const share = shareOf(entry.convertedTotal, total);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show expenses paid in ${entry.currency}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.line,
        { borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.lineTop}>
        <CodeBadge strong>{entry.currency}</CodeBadge>
        <Text style={[text.caption, styles.lineCount, { color: theme.muted }]}>
          {plural(entry.count)}
        </Text>
        <Text style={[text.caption, styles.lineNative, { color: theme.muted }]}>
          {fmt(entry.total, entry.currency)}
        </Text>
      </View>
      <View style={styles.lineBottom}>
        <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${share}%`, backgroundColor: theme.primary }]} />
        </View>
        <Text style={[styles.converted, { color: theme.ink }]}>{fmt(entry.convertedTotal, base)}</Text>
      </View>
    </Pressable>
  );
}

export function ReportPaidIn({
  rangeLabel,
  currencies,
  total,
  base,
  loading,
  error,
  onRetry,
  onOpenCurrency,
}: {
  rangeLabel: string;
  currencies: CurrencyTotal[];
  /** The range total in the base currency — the same figure as the Summary's. */
  total: number | null;
  /** Reporting (base) currency. */
  base: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Open the Activity list filtered to one original currency. */
  onOpenCurrency: (currency: string) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Rank by converted (reporting-currency) volume so the bold numbers lead;
  // native volume breaks the tie and covers the unconvertible case.
  const sorted = [...currencies].sort((a, b) => {
    const av = a.convertedTotal ?? -1;
    const bv = b.convertedTotal ?? -1;
    if (bv !== av) return bv - av;
    return b.total - a.total;
  });

  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const topConverted = top.reduce((sum, c) => sum + (c.convertedTotal ?? 0), 0);
  // The exact difference, so every line sums to the total.
  const restConverted = total != null ? Math.max(0, total - topConverted) : null;
  const restCount = rest.reduce((sum, c) => sum + c.count, 0);

  const isEmpty = currencies.length === 0;

  const table: ReportTableData | undefined =
    currencies.length > 0
      ? {
          caption: `Spending by currency, ${rangeLabel}`,
          columns: [
            { label: 'Currency' },
            { label: 'Expenses', align: 'right' },
            { label: 'Paid (native)', align: 'right' },
            { label: `Converted (${base ?? '—'})`, align: 'right' },
          ],
          rows: sorted.map((c) => [
            c.currency,
            plural(c.count),
            fmt(c.total, c.currency),
            fmt(c.convertedTotal, base),
          ]),
        }
      : undefined;

  return (
    <ReportCard
      title="Paid in"
      subtitle={`${rangeLabel} · by original currency`}
      table={table}
      loading={loading}
      skeletonHeight={224}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      empty={
        <Text style={[text.body, styles.empty, { color: theme.muted }]}>
          No spending in this period yet
        </Text>
      }
      footer={
        <Text style={[text.caption, { color: theme.muted }]}>{FOOTER}</Text>
      }
    >
      <View style={[styles.list, { borderColor: theme.border }]}>
        {top.map((entry) => (
          <CurrencyLine
            key={entry.currency}
            entry={entry}
            base={base}
            total={total}
            onPress={() => onOpenCurrency(entry.currency)}
          />
        ))}

        {rest.length > 0 ? (
          <View style={[styles.otherWrap, { borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((value) => !value)}
              style={styles.other}
            >
              <View style={styles.lineTop}>
                <CodeBadge strong>{`+${rest.length}`}</CodeBadge>
                <Text style={[text.bodyMedium, styles.otherLabel, { color: theme.ink }]} numberOfLines={1}>
                  Other currencies
                  <Text style={[text.caption, { color: theme.muted }]}>  {plural(restCount)}</Text>
                </Text>
                <Text style={[styles.converted, { color: theme.ink }]}>
                  {fmt(restConverted, base)}
                </Text>
              </View>
              <View style={styles.lineBottom}>
                <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${shareOf(restConverted, total)}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
                <View style={[styles.chevron, expanded && styles.chevronOpen]}>
                  <IconChevronDown size={16} color={theme.muted} />
                </View>
              </View>
            </Pressable>

            {expanded
              ? rest.map((entry) => (
                  <View key={entry.currency} style={[styles.otherItem, { borderColor: theme.border }]}>
                    <CurrencyLine
                      entry={entry}
                      base={base}
                      total={total}
                      onPress={() => onOpenCurrency(entry.currency)}
                    />
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </View>
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: spacing.huge },
  list: { borderTopWidth: borderWidth.hairline },
  line: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: borderWidth.hairline,
  },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineCount: { flex: 1 },
  lineNative: { textAlign: 'right' },
  lineBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  converted: { fontFamily: fontFamily.sans.semibold, fontSize: 14, lineHeight: 18 },
  badge: {
    width: 34,
    height: 30,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fontFamily.sans.semibold, fontSize: 11, letterSpacing: -0.2 },
  otherWrap: { borderBottomWidth: borderWidth.hairline },
  other: { paddingVertical: spacing.md, gap: spacing.sm },
  otherLabel: { flex: 1 },
  otherItem: {
    paddingHorizontal: spacing.md,
    borderTopWidth: borderWidth.hairline,
  },
  chevron: { width: 22, alignItems: 'center' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  pressed: { opacity: 0.7 },
});
