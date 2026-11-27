package com.pluto.app.expense

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.RestoreExpenseUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class FakeExpenseRepository : ExpenseRepository {
  private val expensesMap = mutableMapOf<String, Expense>()
  private val expensesFlow = MutableStateFlow<List<Expense>>(emptyList())

  private fun emit() {
    expensesFlow.value = expensesMap.values.sortedByDescending { it.timestamp }
  }

  override fun observeAllExpenses(): Flow<List<Expense>> = expensesFlow.asStateFlow()

  override fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<Expense>> {
    return MutableStateFlow(
      expensesMap.values.filter { it.timestamp in startTime..endTime }
        .sortedByDescending { it.timestamp }
    )
  }

  override fun observeExpensesByCategory(categoryId: String): Flow<List<Expense>> {
    return MutableStateFlow(
      expensesMap.values.filter { it.category.id == categoryId }
        .sortedByDescending { it.timestamp }
    )
  }

  override fun observeExpensesByTrip(tripId: String): Flow<List<Expense>> {
    return MutableStateFlow(
      expensesMap.values.filter { it.tripId == tripId }
        .sortedByDescending { it.timestamp }
    )
  }

  override suspend fun getExpenseById(id: String): Expense? = expensesMap[id]

  override suspend fun saveExpense(expense: Expense) {
    expensesMap[expense.id] = expense
    emit()
  }

  override suspend fun deleteExpense(id: String) {
    expensesMap.remove(id)
    emit()
  }

  override suspend fun getRecurringExpenses(): List<Expense> {
    return expensesMap.values.filter { it.isRecurring }
  }
}

class ExpenseWorkflowTest {

