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

/* ----------------------------- Exchange rates --------------------------- */

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
}

/* ----------------------------- Expenses API ----------------------------- */

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
  /** Number of expenses filed under this category. */
  expenseCount: number;
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  /** Amount in the expense's own currency; always a plain number, never a Decimal string. */
  amount: number;
  currency: string;
  description: string | null;
  /** Date the expense was incurred, as YYYY-MM-DD. */
  incurredOn: string;
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BudgetPeriod = "MONTHLY" | "YEARLY";

export interface Budget {
  id: string;
  /** Null denotes an overall (whole-account) budget. */
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  /** Date the budget first applies, as YYYY-MM-DD. */
  startDate: string;
  createdAt: string;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  color: string;
  /** Subtotal converted into the base currency. */
  total: number;
  count: number;
  /** Share of the period total, 0-100. */
  percentage: number;
}

export interface CurrencyTotal {
  currency: string;
  /** Native, unconverted subtotal. */
  total: number;
  count: number;
}

export interface ExpenseSummary {
  baseCurrency: string;
  /**
   * False when no rate snapshot was available. `total`, `average` and
   * `byCategory` are then null/empty and only `byCurrency` carries figures.
   */
  converted: boolean;
  conversionUnavailableReason?: string;
  /** Inclusive range start, YYYY-MM-DD. */
  from: string;
  /** Inclusive range end, YYYY-MM-DD. */
  to: string;
  total: number | null;
  count: number;
  average: number | null;
  byCategory: CategoryBreakdown[];
  byCurrency: CurrencyTotal[];
}

export interface TrendPoint {
  /** Calendar month, YYYY-MM. */
  month: string;
  total: number | null;
  count: number;
}

export interface ExpenseTrend {
  baseCurrency: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  months: number;
  points: TrendPoint[];
}

export interface BudgetStatus {
  budgetId: string;
  categoryId: string | null;
  categoryName: string | null;
  color: string | null;
  period: BudgetPeriod;
  /** Budgeted amount converted into the base currency. */
  budgetAmount: number;
  /** Budgeted amount as stored, in the budget's own currency. */
  budgetAmountNative: number;
  spent: number;
  remaining: number;
  percentage: number;
  currency: string;
  overBudget: boolean;
  /** False when the budget's start date falls after the evaluated window. */
  applied: boolean;
}

export interface BudgetStatusResponse {
  baseCurrency: string;
  converted: boolean;
  conversionUnavailableReason?: string;
  /** Evaluated period, YYYY-MM. */
  month: string;
  items: BudgetStatus[];
}
