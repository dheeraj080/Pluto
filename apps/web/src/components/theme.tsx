"use client";

/**
 * Appearance controls.
 *
 * `ThemeProvider` owns the side effects the toggle cannot: re-applying the
 * stored theme after mount (React Strict Mode clears the `<html>` attribute it
 * manages on its development remount, which would drop the choice the inline
 * script set) and repainting before the browser shows a frame. The actual
 * colours are pure CSS keyed on `data-theme`; this file only picks the value.
 *
 * `ThemeToggle` is a compact three-way control (System / Light / Dark) reused by
 * the public header, the app shell and the settings screen. The preference is
 * read through `useSyncExternalStore` via `useThemePreference`, so every
 * instance updates together.
 */

import {
  useLayoutEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyTheme,
  getThemeServerSnapshot,
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import { IconMonitor, IconMoon, IconSun } from "./icons";

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: ReactNode;
}> = [
  { value: "system", label: "System", icon: <IconMonitor className="h-4 w-4" /> },
  { value: "light", label: "Light", icon: <IconSun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <IconMoon className="h-4 w-4" /> },
];

/** The persisted appearance preference, reactive to writes and OS changes. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribeTheme,
    readThemePreference,
    getThemeServerSnapshot,
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemePreference();

  // Runs before paint on the client: restores the stored choice after the dev
  // remount and keeps the DOM in step with the store.
  useLayoutEffect(() => {
    applyTheme(preference);
  }, [preference]);

  return <>{children}</>;
}

export function ThemeToggle({
  withLabels = false,
}: {
  /** Show text beside each icon; used where width allows (settings). */
  withLabels?: boolean;
}) {
  const preference = useThemePreference();

  return (
    <div
      role="group"
      aria-label="Appearance"
      className="inline-flex rounded-xl border border-border bg-surface-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === preference;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => setThemePreference(option.value)}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
              active
                ? "bg-background text-ink shadow-[0_1px_2px_rgba(23,33,27,0.08)]"
                : "text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden="true">{option.icon}</span>
            {withLabels ? <span>{option.label}</span> : <span className="sr-only">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
