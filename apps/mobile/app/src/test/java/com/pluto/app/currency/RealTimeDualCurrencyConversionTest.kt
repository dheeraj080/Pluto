package com.pluto.app.currency

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.ui.expenses.ExpenseEntryFormState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class FakeExpenseRepository : ExpenseRepository {
  val expenses = mutableListOf<Expense>()

  override fun observeAllExpenses(): Flow<List<Expense>> = MutableStateFlow(expenses)
  override fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<Expense>> = MutableStateFlow(expenses)
  override fun observeExpensesByCategory(categoryId: String): Flow<List<Expense>> = MutableStateFlow(expenses)
  override fun observeExpensesByTrip(tripId: String): Flow<List<Expense>> = MutableStateFlow(expenses)
  override suspend fun getExpenseById(id: String): Expense? = expenses.find { it.id == id }
  override suspend fun saveExpense(expense: Expense) {
    expenses.removeAll { it.id == expense.id }
    expenses.add(expense)
  }
  override suspend fun deleteExpense(id: String) {
    expenses.removeAll { it.id == id }
  }
}

class FakeUserSettingsRepository(private var settings: UserSettings) : UserSettingsRepository {
  private val flow = MutableStateFlow(settings)
  override fun observeSettings(): Flow<UserSettings> = flow
  override suspend fun getSettings(): UserSettings = settings
  override suspend fun updateHomeCurrency(currency: Currency) {
    settings = settings.copy(homeCurrency = currency)
    flow.value = settings
  }
  override suspend fun updateDestinationCurrency(currency: Currency) {
    settings = settings.copy(destinationCurrency = currency)
    flow.value = settings
  }
  override suspend fun updateSpendingCaps(dailyCap: Double?, monthlyCap: Double?) {}
  override suspend fun updateWarningThreshold(threshold: Double?, notificationsEnabled: Boolean) {}
  override suspend fun updateCategoryBudgets(categoryBudgets: Map<String, Double>) {}
  override suspend fun updateThemeMode(themeMode: com.pluto.app.domain.model.ThemeMode) {
    settings = settings.copy(themeMode = themeMode)
    flow.value = settings
  }
  override suspend fun updatePersona(persona: com.pluto.app.domain.model.UserPersona) {
    settings = settings.copy(persona = persona)
    flow.value = settings
  }
  override suspend fun updateBudgetCycleType(budgetCycleType: com.pluto.app.domain.model.BudgetCycleType) {
    settings = settings.copy(budgetCycleType = budgetCycleType)
  }
  override suspend fun updateAcademicTermSettings(academicTermSettings: com.pluto.app.domain.model.AcademicTermSettings) {
    settings = settings.copy(academicTermSettings = academicTermSettings)
  }
  override suspend fun updateTripSettings(tripSettings: com.pluto.app.domain.model.TripSettings) {
    settings = settings.copy(tripSettings = tripSettings)
  }
  override suspend fun updateBiometricLock(enabled: Boolean, timeoutMinutes: Int) {
    settings = settings.copy(isBiometricLockEnabled = enabled, autoLockTimeoutMinutes = timeoutMinutes)
    flow.value = settings
  }
  override suspend fun updatePrivacyMode(enabled: Boolean) {
    settings = settings.copy(isPrivacyModeEnabled = enabled)
    flow.value = settings
  }
  override suspend fun updateHomeTimeZone(timeZoneId: String?) {
    settings = settings.copy(homeTimeZoneId = timeZoneId)
    flow.value = settings
  }
  override suspend fun updateHomeModules(homeModules: List<com.pluto.app.domain.model.HomeModuleConfig>) {
    settings = settings.copy(homeModules = homeModules)
    flow.value = settings
  }
  override suspend fun updateSettings(userSettings: UserSettings) {
    settings = userSettings
    flow.value = settings
  }
}

class RealTimeDualCurrencyConversionTest {

  private lateinit var fakeExchangeRepo: FakeExchangeRateRepository
  private lateinit var fakeExpenseRepo: FakeExpenseRepository
  private lateinit var fakeUserSettingsRepo: FakeUserSettingsRepository
  private lateinit var convertUseCase: ConvertCurrencyUseCase
  private lateinit var createExpenseUseCase: CreateExpenseUseCase
  private lateinit var updateExpenseUseCase: UpdateExpenseUseCase

