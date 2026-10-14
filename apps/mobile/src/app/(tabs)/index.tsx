import { router } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ExpenseRow, ExpenseRowDivider } from '@/components/expense-row';
import { IconPlus } from '@/components/icons';
import { Wordmark } from '@/components/logo';
import { SummaryCard } from '@/components/summary-card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { layout, spacing, text } from '@/theme';
import { useExpenseList, useExpenseSummary } from '@/hooks/use-expenses';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { expenseHref } from '@/lib/routes';

/** Enough to recognise the month at a glance; the full list is one tap away. */
const RECENT_COUNT = 5;

export default function OverviewScreen() {
  const { user } = useSession();
  const theme = useTheme();
  const list = useExpenseList({ sort: 'date_desc' });
  const summary = useExpenseSummary({});

  const refreshing = list.isRefetching || summary.isRefetching;
  const error = list.error ?? summary.error;

  const onRefresh = useCallback(() => {
    void list.refetch();
    void summary.refetch();
  }, [list, summary]);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Wordmark size={26} />
        <Text numberOfLines={1} style={[text.caption, styles.greeting, { color: theme.muted }]}>
          {user?.name ?? user?.email ?? ''}
        </Text>
      </View>

      <FlatList
        data={list.items.slice(0, RECENT_COUNT)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={ExpenseRowDivider}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(expenseHref(item.id))}>
            <ExpenseRow expense={item} />
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <SummaryCard summary={summary.data ?? null} loading={summary.isPending} />

            <Button
              label="Add expense"
              icon={(color) => <IconPlus size={18} color={color} />}
              onPress={() => router.push('/expense/new')}
            />

            <View style={styles.sectionRow}>
              <Text style={[text.overline, { color: theme.muted }]}>RECENT</Text>
              {list.total > 0 ? (
                <Pressable hitSlop={8} onPress={() => router.push('/transactions')}>
                  <Text style={[text.link, { color: theme.primary }]}>
                    See all {list.total}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <Spinner size="large" style={styles.placeholder} />
          ) : error ? (
            <ErrorNote message={errorMessage(error) ?? 'Could not load expenses.'} />
          ) : (
            <EmptyState
              title="No expenses yet"
              message="Add your first expense to see it here."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  greeting: { flex: 1, textAlign: 'right' },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  placeholder: { marginTop: spacing.xxl },
});
