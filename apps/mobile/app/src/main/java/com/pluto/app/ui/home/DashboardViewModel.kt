package com.pluto.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.repository.ExchangeRateRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.domain.repository.WalletTransactionRepository
import com.pluto.app.domain.usecase.GetDashboardSummaryUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import java.math.BigDecimal
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface DashboardUiState {
  data object Loading : DashboardUiState
  data class Content(val summary: DashboardSummary) : DashboardUiState
  data class Empty(val summary: DashboardSummary) : DashboardUiState
}

class DashboardViewModel(
  observeExpensesUseCase: ObserveExpensesUseCase,
  private val userSettingsRepository: UserSettingsRepository,
  private val getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
  walletTransactionRepository: WalletTransactionRepository? = null,
  private val exchangeRateRepository: ExchangeRateRepository? = null,
  private val notificationHelper: com.pluto.app.util.SafeToSpendNotificationHelper? = null
) : ViewModel() {

  private val _selectedPeriod = MutableStateFlow(DashboardPeriod.THIS_MONTH)
  val selectedPeriod: StateFlow<DashboardPeriod> = _selectedPeriod.asStateFlow()

  private val walletTransactionsFlow = walletTransactionRepository?.observeAllTransactions() ?: flowOf(emptyList())

  val uiState: StateFlow<DashboardUiState> = combine(
    observeExpensesUseCase(),
    userSettingsRepository.observeSettings(),
    _selectedPeriod,
    walletTransactionsFlow
  ) { expenses: List<Expense>, settings, period, walletTx ->
    val rate = exchangeRateRepository?.getRate(settings.homeCurrency, settings.destinationCurrency)?.rate
    val summary = getDashboardSummaryUseCase(
      allExpenses = expenses,
      period = period,
      currentHomeCurrency = settings.homeCurrency,
      destinationCurrency = settings.destinationCurrency,
      dailySpendingCap = settings.dailySpendingCap,
      monthlySpendingCap = settings.monthlySpendingCap,
      safeToSpendWarningThreshold = settings.safeToSpendWarningThreshold,
      walletTransactions = walletTx,
      destinationExchangeRate = rate,
      categoryBudgets = settings.categoryMonthlyBudgets,
      userPersona = settings.persona,
      academicTermSettings = settings.academicTermSettings,
      tripSettings = settings.tripSettings
    )

    if (settings.warningNotificationsEnabled && summary.isWarningActive) {
      notificationHelper?.notifyThresholdBreach(summary)
    }

    if (expenses.isEmpty() && walletTx.isEmpty()) {
      DashboardUiState.Empty(summary)
    } else {
      DashboardUiState.Content(summary)
    }
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = DashboardUiState.Loading
  )

  fun onPeriodSelected(period: DashboardPeriod) {
    _selectedPeriod.value = period
  }

  suspend fun getConversionRate(from: Currency, to: Currency): BigDecimal? {
    if (from == to) return BigDecimal.ONE
    val direct = exchangeRateRepository?.getRate(from, to)?.rate
    if (direct != null) return direct
    val inverse = exchangeRateRepository?.getRate(to, from)?.rate
    if (inverse != null && inverse > BigDecimal.ZERO) {
      return BigDecimal.ONE.divide(inverse, 6, java.math.RoundingMode.HALF_EVEN)
    }
    return null
  }

  fun updateCategoryBudgets(categoryBudgets: Map<String, Double>) {
    viewModelScope.launch {
      userSettingsRepository.updateCategoryBudgets(categoryBudgets)
    }
  }

  fun updatePersona(persona: com.pluto.app.domain.model.UserPersona) {
    viewModelScope.launch {
      val current = userSettingsRepository.getSettings()
      userSettingsRepository.updateSettings(
        current.copy(
          persona = persona,
          homeModules = com.pluto.app.domain.model.HomeLayoutPresets.forPersona(persona)
        )
      )
    }
  }

  fun updateHomeModules(homeModules: List<com.pluto.app.domain.model.HomeModuleConfig>) {
    viewModelScope.launch {
      userSettingsRepository.updateHomeModules(homeModules)
    }
  }

  fun updateAcademicTermSettings(termSettings: com.pluto.app.domain.model.AcademicTermSettings) {
    viewModelScope.launch {
      userSettingsRepository.updateAcademicTermSettings(termSettings)
    }
  }

  fun sendTestNotification(summary: DashboardSummary): Boolean {
    return notificationHelper?.sendTestNotification(summary) ?: false
  }

  companion object {
    fun provideFactory(
      observeExpensesUseCase: ObserveExpensesUseCase,
      userSettingsRepository: UserSettingsRepository,
      getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
      walletTransactionRepository: WalletTransactionRepository? = null,
      exchangeRateRepository: ExchangeRateRepository? = null,
      notificationHelper: com.pluto.app.util.SafeToSpendNotificationHelper? = null
    ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
      @Suppress("UNCHECKED_CAST")
      override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return DashboardViewModel(
          observeExpensesUseCase = observeExpensesUseCase,
          userSettingsRepository = userSettingsRepository,
          getDashboardSummaryUseCase = getDashboardSummaryUseCase,
          walletTransactionRepository = walletTransactionRepository,
          exchangeRateRepository = exchangeRateRepository,
          notificationHelper = notificationHelper
        ) as T
      }
    }
  }
}

