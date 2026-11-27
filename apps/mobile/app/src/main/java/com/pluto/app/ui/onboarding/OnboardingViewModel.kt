package com.pluto.app.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.repository.UserSettingsRepository
import java.math.BigDecimal
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class OnboardingUiState(
  val currentStep: Int = 1,
  val totalSteps: Int = 4,
  val selectedPersona: com.pluto.app.domain.model.UserPersona = com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
  val homeCurrency: Currency = Currency.USD,
  val destinationCurrency: Currency = Currency.EUR,
  val termName: String = "Universal Budget",
  val semesterAllowanceHome: BigDecimal = BigDecimal("6000.00"),
  val tuitionAndFixedHome: BigDecimal = BigDecimal("1500.00"),
  val termDays: Int = 90,
  val dailySpendingCap: BigDecimal? = BigDecimal("50.00"),
  val monthlySpendingCap: BigDecimal? = BigDecimal("2000.00"),
  val tripBudgetHome: BigDecimal = BigDecimal("1500.00"),
  val searchQuery: String = "",
  val availableCurrencies: List<Currency> = Currency.DEFAULT_CURRENCIES,
  val isCompleted: Boolean = false
) {
  // Backwards-compatible alias for existing tests and callers
  val selectedCurrency: Currency
    get() = if (currentStep == 3) destinationCurrency else homeCurrency

  val filteredCurrencies: List<Currency>
    get() = if (searchQuery.isBlank()) {
      availableCurrencies
    } else {
      availableCurrencies.filter {
        it.code.contains(searchQuery, ignoreCase = true) ||
          it.name.contains(searchQuery, ignoreCase = true) ||
          it.symbol.contains(searchQuery, ignoreCase = true)
      }
    }
}

class OnboardingViewModel(
  private val userSettingsRepository: UserSettingsRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(OnboardingUiState())
  val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

  fun onPersonaSelected(persona: com.pluto.app.domain.model.UserPersona) {
    _uiState.update { it.copy(selectedPersona = persona) }
  }

  fun onTermNameChanged(name: String) {
    _uiState.update { it.copy(termName = name) }
  }

  fun onSemesterAllowanceChanged(allowance: BigDecimal) {
    _uiState.update { it.copy(semesterAllowanceHome = allowance) }
  }

  fun onTuitionAndFixedChanged(committed: BigDecimal) {
    _uiState.update { it.copy(tuitionAndFixedHome = committed) }
  }

  fun onTermDaysChanged(days: Int) {
    _uiState.update { it.copy(termDays = days) }
  }

  fun onDailyCapChanged(cap: BigDecimal?) {
    _uiState.update { it.copy(dailySpendingCap = cap) }
  }

  fun onMonthlyCapChanged(cap: BigDecimal?) {
    _uiState.update { it.copy(monthlySpendingCap = cap) }
  }

  fun onTripBudgetChanged(budget: BigDecimal) {
    _uiState.update { it.copy(tripBudgetHome = budget) }
  }

  fun onSearchQueryChanged(query: String) {
    _uiState.update { it.copy(searchQuery = query) }
  }

  fun onCurrencySelected(currency: Currency) {
    _uiState.update { state ->
      if (state.currentStep == 3) {
        state.copy(destinationCurrency = currency)
      } else {
        state.copy(homeCurrency = currency)
      }
    }
  }

  fun onHomeCurrencySelected(currency: Currency) {
    _uiState.update { it.copy(homeCurrency = currency) }
  }

  fun onDestinationCurrencySelected(currency: Currency) {
    _uiState.update { it.copy(destinationCurrency = currency) }
  }

  fun onSwapCurrencies() {
    _uiState.update { state ->
      state.copy(
        homeCurrency = state.destinationCurrency,
        destinationCurrency = state.homeCurrency
      )
    }
  }

  fun nextStep() {
    _uiState.update { state ->
      val next = (state.currentStep + 1).coerceAtMost(state.totalSteps)
      state.copy(
        currentStep = next,
        searchQuery = ""
      )
    }
  }

  fun previousStep() {
    _uiState.update { state ->
      val prev = (state.currentStep - 1).coerceAtLeast(1)
      state.copy(
        currentStep = prev,
        searchQuery = ""
      )
    }
  }

  fun completeOnboarding(onSuccess: () -> Unit) {
    viewModelScope.launch {
      val state = _uiState.value
      val persona = state.selectedPersona
      val home = state.homeCurrency
      val destination = state.destinationCurrency
      val currentSettings = userSettingsRepository.getSettings()

      val cycle = when (persona) {
        com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT -> com.pluto.app.domain.model.BudgetCycleType.ACADEMIC_TERM
        com.pluto.app.domain.model.UserPersona.EXPAT -> com.pluto.app.domain.model.BudgetCycleType.MONTHLY
        com.pluto.app.domain.model.UserPersona.TOURIST -> com.pluto.app.domain.model.BudgetCycleType.TRIP
      }

      val termSettings = com.pluto.app.domain.model.AcademicTermSettings(
        termName = state.termName,
        termStartDate = System.currentTimeMillis(),
        termEndDate = System.currentTimeMillis() + (state.termDays.toLong() * 86400000L),
        totalAllowanceHome = state.semesterAllowanceHome,
        tuitionAndFixedCommittedHome = state.tuitionAndFixedHome
      )

      val tripSettings = com.pluto.app.domain.model.TripSettings(
        tripName = "Current Trip",
        tripStartDate = System.currentTimeMillis(),
        tripEndDate = System.currentTimeMillis() + (14L * 86400000L),
        totalTripBudgetHome = state.tripBudgetHome
      )

      userSettingsRepository.updateSettings(
        currentSettings.copy(
          homeCurrency = home,
          destinationCurrency = destination,
          persona = persona,
          budgetCycleType = cycle,
          academicTermSettings = termSettings,
          tripSettings = tripSettings,
          monthlySpendingCap = state.monthlySpendingCap ?: currentSettings.monthlySpendingCap,
          dailySpendingCap = state.dailySpendingCap ?: currentSettings.dailySpendingCap,
          homeModules = com.pluto.app.domain.model.HomeLayoutPresets.forPersona(persona),
          isOnboardingCompleted = true
        )
      )
      _uiState.update { it.copy(isCompleted = true) }
      onSuccess()
    }
  }

  companion object {
    fun provideFactory(repository: UserSettingsRepository): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return OnboardingViewModel(repository) as T
        }
      }
  }
}
