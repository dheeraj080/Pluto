package com.pluto.app.dashboard

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import com.pluto.app.domain.usecase.GetDashboardSummaryUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.expense.FakeExpenseRepository
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.home.DashboardUiState
import com.pluto.app.ui.home.DashboardViewModel
import com.pluto.app.wallet.FakeCurrencyWalletRepository
import com.pluto.app.wallet.FakeWalletTransactionRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

@OptIn(ExperimentalCoroutinesApi::class)
class DashboardViewModelTest {

  private val testDispatcher = StandardTestDispatcher()
  private lateinit var expenseRepo: FakeExpenseRepository
  private lateinit var settingsRepo: FakeUserSettingsRepository
  private lateinit var walletRepo: FakeCurrencyWalletRepository
  private lateinit var walletTxRepo: FakeWalletTransactionRepository
  private lateinit var exchangeRateRepo: FakeExchangeRateRepository
  private lateinit var viewModel: DashboardViewModel

  @Before
  fun setUp() {
    Dispatchers.setMain(testDispatcher)
    expenseRepo = FakeExpenseRepository()
    settingsRepo = FakeUserSettingsRepository(
      UserSettings(
        homeCurrency = Currency.USD,
        destinationCurrency = Currency.EUR,
        isOnboardingCompleted = true
      )
    )
    walletRepo = FakeCurrencyWalletRepository()
    walletTxRepo = FakeWalletTransactionRepository(walletRepo)
    exchangeRateRepo = FakeExchangeRateRepository()
    viewModel = DashboardViewModel(
      observeExpensesUseCase = ObserveExpensesUseCase(expenseRepo),
      userSettingsRepository = settingsRepo,
      getDashboardSummaryUseCase = GetDashboardSummaryUseCase(),
      walletTransactionRepository = walletTxRepo,
      exchangeRateRepository = exchangeRateRepo
    )
  }

  @After
  fun tearDown() {
    Dispatchers.resetMain()
  }

  @Test
  fun `DashboardViewModel converts multi-currency deposits to home currency and updates when missing rate arrives`() = runTest(testDispatcher) {
    val collectJob = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
      viewModel.uiState.collect()
    }

    // Only USD -> EUR is cached initially; GBP -> USD is missing
    exchangeRateRepo.setRate(ExchangeRate(Currency.USD, Currency.EUR, BigDecimal("0.90000000")))

    val usdWallet = com.pluto.app.domain.model.CurrencyWallet.create(Currency.USD, BigDecimal("100.00"))
    val gbpWallet = com.pluto.app.domain.model.CurrencyWallet.create(Currency.GBP, BigDecimal("200.00"))
    val now = System.currentTimeMillis()
    walletTxRepo.executeDeposit(
      usdWallet,
      WalletTransaction(
        id = "tx-usd",
        walletId = usdWallet.id,
        type = WalletTransactionType.DEPOSIT,
        amount = Money.of("100.00", Currency.USD),
        timestamp = now,
        note = "USD Deposit"
      )
    )
    walletTxRepo.executeDeposit(
      gbpWallet,
      WalletTransaction(
        id = "tx-gbp",
        walletId = gbpWallet.id,
        type = WalletTransactionType.DEPOSIT,
        amount = Money.of("200.00", Currency.GBP),
        timestamp = now + 10,
        note = "GBP Deposit"
      )
    )
    advanceUntilIdle()

    val initialState = viewModel.uiState.value
    assertTrue(initialState is DashboardUiState.Content)
    val initialSummary = (initialState as DashboardUiState.Content).summary
    // Without GBP -> USD rate, GBP deposit is NOT added raw; only 100.00 USD counts
    assertEquals("100.00", initialSummary.totalIncomeHome.amount.toPlainString())
    assertEquals(listOf(Currency.GBP), initialSummary.unvaluedIncomeCurrencies)

