/**
 * One expense line.
 *
 * Laid out like the web app's activity list: the description leads (falling back
 * to the category when there is no description), the category and date follow as
 * muted metadata, and the amount is right-aligned in tabular figures so a column
 * of rows lines up.
 *
 * The amount shows two figures — the currency it was recorded in, with the same
 * amount in the home currency beneath it (or the Second when the expense is
 * already in home). The recorded amount is never rewritten.
 *
 * The row carries no background or border of its own — lists separate rows with
 * the `Divider` component so the first and last rows sit flush inside their card.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { DualAmount } from '@/components/amount';
import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { recordedAmounts, type RateSnapshot } from '@/lib/convert';
import { formatDate } from '@/lib/format';

export function ExpenseRow({
  expense,
  home,
  second,
  snapshot,
}: {
  expense: Schemas['ExpenseDto'];
  /** Home currency the recorded amount is also shown in; null hides it. */
  home: string | null;
  /** Second currency, the companion when the expense is already in home. */
  second: string | null;
  /** Latest public rates, for the companion figure. */
  snapshot: RateSnapshot | null;
}) {
  const theme = useTheme();

  const description = expense.description?.trim();
  const title = description || expense.categoryName;
  // Avoid printing the category twice when it is already the title.
  const meta = description
    ? `${expense.categoryName} · ${formatDate(expense.incurredOn)}`
    : formatDate(expense.incurredOn);

  const amounts = recordedAmounts(expense.amount, expense.currency, home, snapshot, second);

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: expense.categoryColor }]} />

      <View style={styles.details}>
        <Text numberOfLines={1} style={[text.bodyStrong, { color: theme.ink }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[text.caption, { color: theme.muted }]}>
          {meta}
        </Text>
      </View>

      <DualAmount
        amount={amounts.amount}
        currency={amounts.currency}
        secondaryAmount={amounts.companionAmount}
        secondaryCurrency={amounts.companionCurrency}
        size="sm"
        layout="stack"
        align="right"
        style={styles.amount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  details: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  amount: { flexShrink: 0 },
});
