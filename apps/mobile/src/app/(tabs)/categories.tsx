/**
 * Categories — the web's "Tags" page.
 *
 * A category is a colour, a name and a count. The list is one card; creating
 * and renaming happen in a bottom sheet, so the screen is the categories
 * themselves rather than a permanently-open form. Tapping a row opens that
 * category's expenses in Activity, the same drill-down Budgets and the Reports
 * breakdown use.
 *
 * Delete is guarded in the client rather than by the server's 409: a category
 * still holding expenses cannot be removed, so the button explains why instead
 * of firing a request that can only fail.
 */

import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { CategoryRow } from '@/components/categories/category-row';
import { DashboardCard } from '@/components/dashboard/card';
import { CategorySheet } from '@/components/sheets/category-sheet';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconPlus } from '@/components/icons';
import { layout, spacing } from '@/theme';
import { useCategories, type ExpenseCategory } from '@/hooks/use-categories';
import { useDeleteCategory } from '@/hooks/use-category-mutations';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { activityHref } from '@/lib/routes';

export default function CategoriesScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const remove = useDeleteCategory();
  const { confirm, sheet: confirmSheet } = useConfirm();

  const [sheet, setSheet] = useState<{ target: ExpenseCategory | null } | null>(null);

  const items = categories.data ?? [];
  const totalExpenses = items.reduce((sum, category) => sum + category.expenseCount, 0);
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
      // A category still in use would only get a 409 from the server; say so up
      // front rather than firing a request that cannot succeed.
      if (category.expenseCount > 0) {
        void confirm({
          title: 'Category in use',
          message: `${category.expenseCount} ${
            category.expenseCount === 1 ? 'expense uses' : 'expenses use'
          } “${category.name}”. Reassign them before deleting.`,
          confirmLabel: 'OK',
          tone: 'primary',
          cancelable: false,
        });
        return;
      }

      void confirm({
        title: `Delete “${category.name}”?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
      }).then((confirmed) => {
        if (confirmed) remove.mutate(category.id);
      });
    },
    [confirm, remove],
  );

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  }, [queryClient]);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
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
                deleteBusy={remove.isPending && remove.variables === category.id}
              />
            </View>
          ))}
        </DashboardCard>

        {remove.isError ? (
          <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the category.'} />
        ) : null}
      </ScrollView>

      {sheet ? <CategorySheet target={sheet.target} onClose={closeSheet} /> : null}
      {confirmSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
    gap: spacing.lg,
  },
});
