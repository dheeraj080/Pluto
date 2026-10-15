/**
 * Two-currency money display.
 *
 * Every money value is shown as a large primary figure with a smaller muted
 * companion beside or below it, in the app's one display order: the non-home
 * currency leads and the home currency sits beneath it. An expense row leads
 * with the currency it was recorded in; a summary leads with the Second. The
 * recorded amount is never rewritten.
 *
 * Presentation only: the caller decides which currency leads and which is the
 * companion, and supplies both amounts. Digits are always tabular so columns line
 * up and figures do not jump as values change.
 */

import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { fontSize, fontFamily, tabularNums, spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { summaryAmounts } from '@/lib/convert';
import { formatMoney } from '@/lib/format';

export type AmountSize = 'display' | 'hero' | 'kpi' | 'lg' | 'md' | 'sm';

/**
 * The primary figure.
 *
 * The web uses `font-light` for the display sizes; Inter is bundled in four
 * weights on mobile and none of them is light, so the regular cut stands in —
 * it reads the same at these sizes, where the large body does most of the work.
 */
const PRIMARY: Record<AmountSize, TextStyle> = {
  display: { fontFamily: fontFamily.sans.regular, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  hero: { fontFamily: fontFamily.sans.regular, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  kpi: { fontFamily: fontFamily.sans.regular, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  lg: { fontFamily: fontFamily.sans.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.6 },
  md: { fontFamily: fontFamily.sans.semibold, fontSize: fontSize.md, lineHeight: 22 },
  sm: { fontFamily: fontFamily.sans.semibold, fontSize: fontSize.sm, lineHeight: 20 },
};

const SECONDARY: Record<AmountSize, TextStyle> = {
  display: { fontFamily: fontFamily.sans.regular, fontSize: fontSize.lg, lineHeight: 26 },
  hero: { fontFamily: fontFamily.sans.regular, fontSize: fontSize.lg, lineHeight: 26 },
  kpi: { fontFamily: fontFamily.sans.regular, fontSize: fontSize.sm, lineHeight: 20 },
  lg: { fontFamily: fontFamily.sans.regular, fontSize: fontSize.sm, lineHeight: 20 },
  md: { fontFamily: fontFamily.sans.regular, fontSize: fontSize.xs, lineHeight: 16 },
  sm: { fontFamily: fontFamily.sans.regular, fontSize: fontSize.xs, lineHeight: 16 },
};

export function DualAmount({
  amount,
  currency,
  secondaryAmount,
  secondaryCurrency,
  size = 'md',
  layout = 'inline',
  align = 'left',
  /** Primary-figure colour: mint-adjacent ink by default, amber when exceeded. */
  tone = 'ink',
  style,
}: {
  /** Amount in the primary (large) currency. */
  amount: number;
  currency: string;
  /** Amount in the secondary (smaller, muted) currency; omit to show one value. */
  secondaryAmount?: number | null;
  secondaryCurrency?: string | null;
  size?: AmountSize;
  /** `inline` puts the companion beside the primary; `stack` puts it below. */
  layout?: 'inline' | 'stack';
  align?: 'left' | 'center' | 'right';
  tone?: 'ink' | 'warning';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const primaryColor = tone === 'warning' ? theme.warning : theme.ink;

  const showSecond = secondaryAmount != null && secondaryCurrency != null;
  const inline = layout === 'inline';
  const singleLine = size === 'md' || size === 'sm';

  return (
    <View style={[styles.wrap, ALIGN[align], style]}>
      <View style={[inline ? styles.inlineRow : styles.stack, ALIGN[align]]}>
        <Text
          numberOfLines={singleLine ? 1 : undefined}
          style={[PRIMARY[size], tabularNums, { color: primaryColor }]}
        >
          {formatMoney(amount, currency)}
        </Text>

        {showSecond ? (
          <Text
            numberOfLines={singleLine ? 1 : undefined}
            style={[SECONDARY[size], tabularNums, { color: theme.muted }]}
          >
            {inline ? '· ' : ''}
            {formatMoney(secondaryAmount, secondaryCurrency)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The two figures of a summary as inline text, for prose sentences: the
 * non-home (Second) currency in ink, the home currency in muted parentheses.
 *
 * Renders nothing when there is no figure to show, so a caller can drop it into
 * a sentence unconditionally.
 */
export function InlineAmounts({
  homeAmount,
  homeCurrency,
  secondAmount,
  secondCurrency,
  textStyle,
  primaryColor,
}: {
  homeAmount: number | null | undefined;
  homeCurrency: string | null | undefined;
  secondAmount: number | null | undefined;
  secondCurrency: string | null | undefined;
  textStyle?: StyleProp<TextStyle>;
  /** Overrides the primary figure's colour (e.g. the warning tone). */
  primaryColor?: string;
}) {
  const theme = useTheme();
  const pair = summaryAmounts(homeAmount, homeCurrency, secondAmount, secondCurrency);
  if (!pair) return null;

  return (
    <>
      <Text style={[textStyle, tabularNums, { color: primaryColor ?? theme.ink }]}>
        {formatMoney(pair.amount, pair.currency)}
      </Text>
      {pair.secondaryAmount != null && pair.secondaryCurrency ? (
        <Text style={[textStyle, tabularNums, { color: theme.muted }]}>
          {' '}
          ({formatMoney(pair.secondaryAmount, pair.secondaryCurrency)})
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs / 2 },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
  },
  stack: { flexDirection: 'column' },
});

const ALIGN: Record<'left' | 'center' | 'right', ViewStyle> = {
  left: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
};