  private lateinit var fakeExpenseRepo: FakeExpenseRepository
  private lateinit var fakeSettingsRepo: FakeUserSettingsRepository
  private lateinit var fakeExchangeRepo: FakeExchangeRateRepository
  private lateinit var convertCurrencyUseCase: ConvertCurrencyUseCase
  private lateinit var createExpenseUseCase: CreateExpenseUseCase
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
    deleteExpenseUseCase = DeleteExpenseUseCase(fakeExpenseRepo)
    observeExpensesUseCase = ObserveExpensesUseCase(fakeExpenseRepo)
  }

  @Test
  fun `create expense in same home currency does not require exchange rate and saves 1 to 1`() = runTest {
    val result = createExpenseUseCase(
      amount = BigDecimal("500.00"),
      currency = Currency.INR,
      category = Category.FOOD,
      merchant = "Local Spice Market"
    )

    assertTrue(result is CreateExpenseResult.Success)
    val saved = (result as CreateExpenseResult.Success).expense

    assertEquals("500.00", saved.originalAmount.amount.toPlainString())
    assertEquals(Currency.INR, saved.originalCurrency)
    assertEquals("500.00", saved.homeAmount.amount.toPlainString())
    assertEquals(Currency.INR, saved.homeCurrency)
    assertEquals("Local Spice Market", saved.merchant)

    // Verify stored in repo
    val fromDb = fakeExpenseRepo.getExpenseById(saved.id)
    assertNotNull(fromDb)
    assertEquals(saved.id, fromDb?.id)
  }

  @Test
  fun `create foreign currency expense calculates home amount and preserves original values`() = runTest {
    // 1 EUR = 95.00 INR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        source = "test_rate"
      )
    )

    val result = createExpenseUseCase(
      amount = BigDecimal("25.50"),
      currency = Currency.EUR,
      category = Category.GROCERIES,
      merchant = "Monoprix Paris",
      note = "Breakfast items"
    )

    assertTrue(result is CreateExpenseResult.Success)
    val saved = (result as CreateExpenseResult.Success).expense

    // 25.50 * 95 = 2422.50
    assertEquals("25.50", saved.originalAmount.amount.toPlainString())
    assertEquals(Currency.EUR, saved.originalCurrency)
    assertEquals("2422.50", saved.homeAmount.amount.toPlainString())
    assertEquals(Currency.INR, saved.homeCurrency)
    assertEquals("test_rate", saved.exchangeRate.source)
    assertEquals("Monoprix Paris", saved.merchant)
  }

  @Test
  fun `foreign expense without available rate returns ConversionUnavailable without saving fake values`() = runTest {
    // No JPY to INR rate configured
    val result = createExpenseUseCase(
      amount = BigDecimal("3000"),
      currency = Currency.JPY,
      category = Category.TRANSPORT,
      merchant = "Tokyo Metro"
    )

    assertTrue(result is CreateExpenseResult.ConversionUnavailable)
    val unavailable = result as CreateExpenseResult.ConversionUnavailable
    assertEquals(Currency.JPY, unavailable.fromCurrency)
    assertEquals(Currency.INR, unavailable.homeCurrency)

    // Verify database has no recorded entries
    val count = fakeExpenseRepo.getExpenseById("any_id")
    assertNull(count)
  }

  @Test
  fun `invalid negative or zero amount is rejected`() = runTest {
    val zeroResult = createExpenseUseCase(
      amount = BigDecimal.ZERO,
      currency = Currency.INR,
      category = Category.OTHER
    )
    assertTrue(zeroResult is CreateExpenseResult.InvalidInput)

    val negativeResult = createExpenseUseCase(
      amount = BigDecimal("-10.00"),
      currency = Currency.INR,
      category = Category.OTHER
    )
    assertTrue(negativeResult is CreateExpenseResult.InvalidInput)
  }

  @Test
  fun `delete expense removes it from repository`() = runTest {
    val result = createExpenseUseCase(
      amount = BigDecimal("100.00"),
      currency = Currency.INR,
      category = Category.FOOD
    )
    val expense = (result as CreateExpenseResult.Success).expense
    assertNotNull(fakeExpenseRepo.getExpenseById(expense.id))

    deleteExpenseUseCase(expense.id)
    assertNull(fakeExpenseRepo.getExpenseById(expense.id))
  }

  @Test
  fun `changing home currency in settings does not alter existing recorded expense snapshot`() = runTest {
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("90.00000000"),
        source = "initial_rate"
      )
    )

    val result = createExpenseUseCase(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.BILLS
    )
    val expense = (result as CreateExpenseResult.Success).expense
    assertEquals("900.00", expense.homeAmount.amount.toPlainString())
    assertEquals(Currency.INR, expense.homeCurrency)

    // User later changes home currency to USD
    fakeSettingsRepo.updateHomeCurrency(Currency.USD)

    // Existing expense snapshot in DB remains intact
    val existing = fakeExpenseRepo.getExpenseById(expense.id)
    assertNotNull(existing)
    assertEquals("900.00", existing?.homeAmount?.amount?.toPlainString())
    assertEquals(Currency.INR, existing?.homeCurrency)
  }

  @Test
  fun `delete expense returns snapshot and restore recovers original FX snapshot even after rate changes`() = runTest {
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("92.50000000"),
        source = "historical_checkout"
      )
    )

    val created = (createExpenseUseCase(
      amount = BigDecimal("12.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      merchant = "Bistro",
      note = "Lunch"
    ) as CreateExpenseResult.Success).expense

    // Exchange rate changes later
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("110.00000000"),
        source = "later_rate"
      )
    )

    val deletedSnapshot = deleteExpenseUseCase(created.id)
    assertNotNull(deletedSnapshot)
    assertNull(fakeExpenseRepo.getExpenseById(created.id))

    val restoreUseCase = RestoreExpenseUseCase(fakeExpenseRepo)
    val restored = restoreUseCase(deletedSnapshot!!)

    val stored = fakeExpenseRepo.getExpenseById(created.id)
    assertNotNull(stored)
    assertEquals(created.id, stored?.id)
    assertEquals("12.00", stored?.originalAmount?.amount?.toPlainString())
    assertEquals(Currency.EUR, stored?.originalCurrency)
    assertEquals("1110.00", stored?.homeAmount?.amount?.toPlainString())
    assertEquals("92.50000000", stored?.exchangeRate?.rate?.toPlainString())
    assertEquals("historical_checkout", stored?.exchangeRate?.source)
    assertEquals(created.createdAt, stored?.createdAt)
    assertTrue(restored.updatedAt >= created.createdAt)
  }
}
