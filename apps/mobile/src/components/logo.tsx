/**
 * Pluto brand mark and wordmark, ported from the web app's `components/logo.tsx`.
 *
 * The mark is a planet wrapped by an orbit ring whose gap closes with an
 * arrowhead: an **orbit** (the trip) and an **exchange arrow** (a currency
 * converting) in one shape. The planet is painted with the ink token so it sits
 * correctly on any surface; the ring uses the emerald accent.
 *
 * The geometry is identical to `lib/brand-mark.ts` (the SVG string the web uses
 * to rasterise app icons), so the in-app mark and the launcher icon agree.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

import { fontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type MarkProps = {
  /** Square edge in points. */
  size?: number;
  /** Planet colour. Defaults to the ink token. */
  color?: string;
  /** Orbit and arrowhead colour. Defaults to the accent token. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
};

export function PlutoMark({ size = 24, color, accent, style }: MarkProps) {
  const theme = useTheme();
  const planet = color ?? theme.ink;
  const ring = accent ?? theme.accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G transform="rotate(-24 12 12)">
        {/* Faint complete orbit, for depth. */}
        <Ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4.2"
          stroke={planet}
          strokeWidth={1.4}
          opacity={0.22}
        />
        {/* Back half of the ring (passes behind the planet). */}
        <Path
          d="M2.4 10.6 A10 4.2 0 0 1 20.6 10.2"
          stroke={ring}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
      </G>

      {/* Planet. */}
      <Circle cx="12" cy="12" r="5.5" fill={planet} />

      <G transform="rotate(-24 12 12)">
        {/* Front half of the ring (crosses in front of the planet). */}
        <Path
          d="M20.6 13.8 A10 4.2 0 0 1 2.4 10.6"
          stroke={ring}
          strokeWidth={2.1}
          strokeLinecap="round"
        />
        {/* Exchange arrowhead closing the ring. */}
        <Polygon points="19.1 11.3 22.6 12 21.5 8.5" fill={ring} />
      </G>
    </Svg>
  );
}

/** Backwards-compatible alias, mirroring the web's `Logo`. */
export function Logo(props: MarkProps) {
  return <PlutoMark {...props} />;
}

/**
 * Mark plus the "Pluto" wordmark.
 *
 * The web lockup is `h-[1.4em]` for the mark against `text-[1.28em]` for the
 * text, so a `size` for the mark fixes the type size at `size * 1.28 / 1.4`.
 */
export function Wordmark({
  size = 28,
  color,
  accent,
  style,
}: {
  size?: number;
  color?: string;
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const textSize = Math.round((size * 1.28) / 1.4);

  return (
    <View style={[styles.wordmark, style]}>
      <PlutoMark size={size} color={color} accent={accent} />
      <Text
        style={[
          styles.wordmarkText,
          {
            color: color ?? theme.ink,
            fontSize: textSize,
            lineHeight: textSize,
            letterSpacing: textSize * -0.025,
          },
        ]}
      >
        Pluto
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkText: {
    fontFamily: fontFamily.display.semibold,
  },
});
