package com.pluto.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.BudgetCycleType
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DualZoneClockEngine
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.ThemeMode
import com.pluto.app.domain.model.TripSettings
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.UserSettingsRepository
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import java.math.BigDecimal

/**
 * Concrete implementation of [UserSettingsRepository] backed by Android [SharedPreferences].
 *
 * All monetary fields are persisted as exact decimal strings (`BigDecimal.toPlainString()`),
 * with backward-compatible reads for legacy Float preferences written by earlier app versions.
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
      .remove(KEY_HOME_TIME_ZONE)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateDestinationCurrency(destinationCurrency: Currency) {
    prefs.edit()
      .putString(KEY_DESTINATION_CURRENCY, destinationCurrency.code)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateSpendingCaps(dailyCap: BigDecimal?, monthlyCap: BigDecimal?) {
    val editor = prefs.edit()
    if (dailyCap != null && dailyCap > BigDecimal.ZERO) {
      editor.putString(KEY_DAILY_SPENDING_CAP, dailyCap.toPlainString())
    } else {
      editor.remove(KEY_DAILY_SPENDING_CAP)
    }

    if (monthlyCap != null && monthlyCap > BigDecimal.ZERO) {
      editor.putString(KEY_MONTHLY_SPENDING_CAP, monthlyCap.toPlainString())
    } else {
      editor.remove(KEY_MONTHLY_SPENDING_CAP)
    }

    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateWarningThreshold(threshold: BigDecimal?, notificationsEnabled: Boolean) {
    val editor = prefs.edit()
    if (threshold != null && threshold > BigDecimal.ZERO) {
      editor.putString(KEY_WARNING_THRESHOLD, threshold.toPlainString())
    } else {
      editor.remove(KEY_WARNING_THRESHOLD)
    }
    editor.putBoolean(KEY_WARNING_NOTIFICATIONS_ENABLED, notificationsEnabled)
    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateCategoryBudgets(categoryBudgets: Map<String, BigDecimal>) {
    val editor = prefs.edit()
    val serialized = categoryBudgets.entries
      .filter { it.value > BigDecimal.ZERO }
      .joinToString(";") { "${it.key}:${it.value.toPlainString()}" }
    editor.putString(KEY_CATEGORY_BUDGETS, serialized)
    editor.apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateThemeMode(themeMode: ThemeMode) {
    prefs.edit()
      .putString(KEY_THEME_MODE, themeMode.name)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updatePersona(persona: UserPersona) {
    prefs.edit()
      .putString(KEY_USER_PERSONA, persona.name)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateBudgetCycleType(budgetCycleType: BudgetCycleType) {
    prefs.edit()
      .putString(KEY_BUDGET_CYCLE_TYPE, budgetCycleType.name)
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateAcademicTermSettings(academicTermSettings: AcademicTermSettings) {
    prefs.edit()
      .putString(KEY_TERM_NAME, academicTermSettings.termName)
      .putLong(KEY_TERM_START, academicTermSettings.termStartDate)
      .putLong(KEY_TERM_END, academicTermSettings.termEndDate)
      .putString(KEY_TERM_ALLOWANCE, academicTermSettings.totalAllowanceHome.max(BigDecimal.ZERO).toPlainString())
      .putString(KEY_TERM_COMMITTED, academicTermSettings.tuitionAndFixedCommittedHome.max(BigDecimal.ZERO).toPlainString())
      .apply()
    _settingsFlow.tryEmit(loadSettingsFromPrefs())
  }

  override suspend fun updateTripSettings(tripSettings: TripSettings) {
    prefs.edit()
      .putString(KEY_TRIP_NAME, tripSettings.tripName)
      .putLong(KEY_TRIP_START, tripSettings.tripStartDate)
      .putLong(KEY_TRIP_END, tripSettings.tripEndDate)
      .putString(KEY_TRIP_BUDGET, tripSettings.totalTripBudgetHome.max(BigDecimal.ZERO).toPlainString())
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
    val normalized = DualZoneClockEngine.normalizeHomeTimeZoneId(
      timeZoneId,
      loadSettingsFromPrefs().homeCurrency
    )
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
      .putString(KEY_TERM_ALLOWANCE, settings.academicTermSettings.totalAllowanceHome.max(BigDecimal.ZERO).toPlainString())
      .putString(KEY_TERM_COMMITTED, settings.academicTermSettings.tuitionAndFixedCommittedHome.max(BigDecimal.ZERO).toPlainString())
      .putString(KEY_TRIP_NAME, settings.tripSettings.tripName)
      .putLong(KEY_TRIP_START, settings.tripSettings.tripStartDate)
      .putLong(KEY_TRIP_END, settings.tripSettings.tripEndDate)
      .putString(KEY_TRIP_BUDGET, settings.tripSettings.totalTripBudgetHome.max(BigDecimal.ZERO).toPlainString())
      .putInt(KEY_FIRST_DAY_OF_WEEK, settings.firstDayOfWeek)
      .putString(KEY_DEFAULT_CATEGORY, settings.defaultCategoryId)
      .putString(KEY_THEME_MODE, settings.themeMode.name)
      .putBoolean(KEY_ONBOARDING_COMPLETED, settings.isOnboardingCompleted)
      .putBoolean(KEY_WARNING_NOTIFICATIONS_ENABLED, settings.warningNotificationsEnabled)
      .putBoolean(KEY_BIOMETRIC_LOCK_ENABLED, settings.isBiometricLockEnabled)
      .putInt(KEY_AUTO_LOCK_TIMEOUT_MINUTES, settings.autoLockTimeoutMinutes)
      .putBoolean(KEY_PRIVACY_MODE_ENABLED, settings.isPrivacyModeEnabled)

    val serializedBudgets = settings.categoryMonthlyBudgets.entries
      .filter { it.value > BigDecimal.ZERO }
      .joinToString(";") { "${it.key}:${it.value.toPlainString()}" }
    editor.putString(KEY_CATEGORY_BUDGETS, serializedBudgets)

    if (settings.dailySpendingCap != null && settings.dailySpendingCap > BigDecimal.ZERO) {
      editor.putString(KEY_DAILY_SPENDING_CAP, settings.dailySpendingCap.toPlainString())
    } else {
      editor.remove(KEY_DAILY_SPENDING_CAP)
    }

    if (settings.monthlySpendingCap != null && settings.monthlySpendingCap > BigDecimal.ZERO) {
      editor.putString(KEY_MONTHLY_SPENDING_CAP, settings.monthlySpendingCap.toPlainString())
    } else {
      editor.remove(KEY_MONTHLY_SPENDING_CAP)
    }

    if (settings.safeToSpendWarningThreshold != null && settings.safeToSpendWarningThreshold > BigDecimal.ZERO) {
      editor.putString(KEY_WARNING_THRESHOLD, settings.safeToSpendWarningThreshold.toPlainString())
    } else {
      editor.remove(KEY_WARNING_THRESHOLD)
    }

    val normalizedZone = DualZoneClockEngine.normalizeHomeTimeZoneId(
      settings.homeTimeZoneId,
      settings.homeCurrency
    )
    if (normalizedZone != null) {
      editor.putString(KEY_HOME_TIME_ZONE, normalizedZone)
    } else {
      editor.remove(KEY_HOME_TIME_ZONE)
    }

    val normalizedModules = HomeLayoutPresets.normalize(settings.homeModules, settings.persona)
    editor.putString(KEY_HOME_MODULES, serializeHomeModules(normalizedModules))

    editor.apply()
    _settingsFlow.tryEmit(
      settings.copy(homeTimeZoneId = normalizedZone, homeModules = normalizedModules)
    )
  }

  private fun loadSettingsFromPrefs(): UserSettings {
    val storedHomeCode = prefs.getString(KEY_HOME_CURRENCY, null)
    val homeCurrency = if (storedHomeCode == null) {
      Currency.USD
    } else {
      Currency.requireByCode(storedHomeCode)
    }

    val storedDestinationCode = prefs.getString(KEY_DESTINATION_CURRENCY, null)
    val destinationCurrency = if (storedDestinationCode == null) {
      Currency.EUR
    } else {
      Currency.requireByCode(storedDestinationCode)
    }

    val personaRaw = prefs.getString(KEY_USER_PERSONA, UserPersona.INTERNATIONAL_STUDENT.name)
    val persona = try {
      UserPersona.valueOf(personaRaw ?: UserPersona.INTERNATIONAL_STUDENT.name)
    } catch (_: Exception) {
      UserPersona.INTERNATIONAL_STUDENT
    }

    val cycleRaw = prefs.getString(KEY_BUDGET_CYCLE_TYPE, BudgetCycleType.ACADEMIC_TERM.name)
    val budgetCycleType = try {
      BudgetCycleType.valueOf(cycleRaw ?: BudgetCycleType.ACADEMIC_TERM.name)
    } catch (_: Exception) {
      BudgetCycleType.ACADEMIC_TERM
    }

    val termName = prefs.getString(KEY_TERM_NAME, "Fall Semester") ?: "Fall Semester"
    val termStart = prefs.getLong(KEY_TERM_START, System.currentTimeMillis() - (14L * 86400000L))
    val termEnd = prefs.getLong(KEY_TERM_END, System.currentTimeMillis() + (90L * 86400000L))
    val termAllowance = readDecimalFromPrefs(KEY_TERM_ALLOWANCE, BigDecimal("6000.00")) ?: BigDecimal("6000.00")
    val termCommitted = readDecimalFromPrefs(KEY_TERM_COMMITTED, BigDecimal("1500.00")) ?: BigDecimal("1500.00")
    val academicTermSettings = AcademicTermSettings(
      termName = termName,
      termStartDate = termStart,
      termEndDate = termEnd,
      totalAllowanceHome = termAllowance.max(BigDecimal.ZERO),
      tuitionAndFixedCommittedHome = termCommitted.max(BigDecimal.ZERO)
    )

    val tripName = prefs.getString(KEY_TRIP_NAME, "Current Period") ?: "Current Period"
    val tripStart = prefs.getLong(KEY_TRIP_START, System.currentTimeMillis())
    val tripEnd = prefs.getLong(KEY_TRIP_END, System.currentTimeMillis() + (14L * 86400000L))
    val tripBudget = readDecimalFromPrefs(KEY_TRIP_BUDGET, BigDecimal("1500.00")) ?: BigDecimal("1500.00")
    val tripSettings = TripSettings(
      tripName = tripName,
      tripStartDate = tripStart,
      tripEndDate = tripEnd,
      totalTripBudgetHome = tripBudget.max(BigDecimal.ZERO)
    )

    val firstDay = prefs.getInt(KEY_FIRST_DAY_OF_WEEK, 1)
    val defaultCat = prefs.getString(KEY_DEFAULT_CATEGORY, Category.FOOD.id) ?: Category.FOOD.id
    val onboardingCompleted = prefs.getBoolean(KEY_ONBOARDING_COMPLETED, false)

    val dailyCap = readDecimalFromPrefs(KEY_DAILY_SPENDING_CAP, null)
      ?.takeIf { it > BigDecimal.ZERO }

    val monthlyCap = readDecimalFromPrefs(KEY_MONTHLY_SPENDING_CAP, null)
      ?.takeIf { it > BigDecimal.ZERO }

    val warningThreshold = readDecimalFromPrefs(KEY_WARNING_THRESHOLD, BigDecimal("20.00"))
      ?.takeIf { it > BigDecimal.ZERO }

    val notificationsEnabled = prefs.getBoolean(KEY_WARNING_NOTIFICATIONS_ENABLED, true)

    val categoryBudgetsRaw = prefs.getString(KEY_CATEGORY_BUDGETS, "") ?: ""
    val categoryBudgets = if (categoryBudgetsRaw.isNotBlank()) {
      categoryBudgetsRaw.split(";")
        .mapNotNull { pair ->
          val parts = pair.split(":")
          if (parts.size == 2) {
            val amount = parts[1].trim().toBigDecimalOrNull()
            if (amount != null && amount > BigDecimal.ZERO) parts[0] to amount else null
          } else null
        }.toMap()
    } else emptyMap()

    val themeModeRaw = prefs.getString(KEY_THEME_MODE, ThemeMode.SYSTEM.name)
    val themeMode = try {
      ThemeMode.valueOf(themeModeRaw ?: ThemeMode.SYSTEM.name)
    } catch (_: Exception) {
      ThemeMode.SYSTEM
    }

    val biometricLockEnabled = prefs.getBoolean(KEY_BIOMETRIC_LOCK_ENABLED, false)
    val autoLockTimeoutMinutes = prefs.getInt(KEY_AUTO_LOCK_TIMEOUT_MINUTES, 1)
    val privacyModeEnabled = prefs.getBoolean(KEY_PRIVACY_MODE_ENABLED, false)
    val homeTimeZoneId = DualZoneClockEngine.normalizeHomeTimeZoneId(
      prefs.getString(KEY_HOME_TIME_ZONE, null),
      homeCurrency
    )
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

  /**
   * Reads a decimal value stored either as an exact decimal String (current format)
   * or a legacy Float/Number (older versions) without throwing ClassCastException.
   */
  private fun readDecimalFromPrefs(key: String, defaultValue: BigDecimal?): BigDecimal? {
    if (!prefs.contains(key)) return defaultValue
    val raw = prefs.all[key] ?: return defaultValue
    return when (raw) {
      is String -> raw.trim().takeIf { it.isNotEmpty() }?.toBigDecimalOrNull() ?: defaultValue
      is Float -> BigDecimal(raw.toString())
      is Number -> raw.toString().toBigDecimalOrNull() ?: defaultValue
      else -> defaultValue
    }
  }

  private fun serializeHomeModules(modules: List<HomeModuleConfig>): String =
    modules.joinToString(",") { "${it.id.name}:${it.isEnabled}" }

  private fun parseHomeModules(
    raw: String?,
    persona: UserPersona
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
