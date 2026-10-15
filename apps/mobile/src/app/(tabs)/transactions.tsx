import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { layout, spacing, text } from '@/theme';
import { useCategories } from '@/hooks/use-categories';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useExpenseList } from '@/hooks/use-expenses';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { expenseHref } from '@/lib/routes';
import { SORT_OPTIONS, type ExpenseSort } from '@/lib/query-keys';

/**
 * The expense list: debounced search, sort, and a category filter.
 *
 * Filters live in the list header so they scroll away with the content, and rows
 * are separated by hairlines rather than boxed individually — a column of cards
 * reads as a stack of objects, which is not what a ledger is.
 */
export default function ActivityScreen() {
  const theme = useTheme();

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
  const { base, second } = usePair();
  const snapshot = useRateSnapshot(base);

  const hasFilters = Boolean(debouncedSearch.trim()) || categoryId !== null;

  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryId(null);
  }, []);

  const countLabel = list.isPending
    ? 'Loading…'
    : `${list.total} ${list.total === 1 ? 'expense' : 'expenses'}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(expenseHref(item.id))}>
            <ExpenseRow expense={item} home={base} second={second} snapshot={snapshot.data ?? null} />
          </Pressable>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppPageHeader title="Activity" subtitle={countLabel} />

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
              <Text style={[text.overline, { color: theme.muted }]}>SORT</Text>
              <Select
                accessibilityLabel="Sort"
                value={sort}
                onChange={(value) => setSort(value as ExpenseSort)}
                options={SORT_OPTIONS}
              />
            </View>

            {categories.data?.length ? (
              <View style={styles.group}>
                <Text style={[text.overline, { color: theme.muted }]}>CATEGORY</Text>
                <Select
                  accessibilityLabel="Category filter"
                  value={categoryId ?? ''}
                  onChange={(value) => setCategoryId(value === '' ? null : value)}
                  options={[
                    { value: '', label: 'All categories' },
                    ...categories.data.map((category) => ({
                      value: category.id,
                      label: category.name,
                      dotColor: category.color,
                    })),
                  ]}
                />
              </View>
            ) : null}

            {hasFilters ? (
              <Pressable onPress={clearFilters} hitSlop={8} style={styles.clear}>
                <Text style={[text.link, { color: theme.primary }]}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <Spinner size="large" style={styles.placeholder} />
          ) : list.isError ? (
            <ErrorNote message={errorMessage(list.error) ?? 'Could not load expenses.'} />
          ) : (
            <EmptyState
              title={hasFilters ? 'Nothing matches' : 'No expenses yet'}
              message={
                hasFilters
                  ? 'Try a different search, or clear the filters.'
                  : 'Add your first expense to start tracking.'
              }
            />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <Spinner style={styles.footer} />
          ) : list.isError && list.items.length > 0 ? (
            <ErrorNote
              message={errorMessage(list.error) ?? 'Could not load more.'}
              style={styles.footer}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  group: { gap: spacing.sm },
  clear: { alignSelf: 'flex-start' },
  placeholder: { marginTop: spacing.xxl },
  footer: { marginTop: spacing.lg },
});
