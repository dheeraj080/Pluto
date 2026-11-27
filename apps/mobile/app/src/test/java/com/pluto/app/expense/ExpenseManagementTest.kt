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
import com.pluto.app.domain.usecase.RestoreExpenseUseCase
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.expenses.ExpenseListUiState
import com.pluto.app.ui.expenses.ExpenseViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal
import java.util.concurrent.atomic.AtomicInteger

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
  fun `financial edit preserves original FX rate snapshot by default and updates only when requested`() = runTest {
    // 1 EUR = 95.00 INR initially
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        source = "snapshot_1",
        timestamp = 1_700_000_000_000L
      )
    )

    val createRes = createExpenseUseCase(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.SHOPPING,
      timestamp = System.currentTimeMillis() - 86_400_000L
    )
    val expense = (createRes as CreateExpenseResult.Success).expense
    assertEquals("950.00", expense.homeAmount.amount.toPlainString())

    // Market rate later moves to 100.00
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("100.00000000"),
        source = "snapshot_2"
      )
    )

    // User edits amount (10.00 -> 25.00) and date (1 day earlier) without choosing a new rate
    val updateRes = updateExpenseUseCase(
      existingExpense = expense,
      newAmount = BigDecimal("25.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = expense.timestamp - 86_400_000L,
      newMerchant = expense.merchant,
      newNote = expense.note
    )

    assertTrue(updateRes is UpdateExpenseResult.Success)
    val preservedUpdated = (updateRes as UpdateExpenseResult.Success).expense
    assertEquals("25.00", preservedUpdated.originalAmount.amount.toPlainString())
    // Preserves snapshot_1 (95.00): 25.00 * 95.00 = 2375.00
    assertEquals("2375.00", preservedUpdated.homeAmount.amount.toPlainString())
    assertEquals("95.00000000", preservedUpdated.exchangeRate.rate.toPlainString())
    assertEquals("snapshot_1", preservedUpdated.exchangeRate.source)

    // Explicit REFRESH_LIVE updates the rate to snapshot_2 (100.00): 25.00 * 100.00 = 2500.00
    val refreshedRes = updateExpenseUseCase(
      existingExpense = preservedUpdated,
      newAmount = BigDecimal("25.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = preservedUpdated.timestamp,
      newMerchant = preservedUpdated.merchant,
      newNote = preservedUpdated.note,
      rateUpdatePolicy = com.pluto.app.domain.usecase.RateUpdatePolicy.REFRESH_LIVE
    )

    assertTrue(refreshedRes is UpdateExpenseResult.Success)
    val refreshed = (refreshedRes as UpdateExpenseResult.Success).expense
    assertEquals("2500.00", refreshed.homeAmount.amount.toPlainString())
    assertEquals("snapshot_2", refreshed.exchangeRate.source)
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

  @Test
  fun `updating expense preserves createdAt and advances updatedAt`() = runTest {
    val createRes = createExpenseUseCase(
      amount = BigDecimal("25.00"),
      currency = Currency.INR,
      category = Category.FOOD,
      merchant = "Initial Store"
    )
    assertTrue(createRes is CreateExpenseResult.Success)
    val created = (createRes as CreateExpenseResult.Success).expense
    assertTrue(created.createdAt > 0L)
    assertEquals(created.createdAt, created.updatedAt)

    val simulatedOlderCreated = created.copy(
      createdAt = created.createdAt - 60_000L,
      updatedAt = created.createdAt - 60_000L
    )
    fakeExpenseRepo.saveExpense(simulatedOlderCreated)

    val updateRes = updateExpenseUseCase(
      existingExpense = simulatedOlderCreated,
      newAmount = simulatedOlderCreated.originalAmount.amount,
      newCurrency = simulatedOlderCreated.originalCurrency,
      newCategory = Category.GROCERIES,
      newTimestamp = simulatedOlderCreated.timestamp,
      newMerchant = "Updated Store",
      newNote = "Added note"
    )
    assertTrue(updateRes is UpdateExpenseResult.Success)
    val updated = (updateRes as UpdateExpenseResult.Success).expense
    assertEquals(simulatedOlderCreated.createdAt, updated.createdAt)
    assertTrue(updated.updatedAt > simulatedOlderCreated.updatedAt)
  }

  @Test
  fun `expense entity mapper preserves createdAt and updatedAt round trip`() {
    val domain = Expense.create(
      id = "exp-audit-1",
      originalAmount = Money.of("19.95", Currency.EUR),
      homeCurrency = Currency.USD,
      exchangeRate = ExchangeRate(Currency.EUR, Currency.USD, BigDecimal("1.10000000"), source = "api"),
      category = Category.FOOD,
      timestamp = 1700000000000L,
      merchant = "Cafe",
      createdAt = 1700000005000L,
      updatedAt = 1700000099000L
    )
    val entity = com.pluto.app.data.local.expense.ExpenseEntityMapper.toEntity(domain)
    assertEquals(1700000005000L, entity.createdAt)
    assertEquals(1700000099000L, entity.updatedAt)

    val roundTripped = com.pluto.app.data.local.expense.ExpenseEntityMapper.toDomain(entity)
    assertNotNull(roundTripped)
    assertEquals(1700000005000L, roundTripped?.createdAt)
    assertEquals(1700000099000L, roundTripped?.updatedAt)
  }

  @Test
  fun `recurring expense processing is idempotent across sequential and concurrent runs`() = runTest {
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        source = "test",
        timestamp = 1_700_000_000_000L
      )
    )

    val now = 1_705_000_000_000L
    val startTimestamp = now - 35L * 86_400_000L

    val createRes = createExpenseUseCase(
      amount = BigDecimal("19.99"),
      currency = Currency.EUR,
      category = Category.OTHER,
      timestamp = startTimestamp,
      merchant = "Cloud Storage",
      isRecurring = true,
      recurrenceFrequency = RecurrenceFrequency.MONTHLY
    )
    assertTrue(createRes is CreateExpenseResult.Success)
    val parent = (createRes as CreateExpenseResult.Success).expense

    val processUseCase = ProcessRecurringExpensesUseCase(fakeExpenseRepo, convertCurrencyUseCase)

    // Launch 5 concurrent invocations (simulating ViewModel + WorkManager overlap)
    val concurrentResults = coroutineScope {
      List(5) { async { processUseCase.invoke(nowMillis = now) } }.awaitAll()
    }
    val totalLoggedConcurrently = concurrentResults.flatten()
    assertEquals(1, totalLoggedConcurrently.size)

    val expectedDue = RecurrenceFrequency.MONTHLY.getNextTimestamp(startTimestamp)
    val expectedId = ProcessRecurringExpensesUseCase.occurrenceId(parent.id, expectedDue)
    assertEquals(expectedId, totalLoggedConcurrently.first().id)

    // Subsequent sequential run at the same timestamp logs nothing new
    val sequentialFollowUp = processUseCase.invoke(nowMillis = now)
    assertTrue(sequentialFollowUp.isEmpty())

    val storedOccurrences = fakeExpenseRepo.getRecurringExpenses()
    assertEquals(1, storedOccurrences.size)
    assertNotNull(fakeExpenseRepo.getExpenseById(expectedId))
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel saveExpense and deleteExpense guard against rapid duplicate submissions`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val saveCalls = AtomicInteger(0)
      val deleteCalls = AtomicInteger(0)
      val slowExpenseRepo = object : com.pluto.app.domain.repository.ExpenseRepository {
        private val inner = FakeExpenseRepository()
        override fun observeAllExpenses(): Flow<List<Expense>> = inner.observeAllExpenses()
        override fun observeExpensesByDateRange(startTime: Long, endTime: Long) = inner.observeExpensesByDateRange(startTime, endTime)
        override fun observeExpensesByCategory(categoryId: String) = inner.observeExpensesByCategory(categoryId)
        override fun observeExpensesByTrip(tripId: String) = inner.observeExpensesByTrip(tripId)
        override suspend fun getExpenseById(id: String) = inner.getExpenseById(id)
        override suspend fun saveExpense(expense: Expense) {
          saveCalls.incrementAndGet()
          delay(100)
          inner.saveExpense(expense)
        }
        override suspend fun deleteExpense(id: String) {
          deleteCalls.incrementAndGet()
          delay(100)
          inner.deleteExpense(id)
        }
        override suspend fun getRecurringExpenses() = inner.getRecurringExpenses()
      }

      val vm = ExpenseViewModel(
        observeExpensesUseCase = ObserveExpensesUseCase(slowExpenseRepo),
        createExpenseUseCase = CreateExpenseUseCase(slowExpenseRepo, fakeSettingsRepo, convertCurrencyUseCase),
        updateExpenseUseCase = UpdateExpenseUseCase(slowExpenseRepo, fakeSettingsRepo, convertCurrencyUseCase),
        deleteExpenseUseCase = DeleteExpenseUseCase(slowExpenseRepo),
        userSettingsRepository = fakeSettingsRepo,
        convertCurrencyUseCase = convertCurrencyUseCase
      )
      advanceUntilIdle()

      vm.onLocalCurrencyChanged(Currency.INR)
      vm.onHomeCurrencyChanged(Currency.INR)
      vm.onAmountChanged("42.50")
      vm.onMerchantChanged("Campus Cafe")

      var savedCount = 0
      vm.saveExpense { savedCount++ }
      vm.saveExpense { savedCount++ }
      advanceUntilIdle()

      assertEquals(1, saveCalls.get())
      assertEquals(1, savedCount)
      assertFalse(vm.formState.value.isSubmitting)

      var deletedCallbacks = 0
      vm.deleteExpense("exp-dup-1") { deletedCallbacks++ }
      vm.deleteExpense("exp-dup-1") { deletedCallbacks++ }
      advanceUntilIdle()

      assertEquals(1, deleteCalls.get())
      assertEquals(1, deletedCallbacks)
    } finally {
      Dispatchers.resetMain()
    }
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel deleteExpenseWithUndo and restoreExpense recover expense and guard duplicate restore`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val saveCalls = AtomicInteger(0)
      val slowRepo = object : com.pluto.app.domain.repository.ExpenseRepository {
        private val inner = FakeExpenseRepository()
        override fun observeAllExpenses(): Flow<List<Expense>> = inner.observeAllExpenses()
        override fun observeExpensesByDateRange(startTime: Long, endTime: Long) = inner.observeExpensesByDateRange(startTime, endTime)
        override fun observeExpensesByCategory(categoryId: String) = inner.observeExpensesByCategory(categoryId)
        override fun observeExpensesByTrip(tripId: String) = inner.observeExpensesByTrip(tripId)
        override suspend fun getExpenseById(id: String) = inner.getExpenseById(id)
        override suspend fun saveExpense(expense: Expense) {
          saveCalls.incrementAndGet()
          delay(100)
          inner.saveExpense(expense)
        }
        override suspend fun deleteExpense(id: String) = inner.deleteExpense(id)
        override suspend fun getRecurringExpenses() = inner.getRecurringExpenses()
      }

      val original = Expense.create(
        id = "exp-undo-1",
        originalAmount = Money.of("45.00", Currency.EUR),
        homeCurrency = Currency.INR,
        exchangeRate = ExchangeRate(Currency.EUR, Currency.INR, BigDecimal("95.00000000"), source = "snap"),
        category = Category.FOOD,
        timestamp = 1_700_000_000_000L,
        merchant = "Pasta Bar",
        createdAt = 1_700_000_000_100L,
        updatedAt = 1_700_000_000_100L
      )
      slowRepo.saveExpense(original)
      saveCalls.set(0)

      val vm = ExpenseViewModel(
        observeExpensesUseCase = ObserveExpensesUseCase(slowRepo),
        createExpenseUseCase = CreateExpenseUseCase(slowRepo, fakeSettingsRepo, convertCurrencyUseCase),
        updateExpenseUseCase = UpdateExpenseUseCase(slowRepo, fakeSettingsRepo, convertCurrencyUseCase),
        deleteExpenseUseCase = DeleteExpenseUseCase(slowRepo),
        userSettingsRepository = fakeSettingsRepo,
        convertCurrencyUseCase = convertCurrencyUseCase,
        restoreExpenseUseCase = RestoreExpenseUseCase(slowRepo)
      )
      advanceUntilIdle()

      var capturedSnapshot: Expense? = null
      vm.deleteExpenseWithUndo(original.id) { capturedSnapshot = it }
      advanceUntilIdle()

      assertNotNull(capturedSnapshot)
      assertNull(slowRepo.getExpenseById(original.id))

      var restoreCallbacks = 0
      vm.restoreExpense(capturedSnapshot!!) { restoreCallbacks++ }
      vm.restoreExpense(capturedSnapshot!!) { restoreCallbacks++ }
      advanceUntilIdle()

      assertEquals(1, saveCalls.get())
      assertEquals(1, restoreCallbacks)
      val restoredInRepo = slowRepo.getExpenseById(original.id)
      assertNotNull(restoredInRepo)
      assertEquals("45.00", restoredInRepo?.originalAmount?.amount?.toPlainString())
      assertEquals("4275.00", restoredInRepo?.homeAmount?.amount?.toPlainString())
      assertEquals(original.createdAt, restoredInRepo?.createdAt)
    } finally {
      Dispatchers.resetMain()
    }
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel emits Error on expense stream failure and recovers on retryExpensesList`() {
    val dispatcher = StandardTestDispatcher()
    Dispatchers.setMain(dispatcher)
    try {
      runTest(dispatcher) {
        var shouldFail = true
        val flakyRepo = object : com.pluto.app.domain.repository.ExpenseRepository {
          override fun observeAllExpenses(): Flow<List<Expense>> = flow {
            if (shouldFail) throw IllegalStateException("Storage unavailable")
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

        val vm = ExpenseViewModel(
          observeExpensesUseCase = ObserveExpensesUseCase(flakyRepo),
          createExpenseUseCase = CreateExpenseUseCase(flakyRepo, fakeSettingsRepo, convertCurrencyUseCase),
          updateExpenseUseCase = UpdateExpenseUseCase(flakyRepo, fakeSettingsRepo, convertCurrencyUseCase),
          deleteExpenseUseCase = DeleteExpenseUseCase(flakyRepo),
          userSettingsRepository = fakeSettingsRepo,
          convertCurrencyUseCase = convertCurrencyUseCase
        )

        val job = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
          vm.expenseListState.collect()
        }
        advanceUntilIdle()

        val errorState = vm.expenseListState.value
        assertTrue(errorState is ExpenseListUiState.Error)
        assertEquals("Storage unavailable", (errorState as ExpenseListUiState.Error).message)

        shouldFail = false
        vm.retryExpensesList()
        advanceUntilIdle()

        val recovered = vm.expenseListState.value
        assertTrue(recovered is ExpenseListUiState.Success)
        job.cancel()
      }
    } finally {
      Dispatchers.resetMain()
    }
  }
}
