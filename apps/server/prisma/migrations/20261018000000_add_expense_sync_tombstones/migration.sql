-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill the client-controlled last-write-wins key from the server-managed
-- updatedAt so existing rows participate in conflict resolution from their real
-- modification time instead of all colliding on the migration timestamp.
UPDATE "expenses" SET "clientUpdatedAt" = "updatedAt";

-- CreateIndex
CREATE INDEX "expenses_userId_updatedAt_idx" ON "expenses"("userId", "updatedAt");
