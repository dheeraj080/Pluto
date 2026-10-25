import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { CategoryRow } from '@/components/categories/category-row';
import { DashboardCard } from '@/components/dashboard/card';
import { CategorySheet } from '@/components/sheets/category-sheet';
import { ReassignCategorySheet } from '@/components/sheets/reassign-category-sheet';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconPlus } from '@/components/icons';
import { layout, spacing } from '@/theme';
import { useCategories, type ExpenseCategory } from '@/hooks/use-categories';
import { useDeleteCategory } from '@/hooks/use-category-mutations';
import { useScreenPadding } from '@/hooks/use-screen-padding';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { activityHref } from '@/lib/routes';

export default function CategoriesScreen() {
  const theme = useTheme();
  const screenPadding = useScreenPadding();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const remove = useDeleteCategory();
  const { confirm, sheet: confirmSheet } = useConfirm();

  const [sheet, setSheet] = useState<{ target: ExpenseCategory | null } | null>(null);
  const [reassign, setReassign] = useState<ExpenseCategory | null>(null);

  const items = categories.data ?? [];
  const totalExpenses = items.reduce(
    (sum: number, category: ExpenseCategory) => sum + (category.expenseCount ?? 0),
    0,
  );
  const countLine = `${items.length} ${
    items.length === 1 ? 'category' : 'categories'
  } · ${totalExpenses} ${totalExpenses === 1 ? 'expense' : 'expenses'}`;
  const subtitle = categories.isPending ? 'Loading…' : countLine;

  const openCreate = useCallback(() => setSheet({ target: null }), []);
  const openEdit = useCallback((category: ExpenseCategory) => setSheet({ target: category }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const openExpenses = useCallback(
    (category: ExpenseCategory) => router.push(activityHref({ categoryId: category.id })),
    [],
  );

  const confirmDelete = useCallback(
    (category: ExpenseCategory) => {
      if (category.expenseCount > 0) {
        // Show reassign sheet modally when category has expenses
        setReassign(category);
        return;
      }

      void confirm({
        title: `Delete “${category.name}”?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
      }).then((confirmed) => {
        if (confirmed) remove.mutate({ id: category.id });
      });
    },
    [confirm, remove, setReassign],
  );

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  }, [queryClient]);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, screenPadding]}
        refreshControl={
          <RefreshControl
            refreshing={categories.isFetching}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <AppPageHeader title="Categories" subtitle={subtitle}>
          <Button
            label="Add category"
            size="sm"
            icon={(color) => <IconPlus size={16} color={color} />}
            onPress={openCreate}
          />
        </AppPageHeader>

        {categories.isError ? (
          <ErrorNote message={errorMessage(categories.error) ?? 'Could not load categories.'} />
        ) : null}

        <DashboardCard
          title="Your categories"
          loading={categories.isPending}
          skeletonHeight={200}
          isEmpty={!categories.isError && items.length === 0}
          empty={
            <EmptyState
              title="No categories yet"
              message="Add one to start grouping expenses for reports and budgets."
            >
              <Button
                label="Add category"
                size="sm"
                icon={(color) => <IconPlus size={16} color={color} />}
                onPress={openCreate}
              />
            </EmptyState>
          }
        >
          {items.map((category, index) => (
            <View key={category.id}>
              {index > 0 ? <Divider /> : null}
              <CategoryRow
                category={category}
                onOpen={() => openExpenses(category)}
                onEdit={() => openEdit(category)}
                onDelete={() => confirmDelete(category)}
                deleteBusy={remove.isPending && remove.variables?.id === category.id}
              />
            </View>
          ))}
        </DashboardCard>

        {remove.isError ? (
          <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the category.'} />
        ) : null}
      </ScrollView>

      {sheet ? <CategorySheet target={sheet.target} onClose={closeSheet} /> : null}
      <ReassignCategorySheet
        visible={reassign !== null}
        source={reassign}
        categories={items}
        busy={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onClose={() => setReassign(null)}
        onConfirm={(targetId) => {
          if (reassign) {
            remove.mutate(
              { id: reassign.id, reassignTo: targetId },
              { onSuccess: () => setReassign(null) },
            );
          }
        }}
      />
      {confirmSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    gap: spacing.lg,
  },
});
