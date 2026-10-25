import { useCallback } from 'react';
import { View, StyleSheet, Text, SafeAreaView } from 'react-native';

import { useRouter } from 'expo-router';
import { useSession } from '@/hooks/use-session';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { usePair } from '@/hooks/use-pair';
import { useTheme } from '@/hooks/use-theme';
import { useCreateExpense } from '@/hooks/use-expense-mutations';

import { ExpenseForm, type ExpenseDraft } from '@/components/expense-form';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { writeOnboardingCompleted } from '@/lib/session-storage';
import { queryKeys } from '@/lib/query-keys';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ExpenseScreen() {
  const router = useRouter();
  const { status, user } = useSession();
  const currencies = useSupportedCurrencies();
  const { base, setBase } = usePair();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const createExpense = useCreateExpense();

  const onSubmit = useCallback(
    (draft: ExpenseDraft) => {
      createExpense.mutate(draft, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
          writeOnboardingCompleted(true);
          router.replace('/');
        },
      });
    },
    [createExpense, queryClient, router],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.ink }]}>
          Add your first expense
        </Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          Great — you&apos;re all set. Record your first purchase and Pluto will
          start tracking budgets and reports for you.
        </Text>

        <ExpenseForm
          submitLabel="Add expense"
          onSubmit={onSubmit}
          busy={createExpense.isPending}
          submitError={undefined}
        />

        <Button
          label="Add expense"
          onPress={() => onSubmit({} as ExpenseDraft)}
          disabled={createExpense.isPending}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: 'currentColor',
  },
  sub: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    color: 'currentColor',
  },
  button: {
    width: '100%',
    marginTop: 24,
  },
});