import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconChart, IconHome, IconReceipt, IconSettings, IconWallet } from '@/components/icons';
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
  const insets = useSafeAreaInsets();

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
          // Edge-to-edge: the bar sits on the window's bottom edge, so it has to
          // lift itself clear of the navigation bar. A numeric `height` replaces
          // the bar's own inset handling, so the inset is added here and the
          // labels are padded clear of the system buttons by the same amount —
          // which keeps 56pt of content, as before.
          height: (Platform.select({ ios: 56, android: 64 }) ?? 60) + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.sans.medium,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIconStyle: { marginTop: 2 },
        headerShown: false,
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
