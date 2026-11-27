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
import com.google.firebase.firestore.DocumentSnapshot
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
  val totalAllowanceHome: String = "6000.00",
  val tuitionAndFixedCommittedHome: String = "1500.00",
  val tripName: String = "Current Trip",
  val tripStartDate: Long = 0L,
  val tripEndDate: Long = 0L,
  val totalTripBudgetHome: String = "1500.00",
  val firstDayOfWeek: Int = 1,
  val defaultCategoryId: String = Category.FOOD.id,
  val dailySpendingCap: String? = null,
  val monthlySpendingCap: String? = null,
  val safeToSpendWarningThreshold: String? = "20.00",
  val warningNotificationsEnabled: Boolean = true,
  val categoryMonthlyBudgets: Map<String, String> = emptyMap(),
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
    val home = Currency.requireByCode(homeCurrencyCode)
    val dest = Currency.requireByCode(destinationCurrencyCode)
    val resolvedPersona = runCatching { UserPersona.valueOf(persona) }.getOrDefault(UserPersona.INTERNATIONAL_STUDENT)
    val resolvedCycle = runCatching { BudgetCycleType.valueOf(budgetCycleType) }.getOrDefault(BudgetCycleType.ACADEMIC_TERM)
    val resolvedTheme = runCatching { ThemeMode.valueOf(themeMode) }.getOrDefault(ThemeMode.SYSTEM)
    val allowance = totalAllowanceHome.toBigDecimalOrNull()?.max(BigDecimal.ZERO) ?: BigDecimal("6000.00")
    val tuition = tuitionAndFixedCommittedHome.toBigDecimalOrNull()?.max(BigDecimal.ZERO) ?: BigDecimal("1500.00")
    val tripBudget = totalTripBudgetHome.toBigDecimalOrNull()?.max(BigDecimal.ZERO) ?: BigDecimal("1500.00")
    val parsedBudgets = categoryMonthlyBudgets.entries
      .mapNotNull { (k, v) ->
        v.trim().toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }?.let { k to it }
      }
      .toMap()
    return UserSettings(
      homeCurrency = home,
      destinationCurrency = dest,
      persona = resolvedPersona,
      budgetCycleType = resolvedCycle,
      academicTermSettings = AcademicTermSettings(
        termName = termName,
        termStartDate = termStartDate,
        termEndDate = termEndDate,
        totalAllowanceHome = allowance,
        tuitionAndFixedCommittedHome = tuition
      ),
      tripSettings = TripSettings(
        tripName = tripName,
        tripStartDate = tripStartDate,
        tripEndDate = tripEndDate,
        totalTripBudgetHome = tripBudget
      ),
      firstDayOfWeek = firstDayOfWeek,
      defaultCategoryId = defaultCategoryId,
      dailySpendingCap = dailySpendingCap?.trim()?.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO },
      monthlySpendingCap = monthlySpendingCap?.trim()?.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO },
      safeToSpendWarningThreshold = safeToSpendWarningThreshold?.trim()?.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO },
      warningNotificationsEnabled = warningNotificationsEnabled,
      categoryMonthlyBudgets = parsedBudgets,
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
    fun fromSnapshot(snapshot: DocumentSnapshot): CloudUserSettings? {
      if (!snapshot.exists()) return null
      val data = snapshot.data ?: return null
      return fromRawMap(
        id = snapshot.id,
        data = data,
        createdAt = snapshot.getTimestamp("createdAt", DocumentSnapshot.ServerTimestampBehavior.ESTIMATE),
        updatedAt = snapshot.getTimestamp("updatedAt", DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
      )
    }

    internal fun fromRawMap(
      id: String = "",
      data: Map<String, Any?>,
      createdAt: Timestamp? = data["createdAt"] as? Timestamp,
      updatedAt: Timestamp? = data["updatedAt"] as? Timestamp
    ): CloudUserSettings {
      val budgetsRaw = data["categoryMonthlyBudgets"] as? Map<*, *>
      val parsedBudgets = budgetsRaw?.entries
        ?.mapNotNull { (k, v) ->
          val key = k as? String ?: return@mapNotNull null
          val dec = readDecimalString(v)?.takeIf {
            it.toBigDecimalOrNull()?.let { bd -> bd > BigDecimal.ZERO } == true
          } ?: return@mapNotNull null
          key to dec
        }
        ?.toMap()
        ?: emptyMap()

      val modulesRaw = data["homeModules"] as? List<*>
      val parsedModules = modulesRaw?.mapNotNull { it as? String } ?: emptyList()

      return CloudUserSettings(
        id = id,
        userId = (data["userId"] as? String) ?: "",
        homeCurrencyCode = (data["homeCurrencyCode"] as? String) ?: Currency.USD.code,
        destinationCurrencyCode = (data["destinationCurrencyCode"] as? String) ?: Currency.EUR.code,
        persona = (data["persona"] as? String) ?: UserPersona.INTERNATIONAL_STUDENT.name,
        budgetCycleType = (data["budgetCycleType"] as? String) ?: BudgetCycleType.ACADEMIC_TERM.name,
        termName = (data["termName"] as? String) ?: "Fall Semester",
        termStartDate = (data["termStartDate"] as? Number)?.toLong() ?: 0L,
        termEndDate = (data["termEndDate"] as? Number)?.toLong() ?: 0L,
        totalAllowanceHome = readDecimalString(data["totalAllowanceHome"]) ?: "6000.00",
        tuitionAndFixedCommittedHome = readDecimalString(data["tuitionAndFixedCommittedHome"]) ?: "1500.00",
        tripName = (data["tripName"] as? String) ?: "Current Trip",
        tripStartDate = (data["tripStartDate"] as? Number)?.toLong() ?: 0L,
        tripEndDate = (data["tripEndDate"] as? Number)?.toLong() ?: 0L,
        totalTripBudgetHome = readDecimalString(data["totalTripBudgetHome"]) ?: "1500.00",
        firstDayOfWeek = (data["firstDayOfWeek"] as? Number)?.toInt() ?: 1,
        defaultCategoryId = (data["defaultCategoryId"] as? String) ?: Category.FOOD.id,
        dailySpendingCap = readDecimalString(data["dailySpendingCap"]),
        monthlySpendingCap = readDecimalString(data["monthlySpendingCap"]),
        safeToSpendWarningThreshold = if (data.containsKey("safeToSpendWarningThreshold")) {
          readDecimalString(data["safeToSpendWarningThreshold"])
        } else {
          "20.00"
        },
        warningNotificationsEnabled = (data["warningNotificationsEnabled"] as? Boolean) ?: true,
        categoryMonthlyBudgets = parsedBudgets,
        themeMode = (data["themeMode"] as? String) ?: ThemeMode.SYSTEM.name,
        isOnboardingCompleted = (data["isOnboardingCompleted"] as? Boolean) ?: false,
        isBiometricLockEnabled = (data["isBiometricLockEnabled"] as? Boolean) ?: false,
        autoLockTimeoutMinutes = (data["autoLockTimeoutMinutes"] as? Number)?.toInt() ?: 1,
        isPrivacyModeEnabled = (data["isPrivacyModeEnabled"] as? Boolean) ?: false,
        homeTimeZoneId = data["homeTimeZoneId"] as? String,
        homeModules = parsedModules,
        createdAt = createdAt,
        updatedAt = updatedAt
      )
    }

    private fun readDecimalString(raw: Any?): String? {
      return when (raw) {
        is BigDecimal -> raw.toPlainString()
        is String -> raw.trim().takeIf { it.isNotEmpty() }?.toBigDecimalOrNull()?.toPlainString()
        is Number -> raw.toString().toBigDecimalOrNull()?.toPlainString()
        else -> null
      }
    }

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
      if (s.dailySpendingCap == null || s.dailySpendingCap <= BigDecimal.ZERO) {
        map["dailySpendingCap"] = FieldValue.delete()
      }
      if (s.monthlySpendingCap == null || s.monthlySpendingCap <= BigDecimal.ZERO) {
        map["monthlySpendingCap"] = FieldValue.delete()
      }
      if (s.safeToSpendWarningThreshold == null || s.safeToSpendWarningThreshold <= BigDecimal.ZERO) {
        map["safeToSpendWarningThreshold"] = FieldValue.delete()
      }
      map["updatedAt"] = FieldValue.serverTimestamp()
      return map
    }

    private fun toMutableFieldMap(s: UserSettings): MutableMap<String, Any> {
      val sanitizedBudgets = s.categoryMonthlyBudgets.entries
        .filter { it.value > BigDecimal.ZERO }
        .associate { it.key.take(64) to it.value.toPlainString().take(40) }
      val map = mutableMapOf<String, Any>(
        "homeCurrencyCode" to s.homeCurrency.code,
        "destinationCurrencyCode" to s.destinationCurrency.code,
        "persona" to s.persona.name,
        "budgetCycleType" to s.budgetCycleType.name,
        "termName" to s.academicTermSettings.termName.take(100),
        "termStartDate" to s.academicTermSettings.termStartDate,
        "termEndDate" to s.academicTermSettings.termEndDate,
        "totalAllowanceHome" to s.academicTermSettings.totalAllowanceHome.max(BigDecimal.ZERO).toPlainString().take(40),
        "tuitionAndFixedCommittedHome" to s.academicTermSettings.tuitionAndFixedCommittedHome.max(BigDecimal.ZERO).toPlainString().take(40),
        "tripName" to s.tripSettings.tripName.take(100),
        "tripStartDate" to s.tripSettings.tripStartDate,
        "tripEndDate" to s.tripSettings.tripEndDate,
        "totalTripBudgetHome" to s.tripSettings.totalTripBudgetHome.max(BigDecimal.ZERO).toPlainString().take(40),
        "firstDayOfWeek" to s.firstDayOfWeek.coerceIn(1, 7),
        "defaultCategoryId" to s.defaultCategoryId.take(64).ifBlank { Category.FOOD.id },
        "warningNotificationsEnabled" to s.warningNotificationsEnabled,
        "categoryMonthlyBudgets" to sanitizedBudgets,
        "themeMode" to s.themeMode.name,
        "isOnboardingCompleted" to s.isOnboardingCompleted,
        "isBiometricLockEnabled" to s.isBiometricLockEnabled,
        "autoLockTimeoutMinutes" to s.autoLockTimeoutMinutes.coerceIn(0, 1440),
        "isPrivacyModeEnabled" to s.isPrivacyModeEnabled,
        "homeModules" to HomeLayoutPresets.normalize(s.homeModules, s.persona)
          .map { "${it.id.name}:${it.isEnabled}" }
      )
      s.dailySpendingCap?.takeIf { it > BigDecimal.ZERO }?.let { map["dailySpendingCap"] = it.toPlainString().take(40) }
      s.monthlySpendingCap?.takeIf { it > BigDecimal.ZERO }?.let { map["monthlySpendingCap"] = it.toPlainString().take(40) }
      s.safeToSpendWarningThreshold?.takeIf { it > BigDecimal.ZERO }?.let { map["safeToSpendWarningThreshold"] = it.toPlainString().take(40) }
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
    val resolvedCreatedAt = createdAt?.toDate()?.time ?: timestamp
    val resolvedUpdatedAt = updatedAt?.toDate()?.time ?: resolvedCreatedAt
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
      lastRecurrenceLoggedMillis = lastRecurrenceLoggedMillis,
      createdAt = resolvedCreatedAt,
      updatedAt = resolvedUpdatedAt
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
