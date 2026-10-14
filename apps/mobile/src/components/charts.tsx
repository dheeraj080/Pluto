/**
 * Charts, drawn directly with `react-native-svg`.
 *
 * The web app renders these with Recharts; React Native has no DOM, so mobile
 * draws the same shapes itself. The promise is unchanged — one mint line with a
 * soft gradient under it, a quieter dashed line for the comparison, no bars
 * from a generic library, no donuts, no saturated rainbow.
 *
 * Two deliberate differences from the web:
 *
 * - No hover tooltip. There is no pointer on a touch screen, so the figures a
 *   tooltip would reveal are stated in the card's own body instead of hidden
 *   behind a gesture nobody can perform.
 * - No `Table` toggle on the dashboard comparison card — the web passes
 *   `hideTableToggle` there too, so the two agree.
 *
 * The chart measures itself with `onLayout` rather than assuming a width, so a
 * phone, a tablet and a folded device all draw to their real bounds.
 */

import { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** One cumulative point per bucket, for the "this period vs the last one" chart. */
export interface ComparisonRow {
  /** Bucket key: `YYYY-MM-DD` for day/week, `YYYY-MM` for month. */
  key: string;
  current: number | null;
  previous: number | null;
  currentSecond?: number | null;
  previousSecond?: number | null;
}

/**
 * `12345` → `12.3k`, for an axis where the exact figure does not matter.
 *
 * The same thresholds as the web's `compactAxis`, so a tick reads identically
 * on both clients.
 */
export function compactAxis(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** Watches the container's width so the chart can size its own viewport. */
function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (Math.abs(current - next) < 0.5 ? current : next));
  }, []);
  return { width, onLayout };
}

interface Point {
  x: number;
  y: number;
}

