import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { TextField } from '@/components/ui/text-field';
import { borderWidth, layout, radius, spacing, text } from '@/theme';
import { useCategories } from '@/hooks/use-categories';
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/use-category-mutations';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

type Category = Schemas['ExpenseCategoryDto'];

/**
 * Categories — the web's "Tags" page.
 *
 * One form serves both create and rename: tapping Edit loads the row into the
 * form and the primary button becomes "Save changes". A separate modal would be
 * more machinery for a four-field record, and on a phone the list is short
 * enough that scrolling back to the form is not a burden.
 */
export default function CategoriesScreen() {
  const theme = useTheme();
  const categories = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(theme.cat.mint);
  const [validationError, setValidationError] = useState<string | null>(null);

  const swatches = [
    theme.cat.mint,
    theme.cat.sky,
    theme.cat.amber,
    theme.cat.rose,
    theme.cat.violet,
    theme.cat.slate,
  ];

  const items = categories.data ?? [];
  const editing = editingId ? items.find((item) => item.id === editingId) ?? null : null;
  const busy = create.isPending || update.isPending;
  const writeError = errorMessage(create.error) ?? errorMessage(update.error);

  // A category may carry a colour outside the palette; keep it selectable.
  const colorOptions = swatches.includes(color) ? swatches : [color, ...swatches];

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName('');
    setValidationError(null);
  }, []);

  const startEdit = useCallback((category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color);
    setValidationError(null);
  }, []);

  const submit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Enter a name.');
      return;
    }
    setValidationError(null);

    const onSuccess = () => resetForm();
    if (editing) {
      update.mutate({ id: editing.id, body: { name: trimmed, color } }, { onSuccess });
    } else {
      create.mutate({ name: trimmed, color }, { onSuccess });
    }
  }, [color, create, editing, name, resetForm, update]);

  const confirmDelete = useCallback(
    (category: Category) => {
      Alert.alert(
        `Delete “${category.name}”?`,
        'Categories that still have expenses cannot be deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              remove.mutate(category.id, {
                // Drop the form if it was editing the row that just vanished.
                onSuccess: () => {
                  if (editingId === category.id) resetForm();
                },
              }),
          },
        ],
      );
    },
    [editingId, remove, resetForm],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      contentContainerStyle={styles.content}
    >
      <AppPageHeader
        title="Categories"
        subtitle={
          categories.isPending
            ? 'Loading…'
            : `${items.length} ${items.length === 1 ? 'category' : 'categories'}`
        }
      />

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>
          {editing ? 'EDIT CATEGORY' : 'NEW CATEGORY'}
        </Text>

        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Groceries"
          maxLength={60}
          error={validationError ?? undefined}
          editable={!busy}
        />

        <View style={styles.group}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>Colour</Text>
          <View style={styles.wrapRow}>
            {colorOptions.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Colour ${option}`}
                accessibilityState={{ selected: option === color }}
                onPress={() => setColor(option)}
                hitSlop={4}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: option,
                    borderColor: option === color ? theme.ink : theme.border,
                    borderWidth: option === color ? borderWidth.thick : borderWidth.hairline,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {writeError ? <ErrorNote message={writeError} /> : null}

        <View style={styles.formActions}>
          <Button
            label={editing ? 'Save changes' : 'Add category'}
            onPress={submit}
            busy={busy}
          />
          {editing ? (
            <Button label="Cancel" variant="secondary" onPress={resetForm} disabled={busy} />
          ) : null}
        </View>
      </Card>

      {categories.isPending ? (
        <Spinner size="large" style={styles.placeholder} />
      ) : categories.isError ? (
        <ErrorNote message={errorMessage(categories.error) ?? 'Could not load categories.'} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No categories yet"
          message="Add one above and it will be available when you record an expense."
        />
      ) : (
        <Card style={styles.list}>
          {items.map((category, index) => (
            <View key={category.id}>
              {index > 0 ? <Divider /> : null}
              <CategoryRow
                category={category}
                selected={category.id === editingId}
                onEdit={() => startEdit(category)}
                onDelete={() => confirmDelete(category)}
                deleteBusy={remove.isPending && remove.variables === category.id}
              />
            </View>
          ))}
        </Card>
      )}

      {remove.isError ? (
        <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the category.'} />
      ) : null}
    </ScrollView>
  );
}

function CategoryRow({
  category,
  selected,
  onEdit,
  onDelete,
  deleteBusy,
}: {
  category: Category;
  selected: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleteBusy: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, selected && { backgroundColor: theme.surfaceMuted }]}>
      <View style={[styles.dot, { backgroundColor: category.color }]} />

      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[text.bodyStrong, { color: theme.ink }]}>
          {category.name}
        </Text>
        <Text style={[text.caption, { color: theme.muted }]}>
          {category.expenseCount}{' '}
          {category.expenseCount === 1 ? 'expense' : 'expenses'}
        </Text>
      </View>

      <Button label="Edit" variant="ghost" size="sm" onPress={onEdit} />
      <Button label="Delete" variant="ghost" size="sm" onPress={onDelete} busy={deleteBusy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
    gap: spacing.lg,
  },
  group: { gap: spacing.sm },
  formActions: { gap: spacing.sm },
  placeholder: { marginTop: spacing.xl },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
  },
  list: { padding: 0, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  rowText: { flex: 1, gap: spacing.xs / 2 },
});
