package com.pluto.app.ui.expenses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DateRangeFilter
import com.pluto.app.domain.model.ExchangeRate
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
import com.pluto.app.domain.usecase.RateUpdatePolicy
import com.pluto.app.domain.usecase.RestoreExpenseUseCase
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.math.RoundingMode

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
    val destinationExchangeRate: BigDecimal?,
    val homeAmountById: Map<String, Money> = emptyMap(),
    val destinationAmountById: Map<String, Money> = emptyMap(),
    val hasUnconvertedAmounts: Boolean = false
  ) : ExpenseListUiState
  data class Error(val message: String) : ExpenseListUiState
}

data class ConversionPreviewState(
  val isLoading: Boolean = false,
  val convertedMoney: Money? = null,
  val exchangeRate: ExchangeRate? = null,
  val rateFormatted: String? = null,
  val isRateUnavailable: Boolean = false,
  val isLiveApi: Boolean = true,
  val isCached: Boolean = false,
  val lastUpdatedMillis: Long = System.currentTimeMillis()
)

data class ExpenseEntryFormState(
  val editingExpenseId: String? = null, // Null if creating, non-null if editing
  val amount: String = "",
  val localCurrency: Currency = Currency.EUR,
  val homeCurrency: Currency = Currency.USD,
  val category: Category = Category.FOOD,
  val transactionDateMillis: Long = System.currentTimeMillis(),
  val merchant: String = "",
  val note: String = "",
  val receiptUri: String? = null,
  val isRecurring: Boolean = false,
  val recurrenceFrequency: RecurrenceFrequency = RecurrenceFrequency.MONTHLY,
  val conversionPreview: ConversionPreviewState = ConversionPreviewState(),
  val rateUpdatePolicy: RateUpdatePolicy = RateUpdatePolicy.PRESERVE_EXISTING,
  val preservedOriginalRate: ExchangeRate? = null,
  val currencyChangeNotice: String? = null,
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

  val isPriorDayTransaction: Boolean
    get() = ConvertCurrencyUseCase.isPriorCalendarDay(transactionDateMillis)

  val requiresExplicitRateChoice: Boolean
    get() = localCurrency != homeCurrency &&
      conversionPreview.isRateUnavailable &&
      !conversionPreview.isLoading
}

