-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill the client-controlled last-write-wins key from the server-managed
-- updatedAt so existing budgets participate in conflict resolution from their
-- real modification time instead of all colliding on the migration timestamp.
UPDATE "budgets" SET "clientUpdatedAt" = "updatedAt";
