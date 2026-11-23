package com.pluto.app.ui.expenses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DateRangeFilter
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.ExpenseFilter
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.RecurrenceFrequency
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

sealed interface ExpenseListUiState {
  data object Loading : ExpenseListUiState
  data class Success(
    val allExpenses: List<Expense>,
    val filteredExpenses: List<Expense>,
    val filter: ExpenseFilter,
    val totalHomeSpending: Money,
    val totalDestSpending: Money?,
    val destinationCurrency: Currency,
    val homeCurrency: Currency,
    val destinationExchangeRate: BigDecimal?
  ) : ExpenseListUiState
}

data class ConversionPreviewState(
  val isLoading: Boolean = false,
  val convertedMoney: Money? = null,
  val exchangeRate: com.pluto.app.domain.model.ExchangeRate? = null,
  val rateFormatted: String? = null,
  val isRateUnavailable: Boolean = false,
  val isLiveApi: Boolean = true,
  val isCached: Boolean = false,
  val lastUpdatedMillis: Long = System.currentTimeMillis()
)

data class ExpenseEntryFormState(
  val editingExpenseId: String? = null, // Null if creating, non-null if editing
  val amount: String = "",
  val localCurrency: Currency = Currency.USD,
  val homeCurrency: Currency = Currency.USD,
  val category: Category = Category.FOOD,
  val transactionDateMillis: Long = System.currentTimeMillis(),
  val merchant: String = "",
  val note: String = "",
  val receiptUri: String? = null,
  val isRecurring: Boolean = false,
  val recurrenceFrequency: RecurrenceFrequency = RecurrenceFrequency.MONTHLY,
  val conversionPreview: ConversionPreviewState = ConversionPreviewState(),
  val isSubmitting: Boolean = false,
  val isRefreshingRate: Boolean = false,
  val errorMessage: String? = null
) {
  // Alias for backward compatibility
  val currency: Currency
    get() = localCurrency

  val isEditing: Boolean
    get() = editingExpenseId != null

  val isValidAmount: Boolean
    get() = try {
      val bd = BigDecimal(amount.trim())
      bd > BigDecimal.ZERO
    } catch (_: Exception) {
      false
    }
}

sealed interface ExpenseUiEvent {
  data class ExpenseSaved(val expense: Expense) : ExpenseUiEvent
  data class ExpenseUpdated(val expense: Expense) : ExpenseUiEvent
  data class ExpenseDeleted(val id: String) : ExpenseUiEvent
  data class ShowMessage(val message: String) : ExpenseUiEvent
}

