import { Link, router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useExpenseList, useExpenseSummary } from '@/hooks/use-expenses';
import { useSession } from '@/hooks/use-session';
import { errorMessage } from '@/lib/errors';
import { expenseHref } from '@/lib/routes';

/** Enough to recognise the month at a glance; the full list is one tap away. */
const RECENT_COUNT = 5;

export default function OverviewScreen() {
  const { user } = useSession();
  const list = useExpenseList({ sort: 'date_desc' });
  const summary = useExpenseSummary({});

  const refreshing = list.isRefetching || summary.isRefetching;
  const error = list.error ?? summary.error;

  const onRefresh = useCallback(() => {
    void list.refetch();
    void summary.refetch();
  }, [list, summary]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={list.items.slice(0, RECENT_COUNT)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.greeting}>
              <ThemedText type="small" themeColor="textSecondary">
                Signed in as
              </ThemedText>
              <ThemedText type="smallBold" numberOfLines={1}>
                {user?.name ?? user?.email ?? 'Pluto user'}
              </ThemedText>
            </View>

            <SummaryCard summary={summary.data ?? null} loading={summary.isPending} />

            <Button label="Add expense" onPress={() => router.push('/expense/new')} />

            <View style={styles.sectionRow}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                RECENT
              </ThemedText>
              {list.total > 0 ? (
                <Link href="/transactions" asChild>
                  <Pressable hitSlop={8}>
                    <ThemedText type="link">See all {list.total}</ThemedText>
                  </Pressable>
                </Link>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <ActivityIndicator style={styles.placeholder} />
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.placeholder}>
              {errorMessage(error) ?? 'No expenses yet.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(expenseHref(item.id))}>
            <ExpenseRow expense={item} />
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.three + BottomTabInset,
    gap: Spacing.two,
  },
  header: { gap: Spacing.three },
  greeting: { gap: Spacing.half },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  placeholder: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
