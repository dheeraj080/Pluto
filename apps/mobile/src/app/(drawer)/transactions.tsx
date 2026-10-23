import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import {
  DateRangeSheet,
  dateRangeForPreset,
  type ActivityDateRange,
} from '@/components/sheets/date-range-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { IconRefresh } from '@/components/icons';
import { layout, spacing, text } from '@/theme';
import { useCategories } from '@/hooks/use-categories';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useExpenseList } from '@/hooks/use-expenses';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useScreenPadding } from '@/hooks/use-screen-padding';
import { useTheme } from '@/hooks/use-theme';
import { groupExpensesByDate } from '@/lib/date-grouping';
import { errorMessage } from '@/lib/errors';
import { formatDateRange } from '@/lib/format';
import { SORT_OPTIONS, type ExpenseSort } from '@/lib/query-keys';
import { expenseHref, RECURRING } from '@/lib/routes';

/**
 * The expense list: debounced search, sort, and date/category filters.
 *
 * Rows are grouped by the day they were incurred, with sticky headers that read
 * "Today" / "Yesterday" / a formatted date. The default window is the current
 * calendar month (computed in local time), and the date chip opens a preset
 * sheet. Search and sort keep their existing controls; there is deliberately no
 * add button on this screen.
 */

function dateChipLabel(range: ActivityDateRange): string {
  switch (range.preset) {
    case 'this_month':
      return 'This month';
    case 'last_month':
      return 'Last month';
    case 'all_time':
      return 'All time';
    default:
      return range.from && range.to ? formatDateRange(range.from, range.to) : 'Date';
  }
}