/** An SVG path through the points, in order. */
function toPath(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

/** The same path closed to the baseline, for the gradient fill. */
function toAreaPath(points: Point[], baseline: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `M${first.x.toFixed(2)} ${baseline.toFixed(2)} ${toPath(points).slice(1)} L${last.x.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

/** At most one label every `MIN_TICK_GAP` px, always including the last. */
function tickIndices(count: number, plotWidth: number, minGap = 52): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  const capacity = Math.max(2, Math.floor(plotWidth / minGap));
  const stride = Math.max(1, Math.ceil(count / capacity));
  const indices: number[] = [];
  for (let index = 0; index < count; index += stride) indices.push(index);
  if (indices[indices.length - 1] !== count - 1) indices.push(count - 1);
  return indices;
}

const PADDING = { left: 46, right: 6, top: 12, bottom: 22 } as const;

/**
 * The "this period vs the last one" chart: two cumulative lines sharing one
 * axis. The current window is solid mint over a gradient; the window before it
 * is a quieter dashed grey, so the eye reads the solid line first.
 */
export function ComparisonChart({
  rows,
  height = 220,
  formatXTick,
  currentLabel,
  previousLabel,
  formatValue,
  style,
}: {
  rows: ComparisonRow[];
  height?: number;
  formatXTick: (key: string) => string;
  currentLabel: string;
  previousLabel: string;
  formatValue: (value: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { width, onLayout } = useMeasuredWidth();

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = Math.max(0, height - PADDING.top - PADDING.bottom);
  // Data maximum plus 10% headroom, so the lines use the whole plot height.
  let dataMax = 0;
  for (const row of rows) {
    if (row.current != null && row.current > dataMax) dataMax = row.current;
    if (row.previous != null && row.previous > dataMax) dataMax = row.previous;
  }
  const yMax = dataMax > 0 ? dataMax * 1.1 : 1;

  const x = (index: number) =>
    PADDING.left + (rows.length <= 1 ? 0 : (index / (rows.length - 1)) * plotWidth);
  const y = (value: number) => PADDING.top + plotHeight - (value / yMax) * plotHeight;

  const seriesOf = (key: 'current' | 'previous'): Point[] => {
    const points: Point[] = [];
    rows.forEach((row, index) => {
      const value = row[key];
      // Nulls are skipped rather than zeroed: a bucket with no data is not a
      // bucket with no spending, and the lines still join across the gap the
      // way the web's `connectNulls` does.
      if (value != null) points.push({ x: x(index), y: y(value) });
    });
    return points;
  };

  const currentPoints = seriesOf('current');
  const previousPoints = seriesOf('previous');
  const baseline = PADDING.top + plotHeight;

  const lastCurrent = (() => {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const value = rows[index].current;
      if (value != null) return { x: x(index), y: y(value), value };
    }
    return null;
  })();

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((fraction) => yMax * fraction);

  // Spoken equivalent of the line, for a screen reader — the chart itself is
  // decorative once the same figures are announced here.
  const summary =
    lastCurrent && rows.length > 0
      ? `${currentLabel} ${formatValue(lastCurrent.value)} against ${previousLabel.toLowerCase()} to date.`
      : 'No spending in this window yet.';

  return (
    <View style={style} onLayout={onLayout} accessible accessibilityLabel={summary}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="pluto-comparison-fill" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor={theme.primary} stopOpacity={0.34} />
              <Stop offset="1" stopColor={theme.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {gridValues.map((value) => (
            <Line
              key={value}
              x1={PADDING.left}
              y1={y(value)}
              x2={PADDING.left + plotWidth}
              y2={y(value)}
              stroke={theme.border}
              strokeWidth={1}
            />
          ))}

          {gridValues.map((value) => (
            <SvgText
              key={`label-${value}`}
              x={PADDING.left - 8}
              y={y(value) + 4}
              fill={theme.muted}
              fontSize={11}
              textAnchor="end"
            >
              {compactAxis(value)}
            </SvgText>
          ))}

          {tickIndices(rows.length, plotWidth).map((index) => (
            <SvgText
              key={`tick-${rows[index].key}`}
              x={x(index)}
              y={height - 6}
              fill={theme.muted}
              fontSize={11}
              textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'}
            >
              {formatXTick(rows[index].key)}
            </SvgText>
          ))}

          {currentPoints.length > 1 ? (
            <Path d={toAreaPath(currentPoints, baseline)} fill="url(#pluto-comparison-fill)" />
          ) : null}

          {previousPoints.length > 1 ? (
            <Path
              d={toPath(previousPoints)}
              fill="none"
              stroke={theme.chartSecondary}
              strokeWidth={1.75}
              strokeDasharray={[5, 4]}
            />
          ) : null}

          {currentPoints.length > 1 ? (
            <Path d={toPath(currentPoints)} fill="none" stroke={theme.primary} strokeWidth={2.25} />
          ) : null}

          {lastCurrent ? (
            <Circle
              cx={lastCurrent.x}
              cy={lastCurrent.y}
              r={4.5}
              fill={theme.primary}
              stroke={theme.canvas}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      ) : (
        // Reserve the height before the first layout pass so the card does not
        // jump when the measurement lands.
        <View style={{ height }} />
      )}
    </View>
  );
}

/**
 * A bare trend line with no axes, for "last 30 days" inside a card.
 *
 * The domain is the data's own min–max rather than zero-anchored: the point is
 * the shape of the movement, and a sparkline that started at zero would flatten
 * a rate's daily drift into a straight line.
 */
export function Sparkline({
  values,
  color,
  height = 34,
  style,
}: {
  values: number[];
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { width, onLayout } = useMeasuredWidth();

  // A non-finite rate would poison the whole path, so it is dropped rather than
  // drawn as a gap.
  const finite = values.filter((value) => Number.isFinite(value));
  const min = values.length > 0 ? Math.min(...finite) : 0;
  const max = values.length > 0 ? Math.max(...finite) : 0;
  const span = max - min;

  const points: Point[] =
    width > 0 && finite.length > 1
      ? finite.map((value, index) => ({
          x: (index / (finite.length - 1)) * width,
          y: height - 3 - (span === 0 ? 0.5 : (value - min) / span) * (height - 6),
        }))
      : [];

  return (
    <View
      style={style}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && points.length > 1 ? (
        <Svg width={width} height={height}>
          <Path
            d={toPath(points)}
            fill="none"
            stroke={color ?? theme.chartSecondary}
            strokeWidth={1.75}
          />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
