package com.pluto.app.data.local.exchange

import androidx.room.Entity
import androidx.room.Index

/**
 * Room entity for caching currency exchange rates with BigDecimal-safe String precision.
 *
 * Indexed by [fromCurrency], [toCurrency], and [effectiveDate] for fast direct and historical lookups.
 */
@Entity(
  tableName = "exchange_rates",
  primaryKeys = ["fromCurrency", "toCurrency", "effectiveDate"],
  indices = [
    Index(value = ["fromCurrency", "toCurrency"]),
    Index(value = ["fromCurrency", "toCurrency", "effectiveDate"])
  ]
)
data class ExchangeRateEntity(
  val fromCurrency: String,
  val toCurrency: String,
  val rate: String, // Stored as BigDecimal string representation to eliminate floating point issues
  val effectiveDate: String, // Format: YYYY-MM-DD
  val fetchedAt: Long, // Epoch millis when downloaded or written to cache
  val source: String
)
