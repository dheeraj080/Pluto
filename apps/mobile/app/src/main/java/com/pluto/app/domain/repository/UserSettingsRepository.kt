package com.pluto.app.domain.repository

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import kotlinx.coroutines.flow.Flow
import java.math.BigDecimal

/**
 * Domain repository contract for user settings and preferences.
 */
interface UserSettingsRepository {
  /**
   * Observes user settings changes across the application.
   */
  fun observeSettings(): Flow<UserSettings>

  /**
   * Gets current snapshot of user settings.
   */
  suspend fun getSettings(): UserSettings

  /**
   * Updates user reference home currency.
   */
  suspend fun updateHomeCurrency(homeCurrency: Currency)

  /**
   * Updates user active travel / destination currency.
   */
  suspend fun updateDestinationCurrency(destinationCurrency: Currency)

  /**
   * Updates user daily and monthly spending caps in home currency.
   */
  suspend fun updateSpendingCaps(dailyCap: BigDecimal?, monthlyCap: BigDecimal?)

  /**
   * Updates user safe-to-spend minimum warning threshold and notification alert preference.
   */
  suspend fun updateWarningThreshold(threshold: BigDecimal?, notificationsEnabled: Boolean = true)

  /**
   * Updates category-specific monthly spending budgets in home currency.
   */
  suspend fun updateCategoryBudgets(categoryBudgets: Map<String, BigDecimal>)

  /**
   * Updates user theme preference (System, Light, Dark).
   */
  suspend fun updateThemeMode(themeMode: com.pluto.app.domain.model.ThemeMode)

  /**
   * Updates user persona (International Student, Expat, Tourist).
   */
  suspend fun updatePersona(persona: com.pluto.app.domain.model.UserPersona)

  /**
   * Updates budget cycle preference.
   */
  suspend fun updateBudgetCycleType(budgetCycleType: com.pluto.app.domain.model.BudgetCycleType)

  /**
   * Updates academic term settings and semester allowance.
   */
  suspend fun updateAcademicTermSettings(academicTermSettings: com.pluto.app.domain.model.AcademicTermSettings)

  /**
   * Updates trip settings and vacation budget.
   */
  suspend fun updateTripSettings(tripSettings: com.pluto.app.domain.model.TripSettings)

  /**
   * Updates biometric lock preference and timeout in minutes.
   */
  suspend fun updateBiometricLock(enabled: Boolean, timeoutMinutes: Int = 1)

  /**
   * Updates privacy shield mode (FLAG_SECURE and balance concealing).
   */
  suspend fun updatePrivacyMode(enabled: Boolean)

  /**
   * Updates user's preferred home IANA time zone identifier (null resets to currency default).
   */
  suspend fun updateHomeTimeZone(timeZoneId: String?)

  /**
   * Updates user's ordered list of customizable Home feed modules.
   */
  suspend fun updateHomeModules(homeModules: List<com.pluto.app.domain.model.HomeModuleConfig>)

  /**
   * Updates full settings payload.
   */
  suspend fun updateSettings(settings: UserSettings)
}

