/**
 * Accessible dialog primitives built on the native `<dialog>` element.
 *
 * `showModal()` gives focus trapping and Esc-to-close for free. The dialog
 * auto-focuses its first focusable element — for a destructive confirm that is
 * deliberately the Cancel button, so an accidental Enter cannot delete.
 */

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./ui";
import { IconClose } from "./icons";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Native `close` fires on Esc or programmatic close(); keep React in sync.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCloseEvent = () => onClose();
    el.addEventListener("close", onCloseEvent);
    return () => el.removeEventListener("close", onCloseEvent);
  }, [onClose]);

  return (
    // onClick with checkEventTarget closes when the backdrop is clicked.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_160ms_ease-out] ${width}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border px-5 py-4 sm:px-6">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/**
 * Confirmation dialog that replaces `window.confirm` everywhere. `busy` keeps
 * the dialog open with a spinner while the destructive call is in flight.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="text-sm leading-relaxed text-muted">{message}</div>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}