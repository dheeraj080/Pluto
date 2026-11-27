package com.pluto.app.domain.repository

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import kotlinx.coroutines.flow.Flow

/**
 * Domain repository contract for currency exchange rates.
 *
 * Implements the Offline-First Principle:
 * Allows getting current and historical rates, caching them,
 * and querying exchange rate availability between pairs.
 */
interface ExchangeRateRepository {
  /**
   * Returns a Flow observing the latest exchange rate for the specified currency pair.
   */
  fun observeRate(from: Currency, to: Currency): Flow<ExchangeRate?>

  /**
   * Retrieves the latest available exchange rate for the currency pair.
   * If [allowOfflineCache] is true, returns local cached rate when available.
   */
  suspend fun getRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean = true
  ): ExchangeRate?

  /**
   * Retrieves the latest available market/API exchange rate (fresh API cache, live API fetch,
   * stale cache, or derived inverse cache) without applying current-time manual overrides.
   */
  suspend fun getMarketRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean = true
  ): ExchangeRate? = getRate(from, to, allowOfflineCache)

  /**
   * Retrieves historical exchange rate valid at a specific point in time.
   */
  suspend fun getHistoricalRate(
    from: Currency,
    to: Currency,
    timestamp: Long
  ): ExchangeRate?

  /**
   * Saves or updates an exchange rate in local storage.
   */
  suspend fun saveRate(exchangeRate: ExchangeRate)

  /**
   * Returns all currently cached exchange rates.
   */
  fun observeAllRates(): Flow<List<ExchangeRate>>

  /**
   * Sets a user-defined manual exchange rate override effective immediately with no expiration.
   * Any currently open-ended manual override for the pair that started earlier is closed at the
   * current timestamp so historical periods remain intact.
   *
   * @throws IllegalArgumentException if currencies are identical, rate <= 0, or a future/bounded window overlaps.
   */
  suspend fun setManualOverride(from: Currency, to: Currency, rate: java.math.BigDecimal)

  /**
   * Sets or updates a user-defined manual exchange rate override with explicit effective-date bounds
   * using half-open interval semantics `[effectiveFrom, expiresAt)`:
   * - [effectiveFrom] is inclusive.
   * - [expiresAt] is exclusive (`null` means no expiration; non-null must be strictly greater than [effectiveFrom]).
   *
   * Rejects overlapping windows against existing periods for the same pair by throwing
   * an [IllegalArgumentException] (`OverlappingManualRateWindowException`). Editing the exact
   * period identified by `(from, to, effectiveFrom)` updates that period in place without
   * disturbing other effective periods.
   */
  suspend fun setManualOverride(
    from: Currency,
    to: Currency,
    rate: java.math.BigDecimal,
    effectiveFrom: Long,
    expiresAt: Long? = null
  ) {
    setManualOverride(from, to, rate)
  }

  /**
   * Retrieves an applicable manual rate override for ([from], [to]) at [atTimestamp] using
   * half-open `[effectiveFrom, expiresAt)` bounds (`expiresAt` exclusive), or `null` when none
   * exists, it is not yet effective, or it has expired.
   */
  suspend fun getManualOverride(
    from: Currency,
    to: Currency,
    atTimestamp: Long = System.currentTimeMillis()
  ): ExchangeRate? = null

  /**
   * Retrieves all persisted manual rate override periods for ([from], [to]) ordered by
   * `effectiveFrom` ascending.
   */
  suspend fun getManualOverridesForPair(from: Currency, to: Currency): List<ExchangeRate> = emptyList()

  /**
   * Clears all manual rate override periods for the currency pair and restores standard market rates.
   */
  suspend fun clearManualOverride(from: Currency, to: Currency)

  /**
   * Clears only the specific manual rate override period identified by `(from, to, effectiveFrom)`
   * without deleting other effective periods for the same currency pair.
   */
  suspend fun clearManualOverride(from: Currency, to: Currency, effectiveFrom: Long) {
    clearManualOverride(from, to)
  }

  /**
   * Retrieves all currently active manual rate overrides.
   */
  suspend fun getManualOverrides(): List<ExchangeRate>

  /**
   * Observes currently active manual rate overrides reactively.
   */
  fun observeManualOverrides(): Flow<List<ExchangeRate>> = kotlinx.coroutines.flow.flowOf(emptyList())
}
