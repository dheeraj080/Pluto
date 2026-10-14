import { Redirect, router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useExpenses } from '@/hooks/use-expenses';
import { useSession } from '@/hooks/use-session';
import { signOut } from '@/lib/api';

export default function HomeScreen() {
  const { status, user } = useSession();
  const { expenses, summary, loading, refreshing, error, reload } = useExpenses();

  const onSignOut = useCallback(async () => {
    await signOut();
    router.replace('/sign-in');
  }, []);

  if (status === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (status === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={expenses?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={reload}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <ThemedText type="small" themeColor="textSecondary">
                  Signed in as
                </ThemedText>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {user?.name ?? user?.email ?? 'Pluto user'}
                </ThemedText>
              </View>
              <Pressable onPress={onSignOut} hitSlop={8}>
                <ThemedText type="link">Sign out</ThemedText>
              </Pressable>
            </View>
            <SummaryCard summary={summary} loading={loading} />
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {error ?? 'No expenses yet.'}
            </ThemedText>
          )
        }
        renderItem={({ item }) => <ExpenseRow expense={item} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
