package com.pluto.app.domain.model

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Represents the currency exchange rate from a base currency to a target currency.
 *
 * @property fromCurrency Source currency (e.g. EUR)
 * @property toCurrency Destination currency (e.g. INR)
 * @property rate Numerical conversion multiplier: (fromAmount * rate = toAmount)
 * @property timestamp Epoch millisecond timestamp when this rate was captured or validated
 * @property source Indicator of where the rate originated (e.g. "manual", "system_seed", "ecb", "api")
 */
data class ExchangeRate(
  val fromCurrency: Currency,
  val toCurrency: Currency,
  val rate: BigDecimal,
  val timestamp: Long = System.currentTimeMillis(),
  val source: String = "system_seed"
) {
  init {
    require(rate.compareTo(BigDecimal.ZERO) > 0) {
      "Exchange rate must be strictly positive, got $rate"
    }
  }

  /**
   * Converts a given [Money] in [fromCurrency] to equivalent [Money] in [toCurrency].
   */
  fun convert(money: Money): Money {
    require(money.currency == fromCurrency) {
      "Money currency (${money.currency.code}) must match ExchangeRate fromCurrency (${fromCurrency.code})"
    }
    if (fromCurrency == toCurrency) {
      return money
    }
    val convertedAmount = money.amount.multiply(rate)
      .setScale(toCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
    return Money(convertedAmount, toCurrency)
  }

  /**
   * Derives inverse exchange rate (toCurrency -> fromCurrency).
   */
  fun inverse(newSource: String = "${source}_inverse"): ExchangeRate {
    if (fromCurrency == toCurrency) return this
    val inverseRate = BigDecimal.ONE.divide(rate, 8, RoundingMode.HALF_EVEN)
    return ExchangeRate(
      fromCurrency = toCurrency,
      toCurrency = fromCurrency,
      rate = inverseRate,
      timestamp = timestamp,
      source = newSource
    )
  }

  companion object {
    /**
     * Identity rate (1.0) when source and target currencies are identical.
     */
    fun identity(currency: Currency): ExchangeRate =
      ExchangeRate(
        fromCurrency = currency,
        toCurrency = currency,
        rate = BigDecimal.ONE.setScale(8, RoundingMode.HALF_EVEN),
        source = "identity"
      )

    fun of(
      from: Currency,
      to: Currency,
      rateDouble: Double,
      source: String = "system_seed"
    ): ExchangeRate =
      ExchangeRate(
        fromCurrency = from,
        toCurrency = to,
        rate = BigDecimal.valueOf(rateDouble).setScale(8, RoundingMode.HALF_EVEN),
        source = source
      )
  }
}
