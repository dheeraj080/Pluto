"use client";

/**
 * "Add expense" as a right-side drawer, so recording an expense never takes
 * you off the page you're on.
 *
 * Mirrors the CategoryDrawer shell: a fixed overlay with a click-to-close
 * backdrop, Esc-to-close, and a full-height scrollable panel. The category and
 * currency options load on first open (the host mounts it only while open),
 * just like /expenses/new would on its own page.
 */

import { useEffect, useRef } from "react";
import { ErrorNote, Skeleton } from "@/components/ui";
import { IconClose } from "@/components/icons";
import { ExpenseForm } from "./expense-form";
import { useExpenseSetup } from "./use-expenses";

export function AddExpenseDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories, currencies, loading, error } = useExpenseSetup();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add expense"
      className="fixed inset-0 z-50"
    >
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Add expense</p>
            <p className="mt-0.5 text-xs text-muted">
              Record it exactly as you paid — Pluto converts only for reports.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error ? (
            <ErrorNote message={error} />
          ) : loading ? (
            <div className="space-y-4 pb-4" aria-busy="true">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          ) : (
            <ExpenseForm
              variant="panel"
              categories={categories}
              currencies={currencies}
              onSaved={onSaved}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}