/**
 * One budget: what it applies to, how much of it is used, and the track.
 *
 * The figures use the app's one two-currency order: `DualAmount` leads with the
 * non-home amount and tucks the home currency beneath, and `InlineAmounts` keeps
 * the remaining/limit prose in the same pair. Tapping the row opens the matching
 * expenses in Activity; the actions sit below the tap target so reaching for
 * Remove never fires a navigation.
 *
 * The bar is two flex children rather than a percentage width — React Native's
 * `DimensionValue` does not accept a computed string, and flex ratios are exact
 * here because the only other child is the remainder.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DualAmount, InlineAmounts } from '@/components/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@/components/icons';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { summaryAmounts } from '@/lib/convert';
import { formatPercent } from '@/lib/format';
import type { BudgetStatus } from '@/hooks/use-budgets';

export function BudgetRow({
  item,
  baseCurrency,
  secondCurrency,
  onOpen,
  onEdit,
  onRemove,
  busy,
}: {
  item: BudgetStatus;
  baseCurrency: string;
  secondCurrency: string | null;
  /** Open the expenses this budget applies to, in Activity. */
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
  /** True while this row's delete is in flight. */
  busy: boolean;
}) {
  const theme = useTheme();

  const filled = Math.min(100, Math.max(0, item.percentage));
  const over = item.overBudget;
  const secondSpent = item.secondarySpent ?? null;
  const secondLimit = item.secondaryBudgetAmount ?? null;
  const secondRemaining = item.secondaryRemaining ?? null;

  // Spent leads with the Second and shows the Home equivalent beneath, matching
  // every other money figure in the app.
  const spentPair = summaryAmounts(item.spent, baseCurrency, secondSpent, secondCurrency);

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.categoryName ?? 'All expenses'} budget — show expenses`}
        onPress={onOpen}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <View style={styles.info}>
            <View style={styles.title}>
              {item.color ? <View style={[styles.dot, { backgroundColor: item.color }]} /> : null}
              <Text numberOfLines={1} style={[text.bodyMedium, styles.name, { color: theme.ink }]}>
                {item.categoryName ?? 'All expenses'}
              </Text>
              <Text style={[text.caption, { color: theme.muted }]}>
                {item.period === 'MONTHLY' ? 'monthly' : 'yearly'}
              </Text>
            </View>

            <View style={styles.tags}>
              {!item.applied ? <Badge label="not yet active" /> : null}
              {over ? <Badge label="over budget" tone="warning" /> : null}
              {item.ratePolicy === 'estimate' ? <Badge label="estimated" /> : null}
              {item.conversionStatus === 'unavailable' ? (
                <Badge label="rates unavailable" tone="warning" />
              ) : null}
            </View>

            <Text style={[text.caption, { color: theme.muted }]}>
              <InlineAmounts
                homeAmount={Math.abs(item.remaining)}
                homeCurrency={baseCurrency}
                secondAmount={secondRemaining != null ? Math.abs(secondRemaining) : null}
                secondCurrency={secondCurrency}
                textStyle={text.caption}
                primaryColor={over ? theme.warning : undefined}
              />
              {` ${over ? 'over' : 'left'} · ${formatPercent(item.percentage)} used`}
            </Text>
          </View>

          <View style={styles.amount}>
            {spentPair ? (
              <DualAmount
                {...spentPair}
                size="sm"
                layout="stack"
                align="right"
                tone={over ? 'warning' : 'ink'}
              />
            ) : null}
            <Text style={[text.caption, { color: theme.muted }]}>
              {'of '}
              <InlineAmounts
                homeAmount={item.budgetAmount}
                homeCurrency={baseCurrency}
                secondAmount={secondLimit}
                secondCurrency={secondCurrency}
                textStyle={text.caption}
                primaryColor={theme.muted}
              />
            </Text>
          </View>
        </View>

        <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
          <View
            style={[
              styles.fill,
              { flexGrow: filled, backgroundColor: over ? theme.warning : theme.primary },
            ]}
          />
          <View style={{ flexGrow: 100 - filled }} />
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Button
          label="Edit"
          variant="ghost"
          size="sm"
          icon={(color) => <IconEdit size={14} color={color} />}
          onPress={onEdit}
        />
        <Button
          label="Remove"
          variant="ghost"
          size="sm"
          icon={(color) => <IconTrash size={14} color={color} />}
          onPress={onRemove}
          busy={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  open: { gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info: { flex: 1, gap: spacing.xs },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  amount: { flexShrink: 0, alignItems: 'flex-end', gap: spacing.xs / 2 },
  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.pill },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  pressed: { opacity: 0.7 },
});
