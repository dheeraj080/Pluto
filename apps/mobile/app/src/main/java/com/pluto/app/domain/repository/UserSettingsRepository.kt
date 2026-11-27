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
   * Updates the user's reference currency.
   */
  suspend fun updateHomeCurrency(homeCurrency: Currency)

  /**
   * Updates the user's active primary spending currency.
   */
  suspend fun updateDestinationCurrency(destinationCurrency: Currency)

  /**
   * Updates daily and monthly spending caps in the reference currency.
   */
  suspend fun updateSpendingCaps(dailyCap: BigDecimal?, monthlyCap: BigDecimal?)

  /**
   * Updates the safe-to-spend warning threshold and notification preference.
   */
  suspend fun updateWarningThreshold(threshold: BigDecimal?, notificationsEnabled: Boolean = true)

  /**
   * Updates category-specific monthly spending budgets in the reference currency.
   */
  suspend fun updateCategoryBudgets(categoryBudgets: Map<String, BigDecimal>)

  /**
   * Updates the theme preference (System, Light, Dark).
   */
  suspend fun updateThemeMode(themeMode: com.pluto.app.domain.model.ThemeMode)

  /**
   * Updates the spending profile preset.
   */
  suspend fun updatePersona(persona: com.pluto.app.domain.model.UserPersona)

  /**
   * Updates the budget-cycle preference.
   */
  suspend fun updateBudgetCycleType(budgetCycleType: com.pluto.app.domain.model.BudgetCycleType)

  /**
   * Updates term settings and the period allowance.
   */
  suspend fun updateAcademicTermSettings(academicTermSettings: com.pluto.app.domain.model.AcademicTermSettings)

  /**
   * Updates fixed-period settings and budget.
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

