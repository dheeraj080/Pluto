/** Shared API types, mirroring pluto-server DTOs (src/modules/<module>/dto). */

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: UserProfile;
}

export interface HealthReport {
  status: "ok" | "degraded";
  timestamp: string;
  uptime: number;
  environment: string;
  database: {
    status: "connected" | "disconnected" | "unreachable";
    latencyMs?: number;
    error?: string;
  };
}

export interface RateSnapshot {
  version: number;
  baseCurrency: string;
  effectiveDate: string;
  fetchedAt: string;
  provider: string;
  etag: string;
  rates: Record<string, string>;
}

export type BackupStatus = "PENDING" | "COMPLETED" | "FAILED" | "DELETED";

export interface BackupMetadata {
  id: string;
  sequenceNumber: number;
  schemaVersion: string;
  appVersion: string;
  fileSizeBytes: number;
  checksumSha256: string;
  status: BackupStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface DownloadBackupResponse {
  backupId: string;
  sequenceNumber: number;
  downloadUrl: string;
  expiresInSeconds: number;
  checksumSha256: string;
  fileSizeBytes: number;
}

/* ----------------------------- Admin API ----------------------------- */

export type UserRole = "USER" | "ADMIN";

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
  backupCount: number;
  activeSessionCount: number;
}

export interface AdminSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  isRevoked: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface AdminBackup {
  id: string;
  userId: string;
  userEmail: string;
  sequenceNumber: number;
  schemaVersion: string;
  appVersion: string;
  fileSizeBytes: number;
  checksumSha256: string;
  status: BackupStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  sessions: AdminSession[];
  backups: AdminBackup[];
}

export interface AdminStats {
  totalUsers: number;
  totalBackups: number;
  totalStorageBytes: number;
  activeSessions: number;
  lastRateSnapshot: {
    version: number;
    baseCurrency: string;
    effectiveDate: string;
    fetchedAt: string;
  } | null;
}

export interface AdminLock {
  lockName: string;
  lockedUntil: string;
  lockedBy: string;
  updatedAt: string;
}

export interface AdminRateSnapshot {
  version: number;
  baseCurrency: string;
  effectiveDate: string;
  fetchedAt: string;
  provider: string;
  isPublished: boolean;
  etag: string;
  rateCount: number;
}
