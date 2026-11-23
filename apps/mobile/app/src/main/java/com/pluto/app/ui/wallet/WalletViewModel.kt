package com.pluto.app.ui.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.PortfolioValuationSummary
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.CreateWalletDepositUseCase
import com.pluto.app.domain.usecase.CreateWalletTransferUseCase
import com.pluto.app.domain.usecase.CreateWalletWithdrawalUseCase
import com.pluto.app.domain.usecase.DeleteCurrencyWalletUseCase
import com.pluto.app.domain.usecase.DepositResult
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.ObserveCurrencyWalletsUseCase
import com.pluto.app.domain.usecase.ObserveWalletTransactionsUseCase
import com.pluto.app.domain.usecase.TransferResult
import com.pluto.app.domain.usecase.UpdateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.WalletOperationResult
import com.pluto.app.domain.usecase.WithdrawalResult
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

sealed interface WalletUiEvent {
  data class WalletSaved(val wallet: CurrencyWallet) : WalletUiEvent
  data class WalletDeleted(val id: String) : WalletUiEvent
  data class TransactionRecorded(val message: String) : WalletUiEvent
  data class ShowMessage(val message: String) : WalletUiEvent
}

data class WalletFormState(
  val editingWalletId: String? = null,
  val currency: Currency = Currency.EUR,
  val balance: String = "",
  val isSubmitting: Boolean = false,
  val errorMessage: String? = null
) {
  val isEditing: Boolean
    get() = editingWalletId != null

  val isValidBalance: Boolean
    get() = try {
      val bd = BigDecimal(balance.trim())
      bd >= BigDecimal.ZERO
    } catch (_: Exception) {
      false
    }
}

