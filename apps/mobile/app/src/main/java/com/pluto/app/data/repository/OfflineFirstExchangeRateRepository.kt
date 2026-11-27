package com.pluto.app.data.repository

import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ExchangeRateEntityMapper
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.util.LruMemoryCache
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.repository.ExchangeRateRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Production implementation of [ExchangeRateRepository] backed by market data only.
 *
 * Deterministic rate resolution priority:
 * 1. Fresh API cache entry (Tier 1 in-memory LRU cache, then Tier 2 Room `exchange_rates` within
 *    [FRESHNESS_WINDOW_MS]), when `allowOfflineCache` is true.
 * 2. Live API fetch via [ExchangeRateApiService], persisted to `exchange_rates`.
 * 3. Stale API cache entry (when `allowOfflineCache` is true) or derived inverse cache fallback.
 *
 * Historical lookups are strict date-matched API cache reads; they never fall back to today's
 * rate for a past transaction date.
 */
class OfflineFirstExchangeRateRepository(
  private val dao: ExchangeRateDao,
  private val apiService: ExchangeRateApiService
) : ExchangeRateRepository {

  private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  private val memoryCache = LruMemoryCache<String, ExchangeRate>(128)

  private fun formatDate(timestamp: Long): String =
    synchronized(dateFormat) { dateFormat.format(Date(timestamp)) }

  override fun observeRate(from: Currency, to: Currency): Flow<ExchangeRate?> {
    if (from == to) return flowOf(ExchangeRate.identity(from))

    return dao.observeLatestRate(from.code, to.code).map { entity ->
      val domain = entity?.let { ExchangeRateEntityMapper.toDomain(it) }
      if (domain != null) {
        memoryCache.put(cacheKey(from.code, to.code), domain)
      }
      domain
    }
  }

  override suspend fun getRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean
  ): ExchangeRate? {
    if (from == to) return ExchangeRate.identity(from)
    return resolveMarketRate(from, to, allowOfflineCache, System.currentTimeMillis())
  }

  override suspend fun getMarketRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean
  ): ExchangeRate? = getRate(from, to, allowOfflineCache)

  private suspend fun resolveMarketRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean,
    now: Long
  ): ExchangeRate? {
    val key = cacheKey(from.code, to.code)
    var cachedEntity: ExchangeRateEntity? = null

    if (allowOfflineCache) {
      val inMemory = memoryCache.get(key)
      if (inMemory != null && (now - inMemory.timestamp) < FRESHNESS_WINDOW_MS) {
        return inMemory
      }

      cachedEntity = dao.getLatestRate(from.code, to.code)
      if (cachedEntity != null) {
        val isFresh = (now - cachedEntity.fetchedAt) < FRESHNESS_WINDOW_MS
        val domain = ExchangeRateEntityMapper.toDomain(cachedEntity)
        if (domain != null) {
          memoryCache.put(key, domain)
          if (isFresh) return domain
        }
      }
    }

    try {
      fetchAndCacheLatestRates(from)
      val updatedEntity = dao.getLatestRate(from.code, to.code)
      if (updatedEntity != null) {
        val domain = ExchangeRateEntityMapper.toDomain(updatedEntity)
        if (domain != null) {
          memoryCache.put(key, domain)
          return domain
        }
      }
    } catch (e: Exception) {
      if (e is CancellationException) throw e
      // Network failed, malformed JSON, or invalid API response - fall through to cache fallback.
    }

    if (cachedEntity == null) {
      cachedEntity = dao.getLatestRate(from.code, to.code)
    }

    if (allowOfflineCache && cachedEntity != null) {
      val stale = ExchangeRateEntityMapper.toDomain(
        cachedEntity.copy(source = "${cachedEntity.source}_stale")
      )
      if (stale != null) {
        memoryCache.put(key, stale)
        return stale
      }
    }

    val inverseKey = cacheKey(to.code, from.code)
    val inverseInMemory = memoryCache.get(inverseKey)
    if (inverseInMemory != null) {
      val derived = inverseInMemory.inverse(newSource = "derived_inverse_lru")
      memoryCache.put(key, derived)
      return derived
    }

    val inverseCached = dao.getLatestRate(to.code, from.code)
    if (inverseCached != null) {
      val domainInverse = ExchangeRateEntityMapper.toDomain(inverseCached)
      if (domainInverse != null) {
        val derived = domainInverse.inverse(newSource = "derived_inverse_cached")
        memoryCache.put(key, derived)
        return derived
      }
    }

    return null
  }

  override suspend fun getHistoricalRate(
    from: Currency,
    to: Currency,
    timestamp: Long
  ): ExchangeRate? {
    if (from == to) return ExchangeRate.identity(from)

    val dateStr = formatDate(timestamp)
    val historicalKey = "${from.code}_${to.code}_$dateStr"

    val inMemory = memoryCache.get(historicalKey)
    if (inMemory != null) return inMemory

    val historicalEntity = dao.getHistoricalRate(from.code, to.code, dateStr)
    if (historicalEntity != null) {
      val domain = ExchangeRateEntityMapper.toDomain(historicalEntity)
      if (domain != null) {
        memoryCache.put(historicalKey, domain)
        return domain
      }
    }

    val inverseHistorical = dao.getHistoricalRate(to.code, from.code, dateStr)
    if (inverseHistorical != null) {
      val derived = ExchangeRateEntityMapper.toDomain(inverseHistorical)?.inverse()
      if (derived != null) {
        memoryCache.put(historicalKey, derived)
        return derived
      }
    }

    // Never fall back to latest/live API rates for a historical date.
    return null
  }

  override suspend fun saveRate(exchangeRate: ExchangeRate) {
    val entity = ExchangeRateEntityMapper.toEntity(
      domain = exchangeRate,
      effectiveDate = formatDate(exchangeRate.timestamp)
    )
    dao.insertRate(entity)
    memoryCache.put(cacheKey(exchangeRate.fromCurrency.code, exchangeRate.toCurrency.code), exchangeRate)
  }

  override fun observeAllRates(): Flow<List<ExchangeRate>> {
    return dao.observeAllRates().map { entities ->
      entities.mapNotNull { entity ->
        val domain = ExchangeRateEntityMapper.toDomain(entity)
        if (domain != null) {
          memoryCache.put(cacheKey(domain.fromCurrency.code, domain.toCurrency.code), domain)
        }
        domain
      }
    }
  }

  fun clearMemoryCache() {
    memoryCache.evictAll()
  }

  private fun cacheKey(fromCode: String, toCode: String): String = "${fromCode}_$toCode"

  /**
   * Fetches latest rates for [baseCurrency] from remote API, validates response fields and rates,
   * and persists valid entries to Room & Memory Cache while preserving original decimal precision.
   *
   * @throws InvalidExchangeRateResponseException if the API response fails validation.
   */
  internal suspend fun fetchAndCacheLatestRates(baseCurrency: Currency) {
    val canonicalBase = Currency.requireByCode(baseCurrency.code)
    val response = apiService.getLatestRates(canonicalBase.code)
    val validatedRates = validateAndExtractRates(canonicalBase, response)

    val fetchedAt = System.currentTimeMillis()
    val effectiveDate = formatDate(fetchedAt)

    val entities = validatedRates.map { (targetCurr, rateBigDecimal) ->
      val domainRate = ExchangeRate(
        fromCurrency = canonicalBase,
        toCurrency = targetCurr,
        rate = rateBigDecimal,
        timestamp = fetchedAt,
        source = "open_er_api"
      )
      memoryCache.put(cacheKey(canonicalBase.code, targetCurr.code), domainRate)

      ExchangeRateEntityMapper.toEntity(
        domain = domainRate,
        effectiveDate = effectiveDate
      )
    }

    dao.insertRates(entities)
  }

  internal fun validateAndExtractRates(
    expectedBase: Currency,
    response: ExchangeRateResponseDto
  ): Map<Currency, BigDecimal> {
    val resultStatus = response.result
    if (resultStatus != null && resultStatus != "success") {
      throw InvalidExchangeRateResponseException(
        "FX API returned unsuccessful result: '$resultStatus'"
      )
    }

    val rawBaseCode = response.baseCode?.trim()
    if (rawBaseCode.isNullOrEmpty()) {
      throw InvalidExchangeRateResponseException(
        "FX API response is missing base_code for requested currency '${expectedBase.code}'"
      )
    }

    val responseBaseCurrency = Currency.findByCode(rawBaseCode)
      ?: throw InvalidExchangeRateResponseException(
        "FX API returned unknown or unsupported base_code: '$rawBaseCode'"
      )

    if (!responseBaseCurrency.code.equals(expectedBase.code, ignoreCase = true)) {
      throw InvalidExchangeRateResponseException(
        "FX API base_code '${responseBaseCurrency.code}' does not match requested '${expectedBase.code}'"
      )
    }

    val rawRates = response.rates
    if (rawRates == null || rawRates.isEmpty()) {
      throw InvalidExchangeRateResponseException(
        "FX API response for '${expectedBase.code}' is missing rates"
      )
    }

    val validRates = linkedMapOf<Currency, BigDecimal>()
    for ((targetCode, rateValue) in rawRates) {
      val targetCurrency = Currency.findByCode(targetCode)
        ?: throw InvalidExchangeRateResponseException(
          "FX API returned unknown or unsupported currency code: '$targetCode'"
        )
      @Suppress("SENSELESS_COMPARISON")
      if (rateValue == null) {
        throw InvalidExchangeRateResponseException(
          "FX API returned null exchange rate for '${targetCurrency.code}'"
        )
      }
      if (rateValue.compareTo(BigDecimal.ZERO) <= 0) {
        throw InvalidExchangeRateResponseException(
          "FX API returned non-positive exchange rate '$rateValue' for '${targetCurrency.code}'"
        )
      }

      validRates[targetCurrency] = rateValue
    }

    if (validRates.isEmpty()) {
      throw InvalidExchangeRateResponseException(
        "FX API response for '${expectedBase.code}' contained no valid positive exchange rates"
      )
    }

    return validRates
  }

  companion object {
    const val FRESHNESS_WINDOW_MS = 12 * 60 * 60 * 1000L
  }
}

class InvalidExchangeRateResponseException(message: String) : IllegalStateException(message)
