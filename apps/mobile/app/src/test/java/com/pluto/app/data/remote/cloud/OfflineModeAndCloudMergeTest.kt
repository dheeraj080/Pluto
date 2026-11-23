package com.pluto.app.data.remote.cloud

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.base.FirestoreEmulatorTestBase
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.expense.ExpenseEntityMapper
import com.pluto.app.data.local.wallet.CurrencyWalletEntityMapper
import com.pluto.app.data.local.wallet.WalletTransactionEntityMapper
import com.pluto.app.data.repository.OfflineSessionPreferences
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal
import java.util.UUID

class OfflineModeAndCloudMergeTest : FirestoreEmulatorTestBase() {

  private lateinit var context: Context
  private lateinit var database: AppDatabase
  private lateinit var settingsRepo: SharedPreferencesUserSettingsRepository

  @Before
  fun setUpLocalStores() {
    context = ApplicationProvider.getApplicationContext()
    context.getSharedPreferences("pluto_offline_session", Context.MODE_PRIVATE).edit().clear().commit()
    context.getSharedPreferences("global_expense_user_settings", Context.MODE_PRIVATE).edit().clear().commit()
    database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
      .allowMainThreadQueries()
      .build()
    settingsRepo = SharedPreferencesUserSettingsRepository(context)
  }

  @After
  fun tearDownLocalStores() {
    database.close()
  }

  @Test
  fun offlineSessionPreference_persistsAcrossRestarts_untilSignedIn() {
    val firstLaunch = OfflineSessionPreferences(context)
    assertFalse(firstLaunch.isOfflineMode.value)

    firstLaunch.setOfflineMode(true)
    assertTrue(firstLaunch.isOfflineMode.value)

    // Simulate cold restart with a fresh OfflineSessionPreferences instance
    val secondLaunch = OfflineSessionPreferences(context)
    assertTrue(secondLaunch.isOfflineMode.value)

    // Signing in with Google clears offline mode
    secondLaunch.setOfflineMode(false)
    val thirdLaunch = OfflineSessionPreferences(context)
    assertFalse(thirdLaunch.isOfflineMode.value)
  }

  @Test
  fun upgradingFromOfflineToGoogleSignIn_mergesLocalAndCloudRecordsWithoutDataLoss() = runBlocking {
    val cloudRepo = FirestoreCloudSyncRepository(firestore, auth)

    // Seed an existing cloud expense for this Google user before offline work
    signInTestUser(MERGE_USER_EMAIL)
    val cloudExpenseId = "cloud_exp_${UUID.randomUUID().toString().replace("-", "")}"
    val existingCloudExpense = Expense.create(
      id = cloudExpenseId,
      originalAmount = Money.of(BigDecimal("42.00"), Currency.GBP),
      homeCurrency = Currency.USD,
      exchangeRate = ExchangeRate(
        fromCurrency = Currency.GBP,
        toCurrency = Currency.USD,
        rate = BigDecimal("1.27"),
        timestamp = 1_700_000_000_000L,
        source = "api"
      ),
      category = Category.TRANSPORT,
      merchant = "Heathrow Express",
      note = "Airport rail"
    )
    withTimeout(5000L) {
      cloudRepo.saveSettings(
        UserSettings(
          homeCurrency = Currency.USD,
          destinationCurrency = Currency.GBP,
          categoryMonthlyBudgets = mapOf(Category.TRANSPORT.id to 180.0),
          isOnboardingCompleted = true
        )
      )
      cloudRepo.upsertExpense(existingCloudExpense)
    }

    // Switch to signed-out offline session and author local data
    auth.signOut()
    val offlinePrefs = OfflineSessionPreferences(context)
    offlinePrefs.setOfflineMode(true)

    settingsRepo.updateSettings(
      UserSettings(
        homeCurrency = Currency.USD,
        destinationCurrency = Currency.EUR,
        categoryMonthlyBudgets = mapOf(Category.FOOD.id to 320.0),
        isOnboardingCompleted = true
      )
    )

    val localExpenseId = "offline_exp_${UUID.randomUUID().toString().replace("-", "")}"
    val offlineExpense = Expense.create(
      id = localExpenseId,
      originalAmount = Money.of(BigDecimal("18.50"), Currency.EUR),
      homeCurrency = Currency.USD,
      exchangeRate = ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.USD,
        rate = BigDecimal("1.08"),
        timestamp = 1_700_000_100_000L,
        source = "api"
      ),
      category = Category.FOOD,
      merchant = "Cafe de Flore",
      note = "Offline lunch"
    )
    val localWalletId = "offline_wal_${UUID.randomUUID().toString().replace("-", "")}"
    val offlineWallet = CurrencyWallet.create(Currency.EUR, BigDecimal("250.00"), id = localWalletId)
    val localTxId = "offline_tx_${UUID.randomUUID().toString().replace("-", "")}"
    val offlineTx = WalletTransaction(
      id = localTxId,
      walletId = localWalletId,
      type = WalletTransactionType.DEPOSIT,
      amount = Money.of(BigDecimal("250.00"), Currency.EUR),
      note = "Cash load offline"
    )

    database.expenseDao().insertExpense(ExpenseEntityMapper.toEntity(offlineExpense))
    database.currencyWalletDao().insertWallet(CurrencyWalletEntityMapper.toEntity(offlineWallet))
    database.walletTransactionDao().insertTransaction(WalletTransactionEntityMapper.toEntity(offlineTx))

    // User signs in with Google from Settings -> clears offline flag & runs coordinator merge
    signInTestUser(MERGE_USER_EMAIL)
    offlinePrefs.setOfflineMode(false)
    val currentUser = checkNotNull(auth.currentUser)

    val coordinator = CloudSyncCoordinator(
      database = database,
      localSettingsRepo = settingsRepo,
      cloudRepo = cloudRepo,
      auth = auth
    )
    coordinator.syncOnce(currentUser)

    // Verify cloud now contains BOTH cloud + offline expenses, wallet, transaction, and merged budgets
    val mergedCloudExpenses = withTimeout(5000L) { cloudRepo.getExpenses().getOrThrow() }
    assertTrue(mergedCloudExpenses.any { it.id == cloudExpenseId })
    assertTrue(mergedCloudExpenses.any { it.id == localExpenseId })

    val mergedCloudWallets = withTimeout(5000L) { cloudRepo.getWallets().getOrThrow() }
    assertTrue(mergedCloudWallets.any { it.id == localWalletId })

    val mergedCloudTx = withTimeout(5000L) { cloudRepo.getWalletTransactions().getOrThrow() }
    assertTrue(mergedCloudTx.any { it.id == localTxId })

    val mergedLocalExpenses = database.expenseDao().getAllExpenses()
    assertTrue(mergedLocalExpenses.any { it.id == cloudExpenseId })
    assertTrue(mergedLocalExpenses.any { it.id == localExpenseId })

    val mergedCloudSettings = withTimeout(5000L) { cloudRepo.getSettings().getOrThrow() }
    assertEquals(320.0, mergedCloudSettings?.categoryMonthlyBudgets?.get(Category.FOOD.id) ?: 0.0, 0.01)
    assertEquals(180.0, mergedCloudSettings?.categoryMonthlyBudgets?.get(Category.TRANSPORT.id) ?: 0.0, 0.01)

    val syncState = coordinator.syncState.value
    assertTrue("Expected CloudSyncState.Synced but got $syncState", syncState is CloudSyncState.Synced)
    assertFalse(offlinePrefs.isOfflineMode.value)
  }

  private companion object {
    const val MERGE_USER_EMAIL = "offline_merge_pluto@test.com"
  }
}
