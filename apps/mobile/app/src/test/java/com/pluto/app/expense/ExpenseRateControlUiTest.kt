package com.pluto.app.expense

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.ExchangeRateRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.expenses.ExpenseEntryScreen
import com.pluto.app.ui.expenses.ExpenseViewModel
import com.pluto.app.ui.theme.PlutoTheme
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.math.BigDecimal

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExpenseRateControlUiTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private fun strictHistoricalMissRepo(now: Long): ExchangeRateRepository {
    val liveRate = ExchangeRate(
      fromCurrency = Currency.EUR,
      toCurrency = Currency.INR,
      rate = BigDecimal("110.00"),
      timestamp = now,
      source = "open_er_api"
    )
    return object : ExchangeRateRepository {
      override fun observeRate(from: Currency, to: Currency) =
        flowOf(if (from == Currency.EUR && to == Currency.INR) liveRate else null)

      override suspend fun getRate(from: Currency, to: Currency, allowOfflineCache: Boolean): ExchangeRate? =
        when {
          from == to -> ExchangeRate.identity(from)
          from == Currency.EUR && to == Currency.INR -> liveRate
          else -> null
        }

      override suspend fun getHistoricalRate(from: Currency, to: Currency, timestamp: Long): ExchangeRate? =
        if (from == to) ExchangeRate.identity(from) else null

      override suspend fun saveRate(exchangeRate: ExchangeRate) {}
      override fun observeAllRates() = flowOf(listOf(liveRate))
    }
  }

  private fun createViewModel(
    expenseRepo: FakeExpenseRepository,
    settings: UserSettings,
    exchangeRepo: ExchangeRateRepository
  ): ExpenseViewModel {
    val settingsRepo = FakeUserSettingsRepository(settings)
    val convert = ConvertCurrencyUseCase(exchangeRepo)
    return ExpenseViewModel(
      observeExpensesUseCase = ObserveExpensesUseCase(expenseRepo),
      createExpenseUseCase = CreateExpenseUseCase(expenseRepo, settingsRepo, convert),
      updateExpenseUseCase = UpdateExpenseUseCase(expenseRepo, settingsRepo, convert),
      deleteExpenseUseCase = DeleteExpenseUseCase(expenseRepo),
      userSettingsRepository = settingsRepo,
      convertCurrencyUseCase = convert
    )
  }

  @Test
  fun `backdated expense without historical rate communicates limitation and requires explicit choice before save`() {
    val now = System.currentTimeMillis()
    val fiveDaysAgo = now - 5L * 86_400_000L
    val settings = UserSettings(
      homeCurrency = Currency.INR,
      destinationCurrency = Currency.EUR,
      isOnboardingCompleted = true
    )
    val expenseRepo = FakeExpenseRepository()
    val vm = createViewModel(expenseRepo, settings, strictHistoricalMissRepo(now))
    var saved: Expense? = null

    composeTestRule.setContent {
      PlutoTheme {
        ExpenseEntryScreen(
          viewModel = vm,
          userSettings = settings,
          onNavigateBack = {},
          onExpenseSaved = { saved = it }
        )
      }
    }

    composeTestRule.runOnIdle {
      vm.onAmountChanged("15.00")
      vm.onDateChanged(fiveDaysAgo)
    }
    composeTestRule.waitForIdle()

    composeTestRule.onNodeWithTag("expense_rate_unavailable_message")
      .performScrollTo()
      .assertIsDisplayed()
    composeTestRule.onNodeWithTag("expense_use_live_rate_button")
      .performScrollTo()
      .assertIsDisplayed()

    composeTestRule.onNodeWithTag("expense_entry_save_button")
      .performScrollTo()
      .assertIsNotEnabled()

    // Explicit choice: use today's market rate for the backdated expense
    composeTestRule.onNodeWithTag("expense_use_live_rate_button")
      .performScrollTo()
      .performClick()
    composeTestRule.waitForIdle()

    composeTestRule.onNodeWithTag("expense_entry_save_button")
      .performScrollTo()
      .assertIsEnabled()
      .performClick()
    composeTestRule.waitForIdle()

    assertNotNull(saved)
    assertEquals("110.00", saved!!.exchangeRate.rate.toPlainString())
    assertEquals("open_er_api", saved!!.exchangeRate.source)
  }

  @Test
  fun `editing foreign expense restores original amount currencies and rate without exchange card`() {
    val now = System.currentTimeMillis()
    val settings = UserSettings(
      homeCurrency = Currency.INR,
      destinationCurrency = Currency.EUR,
      isOnboardingCompleted = true
    )
    val expenseRepo = FakeExpenseRepository()
    val originalRate = ExchangeRate(
      fromCurrency = Currency.EUR,
      toCurrency = Currency.INR,
      rate = BigDecimal("93.40"),
      timestamp = now - 3L * 86_400_000L,
      source = "historical_checkout"
    )
    val existing = Expense.create(
      id = "exp-ui-restore-original",
      originalAmount = Money.of("10.00", Currency.EUR),
      homeCurrency = Currency.INR,
      exchangeRate = originalRate,
      category = Category.FOOD,
      timestamp = now - 3L * 86_400_000L,
      merchant = "Berlin Cafe"
    )
    val vm = createViewModel(expenseRepo, settings, strictHistoricalMissRepo(now))
    vm.prepareEditForm(existing)

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
    composeTestRule.waitForIdle()

    composeTestRule.onNodeWithTag("currency_chip_home").assertDoesNotExist()
    composeTestRule.onNodeWithTag("expense_rate_display_text").assertDoesNotExist()

    composeTestRule.runOnIdle { vm.onLocalCurrencyChanged(Currency.INR) }
    composeTestRule.waitForIdle()
    assertEquals(Currency.INR, vm.formState.value.localCurrency)

    composeTestRule.runOnIdle { vm.onRestoreOriginalRate() }
    composeTestRule.waitForIdle()

    assertEquals(Currency.EUR, vm.formState.value.localCurrency)
    assertEquals(Currency.INR, vm.formState.value.homeCurrency)
    assertEquals("10.00", vm.formState.value.amount)
    assertEquals("934.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())
  }
}
