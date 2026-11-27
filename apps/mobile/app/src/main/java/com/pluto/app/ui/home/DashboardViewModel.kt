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
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface DashboardUiState {
  data object Loading : DashboardUiState
  data class Content(val summary: DashboardSummary) : DashboardUiState
  data class Empty(val summary: DashboardSummary) : DashboardUiState
  data class Error(val message: String) : DashboardUiState
}

data class DashboardFxStatus(
  val homeCurrency: Currency,
  val destinationCurrency: Currency,
  val rate: BigDecimal?,
  val source: String?,
  val timestampMillis: Long?,
  val isStale: Boolean,
  val isUnavailable: Boolean
)

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

  private val _retryTrigger = MutableStateFlow(0)

  private val walletTransactionsFlow = walletTransactionRepository?.observeAllTransactions() ?: flowOf(emptyList())
  private val allRatesFlow = exchangeRateRepository?.observeAllRates() ?: flowOf(emptyList())

  val fxStatus: StateFlow<DashboardFxStatus?> = kotlinx.coroutines.flow.combine(
    userSettingsRepository.observeSettings(),
    allRatesFlow,
    _retryTrigger
  ) { settings, _, _ ->
    val home = settings.homeCurrency
    val dest = settings.destinationCurrency
    if (home == dest) {
      DashboardFxStatus(
        homeCurrency = home,
        destinationCurrency = dest,
        rate = BigDecimal.ONE,
        source = "identity",
        timestampMillis = null,
        isStale = false,
        isUnavailable = false
      )
    } else {
      val resolved = resolveRateInfo(home, dest)
      if (resolved == null) {
        DashboardFxStatus(
          homeCurrency = home,
          destinationCurrency = dest,
          rate = null,
          source = null,
          timestampMillis = null,
          isStale = false,
          isUnavailable = true
        )
      } else {
        val isStaleSource = resolved.source.endsWith("_stale")
        val ageMillis = (System.currentTimeMillis() - resolved.timestamp).coerceAtLeast(0L)
        val isAged = !resolved.source.startsWith("manual") && ageMillis >= 24L * 3_600_000L
        DashboardFxStatus(
          homeCurrency = home,
          destinationCurrency = dest,
          rate = resolved.rate,
          source = resolved.source,
          timestampMillis = resolved.timestamp,
          isStale = isStaleSource || isAged,
          isUnavailable = false
        )
      }
    }
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = null
  )

  @OptIn(ExperimentalCoroutinesApi::class)
  val uiState: StateFlow<DashboardUiState> = _retryTrigger.flatMapLatest {
    combine(
      observeExpensesUseCase(),
      userSettingsRepository.observeSettings(),
      _selectedPeriod,
      walletTransactionsFlow,
      allRatesFlow
    ) { expenses: List<Expense>, settings, period, walletTx, _ ->
      val rate = getConversionRate(settings.homeCurrency, settings.destinationCurrency)
      val depositCurrencies = walletTx
        .filter {
          it.type == com.pluto.app.domain.model.WalletTransactionType.DEPOSIT &&
            it.amount.currency != settings.homeCurrency
        }
        .map { it.amount.currency }
        .distinct()
      val depositToHomeRates = depositCurrencies
        .mapNotNull { depositCurrency ->
          getConversionRate(depositCurrency, settings.homeCurrency)?.let { resolvedRate ->
            depositCurrency to resolvedRate
          }
        }
        .toMap()

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
        depositToHomeRates = depositToHomeRates,
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
    }.catch { error ->
      emit(DashboardUiState.Error(error.message ?: "Unable to load dashboard data. Please try again."))
    }
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = DashboardUiState.Loading
  )

  fun retry() {
    _retryTrigger.value += 1
  }

  fun onPeriodSelected(period: DashboardPeriod) {
    _selectedPeriod.value = period
  }

  private suspend fun resolveRateInfo(from: Currency, to: Currency): com.pluto.app.domain.model.ExchangeRate? {
    if (from == to) return com.pluto.app.domain.model.ExchangeRate.identity(from)
    val direct = exchangeRateRepository?.getRate(from, to)
    if (direct != null) return direct
    val inverse = exchangeRateRepository?.getRate(to, from)
    if (inverse != null && inverse.rate > BigDecimal.ZERO) {
      return com.pluto.app.domain.model.ExchangeRate(
        fromCurrency = from,
        toCurrency = to,
        rate = BigDecimal.ONE.divide(inverse.rate, 8, java.math.RoundingMode.HALF_EVEN),
        timestamp = inverse.timestamp,
        source = inverse.source
      )
    }
    return null
  }

  suspend fun getConversionRate(from: Currency, to: Currency): BigDecimal? {
    if (from == to) return BigDecimal.ONE
    val direct = exchangeRateRepository?.getRate(from, to)?.rate
    if (direct != null) return direct
    val inverse = exchangeRateRepository?.getRate(to, from)?.rate
    if (inverse != null && inverse > BigDecimal.ZERO) {
      return BigDecimal.ONE.divide(inverse, 8, java.math.RoundingMode.HALF_EVEN)
    }
    return null
  }

  fun updateCategoryBudgets(categoryBudgets: Map<String, BigDecimal>) {
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

