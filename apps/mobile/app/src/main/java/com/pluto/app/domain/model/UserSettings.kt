package com.pluto.app.domain.model

import java.math.BigDecimal

/**
 * Persona profiles that tailor the financial experience for specific international lifestyles.
 */
enum class UserPersona(val displayName: String, val subtitle: String, val badge: String) {
  INTERNATIONAL_STUDENT(
    displayName = "International Student",
    subtitle = "Semester allowance runway, tuition, books & flatmate living",
    badge = "Student Mode"
  ),
  EXPAT(
    displayName = "Expat & Remote Worker",
    subtitle = "Monthly income, recurring housing, utilities & remittances",
    badge = "Expat Mode"
  ),
  TOURIST(
    displayName = "Tourist & Traveler",
    subtitle = "Trip budget, day-by-day vacation spending & live FX",
    badge = "Traveler Mode"
  )
}

/**
 * Modular sections configurable for the Home screen feed.
 */
enum class HomeModuleId(val title: String, val description: String) {
  STACKED_WALLETS(
    title = "Wallet Summary",
    description = "Active travel wallet & reserve overview"
  ),
  DAILY_SAFE_TO_SPEND(
    title = "Daily Safe-to-Spend",
    description = "Remaining daily allowance & cap progress"
  ),
  CYCLE_RUNWAY(
    title = "Cycle Runway",
    description = "Semester or trip pace & discretionary left"
  ),
  CASH_FLOW_SUMMARY(
    title = "Cash Flow Summary",
    description = "Period income, expenses & net flow"
  ),
  SPENDING_TREND(
    title = "30-Day Spending",
    description = "Interactive 30-day expenditure curve"
  ),
  CATEGORY_BUDGETS(
    title = "Category Budgets",
    description = "Top category spending & limits"
  ),
  RECENT_EXPENSES(
    title = "Recent Activity",
    description = "Latest expenses & transactions"
  )
}

data class HomeModuleConfig(
  val id: HomeModuleId,
  val isEnabled: Boolean = true
)

object HomeLayoutPresets {
  fun forPersona(persona: UserPersona): List<HomeModuleConfig> {
    val enabledOrder = when (persona) {
      UserPersona.INTERNATIONAL_STUDENT -> listOf(
        HomeModuleId.CYCLE_RUNWAY,
        HomeModuleId.DAILY_SAFE_TO_SPEND,
        HomeModuleId.RECENT_EXPENSES
      )
      UserPersona.EXPAT -> listOf(
        HomeModuleId.CASH_FLOW_SUMMARY,
        HomeModuleId.CATEGORY_BUDGETS,
        HomeModuleId.RECENT_EXPENSES
      )
      UserPersona.TOURIST -> listOf(
        HomeModuleId.DAILY_SAFE_TO_SPEND,
        HomeModuleId.SPENDING_TREND,
        HomeModuleId.RECENT_EXPENSES
      )
    }
    val remaining = HomeModuleId.entries.filter { it !in enabledOrder }
    return enabledOrder.map { HomeModuleConfig(it, isEnabled = true) } +
      remaining.map { HomeModuleConfig(it, isEnabled = false) }
  }

  /**
   * Ensures every [HomeModuleId] appears exactly once in a persisted module list,
   * preserving stored order and appending any newly introduced modules as disabled.
   */
  fun normalize(modules: List<HomeModuleConfig>, persona: UserPersona): List<HomeModuleConfig> {
    if (modules.isEmpty()) return forPersona(persona)
    val seen = LinkedHashSet<HomeModuleId>()
    val result = mutableListOf<HomeModuleConfig>()
    for (entry in modules) {
      if (seen.add(entry.id)) {
        result.add(entry)
      }
    }
    for (id in HomeModuleId.entries) {
      if (seen.add(id)) {
        result.add(HomeModuleConfig(id, isEnabled = false))
      }
    }
    return result
  }

  fun matchesPreset(modules: List<HomeModuleConfig>, persona: UserPersona): Boolean {
    val preset = forPersona(persona)
    val normalized = normalize(modules, persona)
    if (normalized.size != preset.size) return false
    return normalized.zip(preset).all { (a, b) -> a.id == b.id && a.isEnabled == b.isEnabled }
  }

  fun isCustomLayout(modules: List<HomeModuleConfig>, persona: UserPersona): Boolean =
    !matchesPreset(modules, persona)
}

/**
 * Flexible budget cycle types matching different life stages and financial schedules.
 */
enum class BudgetCycleType(val displayName: String) {
  ACADEMIC_TERM("Academic Semester / Term"),
  MONTHLY("Monthly Calendar / Payday"),
  TRIP("Trip / Vacation Duration")
}

/**
 * Configuration for an academic term (semester, trimester, or quarter).
 */
data class AcademicTermSettings(
  val termName: String = "Fall Semester",
  val termStartDate: Long = System.currentTimeMillis() - (14L * 86400000L), // started 2 weeks ago
  val termEndDate: Long = System.currentTimeMillis() + (90L * 86400000L),  // ~90 days remaining
  val totalAllowanceHome: BigDecimal = BigDecimal("6000.00"),
  val tuitionAndFixedCommittedHome: BigDecimal = BigDecimal("1500.00")
)

/**
 * Configuration for a vacation or travel trip.
 */
data class TripSettings(
  val tripName: String = "Current Trip",
  val tripStartDate: Long = System.currentTimeMillis(),
  val tripEndDate: Long = System.currentTimeMillis() + (14L * 86400000L),
  val totalTripBudgetHome: BigDecimal = BigDecimal("1500.00")
)

/**
 * User-level application preferences and configuration.
 */
data class UserSettings(
  val homeCurrency: Currency = Currency.USD,
  val destinationCurrency: Currency = Currency.EUR,
  val persona: UserPersona = UserPersona.INTERNATIONAL_STUDENT,
  val budgetCycleType: BudgetCycleType = BudgetCycleType.ACADEMIC_TERM,
  val academicTermSettings: AcademicTermSettings = AcademicTermSettings(),
  val tripSettings: TripSettings = TripSettings(),
  val firstDayOfWeek: Int = 1,
  val defaultCategoryId: String = Category.FOOD.id,
  val dailySpendingCap: BigDecimal? = null,
  val monthlySpendingCap: BigDecimal? = null,
  val safeToSpendWarningThreshold: BigDecimal? = BigDecimal("20.00"),
  val warningNotificationsEnabled: Boolean = true,
  val categoryMonthlyBudgets: Map<String, BigDecimal> = emptyMap(),
  val isDarkThemeTheme: Boolean? = null,
  val themeMode: ThemeMode = ThemeMode.SYSTEM,
  val isOnboardingCompleted: Boolean = false,
  val isBiometricLockEnabled: Boolean = false,
  val autoLockTimeoutMinutes: Int = 1,
  val isPrivacyModeEnabled: Boolean = false,
  val homeTimeZoneId: String? = null,
  val homeModules: List<HomeModuleConfig> = HomeLayoutPresets.forPersona(persona)
)

enum class ThemeMode {
  SYSTEM,
  LIGHT,
  DARK
}
