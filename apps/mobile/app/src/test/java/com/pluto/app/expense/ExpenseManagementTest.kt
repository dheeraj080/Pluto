package com.pluto.app.expense

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DateRangeFilter
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.ExpenseFilter
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.RecurrenceFrequency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class ExpenseManagementTest {

  private lateinit var fakeExpenseRepo: FakeExpenseRepository
  private lateinit var fakeSettingsRepo: FakeUserSettingsRepository
  private lateinit var fakeExchangeRepo: FakeExchangeRateRepository
  private lateinit var convertCurrencyUseCase: ConvertCurrencyUseCase
  private lateinit var createExpenseUseCase: CreateExpenseUseCase
  private lateinit var updateExpenseUseCase: UpdateExpenseUseCase
  private lateinit var deleteExpenseUseCase: DeleteExpenseUseCase
  private lateinit var observeExpensesUseCase: ObserveExpensesUseCase

  @Before
  fun setup() {
    fakeExpenseRepo = FakeExpenseRepository()
    fakeSettingsRepo = FakeUserSettingsRepository(
      UserSettings(homeCurrency = Currency.INR, isOnboardingCompleted = true)
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
    deleteExpenseUseCase = DeleteExpenseUseCase(fakeExpenseRepo)
    observeExpensesUseCase = ObserveExpensesUseCase(fakeExpenseRepo)
  }

  @Test
  fun `metadata-only update preserves original financial snapshot exactly`() = runTest {
    // 1 EUR = 95.00 INR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        source = "historical_rate_snapshot",
        timestamp = 1000L
      )
    )

    val createRes = createExpenseUseCase(
      amount = BigDecimal("20.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      timestamp = 5000L,
      merchant = "Initial Cafe"
    )
    val initialExpense = (createRes as CreateExpenseResult.Success).expense

    // Simulate market rate moving to 105.00 INR later
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("105.00000000"),
        source = "today_new_rate"
      )
    )

    // User only edits merchant and category (metadata-only)
    val updateRes = updateExpenseUseCase(
      existingExpense = initialExpense,
      newAmount = initialExpense.originalAmount.amount,
      newCurrency = initialExpense.originalCurrency,
      newCategory = Category.ENTERTAINMENT,
      newTimestamp = initialExpense.timestamp,
      newMerchant = "Updated Jazz Club",
      newNote = "Live music with friends"
    )

    assertTrue(updateRes is UpdateExpenseResult.Success)
    val updated = (updateRes as UpdateExpenseResult.Success).expense

    // Metadata changed
    assertEquals("Updated Jazz Club", updated.merchant)
    assertEquals(Category.ENTERTAINMENT, updated.category)
    assertEquals("Live music with friends", updated.note)

    // Financial snapshot strictly preserved: rate remains 95.00, homeAmount remains 1900.00
    assertEquals("20.00", updated.originalAmount.amount.toPlainString())
    assertEquals(Currency.EUR, updated.originalCurrency)
    assertEquals("1900.00", updated.homeAmount.amount.toPlainString())
    assertEquals(Currency.INR, updated.homeCurrency)
    assertEquals("95.00000000", updated.exchangeRate.rate.toPlainString())
    assertEquals("historical_rate_snapshot", updated.exchangeRate.source)
  }

  @Test
  fun `financial edit recalculates home amount using valid rate snapshot`() = runTest {
    // 1 EUR = 95.00 INR initially
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        source = "snapshot_1"
      )
    )

    val createRes = createExpenseUseCase(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.SHOPPING
    )
    val expense = (createRes as CreateExpenseResult.Success).expense
    assertEquals("950.00", expense.homeAmount.amount.toPlainString())

    // Change rate to 100.00
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("100.00000000"),
        source = "snapshot_2"
      )
    )

    // User edits amount from 10.00 to 25.00
    val updateRes = updateExpenseUseCase(
      existingExpense = expense,
      newAmount = BigDecimal("25.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = expense.timestamp,
      newMerchant = expense.merchant,
      newNote = expense.note
    )

    assertTrue(updateRes is UpdateExpenseResult.Success)
    val updated = (updateRes as UpdateExpenseResult.Success).expense
    assertEquals("25.00", updated.originalAmount.amount.toPlainString())
    // 25.00 * 100.00 = 2500.00
    assertEquals("2500.00", updated.homeAmount.amount.toPlainString())
    assertEquals("snapshot_2", updated.exchangeRate.source)
  }

  @Test
  fun `financial edit fails safely when exchange rate is unavailable`() = runTest {
    val createRes = createExpenseUseCase(
      amount = BigDecimal("50.00"),
      currency = Currency.INR,
      category = Category.FOOD
    )
    val expense = (createRes as CreateExpenseResult.Success).expense

    // User tries to switch currency to JPY where no rate is available
    val updateRes = updateExpenseUseCase(
      existingExpense = expense,
      newAmount = BigDecimal("1000"),
      newCurrency = Currency.JPY,
      newCategory = Category.FOOD,
      newTimestamp = expense.timestamp,
      newMerchant = expense.merchant,
      newNote = expense.note
    )

    assertTrue(updateRes is UpdateExpenseResult.ConversionUnavailable)

    // Ensure database was NOT mutated
    val stored = fakeExpenseRepo.getExpenseById(expense.id)
    assertEquals(Currency.INR, stored?.originalCurrency)
    assertEquals("50.00", stored?.originalAmount?.amount?.toPlainString())
  }

  @Test
  fun `search filter matches merchant, note, and category name`() {
    val expense1 = Expense(
      id = "1",
      originalAmount = Money.of("10.00", Currency.EUR),
      homeAmount = Money.of("950.00", Currency.INR),
      exchangeRate = ExchangeRate.of(Currency.EUR, Currency.INR, 95.0),
      category = Category.FOOD,
      merchant = "Starbucks Coffee",
      note = "Latte"
    )

    val expense2 = Expense(
      id = "2",
      originalAmount = Money.of("4.50", Currency.GBP),
      homeAmount = Money.of("450.00", Currency.INR),
      exchangeRate = ExchangeRate.of(Currency.GBP, Currency.INR, 100.0),
      category = Category.TRANSPORT,
      merchant = "London Underground",
      note = "Commute to campus"
    )

    // Search by merchant
    val filter1 = ExpenseFilter(searchQuery = "Starbucks")
    assertTrue(filter1.matches(expense1))
    assertFalse(filter1.matches(expense2))

    // Search by note
    val filter2 = ExpenseFilter(searchQuery = "campus")
    assertFalse(filter2.matches(expense1))
    assertTrue(filter2.matches(expense2))

    // Search by category
    val filter3 = ExpenseFilter(searchQuery = "Transport")
    assertFalse(filter3.matches(expense1))
    assertTrue(filter3.matches(expense2))

    // Empty search matches all
    val filterEmpty = ExpenseFilter(searchQuery = "")
    assertTrue(filterEmpty.matches(expense1))
    assertTrue(filterEmpty.matches(expense2))
  }

  @Test
  fun `category and date filters compose properly`() {
    val now = System.currentTimeMillis()
    val expenseFood = Expense(
      id = "1",
      originalAmount = Money.of("15.00", Currency.EUR),
      homeAmount = Money.of("1400.00", Currency.INR),
      exchangeRate = ExchangeRate.of(Currency.EUR, Currency.INR, 95.0),
      category = Category.FOOD,
      timestamp = now
    )

    val expenseGroceries = Expense(
      id = "2",
      originalAmount = Money.of("35.00", Currency.EUR),
      homeAmount = Money.of("3300.00", Currency.INR),
      exchangeRate = ExchangeRate.of(Currency.EUR, Currency.INR, 95.0),
      category = Category.GROCERIES,
      timestamp = now
    )

    val categoryFilter = ExpenseFilter(selectedCategoryId = Category.FOOD.id)
    assertTrue(categoryFilter.matches(expenseFood))
    assertFalse(categoryFilter.matches(expenseGroceries))

    // Combined filter: Category FOOD + Date TODAY
    val combinedFilter = ExpenseFilter(
      selectedCategoryId = Category.FOOD.id,
      dateRange = DateRangeFilter.TODAY
    )
    assertTrue(combinedFilter.matches(expenseFood))
    assertFalse(combinedFilter.matches(expenseGroceries))

    // Clearing filters matches both
    val cleared = ExpenseFilter()
    assertTrue(cleared.matches(expenseFood))
    assertTrue(cleared.matches(expenseGroceries))

    // Custom date range filter test
    val threeDaysAgo = now - 3 * 86400000L
    val expensePast = Expense(
      id = "exp-past",
      originalAmount = Money.of("15.00", Currency.EUR),
      homeAmount = Money.of("1400.00", Currency.INR),
      exchangeRate = ExchangeRate.of(Currency.EUR, Currency.INR, 95.0),
      category = Category.FOOD,
      timestamp = threeDaysAgo
    )

    val customRangeFilter = ExpenseFilter(
      dateRange = DateRangeFilter.CUSTOM,
      customStartDateMillis = now - 86400000L,
      customEndDateMillis = now + 86400000L
    )
    assertTrue(customRangeFilter.matches(expenseFood))
    assertFalse(customRangeFilter.matches(expensePast))

    val customRangePastFilter = ExpenseFilter(
      dateRange = DateRangeFilter.CUSTOM,
      customStartDateMillis = threeDaysAgo - 1000L,
      customEndDateMillis = threeDaysAgo + 1000L
    )
    assertTrue(customRangePastFilter.matches(expensePast))
    assertFalse(customRangePastFilter.matches(expenseFood))
  }

  @Test
  fun `recurring expense creation and automated recurrence processing logs monthly subscription`() = runTest {
    // Seed exchange rate EUR to INR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        source = "test",
        timestamp = System.currentTimeMillis()
      )
    )

    val now = System.currentTimeMillis()
    val thirtyFiveDaysAgo = now - 35 * 86400000L

    val createResult = createExpenseUseCase(
      amount = BigDecimal("14.99"),
      currency = Currency.EUR,
      category = Category.OTHER,
      timestamp = thirtyFiveDaysAgo,
      merchant = "Netflix",
      isRecurring = true,
      recurrenceFrequency = RecurrenceFrequency.MONTHLY
    )

    assertTrue(createResult is CreateExpenseResult.Success)
    val recurringExpense = (createResult as CreateExpenseResult.Success).expense
    assertTrue(recurringExpense.isRecurring)
    assertEquals(RecurrenceFrequency.MONTHLY, recurringExpense.recurrenceFrequency)

    // Run automated recurring process
    val processUseCase = ProcessRecurringExpensesUseCase(fakeExpenseRepo, convertCurrencyUseCase)
    val newlyLogged = processUseCase.invoke(nowMillis = now)

    assertTrue("Should have automatically logged subscription occurrence", newlyLogged.isNotEmpty())
    val autoLogged = newlyLogged.first()
    assertEquals("Netflix", autoLogged.merchant)
    assertEquals(Money.of("14.99", Currency.EUR), autoLogged.originalAmount)
    assertTrue(autoLogged.note.contains("Auto-logged subscription"))
    assertFalse(autoLogged.isRecurring) // Generated instance is a regular expense record
  }

  @Test
  fun `calculateReceiptSampleSize picks power-of-two downsampling without undersizing`() {
    // 4000x3000 at 1/16 gives 250x187 (>=128), while 1/32 would give 125x93 (<128) -> 16
    assertEquals(16, com.pluto.app.ui.expenses.calculateReceiptSampleSize(4000, 3000, 128, 128))
    // 4000x3000 at 1/2 gives 2000x1500 (>=1440), while 1/4 would give 1000x750 (<1440) -> 2
    assertEquals(2, com.pluto.app.ui.expenses.calculateReceiptSampleSize(4000, 3000, 1440, 1440))
    // Small image stays at full 1x resolution
    assertEquals(1, com.pluto.app.ui.expenses.calculateReceiptSampleSize(800, 600, 1440, 1440))
    // Invalid dimensions fall back safely to 1
    assertEquals(1, com.pluto.app.ui.expenses.calculateReceiptSampleSize(-1, 3000, 128, 128))
  }
}
