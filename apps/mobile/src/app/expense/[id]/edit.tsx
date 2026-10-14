import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ExpenseForm, type ExpenseDraft } from '@/components/expense-form';
import { Button } from '@/components/ui/button';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { layout, spacing } from '@/theme';
import { useExpense } from '@/hooks/use-expense';
import { useUpdateExpense } from '@/hooks/use-expense-mutations';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
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

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: layout.gutter,
  },
  content: { padding: layout.gutter, paddingBottom: spacing.huge },
});
