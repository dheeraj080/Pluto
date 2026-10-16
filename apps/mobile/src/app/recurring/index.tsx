/**
 * Recurring expenses.
 *
 * Two things live here, and the split is the whole idea: *rules* describe a
 * cadence, and *pending occurrences* are the charges those rules have produced
 * and are waiting for a decision. Nothing is posted until the user confirms, so
 * this screen is the only place a repeating charge becomes real money.
 *
 * The rules list uses the same card-and-row language as Budgets; each row opens
 * the add/edit sheet. Delete is confirmed here rather than in the sheet, matching
 * the budgets screen.
 */

import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { DashboardCard } from '@/components/dashboard/card';
import { OccurrenceRow } from '@/components/recurring/occurrence-row';
import { RecurringRow } from '@/components/recurring/recurring-row';
import { RecurringSheet } from '@/components/sheets/recurring-sheet';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconCheck, IconPlus } from '@/components/icons';
import { layout, spacing } from '@/theme';
import {
  useConfirmAllOccurrences,
  useConfirmOccurrence,
  useDeleteRecurring,
  useOccurrences,
  useRecurringRules,
  useSkipOccurrence,
  type RecurringExpense,
} from '@/hooks/use-recurring';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';

export default function RecurringScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const rules = useRecurringRules();
  const pending = useOccurrences('PENDING', 100);
  const confirmOne = useConfirmOccurrence();
  const skip = useSkipOccurrence();
  const confirmAll = useConfirmAllOccurrences();
  const remove = useDeleteRecurring();
  const { confirm, sheet: confirmSheet } = useConfirm();

  const [sheet, setSheet] = useState<{ target: RecurringExpense | null } | null>(null);

  const openCreate = useCallback(() => setSheet({ target: null }), []);
  const openEdit = useCallback((target: RecurringExpense) => setSheet({ target }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const confirmDelete = useCallback(
    async (rule: RecurringExpense) => {
      const decided = await confirm({
        title: 'Delete this recurring expense?',
        message:
          'Its pending occurrences are removed. Expenses already recorded from it are kept in Activity.',
        confirmLabel: 'Delete',
      });
      if (decided) remove.mutate(rule.id);
    },
    [confirm, remove],
  );

  const onRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all });
  }, [queryClient]);

  const onConfirmOne = useCallback(
    async (id: string) => {
      const decided = await confirm({
        title: 'Record this expense?',
        message: 'This posts the occurrence to Activity for the amount shown.',
        confirmLabel: 'Record',
        tone: 'primary',
      });
      if (decided) confirmOne.mutate(id);
    },
    [confirm, confirmOne],
  );

  const pendingItems = pending.data?.items ?? [];
  const ruleItems = rules.data ?? [];
  const refreshing = rules.isFetching || pending.isFetching;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <AppPageHeader title="Recurring" subtitle="Repeat an expense and confirm it when it falls due.">
          <Button
            label="Add recurring"
            size="sm"
            icon={(color) => <IconPlus size={16} color={color} />}
            onPress={openCreate}
          />
        </AppPageHeader>

        {pending.isError ? (
          <ErrorNote message={errorMessage(pending.error) ?? 'Could not load occurrences.'} />
        ) : null}
        {rules.isError ? (
          <ErrorNote message={errorMessage(rules.error) ?? 'Could not load recurring expenses.'} />
        ) : null}

        <DashboardCard
          title="Due now"
          subtitle="Confirm to record the expense, or skip it."
          action={
            pendingItems.length > 1 ? (
              <Button
                label="Confirm all"
                size="sm"
                variant="secondary"
                icon={(color) => <IconCheck size={14} color={color} />}
                onPress={() => confirmAll.mutate(undefined)}
                busy={confirmAll.isPending}
              />
            ) : null
          }
          loading={pending.isPending}
          skeletonHeight={120}
          isEmpty={!pending.isError && pendingItems.length === 0}
          empty={
            <EmptyState
              title="Nothing due"
              message="Occurrences appear here on each rule's schedule. Nothing is posted until you confirm it."
            />
          }
        >
          {pendingItems.map((occurrence, index) => (
            <View key={occurrence.id}>
              {index > 0 ? <Divider /> : null}
              <OccurrenceRow
                occurrence={occurrence}
                onConfirm={() => void onConfirmOne(occurrence.id)}
                onSkip={() => skip.mutate(occurrence.id)}
                busy={
                  (confirmOne.isPending && confirmOne.variables === occurrence.id) ||
                  (skip.isPending && skip.variables === occurrence.id)
                }
              />
            </View>
          ))}
        </DashboardCard>

        {confirmOne.isError ? (
          <ErrorNote message={errorMessage(confirmOne.error) ?? 'Could not record the expense.'} />
        ) : null}
        {skip.isError ? (
          <ErrorNote message={errorMessage(skip.error) ?? 'Could not skip the occurrence.'} />
        ) : null}
        {confirmAll.isError ? (
          <ErrorNote message={errorMessage(confirmAll.error) ?? 'Could not record the expenses.'} />
        ) : null}

        <DashboardCard
          title="Rules"
          loading={rules.isPending}
          skeletonHeight={160}
          isEmpty={!rules.isError && ruleItems.length === 0}
          empty={
            <EmptyState
              title="No recurring expenses"
              message="Add one to repeat a charge weekly, monthly or yearly."
            >
              <Button
                label="Add recurring"
                size="sm"
                icon={(color) => <IconPlus size={16} color={color} />}
                onPress={openCreate}
              />
            </EmptyState>
          }
        >
          {ruleItems.map((rule, index) => (
            <View key={rule.id}>
              {index > 0 ? <Divider /> : null}
              <RecurringRow
                rule={rule}
                onEdit={() => openEdit(rule)}
                onRemove={() => void confirmDelete(rule)}
                busy={remove.isPending && remove.variables === rule.id}
              />
            </View>
          ))}
        </DashboardCard>

        {remove.isError ? (
          <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the recurring expense.'} />
        ) : null}
      </ScrollView>

      {sheet ? <RecurringSheet target={sheet.target} onClose={closeSheet} /> : null}
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
