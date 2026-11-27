package com.pluto.app.util

import android.content.Context
import android.net.Uri
import androidx.room.withTransaction
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.expense.ExpenseEntity
import com.pluto.app.data.local.wallet.CurrencyWalletEntity
import com.pluto.app.data.local.wallet.WalletTransactionEntity
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.BudgetCycleType
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ThemeMode
import com.pluto.app.domain.model.TripSettings
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.UserSettingsRepository
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class RestoreMode {
  REPLACE,
  MERGE
}

data class BackupSummary(
  val exportedAt: Long,
  val expenseCount: Int,
  val walletCount: Int,
  val transactionCount: Int,
  val homeCurrency: String,
  val destinationCurrency: String
)

data class RestoreResult(
  val success: Boolean,
  val message: String,
  val expensesRestored: Int = 0,
  val walletsRestored: Int = 0,
  val transactionsRestored: Int = 0
)

/**
 * Service managing portable JSON backup export and restore operations.
 * Implements Android Storage Access Framework (SAF) integration for saving/loading from Google Drive or local storage.
 */
object DatabaseBackupService {

  private const val BACKUP_SCHEMA_VERSION = 3
  private const val BACKUP_APP_NAME = "Pluto"

  suspend fun generateBackupJson(
    database: AppDatabase,
    userSettingsRepository: UserSettingsRepository
  ): String {
    val root = JSONObject()
    root.put("app", BACKUP_APP_NAME)
    root.put("schemaVersion", BACKUP_SCHEMA_VERSION)
    root.put("exportedAt", System.currentTimeMillis())

    // 1. Settings
    val settings = userSettingsRepository.getSettings()
    val settingsObj = JSONObject().apply {
      put("homeCurrency", settings.homeCurrency.code)
      put("destinationCurrency", settings.destinationCurrency.code)
      put("persona", settings.persona.name)
      put("budgetCycleType", settings.budgetCycleType.name)
      put("firstDayOfWeek", settings.firstDayOfWeek)
      put("defaultCategoryId", settings.defaultCategoryId)
      settings.dailySpendingCap?.let { put("dailySpendingCap", it.toPlainString()) }
      settings.monthlySpendingCap?.let { put("monthlySpendingCap", it.toPlainString()) }
      settings.safeToSpendWarningThreshold?.let { put("safeToSpendWarningThreshold", it.toPlainString()) }
      put("warningNotificationsEnabled", settings.warningNotificationsEnabled)
      put("themeMode", settings.themeMode.name)
      put("isOnboardingCompleted", settings.isOnboardingCompleted)
      put("isBiometricLockEnabled", settings.isBiometricLockEnabled)
      put("autoLockTimeoutMinutes", settings.autoLockTimeoutMinutes)
      put("isPrivacyModeEnabled", settings.isPrivacyModeEnabled)
      settings.homeTimeZoneId?.let { put("homeTimeZoneId", it) }

      val termObj = JSONObject().apply {
        put("termName", settings.academicTermSettings.termName)
        put("termStartDate", settings.academicTermSettings.termStartDate)
        put("termEndDate", settings.academicTermSettings.termEndDate)
        put("totalAllowanceHome", settings.academicTermSettings.totalAllowanceHome.toPlainString())
        put("tuitionAndFixedCommittedHome", settings.academicTermSettings.tuitionAndFixedCommittedHome.toPlainString())
      }
      put("academicTermSettings", termObj)

      val tripObj = JSONObject().apply {
        put("tripName", settings.tripSettings.tripName)
        put("tripStartDate", settings.tripSettings.tripStartDate)
        put("tripEndDate", settings.tripSettings.tripEndDate)
        put("totalTripBudgetHome", settings.tripSettings.totalTripBudgetHome.toPlainString())
      }
      put("tripSettings", tripObj)

      val budgetsObj = JSONObject()
      settings.categoryMonthlyBudgets.forEach { (cat, amount) ->
        budgetsObj.put(cat, amount.toPlainString())
      }
      put("categoryMonthlyBudgets", budgetsObj)
    }
    root.put("settings", settingsObj)

    // 2. Wallets
    val wallets = database.currencyWalletDao().getAllWallets()
    val walletsArray = JSONArray()
    wallets.forEach { w ->
      val obj = JSONObject().apply {
        put("id", w.id)
        put("currencyCode", w.currencyCode)
        put("balance", w.balance)
        put("initialBalance", w.initialBalance)
        put("createdAt", w.createdAt)
        put("updatedAt", w.updatedAt)
      }
      walletsArray.put(obj)
    }
    root.put("wallets", walletsArray)

    // 3. Wallet Transactions
    val transactions = database.walletTransactionDao().getAllTransactions()
    val transArray = JSONArray()
    transactions.forEach { t ->
      val obj = JSONObject().apply {
        put("id", t.id)
        put("walletId", t.walletId)
        put("type", t.type)
        put("amount", t.amount)
        put("currencyCode", t.currencyCode)
        put("timestamp", t.timestamp)
        put("note", t.note)
        put("targetWalletId", t.targetWalletId ?: JSONObject.NULL)
        put("targetAmount", t.targetAmount ?: JSONObject.NULL)
        put("targetCurrencyCode", t.targetCurrencyCode ?: JSONObject.NULL)
        put("exchangeRate", t.exchangeRate ?: JSONObject.NULL)
        put("exchangeRateSource", t.exchangeRateSource ?: JSONObject.NULL)
        put("createdAt", t.createdAt)
      }
      transArray.put(obj)
    }
    root.put("walletTransactions", transArray)

    // 4. Expenses
    val expenses = database.expenseDao().getAllExpenses()
    val expensesArray = JSONArray()
    expenses.forEach { e ->
      val obj = JSONObject().apply {
        put("id", e.id)
        put("originalAmount", e.originalAmount)
        put("originalCurrencyCode", e.originalCurrencyCode)
        put("homeAmount", e.homeAmount)
        put("homeCurrencyCode", e.homeCurrencyCode)
        put("exchangeRate", e.exchangeRate)
        put("exchangeRateTimestamp", e.exchangeRateTimestamp)
        put("exchangeRateSource", e.exchangeRateSource)
        put("categoryId", e.categoryId)
        put("merchant", e.merchant)
        put("timestamp", e.timestamp)
        put("note", e.note)
        put("location", e.location ?: JSONObject.NULL)
        put("tripId", e.tripId ?: JSONObject.NULL)
        put("receiptUri", e.receiptUri ?: JSONObject.NULL)
        put("isRecurring", e.isRecurring)
        put("recurrenceFrequency", e.recurrenceFrequency ?: JSONObject.NULL)
        put("lastRecurrenceLoggedMillis", e.lastRecurrenceLoggedMillis ?: JSONObject.NULL)
        put("createdAt", e.createdAt)
        put("updatedAt", e.updatedAt)
      }
      expensesArray.put(obj)
    }
    root.put("expenses", expensesArray)

    // 5. Cached API Rates
    val rates = database.exchangeRateDao().getAllRates()
    val ratesArray = JSONArray()
    rates.forEach { r ->
      val obj = JSONObject().apply {
        put("fromCurrency", r.fromCurrency)
        put("toCurrency", r.toCurrency)
        put("rate", r.rate)
        put("effectiveDate", r.effectiveDate)
        put("fetchedAt", r.fetchedAt)
        put("source", r.source)
      }
      ratesArray.put(obj)
    }
    root.put("exchangeRates", ratesArray)

    return root.toString(2)
  }

