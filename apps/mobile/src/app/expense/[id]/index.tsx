import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useExpense } from '@/hooks/use-expense';
import { useDeleteExpense } from '@/hooks/use-expense-mutations';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import { editExpenseHref } from '@/lib/routes';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expense = useExpense(id);
  const remove = useDeleteExpense();

  const onDelete = useCallback(() => {
    const target = expense.data;
    if (!target) return;

    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(target.id, {
            // The list already dropped this row from its cache, so returning
            // to it shows the deletion without a manual refresh.
            onSuccess: () => router.back(),
          }),
      },
    ]);
  }, [expense.data, remove]);

  if (expense.isPending) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!expense.data) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">
          {errorMessage(expense.error) ?? 'Expense not found.'}
        </ThemedText>
        <Button label="Retry" variant="secondary" onPress={() => void expense.refetch()} />
      </ThemedView>
    );
  }

  const item = expense.data;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.amountBlock}>
          <View style={[styles.dot, { backgroundColor: item.categoryColor }]} />
          <ThemedText type="subtitle">{formatMoney(item.amount, item.currency)}</ThemedText>
        </View>

        <View style={styles.card}>
          <DetailRow label="Category" value={item.categoryName} />
          <DetailRow label="Date" value={formatDate(item.incurredOn)} />
          <DetailRow label="Payment method" value={item.paymentMethod ?? '—'} />
          <DetailRow label="Description" value={item.description ?? '—'} />
        </View>

        {remove.isError ? (
          <ThemedText type="small" themeColor="danger">
            {errorMessage(remove.error)}
          </ThemedText>
        ) : null}

        <Button label="Edit" onPress={() => router.push(editExpenseHref(item.id))} />
        <Button label="Delete" variant="danger" onPress={onDelete} busy={remove.isPending} />
      </ScrollView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  amountBlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  card: { gap: Spacing.three },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  detailValue: { flex: 1, textAlign: 'right' },
});
