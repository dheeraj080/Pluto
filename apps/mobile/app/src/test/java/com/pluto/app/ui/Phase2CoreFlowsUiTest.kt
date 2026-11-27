package com.pluto.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.GetDashboardSummaryUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.expense.FakeExpenseRepository
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.expenses.ExpenseDetailSheetContent
import com.pluto.app.ui.expenses.ExpenseEntryScreen
import com.pluto.app.ui.expenses.ExpenseViewModel
import com.pluto.app.ui.expenses.ExpensesScreen
import com.pluto.app.ui.home.DashboardFxStatus
import com.pluto.app.ui.home.DashboardViewModel
import com.pluto.app.ui.home.HomeScreen
import com.pluto.app.ui.home.StackedCardsHero
import com.pluto.app.ui.theme.PlutoTheme
import com.pluto.app.ui.wallet.WalletViewModel
import com.pluto.app.wallet.FakeCurrencyWalletRepository
import com.pluto.app.wallet.FakeWalletTransactionRepository
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.CreateWalletDepositUseCase
import com.pluto.app.domain.usecase.CreateWalletTransferUseCase
import com.pluto.app.domain.usecase.CreateWalletWithdrawalUseCase
import com.pluto.app.domain.usecase.DeleteCurrencyWalletUseCase
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.ObserveCurrencyWalletsUseCase
import com.pluto.app.domain.usecase.ObserveWalletTransactionsUseCase
import com.pluto.app.domain.usecase.UpdateCurrencyWalletUseCase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.math.BigDecimal

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class Phase2CoreFlowsUiTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private fun createExpenseViewModel(
    expenseRepo: FakeExpenseRepository = FakeExpenseRepository(),
    settings: UserSettings = UserSettings(
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      isOnboardingCompleted = true
    )
  ): ExpenseViewModel {
    val settingsRepo = FakeUserSettingsRepository(settings)
    val rateRepo = FakeExchangeRateRepository()
    rateRepo.setRate(ExchangeRate(Currency.EUR, Currency.USD, BigDecimal("1.10000000")))
    val convertUseCase = ConvertCurrencyUseCase(rateRepo)
    return ExpenseViewModel(
      observeExpensesUseCase = ObserveExpensesUseCase(expenseRepo),
      createExpenseUseCase = CreateExpenseUseCase(expenseRepo, settingsRepo, convertUseCase),
      updateExpenseUseCase = UpdateExpenseUseCase(expenseRepo, settingsRepo, convertUseCase),
      deleteExpenseUseCase = DeleteExpenseUseCase(expenseRepo),
      userSettingsRepository = settingsRepo,
      convertCurrencyUseCase = convertUseCase,
      exchangeRateRepository = rateRepo
    )
  }

  @Test
  fun `receipt clear control meets 48dp touch target and clears receipt cleanly`() {
    val vm = createExpenseViewModel()
    vm.onReceiptSelected("content://media/external/images/123")
    val settings = UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR)

    composeTestRule.setContent {
      PlutoTheme {
        ExpenseEntryScreen(
          viewModel = vm,
          userSettings = settings,
          onNavigateBack = {},
          onExpenseSaved = {}
        )
      }
    }

    composeTestRule.onNodeWithTag("expense_receipt_clear_button")
      .performScrollTo()
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertEquals(null, vm.formState.value.receiptUri)
  }

  @Test
  fun `expense detail sheet shows single edit and delete action bar and triggers callbacks`() {
    val expense = Expense.create(
      id = "exp-detail-1",
      originalAmount = Money.of("25.00", Currency.EUR),
      homeCurrency = Currency.USD,
      exchangeRate = ExchangeRate(Currency.EUR, Currency.USD, BigDecimal("1.10"), source = "open_er_api"),
      category = Category.FOOD,
      merchant = "Boulangerie",
      timestamp = 1_700_000_000_000L
    )
    var editClicks = 0
    var closeClicks = 0

    composeTestRule.setContent {
      PlutoTheme {
        ExpenseDetailSheetContent(
          expense = expense,
          userSettings = UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR),
          onDismiss = { closeClicks++ },
          onEditExpense = { editClicks++ },
          onDeleteExpense = {}
        )
      }
    }

    assertEquals(1, composeTestRule.onAllNodesWithTag("expense_detail_edit_button").fetchSemanticsNodes().size)
    assertEquals(1, composeTestRule.onAllNodesWithTag("expense_detail_delete_button").fetchSemanticsNodes().size)
    composeTestRule.onNodeWithTag("expense_detail_back_button").performClick()
    composeTestRule.onNodeWithTag("expense_detail_edit_button").performScrollTo().performClick()

    assertEquals(1, closeClicks)
    assertEquals(1, editClicks)
  }

  @Test
  fun `expenses screen has single Clear button and CSV-only export dialog`() {
    val vm = createExpenseViewModel()
    vm.onCategoryFilterSelected(Category.FOOD.id)
    val settings = UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR)

    composeTestRule.setContent {
      PlutoTheme {
        ExpensesScreen(
          userSettings = settings,
          viewModel = vm,
          onAddExpenseClick = {},
          onExpenseClick = {}
        )
      }
    }

    // Single Clear button in filter bar (none duplicated in TopAppBar)
    assertEquals(1, composeTestRule.onAllNodesWithTag("expenses_clear_filters_button").fetchSemanticsNodes().size)

    composeTestRule.onNodeWithTag("expenses_export_button").performClick()
    composeTestRule.onNodeWithTag("dialog_export_csv_button").assertIsDisplayed().assertIsNotEnabled()
    assertTrue(
      composeTestRule.onAllNodes(hasText("PDF", substring = true, ignoreCase = true))
        .fetchSemanticsNodes()
        .isEmpty()
    )
  }

  @Test
  @Config(sdk = [36], qualifiers = "w800dp-h1280dp")
  fun `expenses tablet wide pane dismisses detail cleanly on Close`() {
    val repo = FakeExpenseRepository()
    val expense = Expense.create(
      id = "exp-tab-1",
      originalAmount = Money.of("15.00", Currency.EUR),
      homeCurrency = Currency.USD,
      exchangeRate = ExchangeRate(Currency.EUR, Currency.USD, BigDecimal("1.10")),
      category = Category.FOOD,
      merchant = "Cafe Metro",
      timestamp = 1_700_000_000_000L
    )
    kotlinx.coroutines.runBlocking { repo.saveExpense(expense) }
    val vm = createExpenseViewModel(expenseRepo = repo)
    val settings = UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR)

    composeTestRule.setContent {
      PlutoTheme {
        Box(modifier = Modifier.width(800.dp)) {
          ExpensesScreen(
            userSettings = settings,
            viewModel = vm,
            onAddExpenseClick = {},
            onExpenseClick = {},
            onEditExpense = {},
            onDeleteExpense = {}
          )
        }
      }
    }

    composeTestRule.onNodeWithTag("expense_tablet_detail_pane").assertIsDisplayed()
    composeTestRule.onNodeWithTag("expense_detail_back_button").performClick()
    composeTestRule.onNodeWithTag("expense_tablet_detail_empty").assertIsDisplayed()
  }

  @Test
  fun `home hero displays stale FX status chip when cached rate is stale`() {
    val settings = UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR)
    val summary = GetDashboardSummaryUseCase().invoke(
      allExpenses = emptyList(),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR
    )

    composeTestRule.setContent {
      PlutoTheme {
        StackedCardsHero(
          summary = summary,
          portfolioValuation = null,
          userSettings = settings,
          fxStatus = DashboardFxStatus(
            homeCurrency = Currency.USD,
            destinationCurrency = Currency.EUR,
            rate = BigDecimal("0.9100"),
            source = "cached_stale",
            timestampMillis = 1_700_000_000_000L,
            isStale = true,
            isUnavailable = false
          )
        )
      }
    }

    composeTestRule.onNodeWithTag("home_fx_status_chip").assertIsDisplayed()
    composeTestRule.onNodeWithText("Cached rate", substring = true).assertIsDisplayed()
  }

  @Test
  fun `home screen shows error state with retry button when stream fails`() {
    var shouldFail = true
    val flakyRepo = object : com.pluto.app.domain.repository.ExpenseRepository {
      override fun observeAllExpenses(): Flow<List<Expense>> = flow {
        if (shouldFail) throw IllegalStateException("Corrupt cache")
        else emit(emptyList())
      }
      override fun observeExpensesByDateRange(startTime: Long, endTime: Long) = flowOf(emptyList<Expense>())
      override fun observeExpensesByCategory(categoryId: String) = flowOf(emptyList<Expense>())
      override fun observeExpensesByTrip(tripId: String) = flowOf(emptyList<Expense>())
      override suspend fun getExpenseById(id: String) = null
      override suspend fun saveExpense(expense: Expense) {}
      override suspend fun deleteExpense(id: String) {}
      override suspend fun getRecurringExpenses() = emptyList<Expense>()
    }
    val settings = UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR, isOnboardingCompleted = true)
    val settingsRepo = FakeUserSettingsRepository(settings)
    val walletRepo = FakeCurrencyWalletRepository()
    val walletTxRepo = FakeWalletTransactionRepository(walletRepo)
    val rateRepo = FakeExchangeRateRepository()
    val dashboardVm = DashboardViewModel(
      observeExpensesUseCase = ObserveExpensesUseCase(flakyRepo),
      userSettingsRepository = settingsRepo,
      getDashboardSummaryUseCase = GetDashboardSummaryUseCase(),
      walletTransactionRepository = walletTxRepo,
      exchangeRateRepository = rateRepo
    )
    val walletVm = WalletViewModel(
      observeCurrencyWalletsUseCase = ObserveCurrencyWalletsUseCase(walletRepo),
      createCurrencyWalletUseCase = CreateCurrencyWalletUseCase(walletRepo),
      updateCurrencyWalletUseCase = UpdateCurrencyWalletUseCase(walletRepo),
      deleteCurrencyWalletUseCase = DeleteCurrencyWalletUseCase(walletRepo),
      getPortfolioValuationUseCase = GetPortfolioValuationUseCase(rateRepo),
      createWalletDepositUseCase = CreateWalletDepositUseCase(walletRepo, walletTxRepo),
      createWalletWithdrawalUseCase = CreateWalletWithdrawalUseCase(walletRepo, walletTxRepo),
      createWalletTransferUseCase = CreateWalletTransferUseCase(walletRepo, walletTxRepo, rateRepo),
      observeWalletTransactionsUseCase = ObserveWalletTransactionsUseCase(walletTxRepo),
      userSettingsRepository = settingsRepo
    )

    composeTestRule.setContent {
      PlutoTheme {
        HomeScreen(
          userSettings = settings,
          dashboardViewModel = dashboardVm,
          walletViewModel = walletVm,
          onAddExpenseClick = {},
          onNavigateToConvert = {},
          onNavigateToExpenses = {},
          onNavigateToWallets = {},
          onExpenseClick = {}
        )
      }
    }

    composeTestRule.onNodeWithTag("dashboard_retry_button").assertIsDisplayed()
    shouldFail = false
    composeTestRule.onNodeWithTag("dashboard_retry_button").performClick()
    composeTestRule.onNodeWithTag("stacked_cards_hero").assertIsDisplayed()
  }
}
