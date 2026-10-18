-- AlterTable
ALTER TABLE "expense_categories" ADD COLUMN     "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill the client-controlled last-write-wins key from the server-managed
-- updatedAt so existing categories participate in conflict resolution from
-- their real modification time (same rationale as the budget migration).
UPDATE "expense_categories" SET "clientUpdatedAt" = "updatedAt";