export default function ActivityScreen() {
  const theme = useTheme();
  const screenPadding = useScreenPadding();
  const [now] = useState(() => new Date());

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ExpenseSort>('date_desc');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<ActivityDateRange>(() => dateRangeForPreset('this_month', now));
  const [currency, setCurrency] = useState<string | null>(null);

  // A Reports drill-down arrives as route params. Adjusting state during render
  // (React's recommended way to react to a changed prop/param) re-renders before
  // committing, so the list never briefly paints the previous filters — and an
  // edit the user then makes here is not reverted by a later render.
  const params = useLocalSearchParams<{
    categoryId?: string;
    currency?: string;
    from?: string;
    to?: string;
  }>();
  const drilldownKey = `${params.categoryId ?? ''}|${params.currency ?? ''}|${params.from ?? ''}|${params.to ?? ''}`;
  const [appliedDrilldown, setAppliedDrilldown] = useState<string | null>(null);
  if (drilldownKey !== appliedDrilldown) {
    setAppliedDrilldown(drilldownKey);
    if (params.categoryId) setCategoryId(params.categoryId);
    if (params.currency) setCurrency(params.currency);
    if (params.from && params.to) {
      setDateRange({ preset: 'custom', from: params.from, to: params.to });
    }
  }

  // Typing must not fire a request per keystroke, and a stable key means the
  // values between keystrokes never become cache entries of their own.
  const debouncedSearch = useDebouncedValue(search);
  const trimmedSearch = debouncedSearch.trim();

  const filters = useMemo(
    () => ({
      sort,
      search: trimmedSearch || undefined,
      categoryId: categoryId ?? undefined,
      currency: currency ?? undefined,
      from: dateRange.from,
      to: dateRange.to,
    }),
    [sort, trimmedSearch, categoryId, currency, dateRange],
  );

  const list = useExpenseList(filters);
  const categories = useCategories();
  const { base, second } = usePair();
  const snapshot = useRateSnapshot(base);

  // Group headers follow the date direction the sort implies ("Oldest" reads
  // oldest-first); the rows inside each group keep the active sort's order.
  const groupOrder = sort === 'date_asc' ? 'asc' : 'desc';
  const sections = useMemo(
    () => groupExpensesByDate(list.items, groupOrder),
    [list.items, groupOrder],
  );

  const activeCategory = useMemo(
    () => categories.data?.find((category) => category.id === categoryId) ?? null,
    [categories.data, categoryId],
  );

  // The default window is not a *filter* — only a narrower or wider one is.
  const hasFilters =
    Boolean(trimmedSearch) || categoryId !== null || currency !== null || dateRange.preset !== 'this_month';

  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryId(null);
    setCurrency(null);
    setDateRange(dateRangeForPreset('this_month', now));
  }, [now]);

  const dateLabel = dateChipLabel(dateRange);

  const countLabel = list.isPending
    ? 'Loading…'
    : `${list.total} ${list.total === 1 ? 'expense' : 'expenses'}`;

  const emptyCopy = useMemo(() => {
    if (trimmedSearch) {
      return {
        title: 'No matches',
        message: `Nothing matches “${trimmedSearch}”. Try a different search or clear the filters.`,
      };
    }
    if (currency) {
      return {
        title: `No ${currency} expenses`,
        message:
          dateRange.preset === 'all_time'
            ? 'Nothing has been paid in this currency yet.'
            : `Nothing was paid in ${currency} in ${dateLabel.toLowerCase()}.`,
      };
    }
    if (activeCategory) {
      return {
        title: `No ${activeCategory.name} expenses`,
        message:
          dateRange.preset === 'all_time'
            ? 'Nothing recorded in this category yet.'
            : `Nothing in ${dateLabel.toLowerCase()}. Try a wider date range or clear the filters.`,
      };
    }
    // No search and no category: whether the window is the default month or a
    // chosen preset, an empty list means this *date range* is empty — only "All
    // time" with no filters can honestly say there is nothing at all.
    if (dateRange.preset !== 'all_time') {
      return {
        title: `Nothing in ${dateLabel.toLowerCase()}`,
        message: hasFilters
          ? 'Try a wider date range, or clear the filters.'
          : 'Try a wider date range to see older expenses.',
      };
    }
    return {
      title: 'No expenses yet',
      message: 'Add your first expense to start tracking.',
    };
  }, [trimmedSearch, activeCategory, currency, dateRange.preset, dateLabel, hasFilters]);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, screenPadding]}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(expenseHref(item.id))}>
            <ExpenseRow expense={item} home={base} second={second} snapshot={snapshot.data ?? null} />
          </Pressable>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.canvas }]}>
            <Text style={[text.captionStrong, { color: theme.muted }]}>{title}</Text>
          </View>
        )}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={list.refetch}
            tintColor={theme.muted}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppPageHeader title="Activity" subtitle={countLabel}>
              <Button
                label="Recurring"
                size="sm"
                variant="secondary"
                icon={(color) => <IconRefresh size={15} color={color} />}
                onPress={() => router.push(RECURRING)}
              />
            </AppPageHeader>

            <TextField
              accessibilityLabel="Search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search descriptions"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              maxLength={100}
            />

            <View style={styles.filterRow}>
              <Chip
                label={dateLabel}
                selected={dateRange.preset !== 'this_month'}
                onPress={() => setDateSheetOpen(true)}
              />

              <Select
                variant="chip"
                active={sort !== 'date_desc'}
                accessibilityLabel="Sort"
                value={sort}
                onChange={(value) => setSort(value as ExpenseSort)}
                options={SORT_OPTIONS}
              />

              {categories.data?.length ? (
                <Select
                  variant="chip"
                  active={categoryId !== null}
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
              ) : null}

              {currency ? (
                <Chip label={`Paid in ${currency}`} selected onPress={() => setCurrency(null)} />
              ) : null}

              {hasFilters ? <Chip label="Clear filters" onPress={clearFilters} /> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <Spinner size="large" style={styles.placeholder} />
          ) : list.isError ? (
            <ErrorNote message={errorMessage(list.error) ?? 'Could not load expenses.'} />
          ) : (
            <EmptyState title={emptyCopy.title} message={emptyCopy.message} />
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
      <DateRangeSheet
        visible={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={dateRange}
        onApply={(next) => setDateRange(next)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionHeader: {
    // `paddingTop`, not `marginTop`: the sticky header's background must cover
    // the gap, or rows show through above it while it is pinned.
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: layout.gutter,
    marginHorizontal: -layout.gutter,
  },
  placeholder: { marginTop: spacing.xxl },
  footer: { marginTop: spacing.lg },
});