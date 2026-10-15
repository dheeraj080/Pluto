/**
 * Appearance preference — System / Light / Dark.
 *
 * The web app defaults to dark, but the user can pin either theme or follow the
 * OS. The choice is a single string in localStorage (`pluto.theme`), read
 * through `useSyncExternalStore` (see `components/theme.tsx`) — the same pattern
 * as the currency and session stores — so every control stays in step without a
 * context provider.
 *
 * Colours never come from JS: the inline script in `app/layout.tsx` sets
 * `data-theme` on `<html>` before first paint (no flash), and `globals.css`
 * resolves the ramp from that attribute. This module only decides *which*
 * attribute to set, persists the choice, and keeps the browser chrome
 * (`color-scheme`, `theme-color`) in step.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "pluto.theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/** `--canvas` for each theme; used for the `theme-color` browser chrome. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#F7F8F8",
  dark: "#0B0C0E",
};

type Listener = () => void;

const listeners = new Set<Listener>();
let media: MediaQueryList | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Re-renders subscribers and repaints when the OS flips, but only while the
 * preference is `system` — an explicit choice must ignore the OS.
 */
function onSystemChange(): void {
  if (readThemePreference() !== "system") return;
  applyTheme("system");
  notify();
}

/**
 * Subscribe to preference changes (and, implicitly, to OS changes while
 * following the system). Registers the `matchMedia` listener on the first
 * subscriber and drops it with the last, so nothing leaks on the server or
 * after unmount.
 */
export function subscribeTheme(listener: Listener): () => void {
  if (typeof window !== "undefined" && !media && window.matchMedia) {
    media = window.matchMedia(LIGHT_QUERY);
    media.addEventListener("change", onSystemChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && media) {
      media.removeEventListener("change", onSystemChange);
      media = null;
    }
  };
}

/** The persisted preference; safe during prerender (no `window`). */
export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** Server snapshot: matches the rendered default so hydration is stable. */
export function getThemeServerSnapshot(): ThemePreference {
  return "system";
}

/** Collapses `system` to the OS preference; defaults to dark without `window`. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

/** Writes the resolved theme to `<html>` and the browser chrome. */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[resolved]));
}

/** Persists the preference, applies it, and notifies every subscriber. */
export function setThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
  notify();
}

/**
 * Inline, pre-paint script injected into `<head>` by `app/layout.tsx`. Written
 * as a string so it runs synchronously during HTML parsing — before the body
 * exists to flash. Kept dependency-free and defensive (`try/catch`) because
 * localStorage throws in some privacy modes. The `theme-color` repaint is
 * deferred to `DOMContentLoaded` when the metas have not parsed yet.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var K="pluto.theme",L="${THEME_COLORS.light}",D="${THEME_COLORS.dark}";
var p=localStorage.getItem(K);
var r=(p==="light"||p==="dark")?p:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");
var e=document.documentElement;
e.setAttribute("data-theme",r);
e.style.colorScheme=r;
function paint(){var c=r==="light"?L:D;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)});}
paint();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",paint);
}catch(_){}})();`;
