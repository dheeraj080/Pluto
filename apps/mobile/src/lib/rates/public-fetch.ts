import type { RateSnapshot } from '@/lib/convert';

const FRANKFURTER_URL = 'https://api.frankfurter.app';

/** Currency the fallback request is always made in (frankfurter always knows it). */
const FALLBACK_BASE = 'USD';

export interface PublicRatesResult {
  snapshot: RateSnapshot;
  /** Where the figures came from, for the UI's provenance line. */
  source: string;
  /** Provider market date (`YYYY-MM-DD`). */
  asOf: string;
}

interface FrankfurterLatest {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`rates request failed: ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-expresses a snapshot that is quoted in `from` into one quoted in `base`.
 *
 * A snapshot's `rates` map is "units of CODE per 1 unit of baseCurrency", so
 * moving the base means dividing every rate by the new base's own rate:
 * `rate_in_base(c) = rate_usd(c) / rate_usd(base)`.
 */
function rebase(rates: Record<string, number>, from: string, base: string): Record<string, number> {
  if (from === base) return rates;
  const baseRate = rates[base];
  if (!baseRate || !Number.isFinite(baseRate) || baseRate <= 0) return {};
  const out: Record<string, number> = {};
  for (const [code, rate] of Object.entries(rates)) {
    out[code] = rate / baseRate;
  }
  return out;
}

function toSnapshot(base: string, data: FrankfurterLatest): RateSnapshot {
  // The provider omits the base itself; `rateBetween` needs it present and equal
  // to 1 or every conversion involving the base silently returns null.
  const numeric: Record<string, number> = { ...data.rates, [data.base]: 1 };
  const rebased = rebase(numeric, data.base, base);
  const rates: Record<string, string> = {};
  for (const [code, rate] of Object.entries(rebased)) {
    if (Number.isFinite(rate) && rate > 0) rates[code] = rate.toFixed(6);
  }
  return {
    version: Math.floor(new Date(data.date).getTime() / 1000),
    baseCurrency: base,
    effectiveDate: data.date,
    fetchedAt: new Date().toISOString(),
    provider: 'frankfurter',
    etag: `frankfurter-${data.date}-${base}`,
    rates,
  };
}

/**
 * Fetches the latest published rates without a Pluto account.
 *
 * This is the free plan's only network dependency: no auth header, no server
 * round-trip, and no consequence for data — it feeds display-only conversion.
 * Callers must treat a throw as "keep using whatever is cached".
 *
 * The requested base is tried first; if the provider does not publish it (or
 * the request fails), the USD table is fetched and re-based locally, so a user
 * whose base currency the provider omits still gets usable figures.
 */
export async function fetchPublicRates(base?: string | null): Promise<PublicRatesResult> {
  const requested = (base || FALLBACK_BASE).toUpperCase();

  try {
    const data = await fetchJson<FrankfurterLatest>(
      `${FRANKFURTER_URL}/latest?from=${encodeURIComponent(requested)}`,
    );
    return {
      snapshot: toSnapshot(requested, data),
      source: 'frankfurter',
      asOf: data.date,
    };
  } catch (error) {
    if (requested === FALLBACK_BASE) throw error;
  }

  const data = await fetchJson<FrankfurterLatest>(
    `${FRANKFURTER_URL}/latest?from=${encodeURIComponent(FALLBACK_BASE)}`,
  );
  const snapshot = toSnapshot(requested, data);
  if (Object.keys(snapshot.rates).length === 0) {
    throw new Error(`rates provider does not publish ${requested}`);
  }
  return { snapshot, source: 'frankfurter', asOf: data.date };
}
