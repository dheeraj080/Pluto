/**
 * Themed text.
 *
 * The `type` names come from the Expo template this app was scaffolded from.
 * They are kept so the screens written against them keep compiling, but each
 * one now resolves to a Pluto type style from `@/theme`. New components should
 * use those `text` styles directly.
 */

import { Text, type TextProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { resolveThemeColor } from '@/constants/theme';
import { text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'default'
  | 'small'
  | 'smallBold'
  | 'title'
  | 'subtitle'
  | 'overline'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

const TYPE_STYLES = {
  default: text.body,
  small: text.caption,
  smallBold: text.bodyStrong,
  title: text.title,
  subtitle: text.subtitle,
  overline: text.overline,
  link: text.link,
  linkPrimary: text.linkPrimary,
  code: text.mono,
} as const;

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: resolveThemeColor(theme, themeColor ?? 'text') },
        TYPE_STYLES[type],
        style,
      ]}
      {...rest}
    />
  );
}