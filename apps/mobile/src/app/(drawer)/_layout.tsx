import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { StyleSheet, View } from 'react-native';

import { AppTopBar } from '@/components/app-top-bar';
import { IconChart, IconHome, IconReceipt, IconSettings, IconWallet } from '@/components/icons';
import { Spinner } from '@/components/ui/feedback';
import { radius, text } from '@/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

/**
 * The drawer shell.
 *
 * The navigation lives in a slide-out drawer rather than a bottom tab bar: the
 * panel carries the five destinations with their labels, and the top bar
 * carries the button that opens it. The drawer is navigation only — signing out
 * stays in Settings, so nothing moves between screens.
 *
 * The redirect lives here rather than in each screen so a signed-out user never
 * briefly mounts a screen that would fire authenticated requests.
 *
 * Note the import path: `Drawer` is not re-exported from the `expo-router`
 * package root, the same way `Tabs` is not — it lives at `expo-router/drawer`.
 *
 * The icons are Pluto's own stroke set (the same glyphs the web sidebar and the
 * old mobile tab bar use) rather than an icon font.
 */
export default function DrawerLayout() {
  const { status } = useSession();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.canvas }]}>
        <Spinner size="large" />
      </View>
    );
  }

  if (status === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Drawer
      screenOptions={{
        // The top bar replaces the chrome the tab bar used to carry: it holds
        // the button that opens the drawer.
        header: (props) => <AppTopBar navigation={props.navigation} />,
        headerShown: true,
        // The panel slides over the content behind a scrim. Pinned to 'front'
        // so iOS and Android behave the same — the library would otherwise use
        // 'slide' on iOS, which shifts the screen instead of covering it.
        drawerType: 'front',
        swipeEnabled: true,
        drawerStyle: { width: 288 },
        drawerContentStyle: { backgroundColor: theme.surface },
        overlayColor: 'rgba(0, 0, 0, 0.5)',
        // The web sidebar's active item is `bg-primary-subtle text-primary`.
        drawerActiveTintColor: theme.accent,
        drawerActiveBackgroundColor: theme.accentSubtle,
        drawerInactiveTintColor: theme.muted,
        drawerItemStyle: { borderRadius: radius.lg },
        // The web sidebar's item is `text-sm font-medium`.
        drawerLabelStyle: text.bodyMedium,
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Dashboard',
          drawerIcon: ({ color }) => <IconHome color={color} size={20} />,
        }}
      />
      <Drawer.Screen
        name="transactions"
        options={{
          title: 'Activity',
          drawerIcon: ({ color }) => <IconReceipt color={color} size={20} />,
        }}
      />
      <Drawer.Screen
        name="reports"
        options={{
          title: 'Reports',
          drawerIcon: ({ color }) => <IconChart color={color} size={20} />,
        }}
      />
      <Drawer.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          drawerIcon: ({ color }) => <IconWallet color={color} size={20} />,
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: 'Settings',
          drawerIcon: ({ color }) => <IconSettings color={color} size={20} />,
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
