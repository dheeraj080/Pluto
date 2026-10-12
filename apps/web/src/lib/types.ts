/** Shared API types, mirroring pluto-server DTOs (src/modules/<module>/dto). */

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** User's persisted reporting base currency (ISO 4217), null when unset. */
  baseCurrency: string | null;
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
  /** Subtotal in the secondary currency, when one was requested. */
  secondaryTotal?: number | null;
}

export interface CurrencyTotal {
  currency: string;
  /** Native, unconverted subtotal. */
  total: number;
  count: number;
}

export type ConversionStatus = "converted" | "partially_converted" | "unavailable";

/** Which snapshots/policies actually fed a report, for auditability. */
export interface RateProvenance {
  /** Earliest snapshot date used, or null when nothing needed a rate. */
  earliestRateDate: string | null;
  /** Latest snapshot date used, or null when nothing needed a rate. */
  latestRateDate: string | null;
  /** Distinct policies applied; includes "unavailable" when any line failed. */
  policies: Array<"historical" | "estimate" | "unavailable">;
}

export interface ExpenseSummary {
  baseCurrency: string;
  /**
   * False when conversion is incomplete (`partially_converted`) or impossible
   * (`unavailable`). `total`, `average` and `byCategory` are then null/empty
   * only when unavailable; see `conversionStatus` for the precise state.
   */
  converted: boolean;
  conversionStatus: ConversionStatus;
  /** Native currencies in the range that could not be converted. */
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
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
  /** Second currency these figures are also expressed in, when requested. */
  secondaryCurrency?: string | null;
  /** Period total in the secondary currency. */
  secondaryTotal?: number | null;
  /** Period average in the secondary currency. */
  secondaryAverage?: number | null;
}

export interface TrendPoint {
  /** Calendar month, YYYY-MM. */
  month: string;
  total: number | null;
  count: number;
  /** Month total in the secondary currency, when one was requested. */
  secondaryTotal?: number | null;
}

export interface ExpenseTrend {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  /** Second currency the points are also expressed in, when requested. */
  secondaryCurrency?: string | null;
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
  /** Converted budget amount, or null when the budget currency could not convert. */
  convertedAmount: number | null;
  /** Base currency used for the converted budget amount, or null. */
  convertedCurrency: string | null;
  /** Snapshot date used to price the budget target, or null (base currency). */
  rateDate: string | null;
  /** historical / estimate, or null when unconvertible. */
  ratePolicy: "historical" | "estimate" | null;
  /** unavailable when some spend or the budget target could not convert. */
  conversionStatus: "converted" | "unavailable";
  /** Budgeted amount in the secondary currency, when requested. */
  secondaryBudgetAmount?: number | null;
  /** Spent in the secondary currency, when requested. */
  secondarySpent?: number | null;
  /** secondaryBudgetAmount minus secondarySpent, when requested. */
  secondaryRemaining?: number | null;
}

export interface ComparisonDelta {
  totalAbs: number;
  totalPct: number;
  countAbs: number;
  countPct: number;
}

export interface ExpenseComparison {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  current: ExpenseSummary;
  previous: ExpenseSummary;
  delta: ComparisonDelta;
}

export interface TopExpenseItem {
  id: string;
  description: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  amountNative: number;
  currency: string;
  /** Amount converted to the base currency, or null when unconvertible. */
  amount?: number | null;
  /** Alias of amount. */
  convertedAmount?: number | null;
  /** Base currency used for `amount`, or null when unconvertible. */
  convertedCurrency?: string | null;
  /** Amount in the requested secondary currency, when one was requested. */
  amountSecondary?: number | null;
  /** Snapshot date used for the conversion, or null. */
  rateDate?: string | null;
  /** historical / estimate, or null when unconvertible. */
  ratePolicy?: "historical" | "estimate" | null;
  /** converted / unavailable for this line. */
  conversionStatus?: "converted" | "unavailable";
  incurredOn: string;
}

export interface TopExpensesResponse {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  items: TopExpenseItem[];
}

export interface DayOfWeekItem {
  dow: number;
  label: string;
  total: number;
  count: number;
  average: number;
  /** Total in the secondary currency, when one was requested. */
  secondaryTotal?: number | null;
}

export interface ByDayOfWeekResponse {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  /** Second currency the items are also expressed in, when requested. */
  secondaryCurrency?: string | null;
  items: DayOfWeekItem[];
}

export interface BudgetStatusResponse {
  baseCurrency: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  /** Second currency the items are also expressed in, when requested. */
  secondaryCurrency?: string | null;
  /** Evaluated period, YYYY-MM. */
  month: string;
  items: BudgetStatus[];
}

/* --------------------------- Rate history ------------------------------- */

export interface RateHistoryPoint {
  /** Snapshot market date, YYYY-MM-DD. */
  date: string;
  /** Units of quoteCurrency per 1 unit of baseCurrency. */
  rate: number;
}

export interface RateHistoryResponse {
  baseCurrency: string;
  quoteCurrency: string;
  from: string;
  to: string;
  points: RateHistoryPoint[];
}

/* ------------------------ Spending series ------------------------------- */

export type SeriesGranularity = "day" | "week" | "month";

export interface SeriesPoint {
  /** Bucket key: YYYY-MM-DD for day/week (week = Monday), YYYY-MM for month. */
  bucket: string;
  total: number | null;
  count: number;
  secondaryTotal?: number | null;
}

export interface ExpenseSeriesResponse {
  baseCurrency: string;
  secondaryCurrency?: string | null;
  granularity: SeriesGranularity;
  from: string;
  to: string;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  points: SeriesPoint[];
}

/* ------------------------ Category trends ------------------------------- */

export interface CategoryTrendPoint {
  month: string;
  total: number | null;
  secondaryTotal?: number | null;
}

export interface CategoryTrendSeries {
  categoryId: string;
  categoryName: string;
  color: string;
  points: CategoryTrendPoint[];
}

export interface CategoryTrendsResponse {
  baseCurrency: string;
  secondaryCurrency?: string | null;
  months: number;
  top: number;
  converted: boolean;
  conversionStatus: ConversionStatus;
  unconvertedCurrencies: string[];
  rateProvenance: RateProvenance;
  conversionUnavailableReason?: string;
  series: CategoryTrendSeries[];
}