  @Before
  fun setUp() {
    fakeExchangeRepo = FakeExchangeRateRepository()
    fakeExpenseRepo = FakeExpenseRepository()
    fakeUserSettingsRepo = FakeUserSettingsRepository(
      UserSettings(
        homeCurrency = Currency.USD,
        destinationCurrency = Currency.EUR
      )
    )
    convertUseCase = ConvertCurrencyUseCase(fakeExchangeRepo)
    createExpenseUseCase = CreateExpenseUseCase(
      expenseRepository = fakeExpenseRepo,
      userSettingsRepository = fakeUserSettingsRepo,
      convertCurrencyUseCase = convertUseCase
    )
    updateExpenseUseCase = UpdateExpenseUseCase(
      expenseRepository = fakeExpenseRepo,
      userSettingsRepository = fakeUserSettingsRepo,
      convertCurrencyUseCase = convertUseCase
    )
  }

  @Test
  fun `create expense with custom home currency distinct from settings`() = runTest {
    // Setup rate: 1 JPY = 0.00650000 USD, 1 JPY = 0.00580000 EUR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.JPY,
        toCurrency = Currency.EUR,
        rate = BigDecimal("0.00580000"),
        source = "open_er_api"
      )
    )

    // User settings has homeCurrency = USD, but user selects EUR as target home currency for this entry
    val result = createExpenseUseCase(
      amount = BigDecimal("10000"),
      currency = Currency.JPY, // Local spent currency
      targetHomeCurrency = Currency.EUR, // Explicitly selected home currency
      category = Category.FOOD,
      merchant = "Tokyo Sushi"
    )

    assertTrue(result is CreateExpenseResult.Success)
    val expense = (result as CreateExpenseResult.Success).expense

    // Verify local currency and custom home currency are preserved accurately
    assertEquals(Currency.JPY, expense.originalCurrency)
    assertEquals(Currency.EUR, expense.homeCurrency)
    assertEquals("10000", expense.originalAmount.amount.toPlainString())
    // 10000 * 0.0058 = 58.00 EUR
    assertEquals("58.00", expense.homeAmount.amount.toPlainString())
    assertEquals(Currency.EUR, expense.homeAmount.currency)
  }

  @Test
  fun `update expense to switch home currency triggers re-conversion`() = runTest {
    // Initial: JPY to USD
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.JPY,
        toCurrency = Currency.USD,
        rate = BigDecimal("0.00650000"),
        source = "open_er_api"
      )
    )
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.JPY,
        toCurrency = Currency.GBP,
        rate = BigDecimal("0.00500000"),
        source = "open_er_api"
      )
    )

    val createResult = createExpenseUseCase(
      amount = BigDecimal("2000"),
      currency = Currency.JPY,
      targetHomeCurrency = Currency.USD,
      category = Category.TRANSPORT,
      merchant = "Tokyo Metro"
    )
    val originalExpense = (createResult as CreateExpenseResult.Success).expense
    assertEquals("13.00", originalExpense.homeAmount.amount.toPlainString()) // 2000 * 0.0065 = 13.00 USD

    // Update: switch home currency to GBP
    val updateResult = updateExpenseUseCase(
      existingExpense = originalExpense,
      newAmount = BigDecimal("2000"),
      newCurrency = Currency.JPY,
      newCategory = Category.TRANSPORT,
      newTimestamp = originalExpense.timestamp,
      newMerchant = "Tokyo Metro",
      newNote = "",
      newHomeCurrency = Currency.GBP
    )

    assertTrue(updateResult is UpdateExpenseResult.Success)
    val updatedExpense = (updateResult as UpdateExpenseResult.Success).expense
    assertEquals(Currency.GBP, updatedExpense.homeCurrency)
    // 2000 * 0.0050 = 10.00 GBP
    assertEquals("10.00", updatedExpense.homeAmount.amount.toPlainString())
  }

  @Test
  fun `convertCurrencyUseCase with forceRefresh requests fresh rates`() = runTest {
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.USD,
        rate = BigDecimal("1.08000000"),
        source = "open_er_api"
      )
    )

    val money = Money.of(BigDecimal("100.00"), Currency.EUR)
    val result = convertUseCase(amount = money, targetCurrency = Currency.USD, forceRefresh = true)

    assertTrue(result is ConversionResult.Success)
    val success = result as ConversionResult.Success
    assertEquals("108.00", success.convertedMoney.amount.toPlainString())
  }

  @Test
  fun `expense form state supports local and home currencies`() {
    val formState = ExpenseEntryFormState(
      localCurrency = Currency.JPY,
      homeCurrency = Currency.USD,
      amount = "1500"
    )

    assertEquals(Currency.JPY, formState.localCurrency)
    assertEquals(Currency.JPY, formState.currency) // Backwards compatible alias
    assertEquals(Currency.USD, formState.homeCurrency)
    assertTrue(formState.isValidAmount)
  }
}
