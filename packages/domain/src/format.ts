/**
 * Display formatters whose output must be identical on both clients.
 *
 * Only the formatters that are genuinely platform-neutral live here. The
 * locale-aware ones (money, long and relative dates) stay with each client:
 * Hermes ships without full ICU, so mobile has to fall back where the browser
 * does not, and the web client can pass an explicit `locale` for
 * server-rendered content to avoid a hydration mismatch.
 */

/** `1536` → `1.5 KB`. The backup list is the only place either client shows bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** `0.5` → `0.5%`, `12` → `12%` — only adds a decimal when there is one. */
export function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/** Today as a `YYYY-MM` bucket, in UTC (buckets are server-side groupings). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
