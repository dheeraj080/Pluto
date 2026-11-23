package com.pluto.app.data.local.expense

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity representing a persisted expense transaction.
 *
 * Preserves the original transaction amount and currency, the applied exchange rate,
 * rate date/source metadata, and the computed home-currency equivalent amount.
 * Financial quantities are stored as BigDecimal strings to prevent floating-point inaccuracies.
 */
@Entity(
  tableName = "expenses",
  indices = [
    Index(value = ["timestamp"]),
    Index(value = ["categoryId"]),
    Index(value = ["tripId"]),
    Index(value = ["isRecurring"])
  ]
)
data class ExpenseEntity(
  @PrimaryKey
  val id: String,
  val originalAmount: String, // Stored as BigDecimal string
  val originalCurrencyCode: String,
  val homeAmount: String, // Stored as BigDecimal string
  val homeCurrencyCode: String,
  val exchangeRate: String, // Stored as BigDecimal string
  val exchangeRateTimestamp: Long,
  val exchangeRateSource: String,
  val categoryId: String,
  val timestamp: Long, // Transaction timestamp (millis)
  val merchant: String,
  val note: String,
  val location: String?,
  val tripId: String?,
  val receiptUri: String? = null,
  val isRecurring: Boolean = false,
  val recurrenceFrequency: String? = null,
  val lastRecurrenceLoggedMillis: Long? = null
)
