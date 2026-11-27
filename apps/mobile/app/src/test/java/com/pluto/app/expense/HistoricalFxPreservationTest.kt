package com.pluto.app.expense

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ManualExchangeRateDao
import com.pluto.app.data.local.exchange.ManualExchangeRateEntity
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.RateUpdatePolicy
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.ui.expenses.ExpenseViewModel
import com.pluto.app.ui.expenses.formatRateNumber
import com.pluto.app.ui.expenses.localMillisToUtcPickerDate
import com.pluto.app.ui.expenses.mergeSelectedUtcDateWithLocalTime
import com.pluto.app.ui.expenses.rateSourceLabel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
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
import java.util.Calendar
import java.util.TimeZone

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
  fun `backdated expense creation uses historical rate rather than current-day rate`() = runTest {
    val now = System.currentTimeMillis()
    val fiveDaysAgo = now - 5L * 86_400_000L

    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("120.00"),
        timestamp = now,
        source = "manual_override"
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
  fun `createExpenseUseCase with customExchangeRate stores expense_custom_rate without mutating repository`() = runTest {
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00"),
        source = "open_er_api"
      )
    )

    val invalidRes = createExpenseUseCase(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      customExchangeRate = BigDecimal.ZERO
    )
    assertTrue(invalidRes is CreateExpenseResult.InvalidInput)

    val result = createExpenseUseCase(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      customExchangeRate = BigDecimal("97.25")
    )
    assertTrue(result is CreateExpenseResult.Success)
    val saved = (result as CreateExpenseResult.Success).expense
    assertEquals("972.50", saved.homeAmount.amount.toPlainString())
    assertEquals("expense_custom_rate", saved.exchangeRate.source)
    assertEquals(BigDecimal("97.25"), saved.exchangeRate.rate)

    // Repository rate stays untouched at 95.00
    assertEquals(BigDecimal("95.00"), fakeExchangeRepo.getRate(Currency.EUR, Currency.INR)?.rate)
  }

  @Test
  fun `updateExpenseUseCase applies custom rate and validates custom rate input`() = runTest {
    val existing = Expense.create(
      id = "exp-edit-custom",
      originalAmount = Money.of("10.00", Currency.EUR),
      homeCurrency = Currency.INR,
      exchangeRate = ExchangeRate(Currency.EUR, Currency.INR, BigDecimal("95.00"), source = "open_er_api"),
      category = Category.SHOPPING,
      timestamp = System.currentTimeMillis() - 3L * 86_400_000L
    )
    fakeExpenseRepo.saveExpense(existing)

    val invalidRes = updateExpenseUseCase(
      existingExpense = existing,
      newAmount = BigDecimal("10.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = existing.timestamp,
      newMerchant = "",
      newNote = "",
      rateUpdatePolicy = RateUpdatePolicy.USE_CUSTOM_RATE,
      customExchangeRate = BigDecimal("-1.5")
    )
    assertTrue(invalidRes is UpdateExpenseResult.InvalidInput)

    val missingCustomRes = updateExpenseUseCase(
      existingExpense = existing,
      newAmount = BigDecimal("10.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = existing.timestamp,
      newMerchant = "",
      newNote = "",
      rateUpdatePolicy = RateUpdatePolicy.USE_CUSTOM_RATE,
      customExchangeRate = null
    )
    assertTrue(missingCustomRes is UpdateExpenseResult.InvalidInput)

    val customRes = updateExpenseUseCase(
      existingExpense = existing,
      newAmount = BigDecimal("25.00"),
      newCurrency = Currency.EUR,
      newCategory = Category.SHOPPING,
      newTimestamp = existing.timestamp,
      newMerchant = "Boutique",
      newNote = "Card FX",
      rateUpdatePolicy = RateUpdatePolicy.USE_CUSTOM_RATE,
      customExchangeRate = BigDecimal("102.50")
    )
    assertTrue(customRes is UpdateExpenseResult.Success)
    val updated = (customRes as UpdateExpenseResult.Success).expense
    assertEquals("2562.50", updated.homeAmount.amount.toPlainString())
    assertEquals("expense_custom_rate", updated.exchangeRate.source)
  }

  @Test
  fun `OfflineFirstExchangeRateRepository getHistoricalRate never leaks today manual or latest API rate to past date and uses date-matched historical API rates`() = runTest {
    val now = System.currentTimeMillis()
    val fiveDaysAgo = now - 5L * 86_400_000L
    val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
    val todayDate = dateFormat.format(java.util.Date(now))
    val fiveDaysAgoDate = dateFormat.format(java.util.Date(fiveDaysAgo))

    val manualStore = mutableListOf(
      ManualExchangeRateEntity(
        fromCurrency = "EUR",
        toCurrency = "INR",
        rate = "120.00",
        effectiveDate = todayDate,
        effectiveFrom = now - 60_000L, // effective only today
        expiresAt = null,
        source = "manual_override",
        updatedAt = now
      )
    )
    val apiLatestStore = mapOf(
      "INR_JPY" to ExchangeRateEntity(
        fromCurrency = "INR",
        toCurrency = "JPY",
        rate = "2.00",
        effectiveDate = todayDate,
        fetchedAt = now,
        source = "open_er_api"
      ),
      "EUR_INR" to ExchangeRateEntity(
        fromCurrency = "EUR",
        toCurrency = "INR",
        rate = "91.50",
        effectiveDate = todayDate,
        fetchedAt = now,
        source = "open_er_api"
      )
    )
    val apiHistoricalStore = mapOf(
      "GBP_INR_$fiveDaysAgoDate" to ExchangeRateEntity(
        fromCurrency = "GBP",
        toCurrency = "INR",
        rate = "105.00",
        effectiveDate = fiveDaysAgoDate,
        fetchedAt = fiveDaysAgo,
        source = "open_er_api"
      ),
      "INR_AUD_$fiveDaysAgoDate" to ExchangeRateEntity(
        fromCurrency = "INR",
        toCurrency = "AUD",
        rate = "0.0200",
        effectiveDate = fiveDaysAgoDate,
        fetchedAt = fiveDaysAgo,
        source = "open_er_api"
      )
    )

    val fakeApiDao = object : ExchangeRateDao {
      override fun observeLatestRate(from: String, to: String): Flow<ExchangeRateEntity?> =
        flowOf(apiLatestStore["${from}_$to"])
      override suspend fun getLatestRate(from: String, to: String): ExchangeRateEntity? =
        apiLatestStore["${from}_$to"]
      override suspend fun getHistoricalRate(from: String, to: String, date: String): ExchangeRateEntity? =
        apiHistoricalStore["${from}_${to}_$date"]
      override suspend fun insertRate(rate: ExchangeRateEntity) {}
      override suspend fun insertRates(rates: List<ExchangeRateEntity>) {}
      override fun observeAllRates(): Flow<List<ExchangeRateEntity>> = flowOf(apiLatestStore.values.toList())
      override suspend fun getAllRates(): List<ExchangeRateEntity> = apiLatestStore.values.toList()
      override suspend fun deleteManualOverride(from: String, to: String) {}
      override suspend fun clearAll() {}
    }

    val fakeManualDao = object : ManualExchangeRateDao {
      override suspend fun getManualRateForPeriod(from: String, to: String, effectiveFrom: Long): ManualExchangeRateEntity? = null
      override suspend fun getApplicableManualRate(from: String, to: String, timestamp: Long): ManualExchangeRateEntity? =
        manualStore.firstOrNull {
          it.fromCurrency == from && it.toCurrency == to && it.isApplicableAt(timestamp)
        }
      override fun observeManualRatesForPair(from: String, to: String): Flow<List<ManualExchangeRateEntity>> =
        flowOf(manualStore.filter { it.fromCurrency == from && it.toCurrency == to })
      override fun observeAllManualRates(): Flow<List<ManualExchangeRateEntity>> = flowOf(manualStore)
      override suspend fun getAllManualRates(): List<ManualExchangeRateEntity> = manualStore
      override suspend fun getManualRatesForPair(from: String, to: String): List<ManualExchangeRateEntity> =
        manualStore.filter { it.fromCurrency == from && it.toCurrency == to }
      override suspend fun insertManualRate(rate: ManualExchangeRateEntity) {}
      override suspend fun insertManualRates(rates: List<ManualExchangeRateEntity>) {}
      override suspend fun deleteManualRatePeriod(from: String, to: String, effectiveFrom: Long) {}
      override suspend fun deleteManualRatesForPair(from: String, to: String) {}
      override suspend fun clearAll() {}
    }

    val noopApi = object : ExchangeRateApiService {
      override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto =
        error("Network must not be called")
    }

    val repo = OfflineFirstExchangeRateRepository(fakeApiDao, fakeManualDao, noopApi)

    // Five days ago has NO historical row for EUR -> INR or JPY -> INR; must NOT leak today's manual or latest API rates
    assertNull(repo.getHistoricalRate(Currency.EUR, Currency.INR, fiveDaysAgo))
    assertNull(repo.getHistoricalRate(Currency.JPY, Currency.INR, fiveDaysAgo))

    // ConvertCurrencyUseCase must surface RateUnavailable rather than misrepresenting today's live rate
    val useCase = ConvertCurrencyUseCase(repo)
    val convRes = useCase(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = fiveDaysAgo)
    assertTrue(convRes is ConversionResult.RateUnavailable)

    // Genuinely date-matched historical API rate (direct) is returned and marked cached
    val gbpInr = repo.getHistoricalRate(Currency.GBP, Currency.INR, fiveDaysAgo)
    assertNotNull(gbpInr)
    assertEquals(BigDecimal("105.00"), gbpInr!!.rate)
    val gbpConv = useCase(Money.of("10.00", Currency.GBP), Currency.INR, atTimestamp = fiveDaysAgo)
    assertTrue(gbpConv is ConversionResult.Success)
    assertTrue((gbpConv as ConversionResult.Success).isCached)

    // Genuinely date-matched historical API rate (inverse) is derived accurately
    val audInr = repo.getHistoricalRate(Currency.AUD, Currency.INR, fiveDaysAgo)
    assertNotNull(audInr)
    assertEquals(0, BigDecimal("50").compareTo(audInr!!.rate))
    assertEquals("open_er_api_inverse", audInr.source)
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel preserves original FX rate on edit, supports custom rate validation, refresh live, and restore original`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val now = System.currentTimeMillis()
      val originalRate = ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        timestamp = now - 5L * 86_400_000L,
        source = "historical_checkout"
      )
      val existingExpense = Expense.create(
        id = "exp-vm-preserve",
        originalAmount = Money.of("10.00", Currency.EUR),
        homeCurrency = Currency.INR,
        exchangeRate = originalRate,
        category = Category.FOOD,
        timestamp = now - 5L * 86_400_000L,
        merchant = "Milan Cafe"
      )
      fakeExpenseRepo.saveExpense(existingExpense)

      // Market rate is now 110.00
      fakeExchangeRepo.setRate(
        ExchangeRate(
          fromCurrency = Currency.EUR,
          toCurrency = Currency.INR,
          rate = BigDecimal("110.00000000"),
          source = "open_er_api"
        )
      )

      val vm = ExpenseViewModel(
        observeExpensesUseCase = ObserveExpensesUseCase(fakeExpenseRepo),
        createExpenseUseCase = createExpenseUseCase,
        updateExpenseUseCase = updateExpenseUseCase,
        deleteExpenseUseCase = DeleteExpenseUseCase(fakeExpenseRepo),
        userSettingsRepository = fakeSettingsRepo,
        convertCurrencyUseCase = convertCurrencyUseCase
      )
      advanceUntilIdle()

      vm.prepareEditForm(existingExpense)
      assertEquals(RateUpdatePolicy.PRESERVE_EXISTING, vm.formState.value.rateUpdatePolicy)
      assertEquals(originalRate, vm.formState.value.preservedOriginalRate)

      // Edit amount & date: preview updates locally with preserved rate 95.00 -> 2375.00 INR
      vm.onAmountChanged("25.00")
      vm.onDateChanged(now - 7L * 86_400_000L)
      advanceUntilIdle()

      assertEquals("2375.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())
      assertEquals("historical_checkout", vm.formState.value.conversionPreview.exchangeRate?.source)

      // Toggle custom rate on and enter invalid "0" -> blocks save
      vm.onToggleCustomRate(true)
      vm.onCustomRateInputChanged("0")
      advanceUntilIdle()
      assertFalse(vm.formState.value.isValidCustomRate)
      assertNotNull(vm.formState.value.customRateError)

      var savedExpense: Expense? = null
      vm.saveExpense { savedExpense = it }
      advanceUntilIdle()
      assertNull(savedExpense)

      // Refresh live rate -> picks up 110.00 -> 2750.00 INR
      vm.refreshLiveExchangeRate()
      advanceUntilIdle()
      assertEquals(RateUpdatePolicy.REFRESH_LIVE, vm.formState.value.rateUpdatePolicy)
      assertEquals("2750.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())

      // Restore original -> goes back to 95.00 -> 2375.00 INR
      vm.onRestoreOriginalRate()
      advanceUntilIdle()
      assertEquals(RateUpdatePolicy.PRESERVE_EXISTING, vm.formState.value.rateUpdatePolicy)
      assertEquals("2375.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())

      // Save with preserved original rate
      vm.saveExpense { savedExpense = it }
      advanceUntilIdle()
      assertNotNull(savedExpense)
      assertEquals("2375.00", savedExpense?.homeAmount?.amount?.toPlainString())
      assertEquals("historical_checkout", savedExpense?.exchangeRate?.source)
      assertEquals("95.00000000", savedExpense?.exchangeRate?.rate?.toPlainString())
    } finally {
      Dispatchers.resetMain()
    }
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel currency swap normalizes decimal scale and supports target home currency change`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      fakeExchangeRepo.setRate(
        ExchangeRate(
          fromCurrency = Currency.JPY,
          toCurrency = Currency.USD,
          rate = BigDecimal("0.0067"),
          source = "open_er_api"
        )
      )
      fakeExchangeRepo.setRate(
        ExchangeRate(
          fromCurrency = Currency.USD,
          toCurrency = Currency.JPY,
          rate = BigDecimal("149.25"),
          source = "open_er_api"
        )
      )

      val vm = ExpenseViewModel(
        observeExpensesUseCase = ObserveExpensesUseCase(fakeExpenseRepo),
        createExpenseUseCase = createExpenseUseCase,
        updateExpenseUseCase = updateExpenseUseCase,
        deleteExpenseUseCase = DeleteExpenseUseCase(fakeExpenseRepo),
        userSettingsRepository = fakeSettingsRepo,
        convertCurrencyUseCase = convertCurrencyUseCase
      )
      advanceUntilIdle()

      vm.prepareCreateForm(presetCurrency = Currency.USD, presetHomeCurrency = Currency.JPY)
      advanceUntilIdle()
      vm.onAmountChanged("10.50")
      advanceUntilIdle()

      assertEquals("1567", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())

      // Swap USD -> JPY to JPY -> USD; zero-decimal normalization turns 10.50 into 10
      vm.onSwapCurrencies()
      advanceUntilIdle()
      assertEquals(Currency.JPY, vm.formState.value.localCurrency)
      assertEquals(Currency.USD, vm.formState.value.homeCurrency)
      assertEquals("10", vm.formState.value.amount)
      assertEquals("0.07", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())
      assertTrue(vm.formState.value.conversionPreview.rateFormatted?.contains("0.0067") == true)
    } finally {
      Dispatchers.resetMain()
    }
  }

  @Test
  fun `formatRateNumber preserves small FX precision and date helper clamps to now`() {
    assertEquals("0.0067", formatRateNumber(BigDecimal("0.00670000"), Currency.USD))
    assertEquals("95.50", formatRateNumber(BigDecimal("95.5"), Currency.INR))

    val now = 1_700_000_500_000L
    val todayUtc = localMillisToUtcPickerDate(now)
    val mergedToday = mergeSelectedUtcDateWithLocalTime(
      selectedUtcDateMillis = todayUtc,
      existingLocalMillis = now + 100_000L,
      nowMillis = now
    )
    assertEquals(now, mergedToday)

    val pastCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
      clear()
      set(2025, Calendar.MARCH, 10, 0, 0, 0)
    }
    val existingLocal = Calendar.getInstance().apply {
      set(2026, Calendar.NOVEMBER, 25, 14, 30, 0)
    }.timeInMillis
    val mergedPast = mergeSelectedUtcDateWithLocalTime(
      selectedUtcDateMillis = pastCal.timeInMillis,
      existingLocalMillis = existingLocal,
      nowMillis = existingLocal
    )
    val resultLocal = Calendar.getInstance().apply { timeInMillis = mergedPast }
    assertEquals(2025, resultLocal.get(Calendar.YEAR))
    assertEquals(Calendar.MARCH, resultLocal.get(Calendar.MONTH))
    assertEquals(10, resultLocal.get(Calendar.DAY_OF_MONTH))
    assertEquals(14, resultLocal.get(Calendar.HOUR_OF_DAY))
    assertEquals(30, resultLocal.get(Calendar.MINUTE))
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel currency pair change clears incompatible old rate and resolves new pair`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val now = System.currentTimeMillis()
      val originalRate = ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("95.00000000"),
        timestamp = now - 5L * 86_400_000L,
        source = "historical_checkout"
      )
      val existingExpense = Expense.create(
        id = "exp-pair-change",
        originalAmount = Money.of("10.00", Currency.EUR),
        homeCurrency = Currency.INR,
        exchangeRate = originalRate,
        category = Category.FOOD,
        timestamp = now,
        merchant = "Cafe"
      )
      fakeExpenseRepo.saveExpense(existingExpense)

      fakeExchangeRepo.setRate(
        ExchangeRate(Currency.GBP, Currency.INR, BigDecimal("108.00"), source = "open_er_api")
      )

      val vm = ExpenseViewModel(
        observeExpensesUseCase = ObserveExpensesUseCase(fakeExpenseRepo),
        createExpenseUseCase = createExpenseUseCase,
        updateExpenseUseCase = updateExpenseUseCase,
        deleteExpenseUseCase = DeleteExpenseUseCase(fakeExpenseRepo),
        userSettingsRepository = fakeSettingsRepo,
        convertCurrencyUseCase = convertCurrencyUseCase
      )
      advanceUntilIdle()

      vm.prepareEditForm(existingExpense)
      assertEquals("950.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())

      // Switch to GBP -> INR (has rate 108.00)
      vm.onLocalCurrencyChanged(Currency.GBP)
      advanceUntilIdle()
      assertEquals(RateUpdatePolicy.REFRESH_FOR_DATE, vm.formState.value.rateUpdatePolicy)
      assertEquals(Currency.GBP, vm.formState.value.conversionPreview.exchangeRate?.fromCurrency)
      assertEquals("1080.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())

      // Switch to CHF -> INR (no rate configured) -> must NOT retain 108.00 or 95.00
      vm.onLocalCurrencyChanged(Currency.CHF)
      assertNull(vm.formState.value.conversionPreview.exchangeRate)
      advanceUntilIdle()
      assertTrue(vm.formState.value.conversionPreview.isRateUnavailable)
      assertNull(vm.formState.value.conversionPreview.convertedMoney)
      assertNull(vm.formState.value.conversionPreview.exchangeRate)

      // Toggling custom rate when no compatible rate exists must NOT prefill incompatible rate
      vm.onToggleCustomRate(true)
      assertEquals("", vm.formState.value.customRateInput)
      vm.onToggleCustomRate(false)

      // Keep Original restores exact EUR -> INR rate, homeAmount, and provenance
      vm.onRestoreOriginalRate()
      advanceUntilIdle()
      assertEquals(Currency.EUR, vm.formState.value.localCurrency)
      assertEquals(Currency.INR, vm.formState.value.homeCurrency)
      assertEquals(RateUpdatePolicy.PRESERVE_EXISTING, vm.formState.value.rateUpdatePolicy)
      assertEquals(originalRate, vm.formState.value.conversionPreview.exchangeRate)
      assertEquals("950.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())
      assertEquals("historical_checkout", vm.formState.value.conversionPreview.exchangeRate?.source)
    } finally {
      Dispatchers.resetMain()
    }
  }

  @OptIn(ExperimentalCoroutinesApi::class)
  @Test
  fun `ExpenseViewModel refresh live does not modify stored snapshot before save and backdated miss requires explicit choice`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val now = System.currentTimeMillis()
      val fiveDaysAgo = now - 5L * 86_400_000L

      // Strict repository where getHistoricalRate never falls back to latest API rates
      val strictRepo = object : com.pluto.app.domain.repository.ExchangeRateRepository {
        val latest = mutableMapOf(
          (Currency.EUR to Currency.INR) to ExchangeRate(Currency.EUR, Currency.INR, BigDecimal("112.00"), now, "open_er_api")
        )
        override fun observeRate(from: Currency, to: Currency) = flowOf(latest[from to to])
        override suspend fun getRate(from: Currency, to: Currency, allowOfflineCache: Boolean) =
          if (from == to) ExchangeRate.identity(from) else latest[from to to]
        override suspend fun getHistoricalRate(from: Currency, to: Currency, timestamp: Long) =
          if (from == to) ExchangeRate.identity(from) else null
        override suspend fun saveRate(exchangeRate: ExchangeRate) {}
        override fun observeAllRates() = flowOf(latest.values.toList())
        override suspend fun setManualOverride(from: Currency, to: Currency, rate: BigDecimal) {}
        override suspend fun clearManualOverride(from: Currency, to: Currency) {}
        override suspend fun getManualOverrides() = emptyList<ExchangeRate>()
      }
      val strictConvert = ConvertCurrencyUseCase(strictRepo)
      val strictCreate = CreateExpenseUseCase(fakeExpenseRepo, fakeSettingsRepo, strictConvert)
      val strictUpdate = UpdateExpenseUseCase(fakeExpenseRepo, fakeSettingsRepo, strictConvert)

      val originalRate = ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("94.25000000"),
        timestamp = fiveDaysAgo,
        source = "historical_checkout"
      )
      val existing = Expense.create(
        id = "exp-unsaved-refresh",
        originalAmount = Money.of("10.00", Currency.EUR),
        homeCurrency = Currency.INR,
        exchangeRate = originalRate,
        category = Category.FOOD,
        timestamp = fiveDaysAgo,
        merchant = "Old Bistro"
      )
      fakeExpenseRepo.saveExpense(existing)

      val vm = ExpenseViewModel(
        observeExpensesUseCase = ObserveExpensesUseCase(fakeExpenseRepo),
        createExpenseUseCase = strictCreate,
        updateExpenseUseCase = strictUpdate,
        deleteExpenseUseCase = DeleteExpenseUseCase(fakeExpenseRepo),
        userSettingsRepository = fakeSettingsRepo,
        convertCurrencyUseCase = strictConvert
      )
      advanceUntilIdle()

      // 1. Editing: refreshLiveExchangeRate updates preview only, leaving repo snapshot untouched
      vm.prepareEditForm(existing)
      vm.refreshLiveExchangeRate()
      advanceUntilIdle()
      assertEquals("1120.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())
      val storedBeforeSave = fakeExpenseRepo.getExpenseById(existing.id)!!
      assertEquals(BigDecimal("94.25000000"), storedBeforeSave.exchangeRate.rate)
      assertEquals("942.50", storedBeforeSave.homeAmount.amount.toPlainString())
      assertEquals("historical_checkout", storedBeforeSave.exchangeRate.source)

      // 2. Creating backdated expense when no historical rate exists:
      // requires explicit choice and refuses to silently save today's live rate
      vm.prepareCreateForm(presetCurrency = Currency.EUR, presetHomeCurrency = Currency.INR)
      advanceUntilIdle()
      vm.onAmountChanged("20.00")
      vm.onDateChanged(fiveDaysAgo)
      advanceUntilIdle()

      assertTrue(vm.formState.value.conversionPreview.isRateUnavailable)
      assertTrue(vm.formState.value.requiresExplicitRateChoice)
      assertFalse(vm.formState.value.conversionPreview.isLiveApi)

      var savedBackdated: Expense? = null
      vm.saveExpense { savedBackdated = it }
      advanceUntilIdle()
      assertNull(savedBackdated)
      assertNotNull(vm.formState.value.errorMessage)

      // Explicit choice: Use Live Rate
      vm.refreshLiveExchangeRate()
      advanceUntilIdle()
      assertFalse(vm.formState.value.requiresExplicitRateChoice)
      assertEquals("2240.00", vm.formState.value.conversionPreview.convertedMoney?.amount?.toPlainString())
      assertEquals(
        "Live API (Past Date)",
        rateSourceLabel(
          source = "open_er_api",
          isPreservedOriginal = false,
          isPriorDay = true,
          isExplicitLiveForPastDate = true
        )
      )
      assertEquals(
        "Historical Rate",
        rateSourceLabel(
          source = "open_er_api",
          isPreservedOriginal = false,
          isPriorDay = true,
          isExplicitLiveForPastDate = false
        )
      )

      // High-precision custom rate preserves BigDecimal precision and rejects invalid values
      vm.onToggleCustomRate(true)
      vm.onCustomRateInputChanged("0.000")
      assertFalse(vm.formState.value.isValidCustomRate)
      vm.onCustomRateInputChanged("95.1234567891")
      assertTrue(vm.formState.value.isValidCustomRate)
      advanceUntilIdle()

      vm.saveExpense { savedBackdated = it }
      advanceUntilIdle()
      assertNotNull(savedBackdated)
      assertEquals("95.1234567891", savedBackdated!!.exchangeRate.rate.toPlainString())
      assertEquals("expense_custom_rate", savedBackdated!!.exchangeRate.source)
      assertEquals("1902.47", savedBackdated!!.homeAmount.amount.toPlainString())
    } finally {
      Dispatchers.resetMain()
    }
  }

  private fun createInMemoryOfflineFirstHarness(
    apiRates: Map<String, BigDecimal> = mapOf("INR" to BigDecimal("90.500000")),
    apiShouldThrow: Boolean = false
  ): SameDayHarness {
    val apiLatestStore = mutableMapOf<String, ExchangeRateEntity>()
    val apiHistoricalStore = mutableMapOf<String, ExchangeRateEntity>()
    val manualStore = mutableMapOf<Triple<String, String, Long>, ManualExchangeRateEntity>()
    var apiCalls = 0

    val fakeApiDao = object : ExchangeRateDao {
      override fun observeLatestRate(from: String, to: String): Flow<ExchangeRateEntity?> =
        flowOf(apiLatestStore["${from}_$to"])

      override suspend fun getLatestRate(from: String, to: String): ExchangeRateEntity? =
        apiLatestStore["${from}_$to"]

      override suspend fun getHistoricalRate(from: String, to: String, date: String): ExchangeRateEntity? =
        apiHistoricalStore["${from}_${to}_$date"]

      override suspend fun insertRate(rate: ExchangeRateEntity) {
        apiLatestStore["${rate.fromCurrency}_${rate.toCurrency}"] = rate
        apiHistoricalStore["${rate.fromCurrency}_${rate.toCurrency}_${rate.effectiveDate}"] = rate
      }

      override suspend fun insertRates(rates: List<ExchangeRateEntity>) {
        rates.forEach { insertRate(it) }
      }

      override fun observeAllRates(): Flow<List<ExchangeRateEntity>> = flowOf(apiLatestStore.values.toList())
      override suspend fun getAllRates(): List<ExchangeRateEntity> = apiLatestStore.values.toList()
      override suspend fun deleteManualOverride(from: String, to: String) {}
      override suspend fun clearAll() {
        apiLatestStore.clear()
        apiHistoricalStore.clear()
      }
    }

    val fakeManualDao = object : ManualExchangeRateDao {
      override suspend fun insertManualRate(rate: ManualExchangeRateEntity) {
        manualStore[Triple(rate.fromCurrency, rate.toCurrency, rate.effectiveFrom)] = rate
      }

      override suspend fun insertManualRates(rates: List<ManualExchangeRateEntity>) {
        rates.forEach { manualStore[Triple(it.fromCurrency, it.toCurrency, it.effectiveFrom)] = it }
      }

      override suspend fun getManualRateForPeriod(from: String, to: String, effectiveFrom: Long): ManualExchangeRateEntity? =
        manualStore[Triple(from, to, effectiveFrom)]

      override suspend fun getManualRatesForPair(from: String, to: String): List<ManualExchangeRateEntity> =
        manualStore.values
          .filter { it.fromCurrency == from && it.toCurrency == to }
          .sortedBy { it.effectiveFrom }

      override suspend fun getApplicableManualRate(from: String, to: String, timestamp: Long): ManualExchangeRateEntity? =
        manualStore.values
          .filter { it.fromCurrency == from && it.toCurrency == to && it.isApplicableAt(timestamp) }
          .maxByOrNull { it.effectiveFrom }

      override fun observeManualRatesForPair(from: String, to: String): Flow<List<ManualExchangeRateEntity>> =
        flowOf(manualStore.values.filter { it.fromCurrency == from && it.toCurrency == to }.sortedByDescending { it.effectiveFrom })

      override fun observeAllManualRates(): Flow<List<ManualExchangeRateEntity>> =
        flowOf(manualStore.values.toList())

      override suspend fun getAllManualRates(): List<ManualExchangeRateEntity> = manualStore.values.toList()

      override suspend fun deleteManualRatePeriod(from: String, to: String, effectiveFrom: Long) {
        manualStore.remove(Triple(from, to, effectiveFrom))
      }

      override suspend fun deleteManualRatesForPair(from: String, to: String) {
        manualStore.keys.removeAll { it.first == from && it.second == to }
      }

      override suspend fun clearAll() {
        manualStore.clear()
      }
    }

    val countingApi = object : ExchangeRateApiService {
      override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto {
        apiCalls++
        if (apiShouldThrow) throw IllegalStateException("Offline simulated")
        return ExchangeRateResponseDto(
          result = "success",
          baseCode = baseCurrency,
          timeLastUpdateUnix = System.currentTimeMillis() / 1000L,
          timeLastUpdateUtc = "Thu, 26 Nov 2026 00:00:00 +0000",
          rates = apiRates
        )
      }
    }

    val repo = OfflineFirstExchangeRateRepository(fakeApiDao, fakeManualDao, countingApi)
    return SameDayHarness(repo = repo, apiCallCount = { apiCalls })
  }

  private data class SameDayHarness(
    val repo: OfflineFirstExchangeRateRepository,
    val apiCallCount: () -> Int
  )

  private fun todayAt(hour: Int, minute: Int, second: Int = 0): Long =
    Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, second)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis

  @Test
  fun `expense earlier today uses manual rate that expired after transaction without API calls`() = runTest {
    val harness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to BigDecimal("90.500000")))
    val currentNow = todayAt(16, 0)
    val txTimestamp = todayAt(10, 30)
    val effectiveFrom = todayAt(8, 0)
    val expiredAt = todayAt(12, 0) // expired AFTER tx (10:30) and BEFORE now (16:00)

    val morningRate = BigDecimal("96.123456789123")
    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = morningRate,
      effectiveFrom = effectiveFrom,
      expiresAt = expiredAt
    )
    // A newer manual rate is active at currentNow (16:00)
    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = BigDecimal("104.000000"),
      effectiveFrom = todayAt(14, 0),
      expiresAt = null
    )

    val convert = ConvertCurrencyUseCase(harness.repo, nowProvider = { currentNow })
    val result = convert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = txTimestamp)

    assertTrue(result is ConversionResult.Success)
    val success = result as ConversionResult.Success
    assertEquals(morningRate, success.exchangeRate.rate)
    assertEquals("96.123456789123", success.exchangeRate.rate.toPlainString())
    assertEquals("manual_override", success.exchangeRate.source)
    assertEquals("961.23", success.convertedMoney.amount.toPlainString())
    assertEquals(0, harness.apiCallCount())

    // Also verify end-to-end expense creation with a recently expired manual window on today's calendar day
    val realNow = System.currentTimeMillis()
    val realHarness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to BigDecimal("90.500000")))
    val windowStart = minOf(todayAt(0, 0), realNow - 90_000L)
    val windowExpiry = realNow - 5_000L
    val earlierTx = maxOf(windowStart + 1_000L, realNow - 30_000L)
    val exactRate = BigDecimal("97.6543210987")
    realHarness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = exactRate,
      effectiveFrom = windowStart,
      expiresAt = windowExpiry
    )
    val realConvert = ConvertCurrencyUseCase(realHarness.repo)
    val realCreate = CreateExpenseUseCase(fakeExpenseRepo, fakeSettingsRepo, realConvert)
    val created = realCreate(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      timestamp = earlierTx,
      merchant = "Morning Cafe"
    )
    assertTrue(created is CreateExpenseResult.Success)
    val expense = (created as CreateExpenseResult.Success).expense
    assertEquals(exactRate, expense.exchangeRate.rate)
    assertEquals("97.6543210987", expense.exchangeRate.rate.toPlainString())
    assertEquals("976.54", expense.homeAmount.amount.toPlainString())
    assertEquals("manual_override", expense.exchangeRate.source)
    assertEquals(0, realHarness.apiCallCount())
  }

  @Test
  fun `expense earlier today does not use manual rate that expired before transaction`() = runTest {
    val apiMarketRate = BigDecimal("91.250000")
    val harness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to apiMarketRate))
    val currentNow = todayAt(16, 0)
    val txTimestamp = todayAt(11, 0)

    // Expired BEFORE tx (11:00)
    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = BigDecimal("99.9999"),
      effectiveFrom = todayAt(8, 0),
      expiresAt = todayAt(10, 0)
    )

    val convert = ConvertCurrencyUseCase(harness.repo, nowProvider = { currentNow })
    val result = convert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = txTimestamp)

    assertTrue(result is ConversionResult.Success)
    val success = result as ConversionResult.Success
    assertEquals("open_er_api", success.exchangeRate.source)
    assertEquals(apiMarketRate, success.exchangeRate.rate)
    assertEquals("912.50", success.convertedMoney.amount.toPlainString())
    assertEquals(1, harness.apiCallCount())

    // When offline and no API cache exists, returns RateUnavailable rather than expired manual rate
    val offlineHarness = createInMemoryOfflineFirstHarness(apiShouldThrow = true)
    offlineHarness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = BigDecimal("99.9999"),
      effectiveFrom = todayAt(8, 0),
      expiresAt = todayAt(10, 0)
    )
    val offlineConvert = ConvertCurrencyUseCase(offlineHarness.repo, nowProvider = { currentNow })
    val offlineResult = offlineConvert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = txTimestamp)
    assertTrue(offlineResult is ConversionResult.RateUnavailable)
  }

  @Test
  fun `expense earlier today does not use manual rate that starts later today even if active now`() = runTest {
    val apiMarketRate = BigDecimal("92.400000")
    val harness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to apiMarketRate))
    val currentNow = todayAt(16, 0)
    val txTimestamp = todayAt(10, 0)

    // Case 1: Manual rate started at 13:00 (after tx at 10:00, already active at currentNow 16:00)
    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = BigDecimal("108.0000"),
      effectiveFrom = todayAt(13, 0),
      expiresAt = null
    )

    val convert = ConvertCurrencyUseCase(harness.repo, nowProvider = { currentNow })
    val resultWithActiveNow = convert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = txTimestamp)

    assertTrue(resultWithActiveNow is ConversionResult.Success)
    val success = resultWithActiveNow as ConversionResult.Success
    // Must NOT pick up the 13:00 current-time manual rate (108.0000) for the 10:00 transaction
    assertEquals("open_er_api", success.exchangeRate.source)
    assertEquals(apiMarketRate, success.exchangeRate.rate)
    assertEquals("924.00", success.convertedMoney.amount.toPlainString())

    // Case 2: Manual rate starts later today in the future relative to currentNow (19:00)
    harness.repo.clearManualOverride(Currency.EUR, Currency.INR)
    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = BigDecimal("115.0000"),
      effectiveFrom = todayAt(19, 0),
      expiresAt = null
    )
    val resultWithFutureRate = convert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = txTimestamp)
    assertTrue(resultWithFutureRate is ConversionResult.Success)
    assertEquals("open_er_api", (resultWithFutureRate as ConversionResult.Success).exchangeRate.source)
    assertEquals(apiMarketRate, resultWithFutureRate.exchangeRate.rate)
  }

  @Test
  fun `half-open interval includes exact effectiveFrom and excludes exact expiresAt`() = runTest {
    val apiMarketRate = BigDecimal("89.500000")
    val harness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to apiMarketRate))
    val currentNow = todayAt(16, 0)
    val effectiveFrom = todayAt(9, 0)
    val expiresAt = todayAt(12, 0)
    val exactWindowRate = BigDecimal("95.8765432109")

    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = exactWindowRate,
      effectiveFrom = effectiveFrom,
      expiresAt = expiresAt
    )

    val convert = ConvertCurrencyUseCase(harness.repo, nowProvider = { currentNow })

    // Exactly at effectiveFrom -> inclusive -> manual override applies with 0 API calls
    val atStart = convert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = effectiveFrom)
    assertTrue(atStart is ConversionResult.Success)
    val startSuccess = atStart as ConversionResult.Success
    assertEquals(exactWindowRate, startSuccess.exchangeRate.rate)
    assertEquals("manual_override", startSuccess.exchangeRate.source)
    assertEquals("958.77", startSuccess.convertedMoney.amount.toPlainString())
    assertEquals(0, harness.apiCallCount())

    // Exactly at expiresAt -> exclusive -> manual override does NOT apply, falls back to market rate
    val atEnd = convert(Money.of("10.00", Currency.EUR), Currency.INR, atTimestamp = expiresAt)
    assertTrue(atEnd is ConversionResult.Success)
    val endSuccess = atEnd as ConversionResult.Success
    assertEquals("open_er_api", endSuccess.exchangeRate.source)
    assertEquals(apiMarketRate, endSuccess.exchangeRate.rate)
    assertEquals("895.00", endSuccess.convertedMoney.amount.toPlainString())
    assertEquals(1, harness.apiCallCount())
  }

  @Test
  fun `current-time transaction uses currently applicable manual rate without API calls and preserves BigDecimal precision`() = runTest {
    val harness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to BigDecimal("90.000000")))
    val currentRate = BigDecimal("101.2345678912")
    val now = System.currentTimeMillis()

    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = currentRate,
      effectiveFrom = now - 60_000L,
      expiresAt = null
    )

    val convert = ConvertCurrencyUseCase(harness.repo)
    val create = CreateExpenseUseCase(fakeExpenseRepo, fakeSettingsRepo, convert)

    // Direct conversion at current time (atTimestamp = null)
    val directRes = convert(Money.of("10.00", Currency.EUR), Currency.INR)
    assertTrue(directRes is ConversionResult.Success)
    assertEquals(currentRate, (directRes as ConversionResult.Success).exchangeRate.rate)
    assertEquals("manual_override", directRes.exchangeRate.source)
    assertEquals(0, harness.apiCallCount())

    // End-to-end current-time expense creation
    val createRes = create(
      amount = BigDecimal("10.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      merchant = "Current Bistro"
    )
    assertTrue(createRes is CreateExpenseResult.Success)
    val saved = (createRes as CreateExpenseResult.Success).expense
    assertEquals(currentRate, saved.exchangeRate.rate)
    assertEquals("101.2345678912", saved.exchangeRate.rate.toPlainString())
    assertEquals("1012.35", saved.homeAmount.amount.toPlainString())
    assertEquals("manual_override", saved.exchangeRate.source)
    assertEquals(0, harness.apiCallCount())
  }

  @Test
  fun `existing expense edit preserves original rate and homeAmount even when same-day manual rates change`() = runTest {
    val harness = createInMemoryOfflineFirstHarness(apiRates = mapOf("INR" to BigDecimal("90.000000")))
    val now = System.currentTimeMillis()
    val originalTimestamp = now - 10_000L
    val initialManualRate = BigDecimal("94.12500000")

    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = initialManualRate,
      effectiveFrom = originalTimestamp - 60_000L,
      expiresAt = now - 5_000L
    )

    val convert = ConvertCurrencyUseCase(harness.repo)
    val create = CreateExpenseUseCase(fakeExpenseRepo, fakeSettingsRepo, convert)
    val update = UpdateExpenseUseCase(fakeExpenseRepo, fakeSettingsRepo, convert)

    val createdRes = create(
      amount = BigDecimal("12.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      timestamp = originalTimestamp,
      merchant = "Original Lunch"
    )
    assertTrue(createdRes is CreateExpenseResult.Success)
    val originalExpense = (createdRes as CreateExpenseResult.Success).expense
    assertEquals("1129.50", originalExpense.homeAmount.amount.toPlainString())
    assertEquals(initialManualRate, originalExpense.exchangeRate.rate)

    // Later today, a brand-new manual override is active
    harness.repo.setManualOverride(
      from = Currency.EUR,
      to = Currency.INR,
      rate = BigDecimal("120.00000000"),
      effectiveFrom = now - 2_000L,
      expiresAt = null
    )

    // 1. Date edit only -> preserves exact original rate, source, and homeAmount
    val dateEditRes = update(
      existingExpense = originalExpense,
      newAmount = originalExpense.originalAmount.amount,
      newCurrency = originalExpense.originalCurrency,
      newCategory = originalExpense.category,
      newTimestamp = now - 1_000L,
      newMerchant = originalExpense.merchant,
      newNote = "Adjusted time"
    )
    assertTrue(dateEditRes is UpdateExpenseResult.Success)
    val afterDateEdit = (dateEditRes as UpdateExpenseResult.Success).expense
    assertEquals(originalExpense.exchangeRate, afterDateEdit.exchangeRate)
    assertEquals(originalExpense.homeAmount, afterDateEdit.homeAmount)
    assertEquals("1129.50", afterDateEdit.homeAmount.amount.toPlainString())

    // 2. Amount edit -> preserves exact original rate and recalculates homeAmount with that rate
    val amountEditRes = update(
      existingExpense = afterDateEdit,
      newAmount = BigDecimal("20.00"),
      newCurrency = Currency.EUR,
      newCategory = afterDateEdit.category,
      newTimestamp = afterDateEdit.timestamp,
      newMerchant = afterDateEdit.merchant,
      newNote = afterDateEdit.note
    )
    assertTrue(amountEditRes is UpdateExpenseResult.Success)
    val afterAmountEdit = (amountEditRes as UpdateExpenseResult.Success).expense
    assertEquals(initialManualRate, afterAmountEdit.exchangeRate.rate)
    assertEquals("manual_override", afterAmountEdit.exchangeRate.source)
    assertEquals("1882.50", afterAmountEdit.homeAmount.amount.toPlainString())
    assertEquals(0, harness.apiCallCount())
  }
}
