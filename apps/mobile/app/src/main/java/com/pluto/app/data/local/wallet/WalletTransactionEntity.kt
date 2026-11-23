package com.pluto.app.data.local.wallet

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity representing an explicit wallet ledger movement.
 *
 * Indexed by [walletId] and [timestamp] for optimal history querying.
 * All amounts and exchange rates stored as plain BigDecimal strings.
 */
@Entity(
  tableName = "wallet_transactions",
  indices = [
    Index(value = ["walletId"]),
    Index(value = ["timestamp"])
  ]
)
data class WalletTransactionEntity(
  @PrimaryKey
  val id: String,
  val walletId: String,
  val type: String, // DEPOSIT, WITHDRAWAL, TRANSFER_OUT, TRANSFER_IN
  val amount: String, // BigDecimal string
  val currencyCode: String,
  val timestamp: Long,
  val note: String,
  val targetWalletId: String? = null,
  val targetAmount: String? = null, // BigDecimal string
  val targetCurrencyCode: String? = null,
  val exchangeRate: String? = null, // BigDecimal string
  val exchangeRateSource: String? = null,
  val createdAt: Long
)