class WalletViewModel(
  observeCurrencyWalletsUseCase: ObserveCurrencyWalletsUseCase,
  private val createCurrencyWalletUseCase: CreateCurrencyWalletUseCase,
  private val updateCurrencyWalletUseCase: UpdateCurrencyWalletUseCase,
  private val deleteCurrencyWalletUseCase: DeleteCurrencyWalletUseCase,
  private val getPortfolioValuationUseCase: GetPortfolioValuationUseCase,
  private val createWalletDepositUseCase: CreateWalletDepositUseCase,
  private val createWalletWithdrawalUseCase: CreateWalletWithdrawalUseCase,
  private val createWalletTransferUseCase: CreateWalletTransferUseCase,
  private val observeWalletTransactionsUseCase: ObserveWalletTransactionsUseCase,
  private val userSettingsRepository: UserSettingsRepository
) : ViewModel() {

  val allWallets: StateFlow<List<CurrencyWallet>> = observeCurrencyWalletsUseCase()
    .stateIn(
      scope = viewModelScope,
      started = SharingStarted.WhileSubscribed(5000),
      initialValue = emptyList()
    )

  val portfolioValuation: StateFlow<PortfolioValuationSummary?> = combine(
    allWallets,
    userSettingsRepository.observeSettings()
  ) { wallets, settings ->
    getPortfolioValuationUseCase(
      wallets = wallets,
      homeCurrency = settings.homeCurrency,
      destinationCurrency = settings.destinationCurrency
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = null
  )

  private val _selectedWalletId = MutableStateFlow<String?>(null)
  val selectedWalletId: StateFlow<String?> = _selectedWalletId.asStateFlow()

  @OptIn(ExperimentalCoroutinesApi::class)
  val selectedWalletTransactions: StateFlow<List<WalletTransaction>> = _selectedWalletId
    .flatMapLatest { walletId ->
      if (walletId == null) {
        flowOf(emptyList())
      } else {
        observeWalletTransactionsUseCase(walletId)
      }
    }.stateIn(
      scope = viewModelScope,
      started = SharingStarted.WhileSubscribed(5000),
      initialValue = emptyList()
    )

  private val _formState = MutableStateFlow(WalletFormState())
  val formState: StateFlow<WalletFormState> = _formState.asStateFlow()

  private val _events = MutableSharedFlow<WalletUiEvent>()
  val events: SharedFlow<WalletUiEvent> = _events.asSharedFlow()

  fun setSelectedWalletId(walletId: String?) {
    _selectedWalletId.value = walletId
  }

  fun prepareCreateForm(defaultCurrency: Currency = Currency.EUR) {
    _formState.value = WalletFormState(
      editingWalletId = null,
      currency = defaultCurrency,
      balance = ""
    )
  }

  fun prepareEditForm(wallet: CurrencyWallet) {
    _formState.value = WalletFormState(
      editingWalletId = wallet.id,
      currency = wallet.currency,
      balance = wallet.balance.amount.toPlainString()
    )
  }

  fun onCurrencyChanged(currency: Currency) {
    _formState.update { it.copy(currency = currency, errorMessage = null) }
  }

  fun onBalanceChanged(balance: String) {
    val clean = balance.filter { it.isDigit() || it == '.' }
    if (clean.count { it == '.' } > 1) return
    _formState.update { it.copy(balance = clean, errorMessage = null) }
  }

  fun saveWallet(onSuccess: () -> Unit) {
    val state = _formState.value
    if (!state.isValidBalance) {
      _formState.update { it.copy(errorMessage = "Please enter a valid non-negative balance") }
      return
    }

    _formState.update { it.copy(isSubmitting = true, errorMessage = null) }

    viewModelScope.launch {
      val amount = BigDecimal(state.balance.trim())
      val result = if (state.isEditing) {
        updateCurrencyWalletUseCase(state.editingWalletId!!, amount)
      } else {
        createCurrencyWalletUseCase(state.currency, amount)
      }

      _formState.update { it.copy(isSubmitting = false) }

      when (result) {
        is WalletOperationResult.Success -> {
          _events.emit(WalletUiEvent.WalletSaved(result.wallet))
          onSuccess()
        }
        is WalletOperationResult.DuplicateCurrency -> {
          _formState.update {
            it.copy(errorMessage = "A wallet for ${result.currency.code} already exists. Edit the existing wallet instead.")
          }
        }
        is WalletOperationResult.InvalidInput -> {
          _formState.update { it.copy(errorMessage = result.reason) }
        }
        is WalletOperationResult.Failure -> {
          _formState.update { it.copy(errorMessage = result.message) }
        }
      }
    }
  }

  fun deleteWallet(walletId: String, onDeleted: () -> Unit) {
    viewModelScope.launch {
      deleteCurrencyWalletUseCase(walletId)
      if (_selectedWalletId.value == walletId) {
        _selectedWalletId.value = null
      }
      _events.emit(WalletUiEvent.WalletDeleted(walletId))
      onDeleted()
    }
  }

  fun deposit(
    walletId: String,
    amount: BigDecimal,
    note: String = "",
    onSuccess: () -> Unit,
    onError: (String) -> Unit
  ) {
    viewModelScope.launch {
      when (val result = createWalletDepositUseCase(walletId, amount, note)) {
        is DepositResult.Success -> {
          _events.emit(WalletUiEvent.TransactionRecorded("Deposited ${result.transaction.amount.format()}"))
          onSuccess()
        }
        is DepositResult.InvalidAmount -> onError(result.reason)
        is DepositResult.WalletNotFound -> onError("Wallet not found")
        is DepositResult.Failure -> onError(result.message)
      }
    }
  }

  fun withdraw(
    walletId: String,
    amount: BigDecimal,
    note: String = "",
    onSuccess: () -> Unit,
    onError: (String) -> Unit
  ) {
    viewModelScope.launch {
      when (val result = createWalletWithdrawalUseCase(walletId, amount, note)) {
        is WithdrawalResult.Success -> {
          _events.emit(WalletUiEvent.TransactionRecorded("Withdrew ${result.transaction.amount.format()}"))
          onSuccess()
        }
        is WithdrawalResult.InsufficientFunds -> {
          onError("Insufficient funds. Available: ${result.available.format()}, Requested: ${result.requested.format()}")
        }
        is WithdrawalResult.InvalidAmount -> onError(result.reason)
        is WithdrawalResult.WalletNotFound -> onError("Wallet not found")
        is WithdrawalResult.Failure -> onError(result.message)
      }
    }
  }

  fun transfer(
    sourceWalletId: String,
    destinationWalletId: String,
    amount: BigDecimal,
    note: String = "",
    onSuccess: () -> Unit,
    onError: (String) -> Unit
  ) {
    viewModelScope.launch {
      when (val result = createWalletTransferUseCase(sourceWalletId, destinationWalletId, amount, note)) {
        is TransferResult.Success -> {
          _events.emit(
            WalletUiEvent.TransactionRecorded(
              "Transferred ${result.sourceTransaction.amount.format()} to ${result.destinationTransaction.amount.currency.code}"
            )
          )
          onSuccess()
        }
        is TransferResult.InsufficientFunds -> {
          onError("Insufficient funds. Available: ${result.available.format()}, Requested: ${result.requested.format()}")
        }
        is TransferResult.RateUnavailable -> {
          onError("Exchange rate from ${result.from.code} to ${result.to.code} is unavailable. Transfer cannot proceed.")
        }
        is TransferResult.SameWallet -> onError("Source and destination wallet cannot be the same")
        is TransferResult.InvalidAmount -> onError(result.reason)
        is TransferResult.WalletNotFound -> onError("Wallet not found")
        is TransferResult.Failure -> onError(result.message)
      }
    }
  }

  companion object {
    fun provideFactory(
      observeCurrencyWalletsUseCase: ObserveCurrencyWalletsUseCase,
      createCurrencyWalletUseCase: CreateCurrencyWalletUseCase,
      updateCurrencyWalletUseCase: UpdateCurrencyWalletUseCase,
      deleteCurrencyWalletUseCase: DeleteCurrencyWalletUseCase,
      getPortfolioValuationUseCase: GetPortfolioValuationUseCase,
      createWalletDepositUseCase: CreateWalletDepositUseCase,
      createWalletWithdrawalUseCase: CreateWalletWithdrawalUseCase,
      createWalletTransferUseCase: CreateWalletTransferUseCase,
      observeWalletTransactionsUseCase: ObserveWalletTransactionsUseCase,
      userSettingsRepository: UserSettingsRepository
    ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
      @Suppress("UNCHECKED_CAST")
      override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return WalletViewModel(
          observeCurrencyWalletsUseCase = observeCurrencyWalletsUseCase,
          createCurrencyWalletUseCase = createCurrencyWalletUseCase,
          updateCurrencyWalletUseCase = updateCurrencyWalletUseCase,
          deleteCurrencyWalletUseCase = deleteCurrencyWalletUseCase,
          getPortfolioValuationUseCase = getPortfolioValuationUseCase,
          createWalletDepositUseCase = createWalletDepositUseCase,
          createWalletWithdrawalUseCase = createWalletWithdrawalUseCase,
          createWalletTransferUseCase = createWalletTransferUseCase,
          observeWalletTransactionsUseCase = observeWalletTransactionsUseCase,
          userSettingsRepository = userSettingsRepository
        ) as T
      }
    }
  }
}
