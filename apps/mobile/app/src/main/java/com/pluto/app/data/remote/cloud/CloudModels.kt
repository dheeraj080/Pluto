package com.pluto.app.data.remote.cloud

import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.BudgetCycleType
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.RecurrenceFrequency
import com.pluto.app.domain.model.ThemeMode
import com.pluto.app.domain.model.TripSettings
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp
import java.math.BigDecimal

@IgnoreExtraProperties
data class CloudUserSettings(
  @DocumentId val id: String = "",
  val userId: String = "",
  val homeCurrencyCode: String = Currency.USD.code,
  val destinationCurrencyCode: String = Currency.EUR.code,
  val persona: String = UserPersona.INTERNATIONAL_STUDENT.name,
  val budgetCycleType: String = BudgetCycleType.ACADEMIC_TERM.name,
  val termName: String = "Fall Semester",
  val termStartDate: Long = 0L,
  val termEndDate: Long = 0L,
  val totalAllowanceHome: Double = 6000.0,
  val tuitionAndFixedCommittedHome: Double = 1500.0,
  val tripName: String = "Current Trip",
  val tripStartDate: Long = 0L,
  val tripEndDate: Long = 0L,
  val totalTripBudgetHome: Double = 1500.0,
  val firstDayOfWeek: Int = 1,
  val defaultCategoryId: String = Category.FOOD.id,
  val dailySpendingCap: Double? = null,
  val monthlySpendingCap: Double? = null,
  val safeToSpendWarningThreshold: Double? = 20.0,
  val warningNotificationsEnabled: Boolean = true,
  val categoryMonthlyBudgets: Map<String, Double> = emptyMap(),
  val themeMode: String = ThemeMode.SYSTEM.name,
  val isOnboardingCompleted: Boolean = false,
  val isBiometricLockEnabled: Boolean = false,
  val autoLockTimeoutMinutes: Int = 1,
  val isPrivacyModeEnabled: Boolean = false,
  val homeTimeZoneId: String? = null,
  val homeModules: List<String> = emptyList(),
  @ServerTimestamp val createdAt: Timestamp? = null,
  @ServerTimestamp val updatedAt: Timestamp? = null
) {
  fun toDomain(): UserSettings {
    val home = Currency.findByCode(homeCurrencyCode) ?: Currency.USD
    val dest = Currency.findByCode(destinationCurrencyCode) ?: Currency.EUR
    val resolvedPersona = runCatching { UserPersona.valueOf(persona) }.getOrDefault(UserPersona.INTERNATIONAL_STUDENT)
    val resolvedCycle = runCatching { BudgetCycleType.valueOf(budgetCycleType) }.getOrDefault(BudgetCycleType.ACADEMIC_TERM)
    val resolvedTheme = runCatching { ThemeMode.valueOf(themeMode) }.getOrDefault(ThemeMode.SYSTEM)
    return UserSettings(
      homeCurrency = home,
      destinationCurrency = dest,
      persona = resolvedPersona,
      budgetCycleType = resolvedCycle,
      academicTermSettings = AcademicTermSettings(
        termName = termName,
        termStartDate = termStartDate,
        termEndDate = termEndDate,
        totalAllowanceHome = totalAllowanceHome,
        tuitionAndFixedCommittedHome = tuitionAndFixedCommittedHome
      ),
      tripSettings = TripSettings(
        tripName = tripName,
        tripStartDate = tripStartDate,
        tripEndDate = tripEndDate,
        totalTripBudgetHome = totalTripBudgetHome
      ),
      firstDayOfWeek = firstDayOfWeek,
      defaultCategoryId = defaultCategoryId,
      dailySpendingCap = dailySpendingCap,
      monthlySpendingCap = monthlySpendingCap,
      safeToSpendWarningThreshold = safeToSpendWarningThreshold,
      warningNotificationsEnabled = warningNotificationsEnabled,
      categoryMonthlyBudgets = categoryMonthlyBudgets,
      themeMode = resolvedTheme,
      isOnboardingCompleted = isOnboardingCompleted,
      isBiometricLockEnabled = isBiometricLockEnabled,
      autoLockTimeoutMinutes = autoLockTimeoutMinutes,
      isPrivacyModeEnabled = isPrivacyModeEnabled,
      homeTimeZoneId = homeTimeZoneId?.trim()?.takeIf { it.isNotEmpty() },
      homeModules = parseCloudHomeModules(homeModules, resolvedPersona)
    )
  }

  private fun parseCloudHomeModules(
    rawList: List<String>,
    resolvedPersona: UserPersona
  ): List<HomeModuleConfig> {
    if (rawList.isEmpty()) return HomeLayoutPresets.forPersona(resolvedPersona)
    val parsed = rawList.mapNotNull { entry ->
      val parts = entry.split(":")
      if (parts.size == 2) {
        val id = runCatching { HomeModuleId.valueOf(parts[0].trim()) }.getOrNull()
        val enabled = parts[1].trim().toBooleanStrictOrNull()
        if (id != null && enabled != null) HomeModuleConfig(id, enabled) else null
      } else null
    }
    return HomeLayoutPresets.normalize(parsed, resolvedPersona)
  }

  companion object {
    fun toCreateMap(uid: String, s: UserSettings): Map<String, Any> {
      val map = toMutableFieldMap(s)
      map["userId"] = uid
      map["createdAt"] = FieldValue.serverTimestamp()
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    fun toUpdateMap(s: UserSettings): Map<String, Any> {
      val map = toMutableFieldMap(s)
      if (s.homeTimeZoneId.isNullOrBlank()) {
        map["homeTimeZoneId"] = FieldValue.delete()
      }
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    private fun toMutableFieldMap(s: UserSettings): MutableMap<String, Any> {
      val map = mutableMapOf<String, Any>(
        "homeCurrencyCode" to s.homeCurrency.code,
        "destinationCurrencyCode" to s.destinationCurrency.code,
        "persona" to s.persona.name,
        "budgetCycleType" to s.budgetCycleType.name,
        "termName" to s.academicTermSettings.termName.take(100),
        "termStartDate" to s.academicTermSettings.termStartDate,
        "termEndDate" to s.academicTermSettings.termEndDate,
        "totalAllowanceHome" to s.academicTermSettings.totalAllowanceHome.coerceAtLeast(0.0),
        "tuitionAndFixedCommittedHome" to s.academicTermSettings.tuitionAndFixedCommittedHome.coerceAtLeast(0.0),
        "tripName" to s.tripSettings.tripName.take(100),
        "tripStartDate" to s.tripSettings.tripStartDate,
        "tripEndDate" to s.tripSettings.tripEndDate,
        "totalTripBudgetHome" to s.tripSettings.totalTripBudgetHome.coerceAtLeast(0.0),
        "firstDayOfWeek" to s.firstDayOfWeek.coerceIn(1, 7),
        "defaultCategoryId" to s.defaultCategoryId.take(64).ifBlank { Category.FOOD.id },
        "warningNotificationsEnabled" to s.warningNotificationsEnabled,
        "categoryMonthlyBudgets" to s.categoryMonthlyBudgets,
        "themeMode" to s.themeMode.name,
        "isOnboardingCompleted" to s.isOnboardingCompleted,
        "isBiometricLockEnabled" to s.isBiometricLockEnabled,
        "autoLockTimeoutMinutes" to s.autoLockTimeoutMinutes.coerceIn(0, 1440),
        "isPrivacyModeEnabled" to s.isPrivacyModeEnabled,
        "homeModules" to HomeLayoutPresets.normalize(s.homeModules, s.persona)
          .map { "${it.id.name}:${it.isEnabled}" }
      )
      s.dailySpendingCap?.let { map["dailySpendingCap"] = it.coerceAtLeast(0.0) }
      s.monthlySpendingCap?.let { map["monthlySpendingCap"] = it.coerceAtLeast(0.0) }
      s.safeToSpendWarningThreshold?.let { map["safeToSpendWarningThreshold"] = it.coerceAtLeast(0.0) }
      s.homeTimeZoneId?.trim()?.takeIf { it.isNotEmpty() }?.let { map["homeTimeZoneId"] = it.take(64) }
      return map
    }
  }
}

@IgnoreExtraProperties
data class CloudExpense(
  @DocumentId val id: String = "",
  val userId: String = "",
  val originalAmount: String = "0",
  val originalCurrencyCode: String = Currency.EUR.code,
  val homeAmount: String = "0",
  val homeCurrencyCode: String = Currency.USD.code,
  val exchangeRate: String = "1",
  val exchangeRateTimestamp: Long = 0L,
  val exchangeRateSource: String = "api",
  val categoryId: String = Category.FOOD.id,
  val timestamp: Long = 0L,
  val merchant: String = "",
  val note: String = "",
  val location: String? = null,
  val tripId: String? = null,
  val receiptUri: String? = null,
  val isRecurring: Boolean = false,
  val recurrenceFrequency: String? = null,
  val lastRecurrenceLoggedMillis: Long? = null,
  @ServerTimestamp val createdAt: Timestamp? = null,
  @ServerTimestamp val updatedAt: Timestamp? = null
) {
  fun toDomain(): Expense? {
    val origCurr = Currency.findByCode(originalCurrencyCode) ?: return null
    val homeCurr = Currency.findByCode(homeCurrencyCode) ?: return null
    val origBig = originalAmount.toBigDecimalOrNull() ?: return null
    val homeBig = homeAmount.toBigDecimalOrNull() ?: return null
    val rateBig = exchangeRate.toBigDecimalOrNull() ?: BigDecimal.ONE
    val resolvedCategory = Category.findById(categoryId)
    val resolvedFreq = recurrenceFrequency?.let { code ->
      runCatching { RecurrenceFrequency.valueOf(code) }.getOrNull()
    }
    return Expense(
      id = id,
      originalAmount = Money.of(origBig, origCurr),
      homeAmount = Money.of(homeBig, homeCurr),
      exchangeRate = ExchangeRate(
        fromCurrency = origCurr,
        toCurrency = homeCurr,
        rate = rateBig,
        timestamp = exchangeRateTimestamp,
        source = exchangeRateSource
      ),
      category = resolvedCategory,
      timestamp = timestamp,
      merchant = merchant,
      note = note,
      location = location,
      tripId = tripId,
      receiptUri = receiptUri,
      isRecurring = isRecurring,
      recurrenceFrequency = resolvedFreq,
      lastRecurrenceLoggedMillis = lastRecurrenceLoggedMillis
    )
  }

  companion object {
    fun toCreateMap(uid: String, e: Expense): Map<String, Any> {
      val map = toMutableFieldMap(e)
      map["userId"] = uid
      map["createdAt"] = FieldValue.serverTimestamp()
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    fun toUpdateMap(e: Expense): Map<String, Any> {
      val map = toMutableFieldMap(e)
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    private fun toMutableFieldMap(e: Expense): MutableMap<String, Any> {
      val map = mutableMapOf<String, Any>(
        "originalAmount" to e.originalAmount.amount.toPlainString().take(40),
        "originalCurrencyCode" to e.originalAmount.currency.code,
        "homeAmount" to e.homeAmount.amount.toPlainString().take(40),
        "homeCurrencyCode" to e.homeAmount.currency.code,
        "exchangeRate" to e.exchangeRate.rate.toPlainString().take(40),
        "exchangeRateTimestamp" to e.exchangeRate.timestamp,
        "exchangeRateSource" to e.exchangeRate.source.take(40).ifBlank { "api" },
        "categoryId" to e.category.id.take(64),
        "timestamp" to e.timestamp,
        "merchant" to e.merchant.take(160),
        "note" to e.note.take(500),
        "isRecurring" to e.isRecurring
      )
      e.location?.take(160)?.let { map["location"] = it }
      e.tripId?.take(128)?.let { map["tripId"] = it }
      e.receiptUri?.take(500)?.let { map["receiptUri"] = it }
      e.recurrenceFrequency?.name?.take(40)?.let { map["recurrenceFrequency"] = it }
      e.lastRecurrenceLoggedMillis?.let { map["lastRecurrenceLoggedMillis"] = it }
      return map
    }
  }
}

@IgnoreExtraProperties
data class CloudCurrencyWallet(
  @DocumentId val id: String = "",
  val userId: String = "",
  val currencyCode: String = Currency.EUR.code,
  val balance: String = "0",
  val initialBalance: String = "0",
  val localCreatedAt: Long = 0L,
  val localUpdatedAt: Long = 0L,
  @ServerTimestamp val createdAt: Timestamp? = null,
  @ServerTimestamp val updatedAt: Timestamp? = null
) {
  fun toDomain(): CurrencyWallet? {
    val currency = Currency.findByCode(currencyCode) ?: return null
    val bal = balance.toBigDecimalOrNull() ?: return null
    val initBal = initialBalance.toBigDecimalOrNull() ?: bal
    return CurrencyWallet(
      id = id,
      currency = currency,
      balance = Money.of(bal.max(BigDecimal.ZERO), currency),
      initialBalance = Money.of(initBal.max(BigDecimal.ZERO), currency),
      createdAt = localCreatedAt,
      updatedAt = localUpdatedAt
    )
  }

  companion object {
    fun toCreateMap(uid: String, w: CurrencyWallet): Map<String, Any> {
      val map = toMutableFieldMap(w)
      map["userId"] = uid
      map["createdAt"] = FieldValue.serverTimestamp()
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    fun toUpdateMap(w: CurrencyWallet): Map<String, Any> {
      val map = toMutableFieldMap(w)
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    private fun toMutableFieldMap(w: CurrencyWallet): MutableMap<String, Any> {
      return mutableMapOf(
        "currencyCode" to w.currency.code,
        "balance" to w.balance.amount.toPlainString().take(40),
        "initialBalance" to w.initialBalance.amount.toPlainString().take(40),
        "localCreatedAt" to w.createdAt,
        "localUpdatedAt" to w.updatedAt
      )
    }
  }
}

@IgnoreExtraProperties
data class CloudWalletTransaction(
  @DocumentId val id: String = "",
  val userId: String = "",
  val walletId: String = "",
  val type: String = WalletTransactionType.DEPOSIT.name,
  val amount: String = "0",
  val currencyCode: String = Currency.EUR.code,
  val timestamp: Long = 0L,
  val note: String = "",
  val targetWalletId: String? = null,
  val targetAmount: String? = null,
  val targetCurrencyCode: String? = null,
  val exchangeRate: String? = null,
  val exchangeRateSource: String? = null,
  val localCreatedAt: Long = 0L,
  @ServerTimestamp val createdAt: Timestamp? = null,
  @ServerTimestamp val updatedAt: Timestamp? = null
) {
  fun toDomain(): WalletTransaction? {
    val currency = Currency.findByCode(currencyCode) ?: return null
    val amt = amount.toBigDecimalOrNull() ?: return null
    if (amt <= BigDecimal.ZERO) return null
    val txType = runCatching { WalletTransactionType.valueOf(type) }.getOrNull() ?: return null
    val targetCurr = targetCurrencyCode?.let { Currency.findByCode(it) }
    val targetMoney = if (targetCurr != null && targetAmount != null) {
      targetAmount.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }?.let { Money.of(it, targetCurr) }
    } else null
    val fx = if (targetCurr != null && exchangeRate != null) {
      exchangeRate.toBigDecimalOrNull()?.let { rate ->
        ExchangeRate(
          fromCurrency = currency,
          toCurrency = targetCurr,
          rate = rate,
          timestamp = timestamp,
          source = exchangeRateSource ?: "api"
        )
      }
    } else null

    return WalletTransaction(
      id = id,
      walletId = walletId,
      type = txType,
      amount = Money.of(amt, currency),
      timestamp = timestamp,
      note = note,
      targetWalletId = targetWalletId,
      targetAmount = targetMoney,
      exchangeRate = fx,
      createdAt = localCreatedAt
    )
  }

  companion object {
    fun toCreateMap(uid: String, tx: WalletTransaction): Map<String, Any> {
      val map = toMutableFieldMap(tx)
      map["userId"] = uid
      map["createdAt"] = FieldValue.serverTimestamp()
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    fun toUpdateMap(tx: WalletTransaction): Map<String, Any> {
      val map = toMutableFieldMap(tx)
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    private fun toMutableFieldMap(tx: WalletTransaction): MutableMap<String, Any> {
      val map = mutableMapOf<String, Any>(
        "walletId" to tx.walletId.take(128),
        "type" to tx.type.name,
        "amount" to tx.amount.amount.toPlainString().take(40),
        "currencyCode" to tx.amount.currency.code,
        "timestamp" to tx.timestamp,
        "note" to tx.note.take(500),
        "localCreatedAt" to tx.createdAt
      )
      tx.targetWalletId?.take(128)?.let { map["targetWalletId"] = it }
      tx.targetAmount?.let {
        map["targetAmount"] = it.amount.toPlainString().take(40)
        map["targetCurrencyCode"] = it.currency.code
      }
      tx.exchangeRate?.let {
        map["exchangeRate"] = it.rate.toPlainString().take(40)
        map["exchangeRateSource"] = it.source.take(40).ifBlank { "api" }
      }
      return map
    }
  }
}
