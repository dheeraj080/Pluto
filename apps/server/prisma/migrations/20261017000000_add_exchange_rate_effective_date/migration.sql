-- Per-row observation date for exchange rates.
--
-- Frankfurter v2 blends ~104 sources that publish on staggered schedules, so a
-- single quote can legitimately be older than its snapshot's effectiveDate.
-- The column is added nullable, backfilled from the owning snapshot, then made
-- NOT NULL so existing rows and new writes are always dated.
ALTER TABLE "exchange_rates" ADD COLUMN "effectiveDate" DATE;

UPDATE "exchange_rates" er
SET "effectiveDate" = rs."effectiveDate"
FROM "rate_snapshots" rs
WHERE er."snapshotId" = rs."id";

ALTER TABLE "exchange_rates" ALTER COLUMN "effectiveDate" SET NOT NULL;
