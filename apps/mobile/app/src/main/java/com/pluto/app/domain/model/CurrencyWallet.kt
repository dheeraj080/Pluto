package com.pluto.app.domain.model

import java.math.BigDecimal
import java.util.UUID

/**
 * Domain model representing a user's currency wallet / holding.
 *
 * Distinct from historical expenses: represents the user's current holding balance
 * in a specific currency.
 *
 * @property id Unique identifier of the wallet.
 * @property currency Canonical ISO 4217 currency.
 * @property balance Precision-safe current balance (must be non-negative).
 * @property createdAt Epoch millis timestamp when created.
 * @property updatedAt Epoch millis timestamp when last edited.
 */
data class CurrencyWallet(
  val id: String = UUID.randomUUID().toString(),
  val currency: Currency,
  val balance: Money,
  val initialBalance: Money = balance,
  val createdAt: Long = System.currentTimeMillis(),
  val updatedAt: Long = System.currentTimeMillis()
) {
  init {
    require(balance.currency == currency) {
      "Wallet balance currency (${balance.currency.code}) must match wallet currency (${currency.code})"
    }
    require(initialBalance.currency == currency) {
      "Wallet initial balance currency (${initialBalance.currency.code}) must match wallet currency (${currency.code})"
    }
    require(balance.amount >= BigDecimal.ZERO) {
      "Wallet balance cannot be negative: ${balance.amount}"
    }
    require(initialBalance.amount >= BigDecimal.ZERO) {
      "Wallet initial balance cannot be negative: ${initialBalance.amount}"
    }
  }

  companion object {
    fun create(
      currency: Currency,
      amount: BigDecimal,
      id: String = UUID.randomUUID().toString()
    ): CurrencyWallet {
      val now = System.currentTimeMillis()
      val money = Money.of(amount, currency)
      return CurrencyWallet(
        id = id,
        currency = currency,
        balance = money,
        initialBalance = money,
        createdAt = now,
        updatedAt = now
      )
    }
  }
}
