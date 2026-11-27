package com.pluto.app.expense

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.RateUpdatePolicy
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.expenses.mergeSelectedTimeWithLocalDate
import com.pluto.app.ui.expenses.rateSourceLabel
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class HistoricalFxPreservationTest {

  private lateinit var fakeExpenseRepo: FakeExpenseRepository
  private lateinit var fakeSettingsRepo: FakeUserSettingsRepository
  private lateinit var fakeExchangeRepo: FakeExchangeRateRepository
  private lateinit var convertCurrencyUseCase: ConvertCurrencyUseCase
  private lateinit var createExpenseUseCase: CreateExpenseUseCase
  private lateinit var updateExpenseUseCase: UpdateExpenseUseCase

  @Before
  fun setup() {
    fakeExpenseRepo = FakeExpenseRepository()
    fakeSettingsRepo = FakeUserSettingsRepository(
      UserSettings(
        homeCurrency = Currency.INR,
        destinationCurrency = Currency.EUR,
        isOnboardingCompleted = true
      )
    )
    fakeExchangeRepo = FakeExchangeRateRepository()
    convertCurrencyUseCase = ConvertCurrencyUseCase(fakeExchangeRepo)
    createExpenseUseCase = CreateExpenseUseCase(
      expenseRepository = fakeExpenseRepo,
      userSettingsRepository = fakeSettingsRepo,
      convertCurrencyUseCase = convertCurrencyUseCase
    )
    updateExpenseUseCase = UpdateExpenseUseCase(
      expenseRepository = fakeExpenseRepo,
      userSettingsRepository = fakeSettingsRepo,
      convertCurrencyUseCase = convertCurrencyUseCase
    )
  }

  @Test
  fun `backdated expense creation uses historical market rate rather than current-day rate`() = runTest {
    val now = System.currentTimeMillis()
    val fiveDaysAgo = now - 5L * 86_400_000L

    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("120.00"),
        timestamp = now,
        source = "open_er_api"
      )
    )
    fakeExchangeRepo.setHistoricalRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("92.00"),
        timestamp = fiveDaysAgo,
        source = "open_er_api"
      )
    )

    val result = createExpenseUseCase(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      timestamp = fiveDaysAgo,
      merchant = "Berlin Bakery"
    )

    assertTrue(result is CreateExpenseResult.Success)
    val expense = (result as CreateExpenseResult.Success).expense
    assertEquals("920.00", expense.homeAmount.amount.toPlainString())
    assertEquals(BigDecimal("92.00"), expense.exchangeRate.rate)
    assertEquals("open_er_api", expense.exchangeRate.source)
  }

  @Test
  fun `same-pair amount edit preserves recorded FX snapshot`() = runTest {
    val recordedAt = System.currentTimeMillis() - 3L * 86_400_000L
    val existing = Expense.create(
      id = "exp-edit-snapshot",
      originalAmount = Money.of("10.00", Currency.EUR),
      homeCurrency = Currency.INR,
      exchangeRate = ExchangeRate(
        Currency.EUR,
        Currency.INR,
        BigDecimal("95.00"),
        timestamp = recordedAt,
        source = "open_er_api"
      ),
      category = Category.SHOPPING,
      timestamp = recordedAt,
      merchant = "Boutique"
    )
    fakeExpenseRepo.saveExpense(existing)

    // A newer market rate must not replace the recorded snapshot on a normal edit.
    fakeExchangeRepo.setRate(
      ExchangeRate(
        Currency.EUR,
        Currency.INR,
        BigDecimal("101.00"),
        source = "open_er_api"
      )
    )

    val result = updateExpenseUseCase(
      existingExpense = existing,
      newAmount = BigDecimal("12.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = recordedAt,
      newMerchant = "Boutique",
      newNote = "",
      rateUpdatePolicy = RateUpdatePolicy.PRESERVE_EXISTING
    )

    assertTrue(result is UpdateExpenseResult.Success)
    val updated = (result as UpdateExpenseResult.Success).expense
    assertEquals("1140.00", updated.homeAmount.amount.toPlainString())
    assertEquals(BigDecimal("95.00"), updated.exchangeRate.rate)
    assertEquals(recordedAt, updated.exchangeRate.timestamp)
    assertEquals("open_er_api", updated.exchangeRate.source)
  }

  @Test
  fun `explicit live refresh replaces snapshot with current market rate`() = runTest {
    val recordedAt = System.currentTimeMillis() - 3L * 86_400_000L
    val existing = Expense.create(
      id = "exp-edit-live",
      originalAmount = Money.of("10.00", Currency.EUR),
      homeCurrency = Currency.INR,
      exchangeRate = ExchangeRate(
        Currency.EUR,
        Currency.INR,
        BigDecimal("95.00"),
        timestamp = recordedAt,
        source = "open_er_api"
      ),
      category = Category.FOOD,
      timestamp = recordedAt
    )
    fakeExpenseRepo.saveExpense(existing)

    fakeExchangeRepo.setRate(
      ExchangeRate(
        Currency.EUR,
        Currency.INR,
        BigDecimal("101.00"),
        timestamp = System.currentTimeMillis(),
        source = "open_er_api"
      )
    )

    val result = updateExpenseUseCase(
      existingExpense = existing,
      newAmount = BigDecimal("10.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.FOOD,
      newTimestamp = recordedAt,
      newMerchant = "",
      newNote = "",
      rateUpdatePolicy = RateUpdatePolicy.REFRESH_LIVE
    )

    assertTrue(result is UpdateExpenseResult.Success)
    val updated = (result as UpdateExpenseResult.Success).expense
    assertEquals("1010.00", updated.homeAmount.amount.toPlainString())
    assertEquals(BigDecimal("101.00"), updated.exchangeRate.rate)
    assertEquals("open_er_api", updated.exchangeRate.source)
  }

  @Test
  fun `changing to a currency pair without a market rate fails without mutating expense`() = runTest {
    val existing = Expense.create(
      id = "exp-edit-unavailable",
      originalAmount = Money.of("10.00", Currency.EUR),
      homeCurrency = Currency.INR,
      exchangeRate = ExchangeRate(Currency.EUR, Currency.INR, BigDecimal("95.00"), source = "open_er_api"),
      category = Category.FOOD,
      timestamp = System.currentTimeMillis()
    )
    fakeExpenseRepo.saveExpense(existing)
    fakeExchangeRepo.clear()

    val result = updateExpenseUseCase(
      existingExpense = existing,
      newAmount = BigDecimal("10.00"),
      newCurrency = Currency.JPY,
      newCategory = Category.FOOD,
      newTimestamp = existing.timestamp,
      newMerchant = "",
      newNote = "",
      rateUpdatePolicy = RateUpdatePolicy.REFRESH_FOR_DATE
    )

    assertTrue(result is UpdateExpenseResult.ConversionUnavailable)
    assertEquals(existing, fakeExpenseRepo.getExpenseById("exp-edit-unavailable"))
  }

  @Test
  fun `legacy override sources are relabeled as recorded rates`() {
    assertEquals("Recorded Rate", rateSourceLabel("manual_override"))
    assertEquals("Recorded Rate", rateSourceLabel("expense_custom_rate"))
    assertEquals(
      "Recorded Rate",
      rateSourceLabel("open_er_api", isPreservedOriginal = true)
    )
    assertEquals("Historical Rate", rateSourceLabel("open_er_api", isPriorDay = true))
  }

  @Test
  fun `editing time keeps the selected calendar date and never creates a future timestamp`() {
    val now = 1_800_000_000_000L
    val earlierSameDay = now - 3_600_000L

    val edited = mergeSelectedTimeWithLocalDate(
      selectedHour = 23,
      selectedMinute = 59,
      existingLocalMillis = earlierSameDay,
      nowMillis = now
    )

    assertEquals(now, edited)
  }
}
