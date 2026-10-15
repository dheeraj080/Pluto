/**
 * "Today's rate": the one-line companion to the Pair.
 *
 * A single figure — 1 base = X second, with its source and date — so a
 * dual-currency user can read the rate at a glance. The converter and the rate
 * history are tools, not a glance item, so they live elsewhere.
 *
 * Renders nothing until the user has chosen both currencies, which keeps the
 * dashboard free of a "choose currencies" invitation competing with the rest.
 */

import { Text } from 'react-native';

import { DashboardCard } from '@/components/dashboard/card';
import { tabularNums, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { rateBetween, type RateSnapshot } from '@/lib/convert';
import { formatAsOf } from '@/lib/format';

export function RateLine({
  base,
  second,
  snapshot,
  loading,
}: {
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  loading: boolean;
}) {
  const theme = useTheme();

  if (!base || !second) return null;

  const rate = snapshot ? rateBetween(base, second, snapshot.rates) : null;

  return (
    <DashboardCard
      title="Today's rate"
      skeletonHeight={56}
      loading={loading && !snapshot}
      action={
        snapshot ? (
          <Text style={[text.caption, { color: theme.muted }]}>
            {snapshot.provider}, {formatAsOf(snapshot.effectiveDate)}
          </Text>
        ) : undefined
      }
    >
      <Text style={[text.bodyMedium, { color: theme.ink }]}>
        1 {base} ={' '}
        <Text style={[text.bodyMedium, tabularNums, { color: theme.primary }]}>
          {rate == null ? '—' : rateDigits(rate)}
        </Text>{' '}
        {second}
      </Text>
    </DashboardCard>
  );
}

/** Two decimals for a large quote, four for a small one. */
function rateDigits(rate: number): string {
  return rate.toFixed(rate >= 100 ? 2 : 4);
}
