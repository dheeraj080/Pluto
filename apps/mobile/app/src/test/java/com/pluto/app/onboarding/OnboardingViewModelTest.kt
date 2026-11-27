package com.pluto.app.onboarding

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.ui.onboarding.OnboardingViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

/**
 * Fake implementation of [UserSettingsRepository] for fast local unit testing.
 */
class FakeUserSettingsRepository(
  initialSettings: UserSettings = UserSettings(isOnboardingCompleted = false)
) : UserSettingsRepository {
  private val state = MutableStateFlow(initialSettings)

  override fun observeSettings(): Flow<UserSettings> = state.asStateFlow()
  override suspend fun getSettings(): UserSettings = state.value
  override suspend fun updateHomeCurrency(homeCurrency: Currency) {
    state.value = state.value.copy(homeCurrency = homeCurrency)
  }
  override suspend fun updateDestinationCurrency(destinationCurrency: Currency) {
    state.value = state.value.copy(destinationCurrency = destinationCurrency)
  }
  override suspend fun updateSpendingCaps(dailyCap: BigDecimal?, monthlyCap: BigDecimal?) {
    state.value = state.value.copy(dailySpendingCap = dailyCap, monthlySpendingCap = monthlyCap)
  }
  override suspend fun updateWarningThreshold(threshold: BigDecimal?, notificationsEnabled: Boolean) {
    state.value = state.value.copy(
      safeToSpendWarningThreshold = threshold,
      warningNotificationsEnabled = notificationsEnabled
    )
  }
  override suspend fun updateCategoryBudgets(categoryBudgets: Map<String, BigDecimal>) {
    state.value = state.value.copy(categoryMonthlyBudgets = categoryBudgets)
  }
  override suspend fun updateThemeMode(themeMode: com.pluto.app.domain.model.ThemeMode) {
    state.value = state.value.copy(themeMode = themeMode)
  }
  override suspend fun updatePersona(persona: com.pluto.app.domain.model.UserPersona) {
    state.value = state.value.copy(persona = persona)
  }
  override suspend fun updateBudgetCycleType(budgetCycleType: com.pluto.app.domain.model.BudgetCycleType) {
    state.value = state.value.copy(budgetCycleType = budgetCycleType)
  }
  override suspend fun updateAcademicTermSettings(academicTermSettings: com.pluto.app.domain.model.AcademicTermSettings) {
    state.value = state.value.copy(academicTermSettings = academicTermSettings)
  }
  override suspend fun updateTripSettings(tripSettings: com.pluto.app.domain.model.TripSettings) {
    state.value = state.value.copy(tripSettings = tripSettings)
  }
  override suspend fun updateBiometricLock(enabled: Boolean, timeoutMinutes: Int) {
    state.value = state.value.copy(isBiometricLockEnabled = enabled, autoLockTimeoutMinutes = timeoutMinutes)
  }
  override suspend fun updatePrivacyMode(enabled: Boolean) {
    state.value = state.value.copy(isPrivacyModeEnabled = enabled)
  }
  override suspend fun updateHomeTimeZone(timeZoneId: String?) {
    state.value = state.value.copy(homeTimeZoneId = timeZoneId)
  }
  override suspend fun updateHomeModules(homeModules: List<com.pluto.app.domain.model.HomeModuleConfig>) {
    state.value = state.value.copy(homeModules = homeModules)
  }
  override suspend fun updateSettings(settings: UserSettings) {
    state.value = settings
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingViewModelTest {

  private val testDispatcher = StandardTestDispatcher()
  private lateinit var fakeRepository: FakeUserSettingsRepository
  private lateinit var viewModel: OnboardingViewModel

  @Before
  fun setUp() {
    Dispatchers.setMain(testDispatcher)
    fakeRepository = FakeUserSettingsRepository()
    viewModel = OnboardingViewModel(fakeRepository)
  }

  @After
  fun tearDown() {
    Dispatchers.resetMain()
  }

  @Test
  fun `initial onboarding state starts at step 1 with 4 steps and defaults to International Student persona`() {
    val state = viewModel.uiState.value
    assertEquals(1, state.currentStep)
    assertEquals(4, state.totalSteps)
    assertEquals(com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT, state.selectedPersona)
    assertEquals(Currency.USD, state.homeCurrency)
    assertEquals(Currency.EUR, state.destinationCurrency)
    assertEquals(Currency.USD, state.selectedCurrency)
    assertFalse(state.isCompleted)
  }

  @Test
  fun `navigating steps clamps properly between 1 and 4`() {
    viewModel.previousStep()
    assertEquals(1, viewModel.uiState.value.currentStep)

    viewModel.nextStep()
    assertEquals(2, viewModel.uiState.value.currentStep)

    viewModel.nextStep()
    assertEquals(3, viewModel.uiState.value.currentStep)

    viewModel.nextStep()
    assertEquals(4, viewModel.uiState.value.currentStep)

    viewModel.nextStep()
    assertEquals(4, viewModel.uiState.value.currentStep)

    viewModel.previousStep()
    assertEquals(3, viewModel.uiState.value.currentStep)
  }

  @Test
  fun `filtering currencies by search query returns matching items`() {
    viewModel.onSearchQueryChanged("EUR")
    val filtered = viewModel.uiState.value.filteredCurrencies
    assertEquals(1, filtered.size)
    assertEquals(Currency.EUR, filtered[0])

    viewModel.onSearchQueryChanged("Rupee")
    val rupeeMatches = viewModel.uiState.value.filteredCurrencies
    assertEquals(1, rupeeMatches.size)
    assertEquals(Currency.INR, rupeeMatches[0])
  }

  @Test
  fun `selecting home and destination currencies and completing onboarding saves both to repository`() = runTest {
    // Select Home Currency
    viewModel.onHomeCurrencySelected(Currency.CAD)
    assertEquals(Currency.CAD, viewModel.uiState.value.homeCurrency)

    // Select Destination Currency
    viewModel.onDestinationCurrencySelected(Currency.JPY)
    assertEquals(Currency.JPY, viewModel.uiState.value.destinationCurrency)

    var callbackCalled = false
    viewModel.completeOnboarding {
      callbackCalled = true
    }

    advanceUntilIdle()

    assertTrue(callbackCalled)
    assertTrue(viewModel.uiState.value.isCompleted)

    val savedSettings = fakeRepository.getSettings()
    assertEquals(Currency.CAD, savedSettings.homeCurrency)
    assertEquals(Currency.JPY, savedSettings.destinationCurrency)
    assertTrue(savedSettings.isOnboardingCompleted)
  }

  @Test
  fun `swapping currencies inverts home and destination currencies`() {
    viewModel.onHomeCurrencySelected(Currency.USD)
    viewModel.onDestinationCurrencySelected(Currency.JPY)

    viewModel.onSwapCurrencies()

    assertEquals(Currency.JPY, viewModel.uiState.value.homeCurrency)
    assertEquals(Currency.USD, viewModel.uiState.value.destinationCurrency)
  }

  @Test
  fun `configuring student persona and allowance persists academic term settings`() = runTest {
    viewModel.onPersonaSelected(com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT)
    viewModel.onTermNameChanged("Spring 2027")
    viewModel.onSemesterAllowanceChanged(BigDecimal("7500.00"))
    viewModel.onTuitionAndFixedChanged(BigDecimal("2000.00"))
    viewModel.onTermDaysChanged(100)

    viewModel.completeOnboarding {}
    advanceUntilIdle()

    val saved = fakeRepository.getSettings()
    assertEquals(com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT, saved.persona)
    assertEquals(com.pluto.app.domain.model.BudgetCycleType.ACADEMIC_TERM, saved.budgetCycleType)
    assertEquals("Spring 2027", saved.academicTermSettings.termName)
    assertEquals("7500.00", saved.academicTermSettings.totalAllowanceHome.toPlainString())
    assertEquals("2000.00", saved.academicTermSettings.tuitionAndFixedCommittedHome.toPlainString())
  }

  @Test
  fun `fractional spending caps and term allowance preserve exact decimal values`() = runTest {
    viewModel.onDailyCapChanged(BigDecimal("49.99"))
    viewModel.onMonthlyCapChanged(BigDecimal("1499.95"))
    viewModel.onSemesterAllowanceChanged(BigDecimal("6123.45"))
    viewModel.onTuitionAndFixedChanged(BigDecimal("1543.21"))
    viewModel.onTripBudgetChanged(BigDecimal("888.75"))

    viewModel.completeOnboarding {}
    advanceUntilIdle()

    val saved = fakeRepository.getSettings()
    assertEquals("49.99", saved.dailySpendingCap?.toPlainString())
    assertEquals("1499.95", saved.monthlySpendingCap?.toPlainString())
    assertEquals("6123.45", saved.academicTermSettings.totalAllowanceHome.toPlainString())
    assertEquals("1543.21", saved.academicTermSettings.tuitionAndFixedCommittedHome.toPlainString())
    assertEquals("888.75", saved.tripSettings.totalTripBudgetHome.toPlainString())
  }
}
