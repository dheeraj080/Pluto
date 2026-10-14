import { router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/logo';
import { layout, spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { useExpenseList, useExpenseSummary } from '@/hooks/use-expenses';
import { useSession } from '@/hooks/use-session';
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
    <ThemedView style={styles.container}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Wordmark size={28} />
        <View style={styles.greeting}>
          <ThemedText type="small" themeColor="textSecondary">
            Signed in as
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {user?.name ?? user?.email ?? 'Pluto user'}
          </ThemedText>
        </View>
      </View>

      <FlatList
        data={list.items.slice(0, RECENT_COUNT)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <SummaryCard summary={summary.data ?? null} loading={summary.isPending} />

            <Button label="Add expense" onPress={() => router.push('/expense/new')} />

            <View style={styles.sectionRow}>
              <ThemedText type="overline">RECENT</ThemedText>
              {list.total > 0 ? (
                <Pressable hitSlop={8} onPress={() => router.push('/transactions')}>
                  <ThemedText type="link" themeColor="textPrimary">
                    See all {list.total}
                  </ThemedText>
                </Pressable>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
    gap: spacing.md,
  },
  header: { gap: spacing.md },
  greeting: { flex: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  placeholder: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});