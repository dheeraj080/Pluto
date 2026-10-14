/**
 * Minimal stroke icon set (24×24), ported 1:1 from the web app's
 * `components/icons.tsx` so both clients draw the same pictograms.
 *
 * The web relies on `currentColor` and CSS sizing. React Native has neither,
 * so every icon takes an explicit `color` (falling back to the muted text
 * token) and an explicit `size`. Whatever the web filled with
 * `fill="currentColor"` is filled with the same resolved colour here.
 *
 * The `d` attributes are byte-identical to the web file; if a glyph changes
 * there, change it here too.
 */

import type { ReactNode } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type IconProps = {
  /** Square edge in points. The web sized these with `h-4 w-4`-style classes. */
  size?: number;
  /** Stroke/fill colour. Defaults to the muted text token. */
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

/** Resolves an icon colour the way `currentColor` did on the web. */
function useIconColor(color?: ColorValue): ColorValue {
  const theme = useTheme();

  return color ?? theme.muted;
}

function Stroke({ size = 24, color, style, children }: IconProps & { children: ReactNode }) {
  const resolved = useIconColor(color);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={resolved}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </Svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M3.5 10.5 12 3.25 20.5 10.5" />
      <Path d="M5.5 9.25V20h13V9.25" />
      <Path d="M9.5 20v-6h5v6" />
    </Stroke>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4 20V10" />
      <Path d="M10 20V4" />
      <Path d="M16 20v-7" />
      <Path d="M20.5 20H3.5" />
    </Stroke>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h12.5A1.5 1.5 0 0 1 19 7.5V9" />
      <Path d="M3.5 7.5V17A1.5 1.5 0 0 0 5 18.5h14A1.5 1.5 0 0 0 20.5 17V9" />
      <Path d="M3.5 7.5V9h17" />
      <Path d="M15.5 13h1" />
    </Stroke>
  );
}

export function IconTag({ color, ...props }: IconProps) {
  const resolved = useIconColor(color);

  return (
    <Stroke color={resolved} {...props}>
      <Path d="M12.6 3.3 20.7 11.4a1.6 1.6 0 0 1 0 2.3l-7 7a1.6 1.6 0 0 1-2.3 0L3.3 12.6a1.6 1.6 0 0 1-.47-1.13V4.6A1.3 1.3 0 0 1 4.13 3.3h6.87c.42 0 .83.17 1.13.47z" />
      <Circle cx="8.3" cy="8.3" r="1.3" fill={resolved} stroke="none" />
    </Stroke>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Stroke>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4.5 12h15" />
      <Path d="M13.5 6 19.5 12l-6 6" />
    </Stroke>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M19.5 12h-15" />
      <Path d="M10.5 6 4.5 12l6 6" />
    </Stroke>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M20 20l-3.8-3.8" />
    </Stroke>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4.5 6.5h15" />
      <Path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" />
      <Path d="M6.5 6.5 7.5 20h9l1-13.5" />
      <Path d="M10 10v6.5" />
      <Path d="M14 10v6.5" />
    </Stroke>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M15 4.5h3.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H15" />
      <Path d="M10 12h9.5" />
      <Path d="M16.5 8.5 20 12l-3.5 3.5" />
      <Path d="M4 4.5h9v15H4" />
    </Stroke>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4 6.5h16" />
      <Path d="M4 12h16" />
      <Path d="M4 17.5h16" />
    </Stroke>
  );
}

/** Vertical ellipsis — the overflow-menu affordance. */
export function IconDots({ color, ...props }: IconProps) {
  const resolved = useIconColor(color);

  return (
    <Stroke color={resolved} {...props}>
      <Circle cx="12" cy="5.5" r="1.15" fill={resolved} stroke="none" />
      <Circle cx="12" cy="12" r="1.15" fill={resolved} stroke="none" />
      <Circle cx="12" cy="18.5" r="1.15" fill={resolved} stroke="none" />
    </Stroke>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M6 6l12 12" />
      <Path d="M18 6 6 18" />
    </Stroke>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M3.5 12h17" />
      <Path d="M12 3.5c2.2 2.3 3.3 5.2 3.3 8.5s-1.1 6.2-3.3 8.5c-2.2-2.3-3.3-5.2-3.3-8.5s1.1-6.2 3.3-8.5z" />
    </Stroke>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Stroke>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M12 11v5" />
      <Path d="M12 7.75h.01" />
    </Stroke>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.7 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.7a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Stroke>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 4 21.2 19H2.8z" />
      <Path d="M12 9.5V13" />
      <Path d="M12 16h.01" />
    </Stroke>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Stroke {...props}>
      <Rect x="4" y="5.5" width="16" height="15" rx="2" />
      <Path d="M4 10h16" />
      <Path d="M8.5 3.5v4" />
      <Path d="M15.5 3.5v4" />
    </Stroke>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 3.5 19 6v5c0 4.4-2.9 8.1-7 9.5C7.9 19.1 5 15.4 5 11V6z" />
      <Path d="M9 11.5 11 13.5 15.5 9" />
    </Stroke>
  );
}

