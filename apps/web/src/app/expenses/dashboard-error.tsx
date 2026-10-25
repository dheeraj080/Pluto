"use client";

/**
 * The small inline failure note shown inside a single dashboard card.
 *
 * A fetch that fails only degrades its own card, so the message and its Retry
 * live there rather than in a page-wide banner.
 */

import { IconRefresh } from "@/components/icons";

export function CardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 py-6">
      <p className="text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-stock,8px)] border border-border bg-paper px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <IconRefresh className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
