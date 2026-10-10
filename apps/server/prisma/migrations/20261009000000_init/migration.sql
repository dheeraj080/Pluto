-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_snapshots" (
    "id" TEXT NOT NULL,
    "version" SERIAL NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveDate" DATE NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "etag" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_locks" (
    "lockName" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_locks_pkey" PRIMARY KEY ("lockName")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_tokenHash_key" ON "refresh_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_sessions_userId_idx" ON "refresh_sessions"("userId");

-- CreateIndex
CREATE INDEX "refresh_sessions_tokenHash_idx" ON "refresh_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_sessions_expiresAt_idx" ON "refresh_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "rate_snapshots_version_key" ON "rate_snapshots"("version");

-- CreateIndex
CREATE UNIQUE INDEX "rate_snapshots_etag_key" ON "rate_snapshots"("etag");

-- CreateIndex
CREATE INDEX "rate_snapshots_isPublished_fetchedAt_idx" ON "rate_snapshots"("isPublished", "fetchedAt");

-- CreateIndex
CREATE INDEX "rate_snapshots_baseCurrency_isPublished_idx" ON "rate_snapshots"("baseCurrency", "isPublished");

-- CreateIndex
CREATE INDEX "exchange_rates_quoteCurrency_idx" ON "exchange_rates"("quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_snapshotId_quoteCurrency_key" ON "exchange_rates"("snapshotId", "quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "backups_storageKey_key" ON "backups"("storageKey");

-- CreateIndex
CREATE INDEX "backups_userId_status_idx" ON "backups"("userId", "status");

-- CreateIndex
CREATE INDEX "backups_userId_completedAt_idx" ON "backups"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "backups_status_expiresAt_idx" ON "backups"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "backups_userId_sequenceNumber_key" ON "backups"("userId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "rate_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
