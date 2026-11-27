package com.pluto.app.data.repository

import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ExchangeRateEntityMapper
import com.pluto.app.data.local.exchange.ManualExchangeRateDao
import com.pluto.app.data.local.exchange.ManualExchangeRateEntity
import com.pluto.app.data.local.exchange.ManualExchangeRateEntityMapper
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.util.LruMemoryCache
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.repository.ExchangeRateRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.math.BigDecimal
import java.math.MathContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Production implementation of [ExchangeRateRepository] with strict separation between user-defined
 * manual overrides (`manual_exchange_rates`) and API-fetched market rates (`exchange_rates`).
 *
 * Deterministic rate resolution priority:
 * 1. Applicable active manual override (effectiveFrom <= queryTime and not expired) — wins over
 *    all API data and short-circuits before any network request.
 * 2. Fresh API cache entry (Tier 1 in-memory LRU cache, then Tier 2 Room `exchange_rates` within
 *    [FRESHNESS_WINDOW_MS]), when `allowOfflineCache` is true.
 * 3. Live API fetch via [ExchangeRateApiService], persisted exclusively to `exchange_rates`.
 * 4. Stale API cache entry (when `allowOfflineCache` is true) or derived inverse API cache fallback.
 */
class OfflineFirstExchangeRateRepository(
  private val dao: ExchangeRateDao,
  private val manualDao: ManualExchangeRateDao,
  private val apiService: ExchangeRateApiService
) : ExchangeRateRepository {

  private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  // In-memory Tier 1 LRU Cache exclusively for API/saved market rates
  private val memoryCache = LruMemoryCache<String, ExchangeRate>(128)

  private fun formatDate(timestamp: Long): String =
    synchronized(dateFormat) { dateFormat.format(Date(timestamp)) }

  override fun observeRate(from: Currency, to: Currency): Flow<ExchangeRate?> {
    if (from == to) return flowOf(ExchangeRate.identity(from))

    return combine(
      manualDao.observeManualRatesForPair(from.code, to.code),
      manualDao.observeManualRatesForPair(to.code, from.code),
      dao.observeLatestRate(from.code, to.code)
    ) { directManualList, inverseManualList, apiEntity ->
      val now = System.currentTimeMillis()
      val activeDirect = directManualList
        .filter { it.isApplicableAt(now) }
        .maxByOrNull { it.effectiveFrom }
        ?.let { ManualExchangeRateEntityMapper.toDomain(it) }
      if (activeDirect != null) {
        return@combine activeDirect
      }

      val activeInverse = inverseManualList
        .filter { it.isApplicableAt(now) }
        .maxByOrNull { it.effectiveFrom }
        ?.let { deriveInverseManualRate(from, to, it) }
      if (activeInverse != null) {
        return@combine activeInverse
      }

      apiEntity?.let {
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

    // Priority 1: Applicable active manual override (never triggers network fetch)
    getManualOverride(from, to, atTimestamp = now)?.let { activeManual ->
      return activeManual
    }

    return resolveMarketRate(from, to, allowOfflineCache, now)
  }

  override suspend fun getMarketRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean
  ): ExchangeRate? {
    if (from == to) {
      return ExchangeRate.identity(from)
    }

    return resolveMarketRate(from, to, allowOfflineCache, System.currentTimeMillis())
  }

  private suspend fun resolveMarketRate(
    from: Currency,
    to: Currency,
    allowOfflineCache: Boolean,
    now: Long
  ): ExchangeRate? {
    val key = cacheKey(from.code, to.code)
    var cachedEntity: ExchangeRateEntity? = null

    // Priority 2: Fresh API cache entry (Tier 1 LRU memory cache, then Tier 2 Room SQLite)
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
          if (isFresh) {
            return domain
          }
        }
      }
    }

    // Priority 3: Live API fetch (writes exclusively to exchange_rates API cache)
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
      // Network failed, malformed JSON, or invalid API response - fall through to stale or inverse cache
    }

    if (cachedEntity == null) {
      cachedEntity = dao.getLatestRate(from.code, to.code)
    }

    // Priority 4a: Stale API cache fallback when offline cache is permitted
    if (allowOfflineCache && cachedEntity != null) {
      val stale = ExchangeRateEntityMapper.toDomain(
        cachedEntity.copy(source = "${cachedEntity.source}_stale")
      )
      if (stale != null) {
        memoryCache.put(key, stale)
        return stale
      }
    }

    // Priority 4b: Derived inverse API cache fallback (to -> from)
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

    // Only apply manual override if it was already effective (and not expired) at the transaction timestamp
    getManualOverride(from, to, atTimestamp = timestamp)?.let { manualForDate ->
      return manualForDate
    }

    val dateStr = formatDate(timestamp)
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

    // Check inverse historical API rate
    val inverseHistorical = dao.getHistoricalRate(to.code, from.code, dateStr)
    if (inverseHistorical != null) {
      val derived = ExchangeRateEntityMapper.toDomain(inverseHistorical)?.inverse()
      if (derived != null) {
        memoryCache.put(historicalKey, derived)
        return derived
      }
    }

    // Never fall back to latest/live API rates for a historical date: if no effective-dated
    // manual override or date-matched historical rate exists, return null so callers/UI can
    // communicate the limitation and require an explicit user choice.
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
    return combine(
      manualDao.observeAllManualRates(),
      dao.observeAllRates()
    ) { manualList, apiList ->
      val now = System.currentTimeMillis()
      val activeManual = manualList
        .filter { it.isApplicableAt(now) }
        .sortedByDescending { it.effectiveFrom }
        .mapNotNull { ManualExchangeRateEntityMapper.toDomain(it) }
      val apiDomains = apiList.mapNotNull {
        val domain = ExchangeRateEntityMapper.toDomain(it)
        if (domain != null) {
          memoryCache.put(cacheKey(domain.fromCurrency.code, domain.toCurrency.code), domain)
        }
        domain
      }
      (activeManual + apiDomains).distinctBy { "${it.fromCurrency.code}_${it.toCurrency.code}" }
    }
  }

  override suspend fun setManualOverride(from: Currency, to: Currency, rate: BigDecimal) {
    val canonicalFrom = Currency.requireByCode(from.code)
    val canonicalTo = Currency.requireByCode(to.code)
    require(canonicalFrom != canonicalTo) {
      "Manual override requires two distinct currencies, got '${canonicalFrom.code}'"
    }
    require(rate.compareTo(BigDecimal.ZERO) > 0) {
      "Manual override rate must be strictly positive, got $rate"
    }

    val now = System.currentTimeMillis()
    val existingDirect = manualDao.getManualRatesForPair(canonicalFrom.code, canonicalTo.code)
    val existingInverse = manualDao.getManualRatesForPair(canonicalTo.code, canonicalFrom.code)

    val directToClose = existingDirect.filter { it.expiresAt == null && it.effectiveFrom < now }
    val inverseToClose = existingInverse.filter { it.expiresAt == null && it.effectiveFrom < now }

    val directClosingKeys = directToClose.map { it.effectiveFrom }.toSet()
    val inverseClosingKeys = inverseToClose.map { it.effectiveFrom }.toSet()

    existingDirect
      .filter { it.effectiveFrom != now && it.effectiveFrom !in directClosingKeys }
      .firstOrNull { it.overlapsWith(now, null) }
      ?.let { conflict ->
        throw OverlappingManualRateWindowException(
          "Manual override for ${canonicalFrom.code}->${canonicalTo.code} starting at $now overlaps existing period [${conflict.effectiveFrom}, ${conflict.expiresAt})"
        )
      }

    existingInverse
      .filter { it.effectiveFrom != now && it.effectiveFrom !in inverseClosingKeys }
      .firstOrNull { it.overlapsWith(now, null) }
      ?.let { conflict ->
        throw OverlappingManualRateWindowException(
          "Manual override for ${canonicalFrom.code}->${canonicalTo.code} starting at $now overlaps existing inverse period [${conflict.effectiveFrom}, ${conflict.expiresAt})"
        )
      }

    if (directToClose.isNotEmpty() || inverseToClose.isNotEmpty()) {
      val closedEntities = (directToClose + inverseToClose).map {
        it.copy(expiresAt = now, updatedAt = now)
      }
      manualDao.insertManualRates(closedEntities)
    }

    setManualOverride(
      from = canonicalFrom,
      to = canonicalTo,
      rate = rate,
      effectiveFrom = now,
      expiresAt = null
    )
  }

  override suspend fun setManualOverride(
    from: Currency,
    to: Currency,
    rate: BigDecimal,
    effectiveFrom: Long,
    expiresAt: Long?
  ) {
    val canonicalFrom = Currency.requireByCode(from.code)
    val canonicalTo = Currency.requireByCode(to.code)
    require(canonicalFrom != canonicalTo) {
      "Manual override requires two distinct currencies, got '${canonicalFrom.code}'"
    }
    require(rate.compareTo(BigDecimal.ZERO) > 0) {
      "Manual override rate must be strictly positive, got $rate"
    }
    if (expiresAt != null) {
      require(expiresAt > effectiveFrom) {
        "Manual override expiresAt ($expiresAt, exclusive) must be strictly after effectiveFrom ($effectiveFrom)"
      }
    }

    val existingDirect = manualDao.getManualRatesForPair(canonicalFrom.code, canonicalTo.code)
    existingDirect
      .filter { it.effectiveFrom != effectiveFrom }
      .firstOrNull { it.overlapsWith(effectiveFrom, expiresAt) }
      ?.let { conflict ->
        throw OverlappingManualRateWindowException(
          "Manual override [${effectiveFrom}, ${expiresAt ?: "∞"}) for ${canonicalFrom.code}->${canonicalTo.code} overlaps existing period [${conflict.effectiveFrom}, ${conflict.expiresAt ?: "∞"})"
        )
      }

    val existingInverse = manualDao.getManualRatesForPair(canonicalTo.code, canonicalFrom.code)
    existingInverse
      .filter { it.effectiveFrom != effectiveFrom }
      .firstOrNull { it.overlapsWith(effectiveFrom, expiresAt) }
      ?.let { conflict ->
        throw OverlappingManualRateWindowException(
          "Manual override [${effectiveFrom}, ${expiresAt ?: "∞"}) for ${canonicalFrom.code}->${canonicalTo.code} overlaps existing inverse period [${conflict.effectiveFrom}, ${conflict.expiresAt ?: "∞"})"
        )
      }

    val now = System.currentTimeMillis()
    val effectiveDate = formatDate(effectiveFrom)

    val directEntity = ManualExchangeRateEntity(
      fromCurrency = canonicalFrom.code,
      toCurrency = canonicalTo.code,
      rate = rate.toPlainString(),
      effectiveDate = effectiveDate,
      effectiveFrom = effectiveFrom,
      expiresAt = expiresAt,
      source = "manual_override",
      updatedAt = now
    )

    val reciprocalRate = computeReciprocalRate(rate)
    val inverseEntity = ManualExchangeRateEntity(
      fromCurrency = canonicalTo.code,
      toCurrency = canonicalFrom.code,
      rate = reciprocalRate.toPlainString(),
      effectiveDate = effectiveDate,
      effectiveFrom = effectiveFrom,
      expiresAt = expiresAt,
      source = "manual_override_inverse",
      updatedAt = now
    )

    manualDao.insertManualRates(listOf(directEntity, inverseEntity))
  }

  override suspend fun getManualOverride(
    from: Currency,
    to: Currency,
    atTimestamp: Long
  ): ExchangeRate? {
    val canonicalFrom = Currency.findByCode(from.code) ?: return null
    val canonicalTo = Currency.findByCode(to.code) ?: return null
    if (canonicalFrom == canonicalTo) return ExchangeRate.identity(canonicalFrom)

    val directEntity = manualDao.getApplicableManualRate(
      from = canonicalFrom.code,
      to = canonicalTo.code,
      timestamp = atTimestamp
    )
    if (directEntity != null && directEntity.isApplicableAt(atTimestamp)) {
      ManualExchangeRateEntityMapper.toDomain(directEntity)?.let { return it }
    }

    val inverseEntity = manualDao.getApplicableManualRate(
      from = canonicalTo.code,
      to = canonicalFrom.code,
      timestamp = atTimestamp
    )
    if (inverseEntity != null && inverseEntity.isApplicableAt(atTimestamp)) {
      deriveInverseManualRate(canonicalFrom, canonicalTo, inverseEntity)?.let { return it }
    }

    return null
  }

  override suspend fun getManualOverridesForPair(from: Currency, to: Currency): List<ExchangeRate> {
    val canonicalFrom = Currency.findByCode(from.code) ?: return emptyList()
    val canonicalTo = Currency.findByCode(to.code) ?: return emptyList()
    if (canonicalFrom == canonicalTo) return emptyList()

    return manualDao.getManualRatesForPair(canonicalFrom.code, canonicalTo.code)
      .mapNotNull { ManualExchangeRateEntityMapper.toDomain(it) }
  }

  override suspend fun clearManualOverride(from: Currency, to: Currency) {
    val canonicalFrom = Currency.requireByCode(from.code)
    val canonicalTo = Currency.requireByCode(to.code)
    manualDao.deleteManualRatesForPair(canonicalFrom.code, canonicalTo.code)
    manualDao.deleteManualRatesForPair(canonicalTo.code, canonicalFrom.code)

    // Best-effort refresh of clean market API rates without disturbing existing API cache on offline failure
    try {
      fetchAndCacheLatestRates(canonicalFrom)
    } catch (e: Exception) {
      if (e is CancellationException) throw e
    }
  }

  override suspend fun clearManualOverride(from: Currency, to: Currency, effectiveFrom: Long) {
    val canonicalFrom = Currency.requireByCode(from.code)
    val canonicalTo = Currency.requireByCode(to.code)
    manualDao.deleteManualRatePeriod(canonicalFrom.code, canonicalTo.code, effectiveFrom)
    manualDao.deleteManualRatePeriod(canonicalTo.code, canonicalFrom.code, effectiveFrom)

    // Best-effort refresh of clean market API rates without disturbing existing API cache on offline failure
    try {
      fetchAndCacheLatestRates(canonicalFrom)
    } catch (e: Exception) {
      if (e is CancellationException) throw e
    }
  }

  override suspend fun getManualOverrides(): List<ExchangeRate> {
    val now = System.currentTimeMillis()
    return manualDao.getAllManualRates()
      .filter { it.isApplicableAt(now) }
      .sortedByDescending { it.effectiveFrom }
      .mapNotNull { ManualExchangeRateEntityMapper.toDomain(it) }
      .distinctBy { "${it.fromCurrency.code}_${it.toCurrency.code}" }
  }

  override fun observeManualOverrides(): Flow<List<ExchangeRate>> {
    return manualDao.observeAllManualRates().map { entities ->
      val now = System.currentTimeMillis()
      entities
        .filter { it.isApplicableAt(now) }
        .sortedByDescending { it.effectiveFrom }
        .mapNotNull { ManualExchangeRateEntityMapper.toDomain(it) }
        .distinctBy { "${it.fromCurrency.code}_${it.toCurrency.code}" }
    }
  }

  fun clearMemoryCache() {
    memoryCache.evictAll()
  }

  private fun computeReciprocalRate(rate: BigDecimal): BigDecimal =
    BigDecimal.ONE.divide(rate, MathContext.DECIMAL128)

  private fun deriveInverseManualRate(
    from: Currency,
    to: Currency,
    inverseEntity: ManualExchangeRateEntity
  ): ExchangeRate? {
    val inverseDomain = ManualExchangeRateEntityMapper.toDomain(inverseEntity) ?: return null
    val reciprocalRate = computeReciprocalRate(inverseDomain.rate)
    val reciprocalSource = if (inverseDomain.source.endsWith("_inverse")) {
      inverseDomain.source
    } else {
      "${inverseDomain.source}_inverse"
    }
    return ExchangeRate(
      fromCurrency = from,
      toCurrency = to,
      rate = reciprocalRate,
      timestamp = inverseDomain.timestamp,
      source = reciprocalSource
    )
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
    // 12 hours freshness window for forex market updates
    const val FRESHNESS_WINDOW_MS = 12 * 60 * 60 * 1000L
  }
}

class InvalidExchangeRateResponseException(message: String) : IllegalStateException(message)

class OverlappingManualRateWindowException(message: String) : IllegalArgumentException(message)
