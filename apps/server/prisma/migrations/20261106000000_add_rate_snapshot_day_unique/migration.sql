-- Enforce one rate snapshot per base currency per day at the database level.
--
-- The scheduled server cron and the GitHub Action previously relied on
-- application-level checks plus a time-based lock, so a race or a new writer
-- could still publish a duplicate same-day snapshot.
--
-- Existing duplicates are collapsed first: keep a published snapshot over an
-- unpublished one, then the most complete (most rate rows), then the newest
-- version. Deleting a snapshot cascades to its exchange_rates rows.

WITH ranked AS (
  SELECT
    rs."id",
    ROW_NUMBER() OVER (
      PARTITION BY rs."baseCurrency", rs."effectiveDate"
      ORDER BY
        rs."isPublished" DESC,
        (
          SELECT COUNT(*)
          FROM "exchange_rates" er
          WHERE er."snapshotId" = rs."id"
        ) DESC,
        rs."version" DESC
    ) AS rn
  FROM "rate_snapshots" rs
)
DELETE FROM "rate_snapshots" rs
USING ranked r
WHERE rs."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX "rate_snapshots_baseCurrency_effectiveDate_key"
  ON "rate_snapshots"("baseCurrency", "effectiveDate");
