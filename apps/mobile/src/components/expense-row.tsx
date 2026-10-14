/**
 * One expense line.
 *
 * Laid out like the web app's activity list: the description leads (falling back
 * to the category when there is no description), the category and date follow as
 * muted metadata, and the amount is right-aligned in tabular figures so a column
 * of rows lines up.
 *
 * The row carries no background or border of its own — lists separate rows with
 * `ExpenseRowDivider` so the first and last rows sit flush inside their card.
 */

import { StyleSheet, Text, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { borderWidth, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/format';

export function ExpenseRow({ expense }: { expense: Schemas['ExpenseDto'] }) {
  const theme = useTheme();

  const description = expense.description?.trim();
  const title = description || expense.categoryName;
  // Avoid printing the category twice when it is already the title.
  const meta = description
    ? `${expense.categoryName} · ${formatDate(expense.incurredOn)}`
    : formatDate(expense.incurredOn);

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

      <Text numberOfLines={1} style={[text.amount, { color: theme.ink }]}>
        {formatMoney(expense.amount, expense.currency)}
      </Text>
    </View>
  );
}

/** Hairline separator for a list of `ExpenseRow`s. */
export function ExpenseRowDivider() {
  const theme = useTheme();

  return <View style={{ height: borderWidth.hairline, backgroundColor: theme.border }} />;
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
});
