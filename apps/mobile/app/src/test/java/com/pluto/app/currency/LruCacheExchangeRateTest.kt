package com.pluto.app.currency

import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class LruCacheExchangeRateTest {

  private lateinit var fakeDao: FakeExchangeRateDao
  private lateinit var fakeApiService: FakeExchangeRateApiService
  private lateinit var repository: OfflineFirstExchangeRateRepository

  @Before
  fun setUp() {
    fakeDao = FakeExchangeRateDao()
    fakeApiService = FakeExchangeRateApiService()
    repository = OfflineFirstExchangeRateRepository(fakeDao, fakeApiService)
  }

  @Test
  fun `subsequent queries hit in-memory LRU cache directly without querying DAO`() = runBlocking {
    val usd = Currency.USD
    val eur = Currency.EUR
    val now = System.currentTimeMillis()

    // Pre-populate DAO with fresh rate
    fakeDao.rates["${usd.code}_${eur.code}"] = ExchangeRateEntity(
      fromCurrency = usd.code,
      toCurrency = eur.code,
      rate = "0.92000000",
      effectiveDate = "2026-11-06",
      source = "test",
      fetchedAt = now
    )

    // First call queries DAO and populates LRU cache
    val firstResult = repository.getRate(usd, eur)
    assertNotNull(firstResult)
    assertEquals(1, fakeDao.getLatestRateCallCount)

    // Second call should hit the LRU cache directly, DAO call count must NOT increment
    val secondResult = repository.getRate(usd, eur)
    assertNotNull(secondResult)
    assertEquals(1, fakeDao.getLatestRateCallCount)
    assertSame(firstResult, secondResult)
  }

  @Test
  fun `saveRate updates in-memory LRU cache immediately`() = runBlocking {
    val jpy = Currency.JPY
    val usd = Currency.USD

    val customRate = ExchangeRate(
      fromCurrency = jpy,
      toCurrency = usd,
      rate = BigDecimal("0.0067"),
      timestamp = System.currentTimeMillis(),
      source = "manual"
    )

    repository.saveRate(customRate)

    // Query should resolve directly from LRU cache without hitting DAO
    val cached = repository.getRate(jpy, usd)
    assertNotNull(cached)
    assertEquals(0, fakeDao.getLatestRateCallCount)
    assertEquals(customRate.rate, cached?.rate)
  }

  @Test
  fun `derived inverse rates are stored in LRU cache`() = runBlocking {
    val usd = Currency.USD
    val gbp = Currency.GBP
    val now = System.currentTimeMillis()

    fakeDao.rates["${gbp.code}_${usd.code}"] = ExchangeRateEntity(
      fromCurrency = gbp.code,
      toCurrency = usd.code,
      rate = "1.25000000",
      effectiveDate = "2026-11-06",
      source = "test",
      fetchedAt = now
    )

    // Query USD -> GBP (requires inverse derivation of GBP -> USD)
    val inverseRate = repository.getRate(usd, gbp)
    assertNotNull(inverseRate)
    assertEquals("0.800000", inverseRate?.rate?.toPlainString()?.take(8))

    // Subsequent call should hit LRU cache without re-querying DAO
    val initialDaoCalls = fakeDao.getLatestRateCallCount
    val secondQuery = repository.getRate(usd, gbp)
    assertNotNull(secondQuery)
    assertEquals(initialDaoCalls, fakeDao.getLatestRateCallCount)
  }

  // --- Fakes ---

  private class FakeExchangeRateDao : ExchangeRateDao {
    val rates = mutableMapOf<String, ExchangeRateEntity>()
    var getLatestRateCallCount = 0

    override suspend fun getLatestRate(from: String, to: String): ExchangeRateEntity? {
      getLatestRateCallCount++
      return rates["${from}_$to"]
    }

    override suspend fun getHistoricalRate(from: String, to: String, date: String): ExchangeRateEntity? {
      return rates["${from}_$to"]
    }

    override suspend fun insertRate(rate: ExchangeRateEntity) {
      rates["${rate.fromCurrency}_${rate.toCurrency}"] = rate
    }

    override suspend fun insertRates(rates: List<ExchangeRateEntity>) {
      rates.forEach { this.rates["${it.fromCurrency}_${it.toCurrency}"] = it }
    }

    override fun observeLatestRate(from: String, to: String) =
      flowOf(rates["${from}_$to"])

    override fun observeAllRates() = flowOf(rates.values.toList())

    override suspend fun getAllRates(): List<ExchangeRateEntity> = rates.values.toList()

    override suspend fun deleteManualOverride(from: String, to: String) {
      rates.remove("${from}_$to")
    }

    override suspend fun clearAll() {
      rates.clear()
    }
  }

  private class FakeExchangeRateApiService : ExchangeRateApiService {
    override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto {
      return ExchangeRateResponseDto(
        result = "success",
        baseCode = baseCurrency,
        timeLastUpdateUnix = System.currentTimeMillis() / 1000,
        timeLastUpdateUtc = "Fri, 06 Nov 2026 00:00:00 +0000",
        rates = mapOf("EUR" to 0.92, "USD" to 1.0, "JPY" to 150.0)
      )
    }
  }
}
