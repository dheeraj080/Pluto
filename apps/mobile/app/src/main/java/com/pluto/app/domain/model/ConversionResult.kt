package com.pluto.app.domain.model

/**
 * Status of currency conversion exchange rate retrieval.
 *
 * Designed to cleanly communicate network/cache states without coupling UI
 * to any specific network framework or remote API provider.
 */
sealed interface ConversionResult {
  /**
   * Converted money successfully calculated using [exchangeRate].
   * [isCached] is true if returned from local offline cache rather than fresh live rate.
   */
  data class Success(
    val convertedMoney: Money,
    val exchangeRate: ExchangeRate,
    val isCached: Boolean = false
  ) : ConversionResult

  /**
   * Rate is unavailable offline and couldn't be derived.
   */
  data class RateUnavailable(
    val fromCurrency: Currency,
    val toCurrency: Currency,
    val reason: String = "No cached or offline exchange rate found"
  ) : ConversionResult

  /**
   * Conversion is pending background resolution.
   */
  data class Pending(
    val fromCurrency: Currency,
    val toCurrency: Currency
  ) : ConversionResult
}
