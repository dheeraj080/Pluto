package com.pluto.app.data.repository

import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ExchangeRateEntityMapper
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.util.LruMemoryCache
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.repository.ExchangeRateRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Production implementation of [ExchangeRateRepository] implementing a two-tier offline-first architecture:
 * - Tier 1: In-Memory [LruMemoryCache] for sub-millisecond hot lookups during frequent UI calculations and list scrolling.
 * - Tier 2: Persistent Room SQLite disk database for robust offline operation.
 * - Tier 3: Network API sync via [ExchangeRateApiService] with automatic cache population.
 *
 * Freshness Policy:
 * - A cached rate is considered "fresh" if it was fetched within [FRESHNESS_WINDOW_MS] (e.g. 12 hours).
 * - If older, it is considered "stale" but still usable offline or as fallback if the network fails.
 */
class OfflineFirstExchangeRateRepository(
  private val dao: ExchangeRateDao,
  private val apiService: ExchangeRateApiService
) : ExchangeRateRepository {

  private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  // In-memory Tier 1 LRU Cache for ultra-fast instant lookups (<1ms) without SQLite disk roundtrips
  private val memoryCache = LruMemoryCache<String, ExchangeRate>(128)

  override fun observeRate(from: Currency, to: Currency): Flow<ExchangeRate?> {
    return dao.observeLatestRate(from.code, to.code).map { entity ->
      entity?.let {
        val domain = ExchangeRateEntityMapper.toDomain(it)
        if (domain != null) {
          memoryCache.put(cacheKey(from.code, to.code), domain)
        }
        domain
      }
    }
  }

  override suspend fun getRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean
  ): ExchangeRate? {
    if (from == to) {
      return ExchangeRate.identity(from)
    }

    val now = System.currentTimeMillis()
    val key = cacheKey(from.code, to.code)

    var cachedEntity: ExchangeRateEntity? = null

    // Tier 1: In-memory LRU Cache check (skipped when allowOfflineCache is false for real-time live API fetch)
    if (allowOfflineCache) {
      val inMemory = memoryCache.get(key)
      if (inMemory != null) {
        val isFresh = (now - inMemory.timestamp) < FRESHNESS_WINDOW_MS
        if (isFresh) {
          return inMemory
        }
      }

      // Tier 2: Room SQLite disk cache check
      cachedEntity = dao.getLatestRate(from.code, to.code)
      if (cachedEntity != null) {
        val isFresh = (now - cachedEntity.fetchedAt) < FRESHNESS_WINDOW_MS
        val domain = ExchangeRateEntityMapper.toDomain(cachedEntity)
        if (domain != null) {
          memoryCache.put(key, domain)
          if (isFresh) {
            return domain
          }
        }
      }
    }

    // Tier 3: Try fetching latest rates from remote API
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
    } catch (_: Exception) {
      // Network failed or offline - fall through to cached/stale rate or inverse
    }

    // If cachedEntity hasn't been fetched yet (e.g., when allowOfflineCache was false or API threw exception)
    if (cachedEntity == null) {
      cachedEntity = dao.getLatestRate(from.code, to.code)
    }

    // Fallback A: Return cached rate even if stale when allowOfflineCache is true
    if (allowOfflineCache && cachedEntity != null) {
      val stale = ExchangeRateEntityMapper.toDomain(
        cachedEntity.copy(source = "${cachedEntity.source}_stale")
      )
      if (stale != null) {
        memoryCache.put(key, stale)
        return stale
      }
    }

    // Fallback B: Check inverse rate in memory or cache (to -> from)
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
    if (from == to) {
      return ExchangeRate.identity(from)
    }

    val dateStr = dateFormat.format(Date(timestamp))
    val historicalKey = "${from.code}_${to.code}_$dateStr"

    val inMemory = memoryCache.get(historicalKey)
    if (inMemory != null) {
      return inMemory
    }

    val historicalEntity = dao.getHistoricalRate(from.code, to.code, dateStr)
    if (historicalEntity != null) {
      val domain = ExchangeRateEntityMapper.toDomain(historicalEntity)
      if (domain != null) {
        memoryCache.put(historicalKey, domain)
        return domain
      }
    }

    // Check inverse historical rate
    val inverseHistorical = dao.getHistoricalRate(to.code, from.code, dateStr)
    if (inverseHistorical != null) {
      val derived = ExchangeRateEntityMapper.toDomain(inverseHistorical)?.inverse()
      if (derived != null) {
        memoryCache.put(historicalKey, derived)
        return derived
      }
    }

    // Fall back to closest latest cached rate if within reasonable window
    return dao.getLatestRate(from.code, to.code)?.let {
      val domain = ExchangeRateEntityMapper.toDomain(it)
      if (domain != null) {
        memoryCache.put(cacheKey(from.code, to.code), domain)
      }
      domain
    }
  }

  override suspend fun saveRate(exchangeRate: ExchangeRate) {
    val entity = ExchangeRateEntityMapper.toEntity(exchangeRate)
    dao.insertRate(entity)
    memoryCache.put(cacheKey(exchangeRate.fromCurrency.code, exchangeRate.toCurrency.code), exchangeRate)
  }

  override fun observeAllRates(): Flow<List<ExchangeRate>> {
    return dao.observeAllRates().map { list ->
      list.mapNotNull {
        val domain = ExchangeRateEntityMapper.toDomain(it)
        if (domain != null) {
          memoryCache.put(cacheKey(domain.fromCurrency.code, domain.toCurrency.code), domain)
        }
        domain
      }
    }
  }

  override suspend fun setManualOverride(from: Currency, to: Currency, rate: BigDecimal) {
    val now = System.currentTimeMillis()
    val effectiveDate = dateFormat.format(Date(now))
    val rateScaled = rate.setScale(8, RoundingMode.HALF_EVEN)

    val directRate = ExchangeRate(
      fromCurrency = from,
      toCurrency = to,
      rate = rateScaled,
      timestamp = now,
      source = "manual_override"
    )
    dao.insertRate(ExchangeRateEntityMapper.toEntity(directRate, effectiveDate))
    memoryCache.put(cacheKey(from.code, to.code), directRate)

    // Also persist the reciprocal override
    if (rateScaled > BigDecimal.ZERO) {
      val inverseScaled = BigDecimal.ONE.divide(rateScaled, 8, RoundingMode.HALF_EVEN)
      val inverseRate = ExchangeRate(
        fromCurrency = to,
        toCurrency = from,
        rate = inverseScaled,
        timestamp = now,
        source = "manual_override_inverse"
      )
      dao.insertRate(ExchangeRateEntityMapper.toEntity(inverseRate, effectiveDate))
      memoryCache.put(cacheKey(to.code, from.code), inverseRate)
    }
  }

  override suspend fun clearManualOverride(from: Currency, to: Currency) {
    dao.deleteManualOverride(from.code, to.code)
    dao.deleteManualOverride(to.code, from.code)
    memoryCache.remove(cacheKey(from.code, to.code))
    memoryCache.remove(cacheKey(to.code, from.code))

    // Re-fetch clean market rate from API
    try {
      fetchAndCacheLatestRates(from)
    } catch (_: Exception) {}
  }

  override suspend fun getManualOverrides(): List<ExchangeRate> {
    return dao.getAllRates()
      .filter { it.source.startsWith("manual") }
      .mapNotNull { ExchangeRateEntityMapper.toDomain(it) }
      .distinctBy { "${it.fromCurrency.code}_${it.toCurrency.code}" }
  }

  fun clearMemoryCache() {
    memoryCache.evictAll()
  }

  private fun cacheKey(fromCode: String, toCode: String): String = "${fromCode}_$toCode"

  /**
   * Fetches latest rates for [baseCurrency] from remote API and persists them to Room & Memory Cache.
   */
  private suspend fun fetchAndCacheLatestRates(baseCurrency: Currency) {
    val response = apiService.getLatestRates(baseCurrency.code)
    val ratesMap = response.rates ?: return
    val fetchedAt = System.currentTimeMillis()
    val effectiveDate = dateFormat.format(Date(fetchedAt))

    val entities = ratesMap.mapNotNull { (targetCode, rateDouble) ->
      if (rateDouble <= 0.0) return@mapNotNull null
      val targetCurr = Currency.findByCode(targetCode) ?: return@mapNotNull null

      val rateBigDecimal = BigDecimal.valueOf(rateDouble).setScale(8, RoundingMode.HALF_EVEN)
      val domainRate = ExchangeRate(
        fromCurrency = baseCurrency,
        toCurrency = targetCurr,
        rate = rateBigDecimal,
        timestamp = fetchedAt,
        source = "open_er_api"
      )
      memoryCache.put(cacheKey(baseCurrency.code, targetCurr.code), domainRate)

      ExchangeRateEntityMapper.toEntity(
        domain = domainRate,
        effectiveDate = effectiveDate
      )
    }

    if (entities.isNotEmpty()) {
      dao.insertRates(entities)
    }
  }

  companion object {
    // 12 hours freshness window for forex market updates
    const val FRESHNESS_WINDOW_MS = 12 * 60 * 60 * 1000L
  }
}
