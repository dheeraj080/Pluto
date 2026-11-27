package com.pluto.app.data.local.exchange

import androidx.room.Entity
import androidx.room.Index

/**
 * Room entity for user-defined manual exchange rate overrides, persisted independently from
 * API-fetched market cache rates in [ExchangeRateEntity] (`exchange_rates`).
 *
 * Keyed by `(fromCurrency, toCurrency, effectiveFrom)` so multiple non-overlapping effective
 * periods can coexist for the same currency pair and support accurate historical lookups.
 *
 * Effective-window semantics are half-open `[effectiveFrom, expiresAt)`:
 * - [effectiveFrom] is inclusive (the rate becomes active at `timestamp == effectiveFrom`).
 * - [expiresAt] is exclusive (the rate is active while `timestamp < expiresAt` and expires at
 *   `timestamp == expiresAt`). A `null` value means no expiration.
 */
@Entity(
  tableName = "manual_exchange_rates",
  primaryKeys = ["fromCurrency", "toCurrency", "effectiveFrom"],
  indices = [
    Index(value = ["fromCurrency", "toCurrency", "effectiveFrom", "expiresAt"]),
    Index(value = ["effectiveDate"]),
    Index(value = ["updatedAt"])
  ]
)
data class ManualExchangeRateEntity(
  val fromCurrency: String,
  val toCurrency: String,
  val rate: String, // Exact BigDecimal plain-string representation
  val effectiveDate: String, // Format: YYYY-MM-DD derived from effectiveFrom
  val effectiveFrom: Long, // Epoch millis when this override becomes effective (inclusive)
  val expiresAt: Long? = null, // Optional epoch millis when override expires (exclusive; null = no expiry)
  val source: String = "manual_override",
  val updatedAt: Long = System.currentTimeMillis()
) {
  /**
   * Returns `true` when this manual rate is active at [timestamp] using half-open interval
   * semantics `[effectiveFrom, expiresAt)` (`expiresAt` exclusive).
   */
  fun isApplicableAt(timestamp: Long): Boolean {
    if (timestamp < effectiveFrom) return false
    if (expiresAt != null && timestamp >= expiresAt) return false
    return true
  }

  /**
   * Returns `true` when this half-open window `[effectiveFrom, expiresAt)` overlaps with
   * `[otherStart, otherEnd)`. Contiguous back-to-back periods where one ends at `T` and the
   * next starts at `T` do not overlap.
   */
  fun overlapsWith(otherStart: Long, otherEnd: Long?): Boolean {
    val thisEnd = expiresAt ?: Long.MAX_VALUE
    val targetEnd = otherEnd ?: Long.MAX_VALUE
    return effectiveFrom < targetEnd && otherStart < thisEnd
  }
}
