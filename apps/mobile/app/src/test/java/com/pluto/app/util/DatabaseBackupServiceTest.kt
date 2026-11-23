package com.pluto.app.util

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.local.AppDatabase
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
}
