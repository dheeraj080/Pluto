"use client";

/**
 * Category management.
 *
 * Colours come from the restrained shared palette: a short row of swatches,
 * plus a custom picker for anyone who wants one. Colour is always shown next
 * to the category name so it never carries meaning on its own.
 *
 * Editing is inline per row rather than a separate route — categories are a
 * short list with two editable fields, so a modal or sub-page would be more
 * ceremony than value.
 */

import { useState, type FormEvent } from "react";
import { expensesApi } from "@/lib/expenses";
import type { ExpenseCategory } from "@/lib/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Skeleton,
} from "@/components/ui";
import { AppPageHeader } from "@/components/app-page-header";
import { CategorySwatch } from "@/components/category-swatch";
import { CATEGORY_PALETTE, DEFAULT_CATEGORY_COLOR } from "@/lib/category-palette";
import { IconTag } from "@/components/icons";
import { useExpenseSetup } from "../use-expenses";

/** Preset swatches plus a custom picker; always paired with the live name. */
function ColorPicker({
  value,
  name,
  onChange,
  label,
}: {
  value: string;
  name: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  const active = value.trim().toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
        {CATEGORY_PALETTE.map((hue) => {
          const selected = active === hue.hex.toLowerCase();
          return (
            <button
              key={hue.key}
              type="button"
              aria-pressed={selected}
              aria-label={hue.label}
              title={hue.label}
              onClick={() => onChange(hue.hex)}
              className={`size-7 rounded-full border transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected
                  ? "scale-110 border-ink"
                  : "border-transparent hover:scale-105 hover:border-border-strong"
              }`}
              style={{ backgroundColor: hue.hex }}
            />
          );
        })}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Custom colour"
          className="h-7 w-9 cursor-pointer rounded-md border border-border bg-surface-muted p-0.5"
        />
        Custom
      </label>
      <span className="inline-flex min-w-0 items-center gap-2">
        <CategorySwatch color={value} size={12} />
        <span className="truncate text-sm text-ink">{name || "New category"}</span>
      </span>
    </div>
  );
}

export default function CategoriesPage() {
  const { categories, loading, error, reloadCategories } = useExpenseSetup();

  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [message, setMessage] = useState<string | null>(null);

  const fail = (err: unknown, fallback: string) =>
    setMessage(err instanceof Error ? err.message : fallback);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      await expensesApi.createCategory({ name: name.trim(), color });
      setName("");
      setColor(DEFAULT_CATEGORY_COLOR);
      await reloadCategories();
    } catch (err) {
      fail(err, "Failed to create the category.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (category: ExpenseCategory) => {
    setMessage(null);
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
  };

  const handleSave = async (id: string) => {
    setMessage(null);
    try {
      await expensesApi.updateCategory(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await reloadCategories();
    } catch (err) {
      fail(err, "Failed to update the category.");
    }
  };

  const handleDelete = async (category: ExpenseCategory) => {
    if (!window.confirm(`Delete the category “${category.name}”?`)) return;
    setMessage(null);
    try {
      await expensesApi.deleteCategory(category.id);
      await reloadCategories();
    } catch (err) {
      // A 409 means expenses still reference it; the server explains why.
      fail(err, "Failed to delete the category.");
    }
  };

  return (
    <div className="space-y-6">
      <AppPageHeader title="Categories" />

      {error && <ErrorNote message={error} />}
      {message && <ErrorNote message={message} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="rounded-3xl border border-border bg-surface lg:col-span-5">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-sm font-medium text-ink">Add category</h2>
            <p className="mt-0.5 text-xs text-muted">
              Group expenses for reports and per-category budgets.
            </p>
          </div>
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-4 px-5 pb-5 pt-4 sm:px-6">
            <Field label="Name" htmlFor="category-name">
              <Input
                id="category-name"
                maxLength={40}
                placeholder="e.g. Subscriptions"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field label="Colour">
              <ColorPicker
                value={color}
                name={name}
                onChange={setColor}
                label="Colour for the new category"
              />
            </Field>
            <Button type="submit" variant="primary" disabled={creating || !name.trim()}>
              {creating ? "Adding…" : "Add category"}
            </Button>
          </form>
        </section>

        <section className="rounded-3xl border border-border bg-surface lg:col-span-7">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-sm font-medium text-ink">Your categories</h2>
            <p className="mt-0.5 text-xs text-muted">
              Rename or recolour any category inline.
            </p>
          </div>
          <div className="px-5 pb-5 pt-4 sm:px-6">
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <EmptyState
                icon={<IconTag className="h-5 w-5" />}
                title="No categories yet"
                description="Add one on the left to start grouping your expenses."
              />
            ) : (
              <ul className="divide-y divide-border">
                {categories.map((category) => {
                  const isEditing = editingId === category.id;
                  return (
                    <li key={category.id} className="py-4 first:pt-0 last:pb-0">
                      {isEditing ? (
                        <div className="space-y-4">
                          <Field label="Name" htmlFor={`edit-name-${category.id}`}>
                            <Input
                              id={`edit-name-${category.id}`}
                              maxLength={40}
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                            />
                          </Field>
                          <ColorPicker
                            value={editColor}
                            name={editName}
                            onChange={setEditColor}
                            label={`Colour for ${category.name}`}
                          />
                          <div className="flex items-center gap-4">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => void handleSave(category.id)}
                              disabled={!editName.trim()}
                            >
                              Save
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <CategorySwatch color={category.color} size={12} />
                              <span className="text-sm font-medium text-ink">{category.name}</span>
                              {category.isDefault && <Badge tone="neutral">default</Badge>}
                            </span>
                            <p className="mt-0.5 text-xs text-muted">
                              <span className="tabular-nums">{category.expenseCount}</span>{" "}
                              {category.expenseCount === 1 ? "expense" : "expenses"}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => startEdit(category)}
                              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(category)}
                              className="text-sm text-danger underline-offset-2 hover:underline disabled:opacity-40"
                              disabled={category.expenseCount > 0}
                              title={
                                category.expenseCount > 0
                                  ? `Reassign ${category.expenseCount} expense(s) first`
                                  : undefined
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
