/**
 * The app's top bar.
 *
 * It replaces the chrome the bottom tab bar used to carry: the button that
 * opens the navigation drawer sits on the left, and the wordmark anchors the
 * right, so the brand stays on screen wherever the user is.
 *
 * The web app's mobile shell has the same bar (`h-14`, `border-b border-border
 * bg-surface`), which is why the drawer panel itself carries no brand header —
 * the wordmark is already here.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconMenu } from '@/components/icons';
import { Wordmark } from '@/components/logo';
import { borderWidth, radius, spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

/** The bar's height, excluding the status bar inset it sits below. */
const BAR_HEIGHT = 56;

export function AppTopBar({
  navigation,
}: {
  /** The drawer's navigation, which owns `openDrawer`. */
  navigation: { openDrawer: () => void };
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          height: BAR_HEIGHT + insets.top,
          paddingTop: insets.top,
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
        // The button has no text, so the e2e flow needs the id to find it.
        testID="open-navigation-menu"
        onPress={() => navigation.openDrawer()}
        hitSlop={8}
        style={({ pressed }) => [
          styles.menu,
          {
            borderRadius: radius.md,
            backgroundColor: pressed ? theme.surfaceMuted : 'transparent',
          },
        ]}
      >
        <IconMenu size={22} color={theme.ink} />
      </Pressable>

      <Wordmark size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: borderWidth.hairline,
  },
  menu: {
    padding: spacing.sm,
  },
});
