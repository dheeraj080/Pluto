#!/usr/bin/env ts-node
/**
 * Standalone daily exchange-rate sync that writes directly to Neon PostgreSQL.
 *
 * Fetches rates from Frankfurter (no API key, no quotas), then inserts a
 * RateSnapshot + ExchangeRate rows into the server's DATABASE_URL database.
 *
 * Runs entirely outside the Nest server — no HTTP endpoint, no running
 * instance required. Intended to be triggered by .github/workflows/rates-sync.yml.
 *
 * Required env:
 *   DATABASE_URL — Neon pooled connection string (sslmode=require, no channel_binding)
 *   EXCHANGE_RATE_BASE_CURRENCY — default USD
 *   EXCHANGE_RATE_BASE_URL — default https://api.frankfurter.dev/v2
 */

import * as crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

const BASE_CURRENCY = process.env.EXCHANGE_RATE_BASE_CURRENCY ?? 'USD';
const BASE_URL = process.env.EXCHANGE_RATE_BASE_URL ?? 'https://api.frankfurter.dev/v2';

async function fetchRates(base: string): Promise<{
  effectiveDate: string;
  rates: { quoteCurrency: string; rate: number; effectiveDate: string }[];
}> {
  const url = `${BASE_URL}/rates?base=${encodeURIComponent(base)}`;
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PlutoRatesSync/1.0',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Frankfurter HTTP ${response.status}: ${response.statusText}`);
      }

      const payload = (await response.json()) as Array<{
        date: string;
        base: string;
        quote: string;
        rate: number;
      }>;

      if (!Array.isArray(payload) || payload.length === 0) {
        throw new Error('Malformed provider payload: expected a non-empty rate array');
      }

      const rows: { quoteCurrency: string; rate: number; effectiveDate: string }[] = [];
      let asOf: string | null = null;

      for (const entry of payload) {
        if (!entry || typeof entry.quote !== 'string' || typeof entry.rate !== 'number') continue;
        if (!Number.isFinite(entry.rate) || entry.rate <= 0) continue;
        rows.push({
          quoteCurrency: entry.quote.toUpperCase(),
          rate: entry.rate,
          effectiveDate: entry.date,
        });
        if (asOf === null || entry.date > asOf) asOf = entry.date;
      }

      if (rows.length === 0 || asOf === null) {
        throw new Error('Provider payload contained no positive, dated rates');
      }

      // Guarantee base quotes exactly 1.0.
      if (!rows.some((r) => r.quoteCurrency === base)) {
        rows.push({ quoteCurrency: base, rate: 1.0, effectiveDate: asOf });
      }

      return { effectiveDate: asOf, rates: rows };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        // Exponential backoff with jitter so retries do not form a thundering
        // herd against the provider.
        const backoff = attempt * 1000 + Math.floor(Math.random() * 500);
        await new Promise((res) => setTimeout(res, backoff));
      }
    }
  }

  throw new Error(
    `Failed to fetch exchange rates after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

function computeEtag(
  base: string,
  effectiveDate: string,
  rates: { quoteCurrency: string; rate: number; effectiveDate: string }[],
): string {
  const fingerprint = [...rates]
    .sort((a, b) => a.quoteCurrency.localeCompare(b.quoteCurrency))
    .map((r) => `${r.quoteCurrency}:${r.rate.toFixed(6)}:${r.effectiveDate}`)
    .join(',');
  const hash = crypto
    .createHash('sha256')
    .update(`${base}:${effectiveDate}:${fingerprint}`)
    .digest('hex')
    .substring(0, 16);
  return `W/"rates-${base}-${effectiveDate}-${hash}"`;
}

async function main(): Promise<void> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL is required');
  // Convert the Neon pooled host (-pooler.*) to the direct host: transactions
  // are not supported over the pooled endpoint. Prisma's driver does not
  // implement channel_binding, so drop it if the provider added it. Rebuild the
  // query string so removing the param (first, last, or only) never leaves a
  // malformed URL such as '.../db&sslmode=require'.
  let directUrl = rawUrl.replace(/-pooler(\.[^/]*neon\.tech)/, '$1');
  const [origin, ...queryParts] = directUrl.split('?');
  const params = queryParts.join('?').split('&').filter((p) => p && p !== 'channel_binding=require');
  directUrl = params.length ? `${origin}?${params.join('&')}` : origin;
  const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

  try {
    const { effectiveDate, rates } = await fetchRates(BASE_CURRENCY);

    // Normalise dates to YYYY-MM-DD.
    const effectiveDateIso = effectiveDate.split('T')[0];
    const etag = computeEtag(BASE_CURRENCY, effectiveDateIso, rates);

    // Skip if an identical published snapshot already exists (no-op on unchanged rates).
    const existing = await prisma.rateSnapshot.findFirst({
      where: { baseCurrency: BASE_CURRENCY, isPublished: true },
      orderBy: { version: 'desc' },
      include: { rates: true },
    });

    if (existing && existing.etag === etag) {
      console.log(
        `Rates unchanged for ${BASE_CURRENCY}; reusing snapshot v${existing.version} (etag match).`,
      );
      return;
    }

    const snapshot = await prisma.$transaction(async (tx) => {
      const created = await tx.rateSnapshot.create({
        data: {
          baseCurrency: BASE_CURRENCY,
          effectiveDate: new Date(`${effectiveDateIso}T00:00:00.000Z`),
          provider: 'frankfurter',
          etag,
          isPublished: true,
        },
      });

      // Insert exchange rates via raw SQL to bypass Prisma schema validation.
      const now = new Date();
      for (const r of rates) {
        const id = crypto.randomUUID();
        await tx.$executeRawUnsafe(
          `INSERT INTO "exchange_rates" ("id", "snapshotId", "quoteCurrency", "rate", "effectiveDate") VALUES ($1, $2, $3, $4::numeric, $5::date)`,
          id,
          created.id,
          r.quoteCurrency.toUpperCase(),
          r.rate.toFixed(6),
          r.effectiveDate,
        );
      }

      return created;
    });

    console.log(
      `Published rate snapshot v${snapshot.version} for ${BASE_CURRENCY} (${effectiveDateIso}, ${rates.length} rates).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`Rate sync failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