  fun parseBackupSummary(jsonString: String): BackupSummary {
    val root = JSONObject(jsonString)
    val exportedAt = root.optLong("exportedAt", System.currentTimeMillis())
    val expenseCount = root.optJSONArray("expenses")?.length() ?: 0
    val walletCount = root.optJSONArray("wallets")?.length() ?: 0
    val transactionCount = root.optJSONArray("walletTransactions")?.length() ?: 0

    val settingsObj = root.optJSONObject("settings")
    val homeCurrency = settingsObj?.optString("homeCurrency", "USD") ?: "USD"
    val destinationCurrency = settingsObj?.optString("destinationCurrency", "EUR") ?: "EUR"

    return BackupSummary(
      exportedAt = exportedAt,
      expenseCount = expenseCount,
      walletCount = walletCount,
      transactionCount = transactionCount,
      homeCurrency = homeCurrency,
      destinationCurrency = destinationCurrency
    )
  }

  suspend fun restoreBackup(
    database: AppDatabase,
    userSettingsRepository: UserSettingsRepository,
    jsonString: String,
    mode: RestoreMode
  ): RestoreResult {
    return try {
      val root = JSONObject(jsonString)
      val app = root.optString("app")
      if (app != BACKUP_APP_NAME && !root.has("expenses")) {
        return RestoreResult(false, "Invalid backup format: Not a recognized Pluto backup file.")
      }

      // 1. Settings restoration
      val settingsObj = root.optJSONObject("settings")
      val parsedSettings: UserSettings? = if (settingsObj != null) {
        val homeCurr = if (settingsObj.has("homeCurrency") && !settingsObj.isNull("homeCurrency")) {
          Currency.requireByCode(settingsObj.getString("homeCurrency"))
        } else {
          Currency.USD
        }
        val destCurr = if (settingsObj.has("destinationCurrency") && !settingsObj.isNull("destinationCurrency")) {
          Currency.requireByCode(settingsObj.getString("destinationCurrency"))
        } else {
          Currency.EUR
        }
        val persona = try {
          UserPersona.valueOf(settingsObj.optString("persona", UserPersona.INTERNATIONAL_STUDENT.name))
        } catch (_: Exception) {
          UserPersona.INTERNATIONAL_STUDENT
        }
        val budgetCycle = try {
          BudgetCycleType.valueOf(settingsObj.optString("budgetCycleType", BudgetCycleType.ACADEMIC_TERM.name))
        } catch (_: Exception) {
          BudgetCycleType.ACADEMIC_TERM
        }

        val termObj = settingsObj.optJSONObject("academicTermSettings")
        val termSettings = if (termObj != null) {
          AcademicTermSettings(
            termName = termObj.optString("termName", "Fall Semester"),
            termStartDate = termObj.optLong("termStartDate", System.currentTimeMillis()),
            termEndDate = termObj.optLong("termEndDate", System.currentTimeMillis() + 90L * 86400000L),
            totalAllowanceHome = termObj.optBigDecimal("totalAllowanceHome")?.max(BigDecimal.ZERO) ?: BigDecimal("6000.00"),
            tuitionAndFixedCommittedHome = termObj.optBigDecimal("tuitionAndFixedCommittedHome")?.max(BigDecimal.ZERO) ?: BigDecimal("1500.00")
          )
        } else AcademicTermSettings()

        val tripObj = settingsObj.optJSONObject("tripSettings")
        val tripSettings = if (tripObj != null) {
          TripSettings(
            tripName = tripObj.optString("tripName", "Current Period"),
            tripStartDate = tripObj.optLong("tripStartDate", System.currentTimeMillis()),
            tripEndDate = tripObj.optLong("tripEndDate", System.currentTimeMillis() + 14L * 86400000L),
            totalTripBudgetHome = tripObj.optBigDecimal("totalTripBudgetHome")?.max(BigDecimal.ZERO) ?: BigDecimal("1500.00")
          )
        } else TripSettings()

        val budgetsMap = mutableMapOf<String, BigDecimal>()
        val budgetsObj = settingsObj.optJSONObject("categoryMonthlyBudgets")
        budgetsObj?.keys()?.forEach { k ->
          budgetsObj.optBigDecimal(k)?.takeIf { it > BigDecimal.ZERO }?.let { budgetsMap[k] = it }
        }

        val themeMode = try {
          ThemeMode.valueOf(settingsObj.optString("themeMode", ThemeMode.SYSTEM.name))
        } catch (_: Exception) {
          ThemeMode.SYSTEM
        }

        UserSettings(
          homeCurrency = homeCurr,
          destinationCurrency = destCurr,
          persona = persona,
          budgetCycleType = budgetCycle,
          academicTermSettings = termSettings,
          tripSettings = tripSettings,
          firstDayOfWeek = settingsObj.optInt("firstDayOfWeek", 1),
          defaultCategoryId = settingsObj.optString("defaultCategoryId", "food"),
          dailySpendingCap = settingsObj.optBigDecimal("dailySpendingCap")?.takeIf { it > BigDecimal.ZERO },
          monthlySpendingCap = settingsObj.optBigDecimal("monthlySpendingCap")?.takeIf { it > BigDecimal.ZERO },
          safeToSpendWarningThreshold = if (!settingsObj.has("safeToSpendWarningThreshold")) {
            BigDecimal("20.00")
          } else {
            settingsObj.optBigDecimal("safeToSpendWarningThreshold")?.takeIf { it > BigDecimal.ZERO }
          },
          warningNotificationsEnabled = settingsObj.optBoolean("warningNotificationsEnabled", true),
          categoryMonthlyBudgets = budgetsMap,
          themeMode = themeMode,
          isOnboardingCompleted = true,
          isBiometricLockEnabled = settingsObj.optBoolean("isBiometricLockEnabled", false),
          autoLockTimeoutMinutes = settingsObj.optInt("autoLockTimeoutMinutes", 1),
          isPrivacyModeEnabled = settingsObj.optBoolean("isPrivacyModeEnabled", false),
          homeTimeZoneId = com.pluto.app.domain.model.DualZoneClockEngine.normalizeHomeTimeZoneId(
            if (settingsObj.has("homeTimeZoneId") && !settingsObj.isNull("homeTimeZoneId")) {
              settingsObj.optString("homeTimeZoneId")
            } else null,
            homeCurr
          )
        )
      } else null

      // Parse & validate all records up front so unsupported currency codes fail cleanly before mutating DB
      val walletsArray = root.optJSONArray("wallets")
      val restoredWallets = mutableListOf<CurrencyWalletEntity>()
      if (walletsArray != null) {
        for (i in 0 until walletsArray.length()) {
          val obj = walletsArray.getJSONObject(i)
          val code = Currency.requireByCode(obj.getString("currencyCode")).code
          restoredWallets.add(
            CurrencyWalletEntity(
              id = obj.getString("id"),
              currencyCode = code,
              balance = obj.getString("balance"),
              initialBalance = obj.optString("initialBalance", "0"),
              createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
              updatedAt = obj.optLong("updatedAt", System.currentTimeMillis())
            )
          )
        }
      }

      val transArray = root.optJSONArray("walletTransactions")
      val restoredTransactions = mutableListOf<WalletTransactionEntity>()
      if (transArray != null) {
        for (i in 0 until transArray.length()) {
          val obj = transArray.getJSONObject(i)
          val code = Currency.requireByCode(obj.getString("currencyCode")).code
          val targetCode = if (obj.isNull("targetCurrencyCode")) null
          else Currency.requireByCode(obj.getString("targetCurrencyCode")).code
          restoredTransactions.add(
            WalletTransactionEntity(
              id = obj.getString("id"),
              walletId = obj.getString("walletId"),
              type = obj.getString("type"),
              amount = obj.getString("amount"),
              currencyCode = code,
              timestamp = obj.optLong("timestamp", System.currentTimeMillis()),
              note = obj.optString("note", ""),
              targetWalletId = if (obj.isNull("targetWalletId")) null else obj.getString("targetWalletId"),
              targetAmount = if (obj.isNull("targetAmount")) null else obj.getString("targetAmount"),
              targetCurrencyCode = targetCode,
              exchangeRate = if (obj.isNull("exchangeRate")) null else obj.getString("exchangeRate"),
              exchangeRateSource = if (obj.isNull("exchangeRateSource")) null else obj.getString("exchangeRateSource"),
              createdAt = obj.optLong("createdAt", System.currentTimeMillis())
            )
          )
        }
      }

      val expensesArray = root.optJSONArray("expenses")
      val restoredExpenses = mutableListOf<ExpenseEntity>()
      if (expensesArray != null) {
        for (i in 0 until expensesArray.length()) {
          val obj = expensesArray.getJSONObject(i)
          val origCode = Currency.requireByCode(obj.getString("originalCurrencyCode")).code
          val homeCode = Currency.requireByCode(obj.getString("homeCurrencyCode")).code
          val txTimestamp = obj.optLong("timestamp", System.currentTimeMillis())
          val createdAt = obj.optLong("createdAt", txTimestamp)
          val updatedAt = obj.optLong("updatedAt", createdAt)
          restoredExpenses.add(
            ExpenseEntity(
              id = obj.getString("id"),
              originalAmount = obj.getString("originalAmount"),
              originalCurrencyCode = origCode,
              homeAmount = obj.getString("homeAmount"),
              homeCurrencyCode = homeCode,
              exchangeRate = obj.getString("exchangeRate"),
              exchangeRateTimestamp = obj.optLong("exchangeRateTimestamp", System.currentTimeMillis()),
              exchangeRateSource = obj.optString("exchangeRateSource", "backup"),
              categoryId = obj.getString("categoryId"),
              timestamp = txTimestamp,
              merchant = obj.optString("merchant", ""),
              note = obj.optString("note", ""),
              location = if (obj.isNull("location")) null else obj.getString("location"),
              tripId = if (obj.isNull("tripId")) null else obj.getString("tripId"),
              receiptUri = if (obj.isNull("receiptUri")) null else obj.getString("receiptUri"),
              isRecurring = obj.optBoolean("isRecurring", false),
              recurrenceFrequency = if (obj.isNull("recurrenceFrequency")) null else obj.getString("recurrenceFrequency"),
              lastRecurrenceLoggedMillis = if (obj.isNull("lastRecurrenceLoggedMillis")) null else obj.getLong("lastRecurrenceLoggedMillis"),
              createdAt = createdAt,
              updatedAt = updatedAt
            )
          )
        }
      }

      val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

      val ratesArray = root.optJSONArray("exchangeRates")
      val restoredRates = mutableListOf<ExchangeRateEntity>()
      if (ratesArray != null) {
        for (i in 0 until ratesArray.length()) {
          val obj = ratesArray.getJSONObject(i)
          val fromCode = Currency.requireByCode(obj.getString("fromCurrency")).code
          val toCode = Currency.requireByCode(obj.getString("toCurrency")).code
          val rawRate = obj.getString("rate").trim()
          val parsedRate = rawRate.toBigDecimalOrNull()
            ?: throw IllegalArgumentException("Malformed exchange rate '$rawRate'")
          require(parsedRate.compareTo(BigDecimal.ZERO) > 0) {
            "Exchange rate must be positive, got '$rawRate'"
          }
          val fetchedAt = obj.optLong("fetchedAt", System.currentTimeMillis())
          val effectiveDate = obj.optString("effectiveDate", "").trim().takeIf { it.isNotEmpty() }
            ?: synchronized(dateFormat) { dateFormat.format(Date(fetchedAt)) }
          val source = obj.optString("source", "backup").trim().ifEmpty { "backup" }

          // Legacy manual-rate rows are intentionally skipped; custom overrides were removed.
          if (source.startsWith("manual")) continue

          restoredRates.add(
            ExchangeRateEntity(
              fromCurrency = fromCode,
              toCurrency = toCode,
              rate = parsedRate.toPlainString(),
              effectiveDate = effectiveDate,
              fetchedAt = fetchedAt,
              source = source
            )
          )
        }
      }

      if (parsedSettings != null) {
        userSettingsRepository.updateSettings(parsedSettings)
      }

      database.withTransaction {
        if (mode == RestoreMode.REPLACE) {
          database.expenseDao().clearAll()
          database.walletTransactionDao().clearAll()
          database.currencyWalletDao().clearAll()
          database.exchangeRateDao().clearAll()
        }

        if (restoredWallets.isNotEmpty()) {
          database.currencyWalletDao().insertWallets(restoredWallets)
        }
        if (restoredTransactions.isNotEmpty()) {
          database.walletTransactionDao().insertTransactionsReplace(restoredTransactions)
        }
        if (restoredExpenses.isNotEmpty()) {
          database.expenseDao().insertExpenses(restoredExpenses)
        }
        if (restoredRates.isNotEmpty()) {
          database.exchangeRateDao().insertRates(restoredRates)
        }
      }

      RestoreResult(
        success = true,
        message = "Successfully restored ${restoredExpenses.size} expenses, ${restoredWallets.size} wallets, and ${restoredTransactions.size} transactions.",
        expensesRestored = restoredExpenses.size,
        walletsRestored = restoredWallets.size,
        transactionsRestored = restoredTransactions.size
      )
    } catch (e: Exception) {
      RestoreResult(false, "Restore failed: ${e.message ?: "Invalid or corrupted backup"}")
    }
  }

  fun writeBackupToUri(context: Context, uri: Uri, jsonString: String): Boolean {
    return try {
      context.contentResolver.openOutputStream(uri)?.use { output ->
        OutputStreamWriter(output, Charsets.UTF_8).use { writer ->
          writer.write(jsonString)
          writer.flush()
        }
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  fun readBackupFromUri(context: Context, uri: Uri): String? {
    return try {
      context.contentResolver.openInputStream(uri)?.use { input ->
        BufferedReader(InputStreamReader(input, Charsets.UTF_8)).use { reader ->
          reader.readText()
        }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun JSONObject.optBigDecimal(key: String): BigDecimal? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key) ?: return null
    return when (raw) {
      is BigDecimal -> raw
      is String -> raw.trim().takeIf { it.isNotEmpty() }?.toBigDecimalOrNull()
      is Number -> raw.toString().toBigDecimalOrNull()
      else -> null
    }
  }
}
