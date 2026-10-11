"use client";

/**
 * Category management.
 *
 * Editing is inline per row rather than a separate route — categories are a
 * short list with two editable fields, so a modal or sub-page would be more
 * ceremony than value. Laid out as a bento: the add form and the list sit side
 * by side on wide screens.
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
  LoadingNote,
  PageHeader,
} from "@/components/ui";
import { BentoGrid, BentoTile } from "@/components/bento";
import { IconTag } from "@/components/icons";
import { useExpenseSetup } from "../use-expenses";

export default function CategoriesPage() {
  const { categories, loading, error, reloadCategories } = useExpenseSetup();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#4f46e5");
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
      <PageHeader
        title="Categories"
        description="Group expenses for reports and per-category budgets. A default set is seeded on first use."
      />

      {error && <ErrorNote message={error} />}
      {message && <ErrorNote message={message} />}

      <BentoGrid>
        <BentoTile title="Add category" className="lg:col-span-4">
          <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
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
            <Field label="Colour" htmlFor="category-color">
              <Input
                id="category-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-24 p-1"
              />
            </Field>
            <Button type="submit" variant="primary" disabled={creating || !name.trim()}>
              {creating ? "Adding…" : "Add category"}
            </Button>
          </form>
        </BentoTile>

        <BentoTile title="Your categories" className="lg:col-span-8" bodyClassName="flex flex-col">
          {loading ? (
            <LoadingNote label="Loading categories…" />
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
                  <li
                    key={category.id}
                    className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            aria-label="Category name"
                            maxLength={40}
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="max-w-56"
                          />
                          <Input
                            aria-label="Category colour"
                            type="color"
                            value={editColor}
                            onChange={(event) => setEditColor(event.target.value)}
                            className="h-9 w-16 p-1"
                          />
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2 font-medium text-ink">
                          <span
                            aria-hidden="true"
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                          {category.isDefault && <Badge tone="neutral">default</Badge>}
                        </span>
                      )}
                      <p className="mt-0.5 text-xs text-muted">
                        {category.expenseCount}{" "}
                        {category.expenseCount === 1 ? "expense" : "expenses"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleSave(category.id)}
                            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-sm text-muted underline-offset-2 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