class ExpenseViewModel(
  private val observeExpensesUseCase: ObserveExpensesUseCase,
  private val createExpenseUseCase: CreateExpenseUseCase,
  private val updateExpenseUseCase: UpdateExpenseUseCase,
  private val deleteExpenseUseCase: DeleteExpenseUseCase,
  private val userSettingsRepository: UserSettingsRepository,
  private val convertCurrencyUseCase: ConvertCurrencyUseCase,
  private val exchangeRateRepository: com.pluto.app.domain.repository.ExchangeRateRepository? = null,
  private val processRecurringExpensesUseCase: com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase? = null
) : ViewModel() {

  private val _filter = MutableStateFlow(ExpenseFilter())
  val filter: StateFlow<ExpenseFilter> = _filter.asStateFlow()

  val expenseListState: StateFlow<ExpenseListUiState> = combine(
    observeExpensesUseCase(),
    _filter,
    userSettingsRepository.observeSettings()
  ) { expenses, currentFilter, settings ->
    val filtered = expenses.filter { currentFilter.matches(it) }
    val totalHomeBigDecimal = filtered.fold(BigDecimal.ZERO) { acc, exp ->
      acc.add(exp.homeAmount.amount)
    }
    val totalHomeMoney = Money.of(totalHomeBigDecimal, settings.homeCurrency)

    val destRate = if (settings.destinationCurrency == settings.homeCurrency) {
      BigDecimal.ONE
    } else {
      exchangeRateRepository?.getRate(settings.homeCurrency, settings.destinationCurrency)?.rate
    }

    val totalDestMoney = if (destRate != null && destRate > BigDecimal.ZERO) {
      val converted = totalHomeBigDecimal.multiply(destRate).setScale(settings.destinationCurrency.decimalPlaces, java.math.RoundingMode.HALF_EVEN)
      Money.of(converted, settings.destinationCurrency)
    } else null

    ExpenseListUiState.Success(
      allExpenses = expenses,
      filteredExpenses = filtered,
      filter = currentFilter,
      totalHomeSpending = totalHomeMoney,
      totalDestSpending = totalDestMoney,
      destinationCurrency = settings.destinationCurrency,
      homeCurrency = settings.homeCurrency,
      destinationExchangeRate = destRate
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = ExpenseListUiState.Loading
  )

  private val _formState = MutableStateFlow(ExpenseEntryFormState())
  val formState: StateFlow<ExpenseEntryFormState> = _formState.asStateFlow()

  private val _events = MutableSharedFlow<ExpenseUiEvent>()
  val events: SharedFlow<ExpenseUiEvent> = _events.asSharedFlow()

  private var previewJob: Job? = null
  private var currentEditingExpense: Expense? = null

  init {
    viewModelScope.launch {
      val settings = userSettingsRepository.getSettings()
      _formState.update {
        it.copy(
          localCurrency = settings.destinationCurrency,
          homeCurrency = settings.homeCurrency
        )
      }
      // Automate processing of any recurring subscriptions or fixed costs
      try {
        processRecurringExpensesUseCase?.invoke()
      } catch (_: Exception) {}
    }
  }


  // --- Search & Filter operations ---
  fun onSearchQueryChanged(query: String) {
    _filter.update { it.copy(searchQuery = query) }
  }

  fun onCategoryFilterSelected(categoryId: String?) {
    _filter.update { it.copy(selectedCategoryId = categoryId) }
  }

  fun onDateRangeFilterSelected(range: DateRangeFilter) {
    _filter.update {
      it.copy(
        dateRange = range,
        customStartDateMillis = if (range == DateRangeFilter.CUSTOM) it.customStartDateMillis else null,
        customEndDateMillis = if (range == DateRangeFilter.CUSTOM) it.customEndDateMillis else null
      )
    }
  }

  fun onCustomDateRangeSelected(startMillis: Long, endMillis: Long) {
    _filter.update {
      it.copy(
        dateRange = DateRangeFilter.CUSTOM,
        customStartDateMillis = startMillis,
        customEndDateMillis = endMillis
      )
    }
  }

  fun clearFilters() {
    _filter.value = ExpenseFilter()
  }

  // --- Form operations ---
  fun onAmountChanged(amount: String) {
    val clean = amount.filter { it.isDigit() || it == '.' }
    if (clean.count { it == '.' } > 1) return
    _formState.update { it.copy(amount = clean, errorMessage = null) }
    updateConversionPreview()
  }

  fun onLocalCurrencyChanged(currency: Currency) {
    _formState.update { it.copy(localCurrency = currency, errorMessage = null) }
    updateConversionPreview()
  }

  fun onHomeCurrencyChanged(currency: Currency) {
    _formState.update { it.copy(homeCurrency = currency, errorMessage = null) }
    updateConversionPreview()
  }

  fun onCurrencyChanged(currency: Currency) {
    onLocalCurrencyChanged(currency)
  }

  fun onSwapCurrencies() {
    val current = _formState.value
    _formState.update {
      it.copy(
        localCurrency = current.homeCurrency,
        homeCurrency = current.localCurrency,
        errorMessage = null
      )
    }
    updateConversionPreview()
  }

  fun refreshLiveExchangeRate() {
    viewModelScope.launch {
      _formState.update { it.copy(isRefreshingRate = true) }
      updateConversionPreview(forceRefresh = true)
      _formState.update { it.copy(isRefreshingRate = false) }
    }
  }

  fun onCategoryChanged(category: Category) {
    _formState.update { it.copy(category = category) }
  }

  fun onDateChanged(timestamp: Long) {
    _formState.update { it.copy(transactionDateMillis = timestamp, errorMessage = null) }
    updateConversionPreview()
  }

  fun onMerchantChanged(merchant: String) {
    _formState.update { it.copy(merchant = merchant) }
  }

  fun onNoteChanged(note: String) {
    _formState.update { it.copy(note = note) }
  }

  fun onReceiptSelected(uri: String?) {
    _formState.update { it.copy(receiptUri = uri) }
  }

  fun onClearReceipt() {
    _formState.update { it.copy(receiptUri = null) }
  }

  fun onRecurringToggled(enabled: Boolean) {
    _formState.update { it.copy(isRecurring = enabled) }
  }

  fun onRecurrenceFrequencyChanged(frequency: RecurrenceFrequency) {
    _formState.update { it.copy(recurrenceFrequency = frequency) }
  }

  fun applyQuickPreset(category: Category, merchant: String = "", defaultAmount: String = "") {
    _formState.update {
      it.copy(
        category = category,
        merchant = if (merchant.isNotBlank()) merchant else it.merchant,
        amount = if (defaultAmount.isNotBlank() && it.amount.isBlank()) defaultAmount else it.amount
      )
    }
    if (defaultAmount.isNotBlank()) {
      updateConversionPreview()
    }
  }

  fun prepareCreateForm(
    presetCurrency: Currency? = null,
    presetHomeCurrency: Currency? = null,
    initialCategory: Category? = null,
    initialMerchant: String = "",
    initialNote: String = ""
  ) {
    currentEditingExpense = null
    viewModelScope.launch {
      val settings = userSettingsRepository.getSettings()
      val initialLocal = presetCurrency ?: settings.destinationCurrency
      val initialHome = presetHomeCurrency ?: settings.homeCurrency
      _formState.value = ExpenseEntryFormState(
        editingExpenseId = null,
        localCurrency = initialLocal,
        homeCurrency = initialHome,
        category = initialCategory ?: Category.FOOD,
        merchant = initialMerchant,
        note = initialNote,
        transactionDateMillis = System.currentTimeMillis(),
        isRecurring = false,
        recurrenceFrequency = RecurrenceFrequency.MONTHLY
      )
      updateConversionPreview(forceRefresh = true)
    }
  }

  fun prepareEditForm(expense: Expense) {
    currentEditingExpense = expense
    val localCurr = expense.originalCurrency
    val homeCurr = expense.homeCurrency
    val isForeign = localCurr != homeCurr

    val initialPreview = ConversionPreviewState(
      isLoading = false,
      convertedMoney = if (isForeign) expense.homeAmount else expense.originalAmount,
      exchangeRate = expense.exchangeRate,
      rateFormatted = if (isForeign) {
        "1 ${localCurr.code} = ${homeCurr.symbol}${expense.exchangeRate.rate.setScale(homeCurr.decimalPlaces.coerceAtLeast(2), java.math.RoundingMode.HALF_EVEN).toPlainString()} ${homeCurr.code}"
      } else null,
      isRateUnavailable = false,
      isLiveApi = expense.exchangeRate.source == "open_er_api",
      isCached = expense.exchangeRate.source != "open_er_api",
      lastUpdatedMillis = expense.exchangeRate.timestamp
    )

    _formState.value = ExpenseEntryFormState(
      editingExpenseId = expense.id,
      amount = expense.originalAmount.amount.toPlainString(),
      localCurrency = localCurr,
      homeCurrency = homeCurr,
      category = expense.category,
      transactionDateMillis = expense.timestamp,
      merchant = expense.merchant,
      note = expense.note,
      receiptUri = expense.receiptUri,
      isRecurring = expense.isRecurring,
      recurrenceFrequency = expense.recurrenceFrequency ?: RecurrenceFrequency.MONTHLY,
      conversionPreview = initialPreview,
      isSubmitting = false,
      errorMessage = null
    )
  }

  private fun updateConversionPreview(forceRefresh: Boolean = false) {
    previewJob?.cancel()
    previewJob = viewModelScope.launch {
      if (!forceRefresh) {
        delay(250) // Debounce preview queries
      }
      val state = _formState.value
      val input = state.amount.trim()

      if (input.isBlank() || !state.isValidAmount) {
        _formState.update { it.copy(conversionPreview = ConversionPreviewState()) }
        return@launch
      }

      val localCurrency = state.localCurrency
      val homeCurrency = state.homeCurrency
      val money = Money.of(input, localCurrency)

      if (localCurrency == homeCurrency) {
        _formState.update {
          it.copy(
            conversionPreview = ConversionPreviewState(
              isLoading = false,
              convertedMoney = money,
              exchangeRate = com.pluto.app.domain.model.ExchangeRate.identity(homeCurrency),
              rateFormatted = "1 ${homeCurrency.code} = 1 ${homeCurrency.code}",
              isRateUnavailable = false,
              isLiveApi = false,
              isCached = false
            )
          )
        }
        return@launch
      }

      _formState.update {
        it.copy(conversionPreview = it.conversionPreview.copy(isLoading = true))
      }

      when (val result = convertCurrencyUseCase(money, homeCurrency, forceRefresh = forceRefresh)) {
        is ConversionResult.Success -> {
          val rateStr = "1 ${localCurrency.code} = ${homeCurrency.symbol}${result.exchangeRate.rate.setScale(homeCurrency.decimalPlaces.coerceAtLeast(2), java.math.RoundingMode.HALF_EVEN).toPlainString()} ${homeCurrency.code}"
          _formState.update {
            it.copy(
              conversionPreview = ConversionPreviewState(
                isLoading = false,
                convertedMoney = result.convertedMoney,
                exchangeRate = result.exchangeRate,
                rateFormatted = rateStr,
                isRateUnavailable = false,
                isLiveApi = result.exchangeRate.source == "open_er_api",
                isCached = result.isCached,
                lastUpdatedMillis = result.exchangeRate.timestamp
              )
            )
          }
        }

        is ConversionResult.RateUnavailable -> {
          _formState.update {
            it.copy(
              conversionPreview = ConversionPreviewState(
                isLoading = false,
                convertedMoney = null,
                exchangeRate = null,
                rateFormatted = null,
                isRateUnavailable = true,
                isLiveApi = false
              )
            )
          }
        }

        is ConversionResult.Pending -> {
          _formState.update {
            it.copy(conversionPreview = it.conversionPreview.copy(isLoading = true))
          }
        }
      }
    }
  }

  fun saveExpense(onSuccess: (Expense) -> Unit) {
    val state = _formState.value
    if (!state.isValidAmount) {
      _formState.update { it.copy(errorMessage = "Please enter a valid positive amount") }
      return
    }

    _formState.update { it.copy(isSubmitting = true, errorMessage = null) }

    viewModelScope.launch {
      val parsedAmount = BigDecimal(state.amount.trim())

      if (state.isEditing && currentEditingExpense != null) {
        // --- EDIT PATH ---
        val result = updateExpenseUseCase(
          existingExpense = currentEditingExpense!!,
          newAmount = parsedAmount,
          newCurrency = state.localCurrency,
          newHomeCurrency = state.homeCurrency,
          newCategory = state.category,
          newTimestamp = state.transactionDateMillis,
          newMerchant = state.merchant,
          newNote = state.note,
          newReceiptUri = state.receiptUri,
          newIsRecurring = state.isRecurring,
          newRecurrenceFrequency = if (state.isRecurring) state.recurrenceFrequency else null
        )

        _formState.update { it.copy(isSubmitting = false) }

        when (result) {
          is UpdateExpenseResult.Success -> {
            _events.emit(ExpenseUiEvent.ExpenseUpdated(result.expense))
            currentEditingExpense = null
            prepareCreateForm()
            onSuccess(result.expense)
          }

          is UpdateExpenseResult.InvalidInput -> {
            _formState.update { it.copy(errorMessage = result.reason) }
          }

          is UpdateExpenseResult.ConversionUnavailable -> {
            _formState.update {
              it.copy(errorMessage = "Exchange rate unavailable for ${result.fromCurrency.code} to ${result.homeCurrency.code}. Try again or check internet.")
            }
          }

          is UpdateExpenseResult.Failure -> {
            _formState.update { it.copy(errorMessage = result.message) }
          }
        }
      } else {
        // --- CREATE PATH ---
        val result = createExpenseUseCase(
          amount = parsedAmount,
          currency = state.localCurrency,
          targetHomeCurrency = state.homeCurrency,
          category = state.category,
          timestamp = state.transactionDateMillis,
          merchant = state.merchant,
          note = state.note,
          receiptUri = state.receiptUri,
          isRecurring = state.isRecurring,
          recurrenceFrequency = if (state.isRecurring) state.recurrenceFrequency else null
        )

        _formState.update { it.copy(isSubmitting = false) }

        when (result) {
          is CreateExpenseResult.Success -> {
            _events.emit(ExpenseUiEvent.ExpenseSaved(result.expense))
            prepareCreateForm()
            onSuccess(result.expense)
          }

          is CreateExpenseResult.InvalidInput -> {
            _formState.update { it.copy(errorMessage = result.reason) }
          }

          is CreateExpenseResult.ConversionUnavailable -> {
            _formState.update {
              it.copy(errorMessage = "Exchange rate unavailable for ${result.fromCurrency.code} to ${result.homeCurrency.code}. Try again or connect to internet.")
            }
          }

          is CreateExpenseResult.Failure -> {
            _formState.update { it.copy(errorMessage = result.message) }
          }
        }
      }
    }
  }

  fun deleteExpense(id: String, onDeleted: () -> Unit) {
    viewModelScope.launch {
      deleteExpenseUseCase(id)
      _events.emit(ExpenseUiEvent.ExpenseDeleted(id))
      onDeleted()
    }
  }

  companion object {
    fun provideFactory(
      observeExpensesUseCase: ObserveExpensesUseCase,
      createExpenseUseCase: CreateExpenseUseCase,
      updateExpenseUseCase: UpdateExpenseUseCase,
      deleteExpenseUseCase: DeleteExpenseUseCase,
      userSettingsRepository: UserSettingsRepository,
      convertCurrencyUseCase: ConvertCurrencyUseCase,
      exchangeRateRepository: com.pluto.app.domain.repository.ExchangeRateRepository? = null,
      processRecurringExpensesUseCase: com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase? = null
    ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
      @Suppress("UNCHECKED_CAST")
      override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ExpenseViewModel(
          observeExpensesUseCase = observeExpensesUseCase,
          createExpenseUseCase = createExpenseUseCase,
          updateExpenseUseCase = updateExpenseUseCase,
          deleteExpenseUseCase = deleteExpenseUseCase,
          userSettingsRepository = userSettingsRepository,
          convertCurrencyUseCase = convertCurrencyUseCase,
          exchangeRateRepository = exchangeRateRepository,
          processRecurringExpensesUseCase = processRecurringExpensesUseCase
        ) as T
      }
    }
  }
}
