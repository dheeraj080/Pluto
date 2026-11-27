package com.pluto.app.domain.model

import java.math.BigDecimal
import java.util.Calendar

/**
 * Period timeframe options for Dashboard calculations.
 */
enum class DashboardPeriod(val label: String) {
  TODAY("Today"),
  THIS_WEEK("This Week"),
  THIS_MONTH("This Month"),
  ACADEMIC_TERM("Semester"),
  CURRENT_TRIP("Trip");

  fun getBounds(customStart: Long? = null, customEnd: Long? = null): Pair<Long, Long> {
    val now = Calendar.getInstance()
    return when (this) {
      TODAY -> {
        val start = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        val end = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 23)
          set(Calendar.MINUTE, 59)
          set(Calendar.SECOND, 59)
          set(Calendar.MILLISECOND, 999)
        }
        Pair(start.timeInMillis, end.timeInMillis)
      }
      THIS_WEEK -> {
        val start = Calendar.getInstance().apply {
          set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        Pair(start.timeInMillis, now.timeInMillis + 86400000L)
      }
      THIS_MONTH -> {
        val start = Calendar.getInstance().apply {
          set(Calendar.DAY_OF_MONTH, 1)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        Pair(start.timeInMillis, now.timeInMillis + 86400000L)
      }
      ACADEMIC_TERM -> {
        val start = customStart ?: (now.timeInMillis - (14L * 86400000L))
        val end = customEnd ?: (now.timeInMillis + (90L * 86400000L))
        Pair(start, end)
      }
      CURRENT_TRIP -> {
        val start = customStart ?: now.timeInMillis
        val end = customEnd ?: (now.timeInMillis + (14L * 86400000L))
        Pair(start, end)
      }
    }
  }
}

/**
 * Pace assessment of student allowance burn rate.
 */
enum class RunwayPaceStatus(val label: String) {
  ON_TRACK("On Pace"),
  CAUTION("High Burn Rate"),
  DEFICIT("Runway Deficit")
}

/**
 * Comprehensive semester allowance runway telemetry for international students.
 */
data class TermRunwaySummary(
  val termName: String,
  val daysRemaining: Int,
  val totalDays: Int,
  val percentPassed: Float,
  val totalAllowanceHome: Money,
  val totalAllowanceDest: Money? = null,
  val committedFixedHome: Money,
  val committedFixedDest: Money? = null,
  val termSpentHome: Money,
  val termSpentDest: Money? = null,
  val remainingDiscretionaryHome: Money,
  val remainingDiscretionaryDest: Money? = null,
  val dailyRunwaySafeToSpendHome: Money,
  val dailyRunwaySafeToSpendDest: Money? = null,
  val actualDailyAverageHome: Money,
  val actualDailyAverageDest: Money? = null,
  val paceStatus: RunwayPaceStatus
)

/**
 * Category spending breakdown item for the dashboard.
 * Supports dual-currency presentation (Primary: local/destination total, Secondary: home snapshot total).
 */
data class CategorySpendingSummary(
  val category: Category,
  val totalHomeAmount: Money,
  val totalDestAmount: Money? = null,
  val transactionCount: Int,
  val percentageOfTotal: BigDecimal, // e.g. 25.5% as BigDecimal
  val budgetHome: Money? = null,
  val budgetDest: Money? = null,
  val budgetProgress: Float? = null, // e.g. 0.65f for 65% spent
  val isOverBudget: Boolean = false
)

/**
 * Currency spending breakdown item for the dashboard.
 * Preserves separation of original currency and home currency equivalent.
 */
data class CurrencySpendingSummary(
  val currency: Currency,
  val totalOriginalAmount: Money,
  val totalHomeEquivalent: Money,
  val transactionCount: Int
)

enum class UnifiedTransactionType {
  EXPENSE,
  INCOME,
  TRANSFER
}

/**
 * Unified timeline activity entry for the recent ledger feed.
 * Adheres to rule:
 * 1. primaryAmountFormatted: currency actually spent/received (expenses, transfers, or deposits)
 * 2. secondaryAmountFormatted: immutable home-currency snapshot or converted home equivalent
 */
data class UnifiedTransactionItem(
  val id: String,
  val title: String,
  val subtitle: String,
  val type: UnifiedTransactionType,
  val primaryAmountFormatted: String,
  val secondaryAmountFormatted: String? = null,
  val timestamp: Long,
  val categoryName: String? = null,
  val originalExpense: Expense? = null
)

