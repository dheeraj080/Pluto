/**
 * Budgets.
 *
 * Limits per category or for the whole account, and how the evaluated month is
 * tracking against each one. The month is a compact stepper in the header, the
 * list is a single card, and adding or editing happens in a bottom sheet — so
 * the screen is the budgets themselves rather than a permanently-open form.
 *
 * Progress is a thin mint line that turns soft amber when a budget is exceeded —
 * never red, because going over a budget is information, not an error.
 *
 * One request covers every row: the status payload carries each budget's id, so
 * this screen never fetches the budget list as well.
 */

import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { BudgetRow } from '@/components/budgets/budget-row';
import { DashboardCard } from '@/components/dashboard/card';
import { BudgetSheet } from '@/components/sheets/budget-sheet';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { ConversionNote } from '@/components/ui/conversion-note';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote } from '@/components/ui/feedback';
import { MonthStepper } from '@/components/ui/month-stepper';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconPlus } from '@/components/icons';
import { layout, spacing } from '@/theme';
import { useBudgetStatus, useDeleteBudget, type BudgetStatus } from '@/hooks/use-budgets';
import { usePair } from '@/hooks/use-pair';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { currentMonth, formatMonth } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { monthEndIso, shiftMonth } from '@/lib/ranges';
import { activityHref } from '@/lib/routes';

export default function BudgetsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { base, second } = usePair();

  const [month, setMonth] = useState(currentMonth());
  const [sheet, setSheet] = useState<{ target: BudgetStatus | null } | null>(null);

  const status = useBudgetStatus({
    month,
    base: base ?? undefined,
    secondary: second ?? undefined,
  });
  const remove = useDeleteBudget();
  const { confirm, sheet: confirmSheet } = useConfirm();

  const items = status.data?.items ?? [];
  const baseCurrency = status.data?.baseCurrency ?? base ?? 'USD';
  const secondCurrency = status.data?.secondaryCurrency ?? second;

  const overCount = items.filter((item) => item.overBudget).length;
  const countLine =
    items.length === 0
      ? null
      : `${items.length} ${items.length === 1 ? 'budget' : 'budgets'}${
          overCount > 0 ? ` · ${overCount} over budget` : ''
        }`;
  const subtitle = countLine ? `${formatMonth(month)} · ${countLine}` : formatMonth(month);

  const openCreate = useCallback(() => setSheet({ target: null }), []);
  const openEdit = useCallback((item: BudgetStatus) => setSheet({ target: item }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const openExpenses = useCallback(
    (item: BudgetStatus) => {
      router.push(
        activityHref({
          categoryId: item.categoryId ?? undefined,
          from: `${month}-01`,
          to: monthEndIso(month),
        }),
      );
    },
    [month],
  );

  const confirmDelete = useCallback(
    (item: BudgetStatus) => {
      const label = item.categoryName ?? 'all expenses';
      void confirm({
        title: `Delete the budget for ${label}?`,
        message: 'The expenses behind it are not affected.',
        confirmLabel: 'Delete',
      }).then((confirmed) => {
        if (confirmed) remove.mutate(item.budgetId);
      });
    },
    [confirm, remove],
  );

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
  }, [queryClient]);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={status.isFetching}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <AppPageHeader title="Budgets" subtitle="Limits and what's left this month.">
          <MonthStepper
            label={formatMonth(month)}
            onPrevious={() => setMonth((value) => shiftMonth(value, -1))}
            onNext={() => setMonth((value) => shiftMonth(value, 1))}
          />

          <Button
            label="Add budget"
            size="sm"
            icon={(color) => <IconPlus size={16} color={color} />}
            onPress={openCreate}
          />
        </AppPageHeader>

        <ConversionNote
          status={status.data?.conversionStatus}
          unconvertedCurrencies={status.data?.unconvertedCurrencies ?? []}
        />
        {status.isError ? (
          <ErrorNote message={errorMessage(status.error) ?? 'Could not load budgets.'} />
        ) : null}

        <DashboardCard
          title="Progress"
          subtitle={subtitle}
          loading={status.isPending}
          skeletonHeight={200}
          isEmpty={!status.isError && items.length === 0}
          empty={
            <EmptyState
              title="No budgets yet"
              message="Add a budget to start tracking spending against a limit."
            >
              <Button
                label="Add budget"
                size="sm"
                icon={(color) => <IconPlus size={16} color={color} />}
                onPress={openCreate}
              />
            </EmptyState>
          }
        >
          {items.map((item, index) => (
            <View key={item.budgetId}>
              {index > 0 ? <Divider /> : null}
              <BudgetRow
                item={item}
                baseCurrency={baseCurrency}
                secondCurrency={secondCurrency}
                onOpen={() => openExpenses(item)}
                onEdit={() => openEdit(item)}
                onRemove={() => confirmDelete(item)}
                busy={remove.isPending && remove.variables === item.budgetId}
              />
            </View>
          ))}
        </DashboardCard>

        {remove.isError ? (
          <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the budget.'} />
        ) : null}
      </ScrollView>

      {sheet ? <BudgetSheet target={sheet.target} onClose={closeSheet} /> : null}
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
