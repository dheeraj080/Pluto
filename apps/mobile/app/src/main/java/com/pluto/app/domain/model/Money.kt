package com.pluto.app.domain.model

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/**
 * Immutable value object representing financial amounts with precision safety.
 *
 * Internally uses [BigDecimal] to eliminate IEEE-754 floating-point inaccuracies
 * in financial summation, rate application, and currency conversions.
 */
data class Money(
  val amount: BigDecimal,
  val currency: Currency
) : Comparable<Money> {

  /**
   * Convenience secondary constructor for Double / String inputs.
   */
  constructor(amount: String, currency: Currency) : this(
    BigDecimal(amount).setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN),
    currency
  )

  constructor(amount: Double, currency: Currency) : this(
    BigDecimal.valueOf(amount).setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN),
    currency
  )

  constructor(amount: Long, currency: Currency) : this(
    BigDecimal.valueOf(amount).setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN),
    currency
  )

  init {
    require(amount.scale() == currency.decimalPlaces) {
      "Money scale must match currency decimal places: expected ${currency.decimalPlaces}, got ${amount.scale()}"
    }
  }

  operator fun plus(other: Money): Money {
    require(this.currency == other.currency) {
      "Cannot add money with different currencies: ${this.currency.code} and ${other.currency.code}"
    }
    return Money(this.amount.add(other.amount), this.currency)
  }

  operator fun minus(other: Money): Money {
    require(this.currency == other.currency) {
      "Cannot subtract money with different currencies: ${this.currency.code} and ${other.currency.code}"
    }
    return Money(this.amount.subtract(other.amount), this.currency)
  }

  operator fun times(factor: BigDecimal): Money {
    val scaledResult = this.amount.multiply(factor)
      .setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN)
    return Money(scaledResult, this.currency)
  }

  operator fun times(factor: Double): Money {
    return this.times(BigDecimal.valueOf(factor))
  }

  override fun compareTo(other: Money): Int {
    require(this.currency == other.currency) {
      "Cannot compare money with different currencies: ${this.currency.code} and ${other.currency.code}"
    }
    return this.amount.compareTo(other.amount)
  }

  val isZero: Boolean
    get() = amount.compareTo(BigDecimal.ZERO) == 0

  val isPositive: Boolean
    get() = amount.compareTo(BigDecimal.ZERO) > 0

  val isNegative: Boolean
    get() = amount.compareTo(BigDecimal.ZERO) < 0

  fun negate(): Money =
    Money(amount.negate(), currency)

  /**
   * Formats the amount with currency symbol and appropriate decimal places.
   * e.g., "$25.50", "¥3,500", "€100.00"
   */
  fun format(locale: Locale = Locale.getDefault()): String {
    val symbols = DecimalFormatSymbols(locale)
    val pattern = buildString {
      append("#,##0")
      if (currency.decimalPlaces > 0) {
        append(".")
        repeat(currency.decimalPlaces) { append("0") }
      }
    }
    val formatter = DecimalFormat(pattern, symbols)
    return "${currency.symbol}${formatter.format(amount)}"
  }

  companion object {
    fun zero(currency: Currency): Money =
      Money(BigDecimal.ZERO.setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN), currency)

    fun of(value: String, currency: Currency): Money =
      Money(BigDecimal(value).setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN), currency)

    fun of(value: Double, currency: Currency): Money =
      Money(BigDecimal.valueOf(value).setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN), currency)

    fun of(value: BigDecimal, currency: Currency): Money =
      Money(value.setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN), currency)
  }
}
