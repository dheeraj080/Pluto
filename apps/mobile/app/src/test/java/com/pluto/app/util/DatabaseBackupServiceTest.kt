package com.pluto.app.util

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ManualExchangeRateEntity
import com.pluto.app.data.local.expense.ExpenseEntity
import com.pluto.app.data.local.wallet.CurrencyWalletEntity
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.Currency
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class DatabaseBackupServiceTest {

  private lateinit var database: AppDatabase
  private lateinit var userSettingsRepository: SharedPreferencesUserSettingsRepository

  @Before
  fun setup() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
      .allowMainThreadQueries()
      .build()
    userSettingsRepository = SharedPreferencesUserSettingsRepository(context)
  }

  @After
  fun tearDown() {
    database.close()
  }

  @Test
  fun `generateBackupJson exports complete database and parseBackupSummary reads it correctly`() = runBlocking {
    // Seed wallet and expense
    val wallet = CurrencyWalletEntity(
      id = "test-wallet-1",
      currencyCode = "EUR",
      balance = "250.00",
      initialBalance = "100.00",
      createdAt = 1000L,
      updatedAt = 1000L
    )
    database.currencyWalletDao().insertWallet(wallet)

    val expense = ExpenseEntity(
      id = "test-expense-1",
      originalAmount = "15.50",
      originalCurrencyCode = "EUR",
      homeAmount = "16.80",
      homeCurrencyCode = "USD",
      exchangeRate = "1.0840",
      exchangeRateTimestamp = 1000L,
      exchangeRateSource = "api",
      categoryId = "food",
      merchant = "Cafe Paris",
      timestamp = 1000L,
      note = "Breakfast croissants",
      location = null,
      tripId = null
    )
    database.expenseDao().insertExpense(expense)

    userSettingsRepository.updateHomeCurrency(Currency.USD)
    userSettingsRepository.updateDestinationCurrency(Currency.EUR)

    // Export backup JSON
    val backupJson = DatabaseBackupService.generateBackupJson(database, userSettingsRepository)
    assertTrue(backupJson.contains("Pluto"))
    assertTrue(backupJson.contains("Cafe Paris"))
    assertTrue(backupJson.contains("EUR"))

    // Parse summary
    val summary = DatabaseBackupService.parseBackupSummary(backupJson)
    assertEquals(1, summary.expenseCount)
    assertEquals(1, summary.walletCount)
    assertEquals("USD", summary.homeCurrency)
    assertEquals("EUR", summary.destinationCurrency)

    // Clear database to simulate restore onto empty database
    database.expenseDao().clearAll()
    database.currencyWalletDao().clearAll()
    assertEquals(0, database.expenseDao().getAllExpenses().size)
    assertEquals(0, database.currencyWalletDao().getAllWallets().size)

    // Restore backup
    val restoreResult = DatabaseBackupService.restoreBackup(
      database = database,
      userSettingsRepository = userSettingsRepository,
      jsonString = backupJson,
      mode = RestoreMode.REPLACE
    )
    assertTrue(restoreResult.success)
    assertEquals(1, restoreResult.expensesRestored)
    assertEquals(1, restoreResult.walletsRestored)

    // Verify restored records
    val restoredExpenses = database.expenseDao().getAllExpenses()
    assertEquals(1, restoredExpenses.size)
    assertEquals("Cafe Paris", restoredExpenses[0].merchant)

    val restoredWallets = database.currencyWalletDao().getAllWallets()
    assertEquals(1, restoredWallets.size)
    assertEquals("EUR", restoredWallets[0].currencyCode)
  }

  @Test
  fun `backup and restore preserves manual rates separately from API cache with exact precision`() = runBlocking {
    val apiRate = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.921234567891",
      effectiveDate = "2026-11-25",
      fetchedAt = 1000L,
      source = "open_er_api"
    )
    val manualRate = ManualExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.123456789123",
      effectiveDate = "2026-11-25",
      effectiveFrom = 2000L,
      expiresAt = 9000L,
      source = "manual_override",
      updatedAt = 2500L
    )
    database.exchangeRateDao().insertRate(apiRate)
    database.manualExchangeRateDao().insertManualRate(manualRate)

    val backupJson = DatabaseBackupService.generateBackupJson(database, userSettingsRepository)
    val summary = DatabaseBackupService.parseBackupSummary(backupJson)
    assertEquals(1, summary.manualRateCount)

    database.exchangeRateDao().clearAll()
    database.manualExchangeRateDao().clearAll()

    val result = DatabaseBackupService.restoreBackup(
      database = database,
      userSettingsRepository = userSettingsRepository,
      jsonString = backupJson,
      mode = RestoreMode.REPLACE
    )
    assertTrue(result.success)
    assertEquals(1, result.manualRatesRestored)

    val restoredManual = database.manualExchangeRateDao().getAllManualRates()
    assertEquals(1, restoredManual.size)
    assertEquals("0.123456789123", restoredManual[0].rate)
    assertEquals(2000L, restoredManual[0].effectiveFrom)
    assertEquals(9000L, restoredManual[0].expiresAt)

    val restoredApi = database.exchangeRateDao().getAllRates()
    assertEquals(1, restoredApi.size)
    assertEquals("0.921234567891", restoredApi[0].rate)
    assertEquals("open_er_api", restoredApi[0].source)
  }

  @Test
  fun `restore supports legacy v1 backups without manualExchangeRates and routes legacy manual rows cleanly`() = runBlocking {
    val legacyJson = """
      {
        "app": "Pluto",
        "schemaVersion": 1,
        "exportedAt": 1700000000000,
        "wallets": [],
        "walletTransactions": [],
        "expenses": [],
        "exchangeRates": [
          {
            "fromCurrency": "USD",
            "toCurrency": "EUR",
            "rate": "0.9200",
            "effectiveDate": "2026-11-24",
            "fetchedAt": 1700000000000,
            "source": "open_er_api"
          },
          {
            "fromCurrency": "USD",
            "toCurrency": "INR",
            "rate": "84.123456789123",
            "effectiveDate": "2026-11-25",
            "fetchedAt": 1700000500000,
            "source": "manual_override"
          }
        ]
      }
    """.trimIndent()

    val summary = DatabaseBackupService.parseBackupSummary(legacyJson)
    assertEquals(0, summary.manualRateCount)

    val result = DatabaseBackupService.restoreBackup(
      database = database,
      userSettingsRepository = userSettingsRepository,
      jsonString = legacyJson,
      mode = RestoreMode.MERGE
    )
    assertTrue(result.success)
    assertEquals(1, result.manualRatesRestored)

    val apiRates = database.exchangeRateDao().getAllRates()
    assertEquals(1, apiRates.size)
    assertEquals("EUR", apiRates[0].toCurrency)

    val manualRates = database.manualExchangeRateDao().getAllManualRates()
    assertEquals(1, manualRates.size)
    assertEquals("INR", manualRates[0].toCurrency)
    assertEquals("84.123456789123", manualRates[0].rate)
  }

  @Test
  fun `backup and restore preserves multiple non-overlapping effective periods for the same currency pair`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val t2 = 1_700_100_000_000L
    val t3 = 1_700_200_000_000L

    val periods = listOf(
      ManualExchangeRateEntity("USD", "EUR", "0.912345678901", "2023-11-14", t1, t2, "manual_override", t1),
      ManualExchangeRateEntity("USD", "EUR", "0.934567890123", "2023-11-15", t2, t3, "manual_override", t2),
      ManualExchangeRateEntity("USD", "EUR", "0.956789012345", "2023-11-16", t3, null, "manual_override", t3)
    )
    database.manualExchangeRateDao().insertManualRates(periods)

    val backupJson = DatabaseBackupService.generateBackupJson(database, userSettingsRepository)
    val summary = DatabaseBackupService.parseBackupSummary(backupJson)
    assertEquals(3, summary.manualRateCount)

    database.manualExchangeRateDao().clearAll()

    val restoreResult = DatabaseBackupService.restoreBackup(
      database = database,
      userSettingsRepository = userSettingsRepository,
      jsonString = backupJson,
      mode = RestoreMode.REPLACE
    )
    assertTrue(restoreResult.success)
    assertEquals(3, restoreResult.manualRatesRestored)

    val restored = database.manualExchangeRateDao().getManualRatesForPair("USD", "EUR")
    assertEquals(3, restored.size)
    assertEquals("0.912345678901", restored[0].rate)
    assertEquals(t2, restored[0].expiresAt)
    assertEquals("0.934567890123", restored[1].rate)
    assertEquals(t3, restored[1].expiresAt)
    assertEquals("0.956789012345", restored[2].rate)
    assertEquals(null, restored[2].expiresAt)

    assertEquals("0.912345678901", database.manualExchangeRateDao().getApplicableManualRate("USD", "EUR", t1 + 10L)?.rate)
    assertEquals("0.934567890123", database.manualExchangeRateDao().getApplicableManualRate("USD", "EUR", t2)?.rate)
    assertEquals("0.956789012345", database.manualExchangeRateDao().getApplicableManualRate("USD", "EUR", t3)?.rate)
  }

  @Test
  fun `restore rejects overlapping manual rate windows without mutating existing records`() = runBlocking {
    val existing = ManualExchangeRateEntity("USD", "EUR", "0.91", "2023-11-14", 1000L, 5000L, "manual_override", 1000L)
    database.manualExchangeRateDao().insertManualRate(existing)

    val corruptBackup = """
      {
        "app": "Pluto",
        "schemaVersion": 2,
        "exportedAt": 1700000000000,
        "wallets": [],
        "walletTransactions": [],
        "expenses": [],
        "exchangeRates": [],
        "manualExchangeRates": [
          {
            "fromCurrency": "USD",
            "toCurrency": "EUR",
            "rate": "0.92",
            "effectiveDate": "2023-11-14",
            "effectiveFrom": 1000,
            "expiresAt": 4000,
            "source": "manual_override",
            "updatedAt": 1000
          },
          {
            "fromCurrency": "USD",
            "toCurrency": "EUR",
            "rate": "0.94",
            "effectiveDate": "2023-11-14",
            "effectiveFrom": 3000,
            "expiresAt": 6000,
            "source": "manual_override",
            "updatedAt": 3000
          }
        ]
      }
    """.trimIndent()

    val result = DatabaseBackupService.restoreBackup(
      database = database,
      userSettingsRepository = userSettingsRepository,
      jsonString = corruptBackup,
      mode = RestoreMode.REPLACE
    )
    assertTrue(!result.success)
    // Existing DB row must remain untouched
    val after = database.manualExchangeRateDao().getAllManualRates()
    assertEquals(1, after.size)
    assertEquals("0.91", after[0].rate)
  }

  @Test
  fun `restore supports legacy v1 backups with multiple effective-dated manual rates for the same pair`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val t2 = 1_700_100_000_000L
    val legacyMultiPeriodJson = """
      {
        "app": "Pluto",
        "schemaVersion": 1,
        "exportedAt": 1700200000000,
        "wallets": [],
        "walletTransactions": [],
        "expenses": [],
        "exchangeRates": [
          {
            "fromCurrency": "USD",
            "toCurrency": "EUR",
            "rate": "0.9100",
            "effectiveDate": "2023-11-14",
            "fetchedAt": $t1,
            "source": "manual_override"
          },
          {
            "fromCurrency": "USD",
            "toCurrency": "EUR",
            "rate": "0.9450",
            "effectiveDate": "2023-11-15",
            "fetchedAt": $t2,
            "source": "manual_override"
          }
        ]
      }
    """.trimIndent()

    val result = DatabaseBackupService.restoreBackup(
      database = database,
      userSettingsRepository = userSettingsRepository,
      jsonString = legacyMultiPeriodJson,
      mode = RestoreMode.MERGE
    )
    assertTrue(result.success)
    assertEquals(2, result.manualRatesRestored)

    val restored = database.manualExchangeRateDao().getManualRatesForPair("USD", "EUR")
    assertEquals(2, restored.size)
    assertEquals("0.9100", restored[0].rate)
    assertEquals(t2, restored[0].expiresAt)
    assertEquals("0.9450", restored[1].rate)
    assertEquals(null, restored[1].expiresAt)
  }
}