export function IconSwap(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4 8h13" />
      <Path d="M14 4.5 17.5 8 14 11.5" />
      <Path d="M20 16H7" />
      <Path d="M10 12.5 6.5 16l3.5 3.5" />
    </Stroke>
  );
}

export function IconReceipt(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M6 3.5h12A1 1 0 0 1 19 4.5v15.2l-2.4-1.6-2.1 1.6-2.5-1.6-2.5 1.6-2.1-1.6-2.4 1.6V4.5a1 1 0 0 1 1-1z" />
      <Path d="M9 8.5h6" />
      <Path d="M9 12h6" />
    </Stroke>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M13 3 5 13.5h5.5L10 21l8.5-11H13z" />
    </Stroke>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Stroke {...props}>
      <Rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <Path d="M12 14.5v2" />
    </Stroke>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </Stroke>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M3.5 20.5h17" />
      <Path d="M4.5 14.9 15.1 4.3a1 1 0 0 1 1.4 0l3.2 3.2a1 1 0 0 1 0 1.4L9.1 19.5H4.5v-4.6z" />
      <Path d="M12.7 6.7l4.6 4.6" />
    </Stroke>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 4.5 13.6 10 19 12l-5.4 2L12 19.5 10.4 14 5 12l5.4-2z" />
    </Stroke>
  );
}

export function IconTrendUp(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M3.5 16.5 9.5 10.5l4 4 7-7" />
      <Path d="M15.5 7.5h5v5" />
    </Stroke>
  );
}

export function IconTarget({ color, ...props }: IconProps) {
  const resolved = useIconColor(color);

  return (
    <Stroke color={resolved} {...props}>
      <Circle cx="12" cy="12" r="8.25" />
      <Circle cx="12" cy="12" r="4.25" />
      <Circle cx="12" cy="12" r="1.1" fill={resolved} stroke="none" />
    </Stroke>
  );
}

export function IconPlay({ color, ...props }: IconProps) {
  const resolved = useIconColor(color);

  return (
    <Stroke color={resolved} {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M10 8.6 15.6 12 10 15.4z" fill={resolved} stroke="none" />
    </Stroke>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M20 11a8 8 0 0 0-14-4.6L4 8.5" />
      <Path d="M4 4.5v4h4" />
      <Path d="M4 13a8 8 0 0 0 14 4.6l2-2.1" />
      <Path d="M20 19.5v-4h-4" />
    </Stroke>
  );
}

export function IconCoins(props: IconProps) {
  return (
    <Stroke {...props}>
      <Ellipse cx="12" cy="7.5" rx="7" ry="3.2" />
      <Path d="M5 7.5v4c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2v-4" />
      <Path d="M5 11.5v4c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2v-4" />
    </Stroke>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="12" cy="14.5" r="3.75" />
      <Path d="M12 3.5v2.4" />
      <Path d="M5.6 7.6 7.3 9.2" />
      <Path d="M18.4 7.6 16.7 9.2" />
      <Path d="M3 19.5h18" />
    </Stroke>
  );
}

export function IconMobile(props: IconProps) {
  return (
    <Stroke {...props}>
      <Rect x="7" y="2.75" width="10" height="18.5" rx="2.6" />
      <Path d="M11 18.25h2" />
    </Stroke>
  );
}

export function IconLaptop(props: IconProps) {
  return (
    <Stroke {...props}>
      <Rect x="4" y="5" width="16" height="10.5" rx="1.6" />
      <Path d="M2.5 18.5h19" />
      <Path d="M9.5 15.5 9 18.5" />
      <Path d="M14.5 15.5 15 18.5" />
    </Stroke>
  );
}

export function IconPlane(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M20.5 3.5 3.6 10.1l6.5 2.5 2.5 6.5 7.9-19.6z" />
      <Path d="M10.1 12.6 14.6 8.1" />
    </Stroke>
  );
}

export function IconGraduation(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 4.5 21.5 9.25 12 14 2.5 9.25z" />
      <Path d="M6.5 11.4v4.6c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.6" />
    </Stroke>
  );
}

/** Official multi-colour Google "G" (filled, not a stroke icon). */
export function IconGoogle({ size = 20, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" style={style}>
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}
