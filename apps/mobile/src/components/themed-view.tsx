/**
 * Themed view — a `View` whose background resolves from the active palette.
 *
 * `type` is any token name on the palette (e.g. `surface`, `surfaceMuted`,
 * `canvas`), plus the legacy names the screens written before the design
 * system still use (`background`, `backgroundElement`, `backgroundSelected`).
 */

import { View, type ViewProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { resolveThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  type?: ThemeColor;
};

export function ThemedView({ style, type = 'background', ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: resolveThemeColor(theme, type) }, style]} {...otherProps} />;
}