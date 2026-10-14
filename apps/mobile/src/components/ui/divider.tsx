/**
 * A hairline separator.
 *
 * `StyleSheet.hairlineWidth` keeps the web's 1px border from becoming a heavy
 * slab on a 3x display. Use it as a list's `ItemSeparatorComponent`, or between
 * the rows of a `Card`.
 */

import { View, type StyleProp, type ViewStyle } from 'react-native';

import { borderWidth } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();

  return <View style={[{ height: borderWidth.hairline, backgroundColor: theme.border }, style]} />;
}
