-- CreateIndex
CREATE INDEX "rate_snapshots_baseCurrency_isPublished_effectiveDate_idx" ON "rate_snapshots"("baseCurrency", "isPublished", "effectiveDate");