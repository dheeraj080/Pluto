-- Add unique constraint for overall budgets (categoryId IS NULL) in PostgreSQL
-- The existing unique index allows multiple NULLs; we need a partial unique index

CREATE UNIQUE INDEX IF NOT EXISTS "budgets_overall_userId_period_key"
  ON "budgets"("userId", "period")
  WHERE "categoryId" IS NULL;
