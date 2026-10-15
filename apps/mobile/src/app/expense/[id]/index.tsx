import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DualAmount } from '@/components/amount';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm';
import { Divider } from '@/components/ui/divider';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { layout, radius, spacing, text } from '@/theme';
import { useExpense } from '@/hooks/use-expense';
import { useDeleteExpense } from '@/hooks/use-expense-mutations';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useTheme } from '@/hooks/use-theme';
import { buildConversionPreview, recordedAmounts } from '@/lib/convert';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { editExpenseHref } from '@/lib/routes';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const expense = useExpense(id);
  const remove = useDeleteExpense();
  const { base, second } = usePair();
  const snapshot = useRateSnapshot(base ?? undefined);
  const { confirm, sheet: confirmSheet } = useConfirm();

  const onDelete = useCallback(() => {
    const target = expense.data;
    if (!target) return;

    void confirm({
      title: 'Delete expense?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
    }).then((confirmed) => {
      if (!confirmed) return;
      remove.mutate(target.id, {
        // The list already dropped this row from its cache, so returning
        // to it shows the deletion without a manual refresh.
        onSuccess: () => router.back(),
      });
    });
  }, [confirm, expense.data, remove]);

  if (expense.isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.canvas }]}>
        <Spinner size="large" />
      </View>
    );
  }

  if (!expense.data) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.canvas }]}>
        <ErrorNote message={errorMessage(expense.error) ?? 'Expense not found.'} />
        <Button label="Retry" variant="secondary" onPress={() => void expense.refetch()} />
      </View>
    );
  }

  const item = expense.data;

  // Read the recorded amount as the headline, with its companion (home, or the
  // Second when the expense is already in home) beneath it. The recorded amount
  // is never rewritten.
  const rates = snapshot.data ?? null;
  const amounts = recordedAmounts(item.amount, item.currency, base, rates, second);

  // The rate that produced the companion figure, so it can be traced back to its
  // snapshot. A row with no companion needs no such line.
  const companionRate =
    amounts.companionCurrency && amounts.companionCurrency !== item.currency
      ? buildConversionPreview(item.amount, item.currency, amounts.companionCurrency, rates)
      : null;
  const rateLine = companionRate
    ? `1 ${companionRate.from} = ${companionRate.rate.toFixed(4)} ${companionRate.to} · ${companionRate.provider} ${companionRate.effectiveDate}`
    : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.categoryRow}>
            <View style={[styles.dot, { backgroundColor: item.categoryColor }]} />
            <Text numberOfLines={1} style={[text.overline, styles.categoryName, { color: theme.muted }]}>
              {item.categoryName}
            </Text>
          </View>

          <DualAmount
            amount={amounts.amount}
            currency={amounts.currency}
            secondaryAmount={amounts.companionAmount}
            secondaryCurrency={amounts.companionCurrency}
            size="hero"
            layout="inline"
          />

          {rateLine ? <Text style={[text.caption, { color: theme.muted }]}>{rateLine}</Text> : null}

          <Text style={[text.caption, { color: theme.muted }]}>{formatDate(item.incurredOn)}</Text>
        </Card>

        {/* Padding lives on each row so the dividers can run edge to edge. */}
        <Card style={styles.details}>
          <DetailRow label="Category" value={item.categoryName} />
          <Divider />
          <DetailRow label="Date" value={formatDate(item.incurredOn)} />
          <Divider />
          <DetailRow label="Payment method" value={item.paymentMethod ?? '—'} />
          <Divider />
          <DetailRow label="Description" value={item.description?.trim() || '—'} />
        </Card>

        {remove.isError ? <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete.'} /> : null}

        <View style={styles.actions}>
          <Button label="Edit" onPress={() => router.push(editExpenseHref(item.id))} />
          <Button label="Delete" variant="danger" onPress={onDelete} busy={remove.isPending} />
        </View>
      </ScrollView>

      {confirmSheet}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[text.caption, { color: theme.muted }]}>{label}</Text>
      <Text style={[text.bodyMedium, styles.detailValue, { color: theme.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: layout.gutter, gap: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: layout.gutter,
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryName: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  details: { padding: 0, gap: 0 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailValue: { flex: 1, textAlign: 'right' },
  actions: { gap: spacing.md },
});
