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

/**
 * Same distributed lock the server scheduler uses (`exchange_rate_daily_sync`),
 * so the GitHub Actions job and the server cron can never write concurrently.
 * Mirrors `RatesScheduler.acquireLock` / `releaseLock` in
 * `apps/server/src/modules/rates/rates.scheduler.ts`.
 */
const SYNC_LOCK_NAME = 'exchange_rate_daily_sync';
const LOCK_DURATION_MINUTES = 10;

async function acquireSyncLock(
  prisma: PrismaClient,
  instanceId: string,
): Promise<boolean> {
  const now = new Date();
  const lockExpiry = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);
  try {
    // Atomic single-statement UPSERT that only claims an expired or missing lock.
    const affected = (await prisma.$executeRawUnsafe(
      `INSERT INTO "system_locks" ("lockName", "lockedUntil", "lockedBy", "updatedAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("lockName") DO UPDATE
       SET "lockedUntil" = EXCLUDED."lockedUntil",
           "lockedBy" = EXCLUDED."lockedBy",
           "updatedAt" = NOW()
       WHERE "system_locks"."lockedUntil" < $4`,
      SYNC_LOCK_NAME,
      lockExpiry,
      instanceId,
      now,
    )) as number;
    return affected > 0;
  } catch {
    // Fail closed: if we can't even touch the lock table, don't sync.
    return false;
  }
}

async function releaseSyncLock(prisma: PrismaClient, instanceId: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "system_locks" WHERE "lockName" = $1 AND "lockedBy" = $2`,
      SYNC_LOCK_NAME,
      instanceId,
    );
  } catch (err) {
    console.error(
      `Failed to release sync lock: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
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

  const instanceId = `github-actions-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { effectiveDate, rates } = await fetchRates(BASE_CURRENCY);

    // Normalise dates to YYYY-MM-DD.
    const effectiveDateIso = effectiveDate.split('T')[0];
    const etag = computeEtag(BASE_CURRENCY, effectiveDateIso, rates);

    // Mutually exclude against the server cron (04:00 UTC) so both writers
    // never insert at the same time.
    const acquired = await acquireSyncLock(prisma, instanceId);
    if (!acquired) {
      console.log(
        `Skipping rate sync: another writer holds the '${SYNC_LOCK_NAME}' lock.`,
      );
      return;
    }

    try {
      // Dedup by effective date: rates are per-day, so if a published snapshot
      // for this base + day already exists (written by either writer), skip.
      // Comparing in JS avoids any date-column timezone quirks.
      const published = await prisma.rateSnapshot.findMany({
        where: { baseCurrency: BASE_CURRENCY, isPublished: true },
        select: { id: true, version: true, effectiveDate: true, etag: true },
      });
      const byDay = published.find(
        (s) => s.effectiveDate.toISOString().split('T')[0] === effectiveDateIso,
      );
      if (byDay) {
        console.log(
          `Rates already published for ${BASE_CURRENCY} on ${effectiveDateIso} (v${byDay.version}); skipping.`,
        );
        return;
      }

      // Belt-and-suspenders: skip if identical content is already stored under
      // any snapshot (content-addressed ETag).
      const byEtag = published.find((s) => s.etag === etag);
      if (byEtag) {
        console.log(
          `Rates unchanged for ${BASE_CURRENCY}; reusing snapshot v${byEtag.version} (etag match).`,
        );
        return;
      }

      // Write the snapshot outside a transaction: tx.$executeRawUnsafe does not
      // reliably join a Prisma transaction (it can fail with "Transaction not
      // found"), so we create the snapshot first, then insert rates directly via
      // the main client.
      const created = await prisma.rateSnapshot.create({
        data: {
          baseCurrency: BASE_CURRENCY,
          effectiveDate: new Date(`${effectiveDateIso}T00:00:00.000Z`),
          provider: 'frankfurter',
          etag,
          isPublished: true,
        },
      });

      try {
        // Insert exchange rates via raw SQL to bypass Prisma schema validation:
        // the target Neon DB may not have the effectiveDate column yet, which
        // Prisma's ExchangeRate model requires.
        for (const r of rates) {
          const id = crypto.randomUUID();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "exchange_rates" ("id", "snapshotId", "quoteCurrency", "rate", "effectiveDate") VALUES ($1, $2, $3, $4::numeric, $5::date)`,
            id,
            created.id,
            r.quoteCurrency.toUpperCase(),
            r.rate.toFixed(6),
            r.effectiveDate,
          );
        }
      } catch (err) {
        // Best-effort cleanup: remove the snapshot if rate insertion fails so we
        // don't leave an orphaned snapshot with missing or partial rates.
        await prisma.rateSnapshot.delete({ where: { id: created.id } }).catch(() => {});
        throw err;
      }

      console.log(
        `Published rate snapshot v${created.version} for ${BASE_CURRENCY} (${effectiveDateIso}, ${rates.length} rates).`,
      );
    } finally {
      await releaseSyncLock(prisma, instanceId);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`Rate sync failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
