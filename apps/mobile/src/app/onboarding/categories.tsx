import { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

import { readOnboardingCompleted, writeOnboardingCompleted } from '@/lib/session-storage';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useCategories as useCategoriesHook } from '@/hooks/use-categories';
import { text, borderWidth, spacing } from '@/theme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CategoriesScreen() {
  const router = useRouter();
  const { status, user } = useSession();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const categories = useCategoriesHook();

  const defaultCategories = [
    { id: 'local-cat-food', name: 'Food & Dining' },
    { id: 'local-cat-transport', name: 'Transport' },
    { id: 'local-cat-shopping', name: 'Shopping' },
    { id: 'local-cat-bills', name: 'Bills & Utilities' },
    { id: 'local-cat-entertainment', name: 'Entertainment' },
    { id: 'local-cat-health', name: 'Health' },
    { id: 'local-cat-other', name: 'Other' },
  ];

  const onContinue = useCallback(async () => {
    // Persist the selected category IDs
    await writeOnboardingCompleted(true);
    await router.push('/onboarding/expense' as any);
  }, [router]);

  const sheetPaddingBottom = insets.bottom > 0 ? insets.bottom + 16 : 16;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.canvas }]}
        contentContainerStyle={[styles.content, { padding: 24 }]}
      >
        <Text style={[text.bodyLarge, { color: theme.ink }]}>Pick your categories</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          Choose which categories you use to group expenses. You can always add more
          from the Settings screen.
        </Text>

        <View style={styles.separator} />

        {categories.isPending ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" />
            <Text>Loading categories…</Text>
          </View>
        ) : categories.isError ? (
          <View style={styles.emptyState}>
            <Text style={[text.bodyMedium, { color: theme.danger }]}>Failed to load categories.</Text>
          </View>
        ) : categories.data?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text>No categories found. You can add some from Settings.</Text>
          </View>
        ) : (
          <View>
            {categories.data?.map((cat) => {
              const isSelected = selectedCategories.has(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryRow,
                    { borderColor: isSelected ? theme.accent : theme.border },
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      setSelectedCategories(
                        new Set([...selectedCategories].filter((id) => id !== cat.id)),
                      );
                    } else {
                      setSelectedCategories(new Set([...selectedCategories, cat.id]));
                    }
                  }}
                >
                  <View
                    style={[
                      styles.categoryCheckbox,
                      { backgroundColor: isSelected ? theme.accent : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.categoryLabel, { color: theme.ink }]}>{cat.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.separator} />

        <View style={styles.bottomAction}>
          <Button
            label="Select all"
            onPress={() => {
              const all = new Set(defaultCategories.map((c) => c.id));
              setSelectedCategories(all);
            }}
          />
        </View>

        <View style={styles.separator} />

        <Button
          label="Continue to first expense"
          onPress={onContinue}
          disabled={selectedCategories.size === 0}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 24 },
  separator: { height: 1, width: '100%', backgroundColor: '#e0e0e0', marginVertical: 16 },

  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: borderWidth.hairline,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  categoryCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },

  categoryLabel: {
    flex: 1,
    fontSize: 16,
  },

  bottomAction: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
});