sealed interface ExpenseUiEvent {
  data class ExpenseSaved(val expense: Expense) : ExpenseUiEvent
  data class ExpenseUpdated(val expense: Expense) : ExpenseUiEvent
  data class ExpenseDeleted(val id: String) : ExpenseUiEvent
  data class ExpenseRestored(val expense: Expense) : ExpenseUiEvent
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
  private val processRecurringExpensesUseCase: com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase? = null,
  private val restoreExpenseUseCase: RestoreExpenseUseCase? = null
) : ViewModel() {

  private val _filter = MutableStateFlow(ExpenseFilter())
  val filter: StateFlow<ExpenseFilter> = _filter.asStateFlow()

  private val _listRetryTrigger = MutableStateFlow(0)

  @OptIn(ExperimentalCoroutinesApi::class)
  val expenseListState: StateFlow<ExpenseListUiState> = _listRetryTrigger
    .flatMapLatest {
      combine(
        observeExpensesUseCase(),
        _filter,
        userSettingsRepository.observeSettings()
      ) { expenses, currentFilter, settings ->
        val filtered = expenses.filter { currentFilter.matches(it) }
        val rateCache = mutableMapOf<Pair<Currency, Currency>, BigDecimal?>()
        val homeAmountById = linkedMapOf<String, Money>()
        val destinationAmountById = linkedMapOf<String, Money>()
        var totalHomeMoney = Money.zero(settings.homeCurrency)
        var totalDestMoney = Money.zero(settings.destinationCurrency)
        var hasUnconvertedAmounts = false

        // Match GetDashboardSummaryUseCase: derive local totals from translated home snapshots,
        // with original-currency conversion used only when a snapshot cannot be translated.
        val destRate = if (settings.destinationCurrency == settings.homeCurrency) {
          BigDecimal.ONE
        } else {
          exchangeRateRepository?.getRate(settings.homeCurrency, settings.destinationCurrency)?.rate
        }

        filtered.forEach { expense ->
          val homeMoney = convertMoneyTo(expense.homeAmount, settings.homeCurrency, rateCache)
          if (homeMoney != null) {
            homeAmountById[expense.id] = homeMoney
            totalHomeMoney += homeMoney
          } else {
            hasUnconvertedAmounts = true
          }

          val destMoney = when {
            homeMoney != null && destRate != null && destRate > BigDecimal.ZERO ->
              Money.of(homeMoney.amount.multiply(destRate), settings.destinationCurrency)
            expense.originalCurrency == settings.destinationCurrency -> expense.originalAmount
            else -> convertMoneyTo(expense.originalAmount, settings.destinationCurrency, rateCache)
          }
          if (destMoney != null) {
            destinationAmountById[expense.id] = destMoney
            totalDestMoney += destMoney
          } else {
            hasUnconvertedAmounts = true
          }
        }

        ExpenseListUiState.Success(
          allExpenses = expenses,
          filteredExpenses = filtered,
          filter = currentFilter,
          totalHomeSpending = totalHomeMoney,
          totalDestSpending = if (filtered.isNotEmpty() && destinationAmountById.isEmpty()) null else totalDestMoney,
          destinationCurrency = settings.destinationCurrency,
          homeCurrency = settings.homeCurrency,
          destinationExchangeRate = destRate,
          homeAmountById = homeAmountById,
          destinationAmountById = destinationAmountById,
          hasUnconvertedAmounts = hasUnconvertedAmounts
        ) as ExpenseListUiState
      }.catch { throwable ->
        emit(
          ExpenseListUiState.Error(
            throwable.message?.takeIf { it.isNotBlank() }
              ?: "Unable to load your transactions right now."
          )
        )
      }
    }.stateIn(
      scope = viewModelScope,
      started = SharingStarted.WhileSubscribed(5000),
      initialValue = ExpenseListUiState.Loading
    )

  fun retryExpensesList() {
    _listRetryTrigger.update { it + 1 }
  }

  private val _formState = MutableStateFlow(
    ExpenseEntryFormState(rateUpdatePolicy = RateUpdatePolicy.REFRESH_FOR_DATE)
  )
  val formState: StateFlow<ExpenseEntryFormState> = _formState.asStateFlow()

  private val _events = MutableSharedFlow<ExpenseUiEvent>()
  val events: SharedFlow<ExpenseUiEvent> = _events.asSharedFlow()

  private var previewJob: Job? = null
  private var currentEditingExpense: Expense? = null
  private val inFlightDeleteIds = mutableSetOf<String>()
  private val inFlightRestoreIds = mutableSetOf<String>()

  init {
    viewModelScope.launch {
      val settings = userSettingsRepository.getSettings()
      _formState.update {
        it.copy(
          localCurrency = settings.destinationCurrency,
          homeCurrency = settings.homeCurrency,
          rateUpdatePolicy = RateUpdatePolicy.REFRESH_FOR_DATE
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
    val sanitized = _formState.value.localCurrency.sanitizeAmountInput(amount) ?: return
    _formState.update { it.copy(amount = sanitized, errorMessage = null) }
    updateConversionPreview(immediate = shouldCalculateLocally(_formState.value))
  }

  fun onLocalCurrencyChanged(currency: Currency) {
    if (_formState.value.localCurrency == currency) return
    _formState.update { current ->
      val pairMatchesOriginal = isOriginalCurrencyPair(currency, current.homeCurrency)
      val willUseLocalSnapshot = current.isEditing && pairMatchesOriginal
      current.copy(
        localCurrency = currency,
        amount = currency.normalizeForScale(current.amount),
        currencyChangeNotice = "Primary currency for this entry: ${currency.code}. Amounts are unchanged.",
        rateUpdatePolicy = if (willUseLocalSnapshot) {
          RateUpdatePolicy.PRESERVE_EXISTING
        } else {
          RateUpdatePolicy.REFRESH_FOR_DATE
        },
        conversionPreview = if (willUseLocalSnapshot) {
          current.conversionPreview
        } else {
          ConversionPreviewState(isLoading = true)
        },
        errorMessage = null
      )
    }
    updateConversionPreview(immediate = true)
  }

  fun onHomeCurrencyChanged(currency: Currency) {
    if (_formState.value.homeCurrency == currency) return
    _formState.update { current ->
      val pairMatchesOriginal = isOriginalCurrencyPair(current.localCurrency, currency)
      val willUseLocalSnapshot = current.isEditing && pairMatchesOriginal
      current.copy(
        homeCurrency = currency,
        currencyChangeNotice = "Reference currency for this entry: ${currency.code}. Amounts are unchanged until saved.",
        rateUpdatePolicy = if (willUseLocalSnapshot) {
          RateUpdatePolicy.PRESERVE_EXISTING
        } else {
          RateUpdatePolicy.REFRESH_FOR_DATE
        },
        conversionPreview = if (willUseLocalSnapshot) {
          current.conversionPreview
        } else {
          ConversionPreviewState(isLoading = true)
        },
        errorMessage = null
      )
    }
    updateConversionPreview(immediate = true)
  }

  fun onCurrencyChanged(currency: Currency) {
    onLocalCurrencyChanged(currency)
  }

  fun onSwapCurrencies() {
    val before = _formState.value
    if (before.localCurrency == before.homeCurrency) return
    _formState.update { current ->
      val nextLocal = current.homeCurrency
      val nextHome = current.localCurrency
      val pairMatchesOriginal = isOriginalCurrencyPair(nextLocal, nextHome)
      val willUseLocalSnapshot = current.isEditing && pairMatchesOriginal
      current.copy(
        localCurrency = nextLocal,
        homeCurrency = nextHome,
        amount = nextLocal.normalizeForScale(current.amount),
        currencyChangeNotice = "Currencies swapped for this entry. Amounts are unchanged.",
        rateUpdatePolicy = if (willUseLocalSnapshot) {
          RateUpdatePolicy.PRESERVE_EXISTING
        } else {
          RateUpdatePolicy.REFRESH_FOR_DATE
        },
        conversionPreview = if (willUseLocalSnapshot) {
          current.conversionPreview
        } else {
          ConversionPreviewState(isLoading = true)
        },
        errorMessage = null
      )
    }
    updateConversionPreview(immediate = true)
  }

  fun refreshLiveExchangeRate() {
    viewModelScope.launch {
      _formState.update {
        it.copy(
          isRefreshingRate = true,
          rateUpdatePolicy = RateUpdatePolicy.REFRESH_LIVE,
          currencyChangeNotice = null,
          errorMessage = null
        )
      }
      updateConversionPreview(forceRefresh = true, immediate = true)
      previewJob?.join()
      _formState.update { it.copy(isRefreshingRate = false) }
    }
  }

  fun onRefreshRateForTransactionDate() {
    _formState.update {
      it.copy(
        rateUpdatePolicy = RateUpdatePolicy.REFRESH_FOR_DATE,
        currencyChangeNotice = null,
        errorMessage = null
      )
    }
    updateConversionPreview(immediate = true)
  }

  fun onRestoreOriginalRate() {
    val original = currentEditingExpense ?: return
    _formState.update {
      it.copy(
        localCurrency = original.originalCurrency,
        homeCurrency = original.homeCurrency,
        amount = original.originalAmount.amount.toPlainString(),
        rateUpdatePolicy = RateUpdatePolicy.PRESERVE_EXISTING,
        currencyChangeNotice = "Original amount, currencies, and rate restored for this entry.",
        errorMessage = null
      )
    }
    updateConversionPreview(immediate = true)
  }

  fun onCategoryChanged(category: Category) {
    _formState.update { it.copy(category = category) }
  }

  fun onDateChanged(timestamp: Long) {
    if (_formState.value.transactionDateMillis == timestamp) return
    _formState.update { current ->
      val nextPolicy = if (current.rateUpdatePolicy == RateUpdatePolicy.REFRESH_LIVE) {
        RateUpdatePolicy.REFRESH_LIVE
      } else {
        RateUpdatePolicy.REFRESH_FOR_DATE
      }
      val shouldResetPreview = current.localCurrency != current.homeCurrency
      current.copy(
        transactionDateMillis = timestamp,
        rateUpdatePolicy = nextPolicy,
        conversionPreview = if (shouldResetPreview) ConversionPreviewState(isLoading = true) else current.conversionPreview,
        errorMessage = null
      )
    }
    // A changed transaction date must resolve the market rate for that date instead of
    // silently reusing the snapshot recorded for the old date.
    updateConversionPreview(immediate = true)
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
    previewJob?.cancel()
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
        recurrenceFrequency = RecurrenceFrequency.MONTHLY,
        rateUpdatePolicy = RateUpdatePolicy.REFRESH_FOR_DATE,
        preservedOriginalRate = null
      )
      updateConversionPreview()
    }
  }

  fun prepareEditForm(expense: Expense) {
    previewJob?.cancel()
    currentEditingExpense = expense
    val localCurr = expense.originalCurrency
    val homeCurr = expense.homeCurrency
    val isForeign = localCurr != homeCurr

    val initialPreview = ConversionPreviewState(
      isLoading = false,
      convertedMoney = if (isForeign) expense.homeAmount else expense.originalAmount,
      exchangeRate = expense.exchangeRate,
      rateFormatted = if (isForeign) {
        formatRateDisplay(localCurr, homeCurr, expense.exchangeRate.rate)
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
      rateUpdatePolicy = RateUpdatePolicy.PRESERVE_EXISTING,
      preservedOriginalRate = expense.exchangeRate,
      isSubmitting = false,
      errorMessage = null
    )
  }

  private fun isOriginalCurrencyPair(localCurrency: Currency, homeCurrency: Currency): Boolean {
    val existing = currentEditingExpense ?: return false
    return existing.originalCurrency == localCurrency && existing.homeCurrency == homeCurrency
  }

  private fun shouldCalculateLocally(state: ExpenseEntryFormState): Boolean {
    if (state.localCurrency == state.homeCurrency) return true
    if (state.isEditing &&
      state.rateUpdatePolicy == RateUpdatePolicy.PRESERVE_EXISTING &&
      isOriginalCurrencyPair(state.localCurrency, state.homeCurrency)
    ) {
      return true
    }
    return false
  }

  private fun updateConversionPreview(forceRefresh: Boolean = false, immediate: Boolean = false) {
    previewJob?.cancel()
    previewJob = viewModelScope.launch {
      val state = _formState.value
      val localCurrency = state.localCurrency
      val homeCurrency = state.homeCurrency
      val input = state.amount.trim()

      // Preserved original FX snapshot on edit when currency pair is unchanged
      val editingExpense = currentEditingExpense
      if (state.isEditing &&
        editingExpense != null &&
        state.rateUpdatePolicy == RateUpdatePolicy.PRESERVE_EXISTING &&
        isOriginalCurrencyPair(localCurrency, homeCurrency)
      ) {
        val preservedRate = editingExpense.exchangeRate
        val convertedMoney = if (input.isNotBlank() && state.isValidAmount) {
          val parsedInput = BigDecimal(input)
          if (parsedInput.compareTo(editingExpense.originalAmount.amount) == 0 &&
            localCurrency == editingExpense.originalCurrency &&
            homeCurrency == editingExpense.homeCurrency
          ) {
            editingExpense.homeAmount
          } else if (localCurrency == homeCurrency) {
            Money.of(input, localCurrency)
          } else {
            preservedRate.convert(Money.of(input, localCurrency))
          }
        } else null
        _formState.update {
          it.copy(
            conversionPreview = ConversionPreviewState(
              isLoading = false,
              convertedMoney = convertedMoney,
              exchangeRate = preservedRate,
              rateFormatted = if (localCurrency == homeCurrency) {
                "1 ${homeCurrency.code} = 1 ${homeCurrency.code}"
              } else {
                formatRateDisplay(localCurrency, homeCurrency, preservedRate.rate)
              },
              isRateUnavailable = false,
              isLiveApi = preservedRate.source == "open_er_api",
              isCached = preservedRate.source != "open_er_api",
              lastUpdatedMillis = preservedRate.timestamp
            )
          )
        }
        return@launch
      }

      if (localCurrency == homeCurrency) {
        val money = if (input.isNotBlank() && state.isValidAmount) Money.of(input, localCurrency) else null
        _formState.update {
          it.copy(
            conversionPreview = ConversionPreviewState(
              isLoading = false,
              convertedMoney = money,
              exchangeRate = ExchangeRate.identity(homeCurrency),
              rateFormatted = "1 ${homeCurrency.code} = 1 ${homeCurrency.code}",
              isRateUnavailable = false,
              isLiveApi = false,
              isCached = false
            )
          )
        }
        return@launch
      }

      if (!forceRefresh && !immediate) {
        delay(250) // Debounce network/repository preview queries
      }

      val latestState = _formState.value
      val latestInput = latestState.amount.trim()
      val probeMoney = if (latestInput.isNotBlank() && latestState.isValidAmount) {
        Money.of(latestInput, localCurrency)
      } else {
        Money.of(BigDecimal.ONE, localCurrency)
      }

      _formState.update {
        it.copy(conversionPreview = it.conversionPreview.copy(isLoading = true))
      }

      val useLiveOnly = forceRefresh || latestState.rateUpdatePolicy == RateUpdatePolicy.REFRESH_LIVE
      when (
        val result = convertCurrencyUseCase(
          amount = probeMoney,
          targetCurrency = homeCurrency,
          forceRefresh = useLiveOnly,
          atTimestamp = if (useLiveOnly) null else latestState.transactionDateMillis
        )
      ) {
        is ConversionResult.Success -> {
          val hasValidAmount = latestInput.isNotBlank() && latestState.isValidAmount
          val isHistoricalLookup = !useLiveOnly &&
            ConvertCurrencyUseCase.isPriorCalendarDay(latestState.transactionDateMillis)
          _formState.update {
            it.copy(
              conversionPreview = ConversionPreviewState(
                isLoading = false,
                convertedMoney = if (hasValidAmount) result.convertedMoney else null,
                exchangeRate = result.exchangeRate,
                rateFormatted = formatRateDisplay(localCurrency, homeCurrency, result.exchangeRate.rate),
                isRateUnavailable = false,
                isLiveApi = !isHistoricalLookup && result.exchangeRate.source == "open_er_api",
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
    if (state.isSubmitting) return
    if (!state.isValidAmount) {
      _formState.update { it.copy(errorMessage = "Please enter a valid positive amount") }
      return
    }

    if (state.localCurrency != state.homeCurrency &&
      state.conversionPreview.isRateUnavailable &&
      state.conversionPreview.exchangeRate == null
    ) {
      _formState.update {
        it.copy(errorMessage = "Exchange rate unavailable for this date. Choose another date or try again.")
      }
      return
    }

    _formState.update { it.copy(isSubmitting = true, errorMessage = null) }

    viewModelScope.launch {
      try {
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
            newRecurrenceFrequency = if (state.isRecurring) state.recurrenceFrequency else null,
            rateUpdatePolicy = state.rateUpdatePolicy
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
                it.copy(errorMessage = "Exchange rate unavailable for ${result.fromCurrency.code} to ${result.homeCurrency.code}. Try again or choose another date.")
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
            recurrenceFrequency = if (state.isRecurring) state.recurrenceFrequency else null,
            forceLiveRate = state.rateUpdatePolicy == RateUpdatePolicy.REFRESH_LIVE
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
                it.copy(errorMessage = "Exchange rate unavailable for ${result.fromCurrency.code} to ${result.homeCurrency.code}. Try again or choose another date.")
              }
            }

            is CreateExpenseResult.Failure -> {
              _formState.update { it.copy(errorMessage = result.message) }
            }
          }
        }
      } finally {
        _formState.update { it.copy(isSubmitting = false) }
      }
    }
  }

  fun deleteExpense(id: String, onDeleted: () -> Unit) {
    deleteExpenseWithUndo(id) { onDeleted() }
  }

  fun deleteExpenseWithUndo(id: String, onDeleted: (Expense?) -> Unit) {
    if (!inFlightDeleteIds.add(id)) return
    viewModelScope.launch {
      try {
        val deletedSnapshot = deleteExpenseUseCase(id)
        _events.emit(ExpenseUiEvent.ExpenseDeleted(id))
        onDeleted(deletedSnapshot)
      } finally {
        inFlightDeleteIds.remove(id)
      }
    }
  }

  fun restoreExpense(expense: Expense, onRestored: (Expense) -> Unit = {}) {
    val useCase = restoreExpenseUseCase ?: return
    if (!inFlightRestoreIds.add(expense.id)) return
    viewModelScope.launch {
      try {
        val restored = useCase(expense)
        _events.emit(ExpenseUiEvent.ExpenseRestored(restored))
        onRestored(restored)
      } finally {
        inFlightRestoreIds.remove(expense.id)
      }
    }
  }

  private suspend fun convertMoneyTo(
    money: Money,
    targetCurrency: Currency,
    rateCache: MutableMap<Pair<Currency, Currency>, BigDecimal?>
  ): Money? {
    if (money.currency == targetCurrency) return money
    val key = money.currency to targetCurrency
    val rate = rateCache.getOrPut(key) {
      exchangeRateRepository
        ?.getRate(money.currency, targetCurrency)
        ?.rate
        ?.takeIf { it > BigDecimal.ZERO }
    }
    return rate?.let { Money.of(money.amount.multiply(it), targetCurrency) }
  }

  private fun formatRateDisplay(
    fromCurrency: Currency,
    toCurrency: Currency,
    rate: BigDecimal
  ): String {
    val minScale = toCurrency.decimalPlaces.coerceAtLeast(2)
    val maxScale = if (rate < BigDecimal("0.01")) 8 else 6
    val normalizedScale = rate.stripTrailingZeros().scale().coerceIn(minScale, maxScale)
    val formattedNumber = rate.setScale(normalizedScale, RoundingMode.HALF_EVEN).toPlainString()
    return "1 ${fromCurrency.code} = ${toCurrency.symbol}$formattedNumber ${toCurrency.code}"
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
      processRecurringExpensesUseCase: com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase? = null,
      restoreExpenseUseCase: RestoreExpenseUseCase? = null
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
          processRecurringExpensesUseCase = processRecurringExpensesUseCase,
          restoreExpenseUseCase = restoreExpenseUseCase
        ) as T
      }
    }
  }
}
