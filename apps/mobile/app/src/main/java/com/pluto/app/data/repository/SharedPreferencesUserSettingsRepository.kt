package com.pluto.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.UserSettingsRepository
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Concrete implementation of [UserSettingsRepository] backed by Android [SharedPreferences].
 *
 * Lightweight, zero-extra-dependency persistence perfect for user-level preferences,
 * theme choice, and onboarding completion state.
 */
class SharedPreferencesUserSettingsRepository(
  context: Context
) : UserSettingsRepository {

  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private val _settingsFlow = MutableSharedFlow<UserSettings>(
    replay = 1,
    onBufferOverflow = BufferOverflow.DROP_OLDEST
  )

  init {
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override fun observeSettings(): Flow<UserSettings> =
    _settingsFlow.asSharedFlow().distinctUntilChanged()

  override suspend fun getSettings(): UserSettings =
    loadSettingsFromPrefs()

  override suspend fun updateHomeCurrency(homeCurrency: Currency) {
    prefs.edit()
      .putString(KEY_HOME_CURRENCY, homeCurrency.code)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateDestinationCurrency(destinationCurrency: Currency) {
    prefs.edit()
      .putString(KEY_DESTINATION_CURRENCY, destinationCurrency.code)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateSpendingCaps(dailyCap: Double?, monthlyCap: Double?) {
    val editor = prefs.edit()
    if (dailyCap != null && dailyCap > 0.0) {
      editor.putFloat(KEY_DAILY_SPENDING_CAP, dailyCap.toFloat())
    } else {
      editor.remove(KEY_DAILY_SPENDING_CAP)
    }

    if (monthlyCap != null && monthlyCap > 0.0) {
      editor.putFloat(KEY_MONTHLY_SPENDING_CAP, monthlyCap.toFloat())
    } else {
      editor.remove(KEY_MONTHLY_SPENDING_CAP)
    }

    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateWarningThreshold(threshold: Double?, notificationsEnabled: Boolean) {
    val editor = prefs.edit()
    if (threshold != null && threshold > 0.0) {
      editor.putFloat(KEY_WARNING_THRESHOLD, threshold.toFloat())
    } else {
      editor.remove(KEY_WARNING_THRESHOLD)
    }
    editor.putBoolean(KEY_WARNING_NOTIFICATIONS_ENABLED, notificationsEnabled)
    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateCategoryBudgets(categoryBudgets: Map<String, Double>) {
    val editor = prefs.edit()
    val serialized = categoryBudgets.entries.joinToString(";") { "${it.key}:${it.value}" }
    editor.putString(KEY_CATEGORY_BUDGETS, serialized)
    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateThemeMode(themeMode: com.pluto.app.domain.model.ThemeMode) {
    prefs.edit()
      .putString(KEY_THEME_MODE, themeMode.name)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updatePersona(persona: com.pluto.app.domain.model.UserPersona) {
    prefs.edit()
      .putString(KEY_USER_PERSONA, persona.name)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateBudgetCycleType(budgetCycleType: com.pluto.app.domain.model.BudgetCycleType) {
    prefs.edit()
      .putString(KEY_BUDGET_CYCLE_TYPE, budgetCycleType.name)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateAcademicTermSettings(academicTermSettings: com.pluto.app.domain.model.AcademicTermSettings) {
    prefs.edit()
      .putString(KEY_TERM_NAME, academicTermSettings.termName)
      .putLong(KEY_TERM_START, academicTermSettings.termStartDate)
      .putLong(KEY_TERM_END, academicTermSettings.termEndDate)
      .putFloat(KEY_TERM_ALLOWANCE, academicTermSettings.totalAllowanceHome.toFloat())
      .putFloat(KEY_TERM_COMMITTED, academicTermSettings.tuitionAndFixedCommittedHome.toFloat())
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateTripSettings(tripSettings: com.pluto.app.domain.model.TripSettings) {
    prefs.edit()
      .putString(KEY_TRIP_NAME, tripSettings.tripName)
      .putLong(KEY_TRIP_START, tripSettings.tripStartDate)
      .putLong(KEY_TRIP_END, tripSettings.tripEndDate)
      .putFloat(KEY_TRIP_BUDGET, tripSettings.totalTripBudgetHome.toFloat())
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateBiometricLock(enabled: Boolean, timeoutMinutes: Int) {
    prefs.edit()
      .putBoolean(KEY_BIOMETRIC_LOCK_ENABLED, enabled)
      .putInt(KEY_AUTO_LOCK_TIMEOUT_MINUTES, timeoutMinutes)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updatePrivacyMode(enabled: Boolean) {
    prefs.edit()
      .putBoolean(KEY_PRIVACY_MODE_ENABLED, enabled)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateHomeTimeZone(timeZoneId: String?) {
    val editor = prefs.edit()
    val normalized = timeZoneId?.trim()?.takeIf { it.isNotEmpty() }
    if (normalized != null) {
      editor.putString(KEY_HOME_TIME_ZONE, normalized)
    } else {
      editor.remove(KEY_HOME_TIME_ZONE)
    }
    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateHomeModules(homeModules: List<HomeModuleConfig>) {
    val current = loadSettingsFromPrefs()
    val normalized = HomeLayoutPresets.normalize(homeModules, current.persona)
    prefs.edit()
      .putString(KEY_HOME_MODULES, serializeHomeModules(normalized))
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateSettings(settings: UserSettings) {
    val editor = prefs.edit()
      .putString(KEY_HOME_CURRENCY, settings.homeCurrency.code)
      .putString(KEY_DESTINATION_CURRENCY, settings.destinationCurrency.code)
      .putString(KEY_USER_PERSONA, settings.persona.name)
      .putString(KEY_BUDGET_CYCLE_TYPE, settings.budgetCycleType.name)
      .putString(KEY_TERM_NAME, settings.academicTermSettings.termName)
      .putLong(KEY_TERM_START, settings.academicTermSettings.termStartDate)
      .putLong(KEY_TERM_END, settings.academicTermSettings.termEndDate)
      .putFloat(KEY_TERM_ALLOWANCE, settings.academicTermSettings.totalAllowanceHome.toFloat())
      .putFloat(KEY_TERM_COMMITTED, settings.academicTermSettings.tuitionAndFixedCommittedHome.toFloat())
      .putString(KEY_TRIP_NAME, settings.tripSettings.tripName)
      .putLong(KEY_TRIP_START, settings.tripSettings.tripStartDate)
      .putLong(KEY_TRIP_END, settings.tripSettings.tripEndDate)
      .putFloat(KEY_TRIP_BUDGET, settings.tripSettings.totalTripBudgetHome.toFloat())
      .putInt(KEY_FIRST_DAY_OF_WEEK, settings.firstDayOfWeek)
      .putString(KEY_DEFAULT_CATEGORY, settings.defaultCategoryId)
      .putString(KEY_THEME_MODE, settings.themeMode.name)
      .putBoolean(KEY_ONBOARDING_COMPLETED, settings.isOnboardingCompleted)
      .putBoolean(KEY_WARNING_NOTIFICATIONS_ENABLED, settings.warningNotificationsEnabled)
      .putBoolean(KEY_BIOMETRIC_LOCK_ENABLED, settings.isBiometricLockEnabled)
      .putInt(KEY_AUTO_LOCK_TIMEOUT_MINUTES, settings.autoLockTimeoutMinutes)
      .putBoolean(KEY_PRIVACY_MODE_ENABLED, settings.isPrivacyModeEnabled)

    val serializedBudgets = settings.categoryMonthlyBudgets.entries.joinToString(";") { "${it.key}:${it.value}" }
    editor.putString(KEY_CATEGORY_BUDGETS, serializedBudgets)

    if (settings.dailySpendingCap != null && settings.dailySpendingCap > 0.0) {
      editor.putFloat(KEY_DAILY_SPENDING_CAP, settings.dailySpendingCap.toFloat())
    } else {
      editor.remove(KEY_DAILY_SPENDING_CAP)
    }

    if (settings.monthlySpendingCap != null && settings.monthlySpendingCap > 0.0) {
      editor.putFloat(KEY_MONTHLY_SPENDING_CAP, settings.monthlySpendingCap.toFloat())
    } else {
      editor.remove(KEY_MONTHLY_SPENDING_CAP)
    }

    if (settings.safeToSpendWarningThreshold != null && settings.safeToSpendWarningThreshold > 0.0) {
      editor.putFloat(KEY_WARNING_THRESHOLD, settings.safeToSpendWarningThreshold.toFloat())
    } else {
      editor.remove(KEY_WARNING_THRESHOLD)
    }

    val normalizedZone = settings.homeTimeZoneId?.trim()?.takeIf { it.isNotEmpty() }
    if (normalizedZone != null) {
      editor.putString(KEY_HOME_TIME_ZONE, normalizedZone)
    } else {
      editor.remove(KEY_HOME_TIME_ZONE)
    }

    val normalizedModules = HomeLayoutPresets.normalize(settings.homeModules, settings.persona)
    editor.putString(KEY_HOME_MODULES, serializeHomeModules(normalizedModules))

    editor.apply()
    _settingsFlow.tryEmit(settings.copy(homeModules = normalizedModules))
  }

  private fun loadSettingsFromPrefs(): UserSettings {
    val homeCurrencyCode = prefs.getString(KEY_HOME_CURRENCY, Currency.USD.code) ?: Currency.USD.code
    val homeCurrency = Currency.findByCode(homeCurrencyCode) ?: Currency.USD

    val destinationCurrencyCode = prefs.getString(KEY_DESTINATION_CURRENCY, Currency.EUR.code) ?: Currency.EUR.code
    val destinationCurrency = Currency.findByCode(destinationCurrencyCode) ?: Currency.EUR

    val personaRaw = prefs.getString(KEY_USER_PERSONA, com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT.name)
    val persona = try {
      com.pluto.app.domain.model.UserPersona.valueOf(personaRaw ?: com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT.name)
    } catch (e: Exception) {
      com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT
    }

    val cycleRaw = prefs.getString(KEY_BUDGET_CYCLE_TYPE, com.pluto.app.domain.model.BudgetCycleType.ACADEMIC_TERM.name)
    val budgetCycleType = try {
      com.pluto.app.domain.model.BudgetCycleType.valueOf(cycleRaw ?: com.pluto.app.domain.model.BudgetCycleType.ACADEMIC_TERM.name)
    } catch (e: Exception) {
      com.pluto.app.domain.model.BudgetCycleType.ACADEMIC_TERM
    }

    val termName = prefs.getString(KEY_TERM_NAME, "Fall Semester") ?: "Fall Semester"
    val termStart = prefs.getLong(KEY_TERM_START, System.currentTimeMillis() - (14L * 86400000L))
    val termEnd = prefs.getLong(KEY_TERM_END, System.currentTimeMillis() + (90L * 86400000L))
    val termAllowance = prefs.getFloat(KEY_TERM_ALLOWANCE, 6000f).toDouble()
    val termCommitted = prefs.getFloat(KEY_TERM_COMMITTED, 1500f).toDouble()
    val academicTermSettings = com.pluto.app.domain.model.AcademicTermSettings(
      termName = termName,
      termStartDate = termStart,
      termEndDate = termEnd,
      totalAllowanceHome = termAllowance,
      tuitionAndFixedCommittedHome = termCommitted
    )

    val tripName = prefs.getString(KEY_TRIP_NAME, "Current Trip") ?: "Current Trip"
    val tripStart = prefs.getLong(KEY_TRIP_START, System.currentTimeMillis())
    val tripEnd = prefs.getLong(KEY_TRIP_END, System.currentTimeMillis() + (14L * 86400000L))
    val tripBudget = prefs.getFloat(KEY_TRIP_BUDGET, 1500f).toDouble()
    val tripSettings = com.pluto.app.domain.model.TripSettings(
      tripName = tripName,
      tripStartDate = tripStart,
      tripEndDate = tripEnd,
      totalTripBudgetHome = tripBudget
    )

    val firstDay = prefs.getInt(KEY_FIRST_DAY_OF_WEEK, 1)
    val defaultCat = prefs.getString(KEY_DEFAULT_CATEGORY, Category.FOOD.id) ?: Category.FOOD.id
    val onboardingCompleted = prefs.getBoolean(KEY_ONBOARDING_COMPLETED, false)

    val dailyCap = if (prefs.contains(KEY_DAILY_SPENDING_CAP)) {
      prefs.getFloat(KEY_DAILY_SPENDING_CAP, 0f).toDouble()
    } else null

    val monthlyCap = if (prefs.contains(KEY_MONTHLY_SPENDING_CAP)) {
      prefs.getFloat(KEY_MONTHLY_SPENDING_CAP, 0f).toDouble()
    } else null

    val warningThreshold = if (prefs.contains(KEY_WARNING_THRESHOLD)) {
      prefs.getFloat(KEY_WARNING_THRESHOLD, 20f).toDouble()
    } else 20.0

    val notificationsEnabled = prefs.getBoolean(KEY_WARNING_NOTIFICATIONS_ENABLED, true)

    val categoryBudgetsRaw = prefs.getString(KEY_CATEGORY_BUDGETS, "") ?: ""
    val categoryBudgets = if (categoryBudgetsRaw.isNotBlank()) {
      categoryBudgetsRaw.split(";")
        .mapNotNull { pair ->
          val parts = pair.split(":")
          if (parts.size == 2) {
            val amount = parts[1].toDoubleOrNull()
            if (amount != null && amount > 0.0) parts[0] to amount else null
          } else null
        }.toMap()
    } else emptyMap()

    val themeModeRaw = prefs.getString(KEY_THEME_MODE, com.pluto.app.domain.model.ThemeMode.SYSTEM.name)
    val themeMode = try {
      com.pluto.app.domain.model.ThemeMode.valueOf(themeModeRaw ?: com.pluto.app.domain.model.ThemeMode.SYSTEM.name)
    } catch (e: Exception) {
      com.pluto.app.domain.model.ThemeMode.SYSTEM
    }

    val biometricLockEnabled = prefs.getBoolean(KEY_BIOMETRIC_LOCK_ENABLED, false)
    val autoLockTimeoutMinutes = prefs.getInt(KEY_AUTO_LOCK_TIMEOUT_MINUTES, 1)
    val privacyModeEnabled = prefs.getBoolean(KEY_PRIVACY_MODE_ENABLED, false)
    val homeTimeZoneId = prefs.getString(KEY_HOME_TIME_ZONE, null)?.trim()?.takeIf { it.isNotEmpty() }
    val homeModules = parseHomeModules(prefs.getString(KEY_HOME_MODULES, null), persona)

    return UserSettings(
      homeCurrency = homeCurrency,
      destinationCurrency = destinationCurrency,
      persona = persona,
      budgetCycleType = budgetCycleType,
      academicTermSettings = academicTermSettings,
      tripSettings = tripSettings,
      firstDayOfWeek = firstDay,
      defaultCategoryId = defaultCat,
      dailySpendingCap = dailyCap,
      monthlySpendingCap = monthlyCap,
      safeToSpendWarningThreshold = warningThreshold,
      warningNotificationsEnabled = notificationsEnabled,
      categoryMonthlyBudgets = categoryBudgets,
      themeMode = themeMode,
      isOnboardingCompleted = onboardingCompleted,
      isBiometricLockEnabled = biometricLockEnabled,
      autoLockTimeoutMinutes = autoLockTimeoutMinutes,
      isPrivacyModeEnabled = privacyModeEnabled,
      homeTimeZoneId = homeTimeZoneId,
      homeModules = homeModules
    )
  }

  private fun serializeHomeModules(modules: List<HomeModuleConfig>): String =
    modules.joinToString(",") { "${it.id.name}:${it.isEnabled}" }

  private fun parseHomeModules(
    raw: String?,
    persona: com.pluto.app.domain.model.UserPersona
  ): List<HomeModuleConfig> {
    if (raw.isNullOrBlank()) return HomeLayoutPresets.forPersona(persona)
    val parsed = raw.split(",")
      .mapNotNull { token ->
        val parts = token.split(":")
        if (parts.size == 2) {
          val id = runCatching { HomeModuleId.valueOf(parts[0].trim()) }.getOrNull()
          val enabled = parts[1].trim().toBooleanStrictOrNull()
          if (id != null && enabled != null) HomeModuleConfig(id, enabled) else null
        } else null
      }
    return HomeLayoutPresets.normalize(parsed, persona)
  }

  companion object {
    private const val PREFS_NAME = "global_expense_user_settings"
    private const val KEY_HOME_CURRENCY = "key_home_currency"
    private const val KEY_DESTINATION_CURRENCY = "key_destination_currency"
    private const val KEY_USER_PERSONA = "key_user_persona"
    private const val KEY_BUDGET_CYCLE_TYPE = "key_budget_cycle_type"
    private const val KEY_TERM_NAME = "key_term_name"
    private const val KEY_TERM_START = "key_term_start"
    private const val KEY_TERM_END = "key_term_end"
    private const val KEY_TERM_ALLOWANCE = "key_term_allowance"
    private const val KEY_TERM_COMMITTED = "key_term_committed"
    private const val KEY_TRIP_NAME = "key_trip_name"
    private const val KEY_TRIP_START = "key_trip_start"
    private const val KEY_TRIP_END = "key_trip_end"
    private const val KEY_TRIP_BUDGET = "key_trip_budget"
    private const val KEY_FIRST_DAY_OF_WEEK = "key_first_day_of_week"
    private const val KEY_DEFAULT_CATEGORY = "key_default_category"
    private const val KEY_DAILY_SPENDING_CAP = "key_daily_spending_cap"
    private const val KEY_MONTHLY_SPENDING_CAP = "key_monthly_spending_cap"
    private const val KEY_WARNING_THRESHOLD = "key_warning_threshold"
    private const val KEY_WARNING_NOTIFICATIONS_ENABLED = "key_warning_notifications_enabled"
    private const val KEY_CATEGORY_BUDGETS = "key_category_budgets"
    private const val KEY_THEME_MODE = "key_theme_mode"
    private const val KEY_ONBOARDING_COMPLETED = "key_onboarding_completed"
    private const val KEY_BIOMETRIC_LOCK_ENABLED = "key_biometric_lock_enabled"
    private const val KEY_AUTO_LOCK_TIMEOUT_MINUTES = "key_auto_lock_timeout_minutes"
    private const val KEY_PRIVACY_MODE_ENABLED = "key_privacy_mode_enabled"
    private const val KEY_HOME_TIME_ZONE = "key_home_time_zone"
    private const val KEY_HOME_MODULES = "key_home_modules"
  }
}
