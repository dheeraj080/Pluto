import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { IconChart, IconHome, IconReceipt, IconSettings, IconTag, IconWallet } from '@/components/icons';
import { Spinner } from '@/components/ui/feedback';
import { fontFamily } from '@/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

/**
 * Guarded tab shell.
 *
 * The redirect lives here rather than in each screen so a signed-out user never
 * briefly mounts a tab that would fire authenticated requests.
 *
 * Note the import path: `Tabs` from `expo-router` itself is deprecated in
 * Router v57 and the name is no longer re-exported from the package root.
 *
 * The icons are Pluto's own stroke set (the same glyphs the web sidebar and
 * mobile tab bar use) rather than an icon font.
 */
export default function TabsLayout() {
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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.sans.medium,
          fontSize: 12,
        },
        headerStyle: { backgroundColor: theme.canvas },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: theme.ink,
          fontFamily: fontFamily.display.semibold,
          fontSize: 20,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <IconHome color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <IconReceipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <IconChart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Budgets',
          tabBarIcon: ({ color, size }) => <IconWallet color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Categories',
          tabBarIcon: ({ color, size }) => <IconTag color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <IconSettings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
