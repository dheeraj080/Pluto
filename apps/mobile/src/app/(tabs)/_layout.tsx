import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, type ColorValue } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Accent } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Filled icon while a tab is active, outline while it is not.
 *
 * Note the import path: `Tabs` from `expo-router` itself is deprecated in
 * Router v57 and the name is no longer re-exported from the package root.
 */
function tabIcon(icons: [IconName, IconName]) {
  return function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={icons[focused ? 1 : 0]} size={size} color={color} />;
  };
}

/**
 * Guarded tab shell.
 *
 * The redirect lives here rather than in each screen so a signed-out user never
 * briefly mounts a tab that would fire authenticated requests.
 */
export default function TabsLayout() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (status === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: Accent }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarIcon: tabIcon(['pie-chart-outline', 'pie-chart']),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Expenses',
          tabBarIcon: tabIcon(['list-outline', 'list']),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon(['settings-outline', 'settings']),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
