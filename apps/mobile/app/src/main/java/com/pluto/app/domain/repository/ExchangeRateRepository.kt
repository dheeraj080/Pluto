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
   * Returns a Flow observing the latest market exchange rate for the specified currency pair.
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
   * Retrieves the latest market rate (fresh API cache, live API fetch, stale cache,
   * or derived inverse cache) for the currency pair.
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
   * Returns all currently cached market exchange rates.
   */
  fun observeAllRates(): Flow<List<ExchangeRate>>
}
