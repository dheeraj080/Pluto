package com.pluto.app.data.local.wallet

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity representing a currency wallet.
 *
 * Unique index on [currencyCode] guarantees at most one wallet per currency.
 * Balance is stored as a BigDecimal String to eliminate floating point issues.
 */
@Entity(
  tableName = "wallets",
  indices = [
    Index(value = ["currencyCode"], unique = true)
  ]
)
data class CurrencyWalletEntity(
  @PrimaryKey
  val id: String,
  val currencyCode: String,
  val balance: String, // BigDecimal string
  @ColumnInfo(defaultValue = "0")
  val initialBalance: String = "0", // BigDecimal string
  val createdAt: Long,
  val updatedAt: Long
)