    // Now provide inverse USD -> GBP rate (0.80 -> inverse GBP -> USD = 1.25)
    exchangeRateRepo.setRate(ExchangeRate(Currency.USD, Currency.GBP, BigDecimal("0.80000000")))
    advanceUntilIdle()

    val updatedState = viewModel.uiState.value as DashboardUiState.Content
    // 100.00 USD + (200.00 GBP * 1.25 = 250.00 USD) = 350.00 USD
    assertEquals("350.00", updatedState.summary.totalIncomeHome.amount.toPlainString())
    assertEquals("350.00", updatedState.summary.todayIncomeHome.amount.toPlainString())
    assertTrue(updatedState.summary.unvaluedIncomeCurrencies.isEmpty())

    collectJob.cancel()
  }

  @Test
  fun `DashboardViewModel emits Error on stream failure and recovers on retry`() = runTest(testDispatcher) {
    var shouldFail = true
    val flakyExpenseRepo = object : com.pluto.app.domain.repository.ExpenseRepository {
      override fun observeAllExpenses(): Flow<List<com.pluto.app.domain.model.Expense>> = flow {
        if (shouldFail) {
          throw IllegalStateException("Disk read failed")
        } else {
          emit(emptyList())
        }
      }
      override fun observeExpensesByDateRange(startTime: Long, endTime: Long) = flowOf(emptyList<com.pluto.app.domain.model.Expense>())
      override fun observeExpensesByCategory(categoryId: String) = flowOf(emptyList<com.pluto.app.domain.model.Expense>())
      override fun observeExpensesByTrip(tripId: String) = flowOf(emptyList<com.pluto.app.domain.model.Expense>())
      override suspend fun getExpenseById(id: String) = null
      override suspend fun saveExpense(expense: com.pluto.app.domain.model.Expense) {}
      override suspend fun deleteExpense(id: String) {}
      override suspend fun getRecurringExpenses() = emptyList<com.pluto.app.domain.model.Expense>()
    }

    val flakyVm = DashboardViewModel(
      observeExpensesUseCase = ObserveExpensesUseCase(flakyExpenseRepo),
      userSettingsRepository = settingsRepo,
      getDashboardSummaryUseCase = GetDashboardSummaryUseCase(),
      walletTransactionRepository = walletTxRepo,
      exchangeRateRepository = exchangeRateRepo
    )

    val job = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
      flakyVm.uiState.collect()
    }
    advanceUntilIdle()

    val errorState = flakyVm.uiState.value
    assertTrue(errorState is DashboardUiState.Error)
    assertEquals("Disk read failed", (errorState as DashboardUiState.Error).message)

    shouldFail = false
    flakyVm.retry()
    advanceUntilIdle()

    assertTrue(flakyVm.uiState.value is DashboardUiState.Empty)
    job.cancel()
  }

  @Test
  fun `DashboardViewModel fxStatus tracks unavailable, stale, and fresh exchange rates`() = runTest(testDispatcher) {
    val job = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
      viewModel.fxStatus.collect()
    }
    advanceUntilIdle()

    val unavailable = viewModel.fxStatus.value
    assertEquals(true, unavailable?.isUnavailable)
    assertEquals(false, unavailable?.isStale)

    exchangeRateRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.USD,
        toCurrency = Currency.EUR,
        rate = BigDecimal("0.9100"),
        source = "cached_stale",
        timestamp = System.currentTimeMillis() - 1000L
      )
    )
    advanceUntilIdle()
    val stale = viewModel.fxStatus.value
    assertEquals(false, stale?.isUnavailable)
    assertEquals(true, stale?.isStale)

    exchangeRateRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.USD,
        toCurrency = Currency.EUR,
        rate = BigDecimal("0.9200"),
        source = "open_er_api",
        timestamp = System.currentTimeMillis()
      )
    )
    advanceUntilIdle()
    val fresh = viewModel.fxStatus.value
    assertEquals(false, fresh?.isUnavailable)
    assertEquals(false, fresh?.isStale)
    assertEquals("0.9200", fresh?.rate?.toPlainString())

    job.cancel()
  }
}
