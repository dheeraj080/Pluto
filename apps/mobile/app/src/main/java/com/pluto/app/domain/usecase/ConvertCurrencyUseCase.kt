package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.repository.ExchangeRateRepository

/**
 * Domain UseCase to convert money from one currency to another.
 * Handles identity conversions, cached rates, inverse rates, and offline fallbacks cleanly.
 */
class ConvertCurrencyUseCase(
  private val exchangeRateRepository: ExchangeRateRepository
) {
  suspend operator fun invoke(
    amount: Money,
    targetCurrency: Currency,
    forceRefresh: Boolean = false
  ): ConversionResult {
    if (amount.currency == targetCurrency) {
      val identityRate = ExchangeRate.identity(targetCurrency)
      return ConversionResult.Success(
        convertedMoney = amount,
        exchangeRate = identityRate,
        isCached = false
      )
    }

    // 1. Try direct pair (from -> to)
    val directRate = exchangeRateRepository.getRate(
      from = amount.currency,
      to = targetCurrency,
      allowOfflineCache = !forceRefresh
    )
    if (directRate != null) {
      val converted = directRate.convert(amount)
      return ConversionResult.Success(
        convertedMoney = converted,
        exchangeRate = directRate,
        isCached = directRate.source != "open_er_api"
      )
    }

    // 2. Try inverse pair (to -> from) if available
    val inversePairRate = exchangeRateRepository.getRate(
      from = targetCurrency,
      to = amount.currency,
      allowOfflineCache = !forceRefresh
    )
    if (inversePairRate != null) {
      val derivedRate = inversePairRate.inverse()
      val converted = derivedRate.convert(amount)
      return ConversionResult.Success(
        convertedMoney = converted,
        exchangeRate = derivedRate,
        isCached = derivedRate.source != "open_er_api"
      )
    }

    return ConversionResult.RateUnavailable(
      fromCurrency = amount.currency,
      toCurrency = targetCurrency,
      reason = "No exchange rate found for ${amount.currency.code} to ${targetCurrency.code}"
    )
  }
}
