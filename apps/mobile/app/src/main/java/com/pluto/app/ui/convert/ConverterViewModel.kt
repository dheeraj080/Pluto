package com.pluto.app.ui.convert

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

sealed interface ConverterUiState {
  data object Idle : ConverterUiState
  data object Loading : ConverterUiState

  data class Success(
    val originalMoney: Money,
    val result: ConversionResult.Success,
    val rateFormatted: String,
    val freshnessLabel: String
  ) : ConverterUiState

  data class RateUnavailable(
    val reason: String
  ) : ConverterUiState

  data class Error(
    val message: String
  ) : ConverterUiState
}

class ConverterViewModel(
  private val convertCurrencyUseCase: ConvertCurrencyUseCase,
  initialSourceCurrency: Currency = Currency.INR,
  initialTargetCurrency: Currency = Currency.USD
) : ViewModel() {

  private val _sourceCurrency = MutableStateFlow(initialSourceCurrency)
  val sourceCurrency: StateFlow<Currency> = _sourceCurrency.asStateFlow()

  private val _targetCurrency = MutableStateFlow(initialTargetCurrency)
  val targetCurrency: StateFlow<Currency> = _targetCurrency.asStateFlow()

  private val _amountInput = MutableStateFlow("100")
  val amountInput: StateFlow<String> = _amountInput.asStateFlow()

  private val _uiState = MutableStateFlow<ConverterUiState>(ConverterUiState.Idle)
  val uiState: StateFlow<ConverterUiState> = _uiState.asStateFlow()

  private var conversionJob: Job? = null

  init {
    performConversion(immediate = true)
  }

  fun onAmountChanged(newAmount: String) {
    val sanitized = _sourceCurrency.value.sanitizeAmountInput(newAmount) ?: return
    _amountInput.value = sanitized
    performConversion(immediate = false)
  }

  fun setSourceCurrency(currency: Currency) {
    if (_sourceCurrency.value == currency) return
    _sourceCurrency.value = currency
    _amountInput.value = currency.normalizeForScale(_amountInput.value)
    performConversion(immediate = true)
  }

  fun setTargetCurrency(currency: Currency) {
    if (_targetCurrency.value == currency) return
    _targetCurrency.value = currency
    performConversion(immediate = true)
  }

  fun swapCurrencies() {
    val temp = _sourceCurrency.value
    val nextSource = _targetCurrency.value
    _sourceCurrency.value = nextSource
    _targetCurrency.value = temp
    _amountInput.value = nextSource.normalizeForScale(_amountInput.value)
    performConversion(immediate = true)
  }

  fun retry() {
    performConversion(immediate = true)
  }

  private fun performConversion(immediate: Boolean) {
    conversionJob?.cancel()
    conversionJob = viewModelScope.launch {
      if (!immediate) {
        // Debounce typing to avoid excessive calculations/requests
        delay(300)
      }

      val input = _amountInput.value.trim()
      if (input.isBlank() || input == ".") {
        _uiState.value = ConverterUiState.Idle
        return@launch
      }

      val parsedAmount = try {
        BigDecimal(input)
      } catch (_: Exception) {
        _uiState.value = ConverterUiState.Error("Invalid amount entered")
        return@launch
      }

      if (parsedAmount < BigDecimal.ZERO) {
        _uiState.value = ConverterUiState.Error("Amount cannot be negative")
        return@launch
      }

      val source = _sourceCurrency.value
      val target = _targetCurrency.value
      val originalMoney = Money.of(parsedAmount, source)

      _uiState.value = ConverterUiState.Loading

      try {
        when (val result = convertCurrencyUseCase(originalMoney, target)) {
          is ConversionResult.Success -> {
            val rate = result.exchangeRate
            val rateFormatted = "1 ${source.code} = ${target.symbol}${rate.rate.setScale(target.decimalPlaces.coerceAtLeast(2), java.math.RoundingMode.HALF_EVEN).toPlainString()} ${target.code}"

            val freshnessLabel = when {
              rate.source == "identity" -> "Identity rate (1:1)"
              result.isCached && rate.source.contains("stale") -> "Using cached offline rate (older)"
              result.isCached -> "Using cached offline rate"
              else -> "Live exchange rate"
            }

            _uiState.value = ConverterUiState.Success(
              originalMoney = originalMoney,
              result = result,
              rateFormatted = rateFormatted,
              freshnessLabel = freshnessLabel
            )
          }

          is ConversionResult.RateUnavailable -> {
            _uiState.value = ConverterUiState.RateUnavailable(
              reason = "Exchange rate unavailable for ${source.code} to ${target.code}. Check internet connection or try again."
            )
          }

          is ConversionResult.Pending -> {
            _uiState.value = ConverterUiState.Loading
          }
        }
      } catch (e: Exception) {
        _uiState.value = ConverterUiState.Error(e.message ?: "Failed to perform currency conversion")
      }
    }
  }

  companion object {
    fun provideFactory(useCase: ConvertCurrencyUseCase): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return ConverterViewModel(useCase) as T
        }
      }
  }
}
