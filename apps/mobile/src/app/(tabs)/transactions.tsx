import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useExpenseList } from '@/hooks/use-expenses';
import { SORT_OPTIONS, type ExpenseSort } from '@/lib/query-keys';
import { errorMessage } from '@/lib/errors';
import { expenseHref } from '@/lib/routes';

export default function TransactionsScreen() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ExpenseSort>('date_desc');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Typing must not fire a request per keystroke, and a stable key means the
  // values between keystrokes never become cache entries of their own.
  const debouncedSearch = useDebouncedValue(search);

  const filters = useMemo(
    () => ({
      sort,
      search: debouncedSearch.trim() || undefined,
      categoryId: categoryId ?? undefined,
    }),
    [sort, debouncedSearch, categoryId],
  );

  const list = useExpenseList(filters);
  const categories = useCategories();

  const hasFilters = Boolean(categoryId) || search.trim().length > 0;

  const onEndReached = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  }, [list]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryId(null);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshing={list.isRefetching}
        onRefresh={() => void list.refetch()}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              label="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Description"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={100}
            />

            <View style={styles.group}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Sort
              </ThemedText>
              <View style={styles.wrapRow}>
                {SORT_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={option.value === sort}
                    onPress={() => setSort(option.value)}
                  />
                ))}
              </View>
            </View>

            {categories.data?.length ? (
              <View style={styles.group}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Category
                </ThemedText>
                {/* Horizontal rather than wrapped: the list is user-grown. */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  <Chip
                    label="All"
                    selected={categoryId === null}
                    onPress={() => setCategoryId(null)}
                  />
                  {categories.data.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      dotColor={category.color}
                      selected={category.id === categoryId}
                      // Tapping the active category removes the filter.
                      onPress={() =>
                        setCategoryId((current) =>
                          current === category.id ? null : category.id,
                        )
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.countRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {list.isPending
                  ? 'Loading…'
                  : `${list.total} ${list.total === 1 ? 'expense' : 'expenses'}`}
              </ThemedText>
              {hasFilters ? (
                <Pressable onPress={clearFilters} hitSlop={8}>
                  <ThemedText type="link">Clear filters</ThemedText>
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
              {errorMessage(list.error) ??
                (hasFilters ? 'Nothing matches these filters.' : 'No expenses yet.')}
            </ThemedText>
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} />
          ) : list.isError && list.items.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
              {errorMessage(list.error)}
            </ThemedText>
          ) : null
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
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: { gap: Spacing.three, paddingBottom: Spacing.two },
  group: { gap: Spacing.two },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipRow: { gap: Spacing.two, paddingRight: Spacing.four },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  placeholder: { textAlign: 'center', paddingVertical: Spacing.five },
  footer: { paddingVertical: Spacing.three },
});
