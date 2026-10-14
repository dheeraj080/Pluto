import { router } from 'expo-router';
import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ExpenseForm, type ExpenseDraft } from '@/components/expense-form';
import { layout, spacing } from '@/theme';
import { useCreateExpense } from '@/hooks/use-expense-mutations';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

export default function NewExpenseScreen() {
  const { user } = useSession();
  const theme = useTheme();
  const create = useCreateExpense();

  const onSubmit = useCallback(
    (draft: ExpenseDraft) => {
      // The form's draft is exactly `CreateExpenseDto`.
      create.mutate(draft, { onSuccess: () => router.back() });
    },
    [create],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ExpenseForm
            submitLabel="Save expense"
            onSubmit={onSubmit}
            busy={create.isPending}
            submitError={errorMessage(create.error)}
            defaultCurrency={user?.baseCurrency ?? 'USD'}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: layout.gutter, paddingBottom: spacing.huge },
});
