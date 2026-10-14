import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { ExpenseForm, type ExpenseDraft } from '@/components/expense-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useExpense } from '@/hooks/use-expense';
import { useUpdateExpense } from '@/hooks/use-expense-mutations';
import { errorMessage } from '@/lib/errors';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expense = useExpense(id);
  const update = useUpdateExpense();

  const onSubmit = useCallback(
    (draft: ExpenseDraft) => {
      if (!id) return;
      update.mutate({ id, body: draft }, { onSuccess: () => router.back() });
    },
    [id, update],
  );

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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/*
            The form seeds its state from `initial` once, so it must not mount
            until the expense has arrived — hence the loading gate above.
          */}
          <ExpenseForm
            key={item.id}
            initial={{
              amount: item.amount,
              currency: item.currency,
              categoryId: item.categoryId,
              incurredOn: item.incurredOn,
              description: item.description ?? '',
              paymentMethod: item.paymentMethod ?? '',
            }}
            submitLabel="Save changes"
            onSubmit={onSubmit}
            busy={update.isPending}
            submitError={errorMessage(update.error)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
});