/**
 * Daily spend entry for the 30-day spending trend visualization.
 * Supports dual-currency presentation (Primary: local/destination total, Secondary: home snapshot total).
 */
data class DailySpendPoint(
  val timestamp: Long,
  val dayLabel: String,
  val fullDateLabel: String,
  val amountHome: Money,
  val amountDest: Money? = null,
  val transactionCount: Int = 0
)

/**
 * Aggregated domain model for the Dashboard supporting Dual-Currency:
 * 1. Primary: Amount spent in the currency actually paid
 * 2. Secondary: Immutable home-currency snapshot recorded with the transaction
 */
data class DashboardSummary(
  val period: DashboardPeriod,
  val homeCurrency: Currency,
  val destinationCurrency: Currency = Currency.EUR,
  val totalHomeSpending: Money,
  val totalDestSpending: Money? = null,
  val transactionCount: Int,
  val categoryBreakdowns: List<CategorySpendingSummary>,
  val currencyBreakdowns: List<CurrencySpendingSummary>,
  val recentExpenses: List<Expense>,
  val hasExpensesInPeriod: Boolean,
  val totalAllTimeExpensesCount: Int,
  val todayHomeSpending: Money = Money.zero(homeCurrency),
  val todayDestSpending: Money? = null,
  val todayIncomeHome: Money = Money.zero(homeCurrency),
  val todayIncomeDest: Money? = null,
  val effectiveDailyBudgetHome: Money? = null,
  val effectiveDailyBudgetDest: Money? = null,
  val monthHomeSpending: Money = Money.zero(homeCurrency),
  val monthDestSpending: Money? = null,
  val dailySpendingCap: BigDecimal? = null,
  val dailySpendingCapDest: Money? = null,
  val monthlySpendingCap: BigDecimal? = null,
  val monthlySpendingCapDest: Money? = null,
  val dailyCapProgress: Float? = null,
  val monthlyCapProgress: Float? = null,
  // Cashew & Ivy Wallet Safe-to-Spend & Cash Flow Metrics (Primary Dest, Secondary Home)
  val safeToSpendTodayHome: Money = Money.zero(homeCurrency),
  val safeToSpendTodayDest: Money? = null,
  val warningThresholdHome: Money? = null,
  val warningThresholdDest: Money? = null,
  val isBelowWarningThreshold: Boolean = false,
  val totalIncomeHome: Money = Money.zero(homeCurrency),
  val totalIncomeDest: Money? = null,
  val netCashFlowHome: Money = Money.zero(homeCurrency),
  val netCashFlowDest: Money? = null,
  val unifiedRecentTransactions: List<UnifiedTransactionItem> = emptyList(),
  // 30-Day Spending Trend Telemetry (Recharts-style curve & analytics)
  val thirtyDaySpendingTrend: List<DailySpendPoint> = emptyList(),
  val thirtyDayTotalHome: Money = Money.zero(homeCurrency),
  val thirtyDayTotalDest: Money? = null,
  val thirtyDayDailyAvgHome: Money = Money.zero(homeCurrency),
  val thirtyDayDailyAvgDest: Money? = null,
  val thirtyDayPeakDay: DailySpendPoint? = null,
  val thirtyDayTrendPercentage: Double? = null,
  val userPersona: UserPersona = UserPersona.INTERNATIONAL_STUDENT,
  val termRunwaySummary: TermRunwaySummary? = null,
  val unvaluedIncomeCurrencies: List<Currency> = emptyList(),
  val unvaluedTodayIncomeCurrencies: List<Currency> = emptyList(),
  /** Former home currencies excluded from selected-period totals because no current market rate was supplied. */
  val unconvertibleHomeCurrencies: List<Currency> = emptyList()
) {
  val isDailyBudgetExceeded: Boolean
    get() = safeToSpendTodayHome.amount < BigDecimal.ZERO || (dailyCapProgress != null && dailyCapProgress >= 1f)

  val isDailyBudgetCautious: Boolean
    get() = !isDailyBudgetExceeded && (isBelowWarningThreshold || (dailyCapProgress != null && dailyCapProgress in 0.75f..0.999f))

  val isWarningActive: Boolean
    get() = isDailyBudgetExceeded || isBelowWarningThreshold
}


