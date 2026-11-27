package com.pluto.app.domain.model

import java.util.UUID

/**
 * Represents an individual financial expense transaction.
 *
 * Adheres strictly to the Currency Principle:
 * - [originalAmount]: What the user actually spent in [originalCurrency]. This must NEVER be overwritten.
 * - [homeAmount]: Equivalent amount in the user's reference [homeCurrency] at the time of recording or recalculation.
 * - [exchangeRate]: The conversion rate applied (`originalAmount * exchangeRate = homeAmount`).
 * - [exchangeRateSource]: Details of how the rate was obtained ("open_er_api", "offline_cache", etc.). Recorded snapshots are immutable even if the feature that produced them is retired.
 * - [exchangeRateTimestamp]: The timestamp of the rate used, preserving historical accuracy.
 */
data class Expense(
  val id: String = UUID.randomUUID().toString(),
  val originalAmount: Money,
  val homeAmount: Money,
  val exchangeRate: ExchangeRate,
  val category: Category,
  val timestamp: Long = System.currentTimeMillis(),
  val merchant: String = "",
  val note: String = "",
  val location: String? = null,
  val tripId: String? = null,
  val receiptUri: String? = null,
  val isRecurring: Boolean = false,
  val recurrenceFrequency: RecurrenceFrequency? = null,
  val lastRecurrenceLoggedMillis: Long? = null,
  val createdAt: Long = System.currentTimeMillis(),
  val updatedAt: Long = createdAt
) {
  val originalCurrency: Currency
    get() = originalAmount.currency

  val homeCurrency: Currency
    get() = homeAmount.currency

  init {
    require(originalAmount.currency == exchangeRate.fromCurrency) {
      "Original money currency (${originalAmount.currency.code}) must match exchange rate fromCurrency (${exchangeRate.fromCurrency.code})"
    }
    require(homeAmount.currency == exchangeRate.toCurrency) {
      "Home money currency (${homeAmount.currency.code}) must match exchange rate toCurrency (${exchangeRate.toCurrency.code})"
    }
  }

  companion object {
    /**
     * Factory function that constructs an Expense by converting [originalAmount] to [homeCurrency]
     * using the supplied [exchangeRate].
     */
    fun create(
      id: String = UUID.randomUUID().toString(),
      originalAmount: Money,
      homeCurrency: Currency,
      exchangeRate: ExchangeRate,
      category: Category,
      timestamp: Long = System.currentTimeMillis(),
      merchant: String = "",
      note: String = "",
      location: String? = null,
      tripId: String? = null,
      receiptUri: String? = null,
      isRecurring: Boolean = false,
      recurrenceFrequency: RecurrenceFrequency? = null,
      lastRecurrenceLoggedMillis: Long? = null,
      createdAt: Long = System.currentTimeMillis(),
      updatedAt: Long = createdAt
    ): Expense {
      require(exchangeRate.fromCurrency == originalAmount.currency) {
        "Exchange rate fromCurrency must match original currency"
      }
      require(exchangeRate.toCurrency == homeCurrency) {
        "Exchange rate toCurrency must match home currency"
      }
      val convertedHomeAmount = exchangeRate.convert(originalAmount)
      return Expense(
        id = id,
        originalAmount = originalAmount,
        homeAmount = convertedHomeAmount,
        exchangeRate = exchangeRate,
        category = category,
        timestamp = timestamp,
        merchant = merchant,
        note = note,
        location = location,
        tripId = tripId,
        receiptUri = receiptUri,
        isRecurring = isRecurring,
        recurrenceFrequency = recurrenceFrequency,
        lastRecurrenceLoggedMillis = lastRecurrenceLoggedMillis,
        createdAt = createdAt,
        updatedAt = updatedAt
      )
    }
  }
}
