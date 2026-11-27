package com.pluto.app.currency

import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ManualExchangeRateDao
import com.pluto.app.data.local.exchange.ManualExchangeRateEntity
import com.pluto.app.data.remote.exchange.ExchangeRateApiClient
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.repository.InvalidExchangeRateResponseException
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.domain.model.Currency
import com.squareup.moshi.JsonDataException
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class ExchangeRateParsingAndValidationTest {

  private lateinit var fakeDao: FakeExchangeRateDao
  private lateinit var fakeManualDao: FakeManualExchangeRateDao

  @Before
  fun setUp() {
    fakeDao = FakeExchangeRateDao()
    fakeManualDao = FakeManualExchangeRateDao()
  }

  @Test
  fun `parses exact decimal values with many digits without Double precision loss end to end`() = runBlocking {
    val json = """
      {
        "result": "success",
        "base_code": "USD",
        "time_last_update_unix": 1731000000,
        "time_last_update_utc": "Thu, 07 Nov 2024 00:00:00 +0000",
        "rates": {
          "EUR": 0.123456789123,
          "GBP": 0.987654321098765432,
          "KWD": 0.30712345678901
        }
      }
    """.trimIndent()

    val dto = ExchangeRateApiClient.parseResponse(json)
    assertEquals(BigDecimal("0.123456789123"), dto.rates?.get("EUR"))
    assertEquals("0.123456789123", dto.rates?.get("EUR")?.toPlainString())
    assertEquals(12, dto.rates?.get("EUR")?.scale())
    assertEquals(BigDecimal("0.987654321098765432"), dto.rates?.get("GBP"))
    assertEquals("0.987654321098765432", dto.rates?.get("GBP")?.toPlainString())

    val repository = createRepositoryFromJson(json)
    val eurRate = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false)
    assertNotNull(eurRate)
    assertEquals(BigDecimal("0.123456789123"), eurRate!!.rate)
    assertEquals("0.123456789123", eurRate.rate.toPlainString())

    val persisted = fakeDao.getLatestRate("USD", "EUR")
    assertNotNull(persisted)
    assertEquals("0.123456789123", persisted!!.rate)

    val gbpPersisted = fakeDao.getLatestRate("USD", "GBP")
    assertNotNull(gbpPersisted)
    assertEquals("0.987654321098765432", gbpPersisted!!.rate)
  }

  @Test
  fun `parses very small and very large positive rates accurately`() = runBlocking {
    val json = """
      {
        "result": "success",
        "base_code": "USD",
        "rates": {
          "KWD": 0.000000000000012345,
          "BHD": 1e-12,
          "JPY": 15000000000000000.123456789,
          "OMR": 9876543210987654321.987654321
        }
      }
    """.trimIndent()

    val repository = createRepositoryFromJson(json)

    val kwdRate = repository.getRate(Currency.USD, Currency.KWD, allowOfflineCache = false)
    assertEquals(BigDecimal("0.000000000000012345"), kwdRate?.rate)

    val bhdRate = repository.getRate(Currency.USD, Currency.BHD, allowOfflineCache = false)
    assertNotNull(bhdRate)
    assertEquals(0, BigDecimal("0.000000000001").compareTo(bhdRate!!.rate))

    val jpyRate = repository.getRate(Currency.USD, Currency.JPY, allowOfflineCache = false)
    assertEquals(BigDecimal("15000000000000000.123456789"), jpyRate?.rate)

    val omrRate = repository.getRate(Currency.USD, Currency.OMR, allowOfflineCache = false)
    assertEquals(BigDecimal("9876543210987654321.987654321"), omrRate?.rate)
  }

  @Test
  fun `rejects entire response when any rate is zero or negative`() = runBlocking {
    val allInvalidRepo = createRepositoryFromDto(
      ExchangeRateResponseDto(
        result = "success",
        baseCode = "USD",
        rates = mapOf(
          "EUR" to BigDecimal.ZERO,
          "GBP" to BigDecimal("-1.25"),
          "JPY" to BigDecimal("0.00000000")
        )
      )
    )

    assertThrowsInvalidResponse {
      allInvalidRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())
    assertNull(allInvalidRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false))

    // Mixed valid EUR + zero-valued INR must reject the entire response
    val mixedZeroRepo = createRepositoryFromJson(
      """
      {
        "result": "success",
        "base_code": "USD",
        "rates": {
          "EUR": 0.92,
          "INR": 0
        }
      }
      """.trimIndent()
    )

    assertThrowsInvalidResponse {
      mixedZeroRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())
    assertNull(mixedZeroRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false))
    assertNull(mixedZeroRepo.getRate(Currency.USD, Currency.INR, allowOfflineCache = false))

    // Mixed valid EUR + negative-valued JPY must reject the entire response
    val mixedNegativeRepo = createRepositoryFromJson(
      """
      {
        "result": "success",
        "base_code": "USD",
        "rates": {
          "EUR": 0.92,
          "JPY": -150.5
        }
      }
      """.trimIndent()
    )

    assertThrowsInvalidResponse {
      mixedNegativeRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())
    assertNull(mixedNegativeRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false))
  }

  @Test
  fun `rejects entire response on invalid currency codes in base_code or rates without silent USD fallback`() = runBlocking {
    val invalidBaseRepo = createRepositoryFromDto(
      ExchangeRateResponseDto(
        result = "success",
        baseCode = "ZZZ",
        rates = mapOf("EUR" to BigDecimal("0.92"))
      )
    )
    assertThrowsInvalidResponse {
      invalidBaseRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())

    val onlyInvalidTargetsRepo = createRepositoryFromDto(
      ExchangeRateResponseDto(
        result = "success",
        baseCode = "USD",
        rates = mapOf(
          "ZZZ" to BigDecimal("1.23"),
          "US" to BigDecimal("1.00"),
          "123" to BigDecimal("2.00"),
          "XDR" to BigDecimal("0.75")
        )
      )
    )
    assertThrowsInvalidResponse {
      onlyInvalidTargetsRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())

    // Mixed valid EUR + unknown currency code must reject the entire response
    val mixedUnknownCodeRepo = createRepositoryFromDto(
      ExchangeRateResponseDto(
        result = "success",
        baseCode = "USD",
        rates = mapOf(
          "EUR" to BigDecimal("0.92"),
          "ZZZ" to BigDecimal("1.23")
        )
      )
    )
    assertThrowsInvalidResponse {
      mixedUnknownCodeRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())
    assertNull(mixedUnknownCodeRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false))

    // Non-circulating ISO code XDR mixed with valid EUR must also reject the entire response
    val mixedXdrRepo = createRepositoryFromDto(
      ExchangeRateResponseDto(
        result = "success",
        baseCode = "USD",
        rates = mapOf(
          "EUR" to BigDecimal("0.92"),
          "XDR" to BigDecimal("0.75")
        )
      )
    )
    assertThrowsInvalidResponse {
      mixedXdrRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())
  }

  @Test
  fun `rejects missing rates, empty rates, missing base_code, and null rate values`() = runBlocking {
    val missingRatesRepo = createRepositoryFromJson("""{"result":"success","base_code":"USD"}""")
    assertThrowsInvalidResponse { missingRatesRepo.fetchAndCacheLatestRates(Currency.USD) }

    val nullRatesRepo = createRepositoryFromJson("""{"result":"success","base_code":"USD","rates":null}""")
    assertThrowsInvalidResponse { nullRatesRepo.fetchAndCacheLatestRates(Currency.USD) }

    val emptyRatesRepo = createRepositoryFromJson("""{"result":"success","base_code":"USD","rates":{}}""")
    assertThrowsInvalidResponse { emptyRatesRepo.fetchAndCacheLatestRates(Currency.USD) }

    val missingBaseRepo = createRepositoryFromJson("""{"result":"success","rates":{"EUR":0.92}}""")
    assertThrowsInvalidResponse { missingBaseRepo.fetchAndCacheLatestRates(Currency.USD) }

    val blankBaseRepo = createRepositoryFromJson("""{"result":"success","base_code":"  ","rates":{"EUR":0.92}}""")
    assertThrowsInvalidResponse { blankBaseRepo.fetchAndCacheLatestRates(Currency.USD) }

    try {
      ExchangeRateApiClient.parseResponse("""{"result":"success","base_code":"USD","rates":{"EUR":null}}""")
      fail("Expected JsonDataException for null rate value")
    } catch (_: JsonDataException) {
      // expected
    }

    @Suppress("UNCHECKED_CAST")
    val dtoWithNullRate = ExchangeRateResponseDto(
      result = "success",
      baseCode = "USD",
      rates = mapOf("EUR" to BigDecimal("0.92"), "INR" to null) as Map<String, BigDecimal>
    )
    val nullDtoRepo = createRepositoryFromDto(dtoWithNullRate)
    assertThrowsInvalidResponse { nullDtoRepo.fetchAndCacheLatestRates(Currency.USD) }
    assertTrue(fakeDao.rates.isEmpty())
  }

  @Test
  fun `requires result equals success when result field is provided`() = runBlocking {
    val errorResultRepo = createRepositoryFromJson(
      """
      {
        "result": "error",
        "base_code": "USD",
        "rates": {"EUR": 0.92}
      }
      """.trimIndent()
    )
    assertThrowsInvalidResponse {
      errorResultRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())

    val blankResultRepo = createRepositoryFromJson(
      """
      {
        "result": "",
        "base_code": "USD",
        "rates": {"EUR": 0.92}
      }
      """.trimIndent()
    )
    assertThrowsInvalidResponse {
      blankResultRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())

    // When result is omitted (null), valid payload still succeeds
    val omittedResultRepo = createRepositoryFromJson(
      """
      {
        "base_code": "USD",
        "rates": {"EUR": 0.92}
      }
      """.trimIndent()
    )
    omittedResultRepo.fetchAndCacheLatestRates(Currency.USD)
    assertEquals("0.92", fakeDao.getLatestRate("USD", "EUR")?.rate)
  }

  @Test
  fun `verifies response base currency matches requested base currency case-insensitively`() = runBlocking {
    val mismatchedRepo = createRepositoryFromJson(
      """
      {
        "result": "success",
        "base_code": "EUR",
        "rates": {"USD": 1.08, "GBP": 0.85}
      }
      """.trimIndent()
    )
    assertThrowsInvalidResponse {
      mismatchedRepo.fetchAndCacheLatestRates(Currency.USD)
    }
    assertTrue(fakeDao.rates.isEmpty())

    val lowercaseBaseRepo = createRepositoryFromJson(
      """
      {
        "result": "success",
        "base_code": "usd",
        "rates": {"eur": 0.925}
      }
      """.trimIndent()
    )
    val eurRate = lowercaseBaseRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false)
    assertNotNull(eurRate)
    assertEquals(BigDecimal("0.925"), eurRate!!.rate)
  }

  @Test
  fun `rejects malformed numeric JSON values`() = runBlocking {
    val malformedPayloads = listOf(
      """{"result":"success","base_code":"USD","rates":{"EUR":"not_a_number"}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":""}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":"NaN"}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":"Infinity"}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":true}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":{}}}"""
    )

    for (payload in malformedPayloads) {
      try {
        ExchangeRateApiClient.parseResponse(payload)
        fail("Expected JsonDataException for malformed payload: $payload")
      } catch (_: JsonDataException) {
        // expected
      }

      val repo = createRepositoryFromJson(payload)
      assertNull(repo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false))
    }
    assertTrue(fakeDao.rates.isEmpty())
  }

  @Test
  fun `parses valid multi-currency response across 0-decimal, 2-decimal, and 3-decimal currencies`() = runBlocking {
    val json = """
      {
        "result": "success",
        "base_code": "USD",
        "time_last_update_unix": 1731000000,
        "time_last_update_utc": "Thu, 07 Nov 2024 00:00:00 +0000",
        "rates": {
          "USD": 1,
          "EUR": 0.92415,
          "GBP": 0.789123,
          "INR": 84.3825,
          "JPY": 153.42,
          "KRW": 1395.5,
          "KWD": 0.30725,
          "BHD": 0.376,
          "OMR": 0.3845,
          "JOD": 0.709,
          "TND": 3.1245
        }
      }
    """.trimIndent()

    val repository = createRepositoryFromJson(json)
    repository.fetchAndCacheLatestRates(Currency.USD)

    assertEquals(11, fakeDao.rates.size)
    assertEquals("1", fakeDao.getLatestRate("USD", "USD")?.rate)
    assertEquals("0.92415", fakeDao.getLatestRate("USD", "EUR")?.rate)
    assertEquals("153.42", fakeDao.getLatestRate("USD", "JPY")?.rate)
    assertEquals("1395.5", fakeDao.getLatestRate("USD", "KRW")?.rate)
    assertEquals("0.30725", fakeDao.getLatestRate("USD", "KWD")?.rate)
    assertEquals("0.376", fakeDao.getLatestRate("USD", "BHD")?.rate)
    assertEquals("0.3845", fakeDao.getLatestRate("USD", "OMR")?.rate)
    assertEquals("0.709", fakeDao.getLatestRate("USD", "JOD")?.rate)
    assertEquals("3.1245", fakeDao.getLatestRate("USD", "TND")?.rate)
  }

  @Test
  fun `repository invalid API response does not overwrite cached data or count as successful refresh`() = runBlocking {
    val staleTimestamp = System.currentTimeMillis() - (24 * 60 * 60 * 1000L)
    fakeDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.9100",
      effectiveDate = "2024-11-06",
      fetchedAt = staleTimestamp,
      source = "open_er_api"
    )

    val invalidPayloads = listOf(
      """{"result":"error","base_code":"GBP","rates":{"EUR":0.50}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":0.99,"INR":0}}""",
      """{"result":"success","base_code":"USD","rates":{"EUR":0.99,"ZZZ":1.23}}"""
    )

    for (payload in invalidPayloads) {
      val invalidApiRepo = createRepositoryFromJson(payload)

      // With offline cache disallowed, invalid API refresh must not return stale or invalid rate
      val liveResult = invalidApiRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false)
      assertNull(liveResult)

      // Cached entry in DAO must remain untouched (not overwritten, timestamp unchanged)
      val daoEntry = fakeDao.getLatestRate("USD", "EUR")
      assertNotNull(daoEntry)
      assertEquals("0.9100", daoEntry!!.rate)
      assertEquals(staleTimestamp, daoEntry.fetchedAt)

      // With offline cache allowed, falls back to stale cache instead of overwriting with partial/invalid data
      invalidApiRepo.clearMemoryCache()
      val staleFallback = invalidApiRepo.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
      assertNotNull(staleFallback)
      assertEquals(BigDecimal("0.9100"), staleFallback!!.rate)
      assertEquals("open_er_api_stale", staleFallback.source)
    }
  }

  private fun createRepositoryFromJson(json: String): OfflineFirstExchangeRateRepository {
    val apiService = object : ExchangeRateApiService {
      override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto {
        return ExchangeRateApiClient.parseResponse(json)
      }
    }
    return OfflineFirstExchangeRateRepository(fakeDao, fakeManualDao, apiService)
  }

  private fun createRepositoryFromDto(dto: ExchangeRateResponseDto): OfflineFirstExchangeRateRepository {
    val apiService = object : ExchangeRateApiService {
      override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto = dto
    }
    return OfflineFirstExchangeRateRepository(fakeDao, fakeManualDao, apiService)
  }

  private suspend fun assertThrowsInvalidResponse(block: suspend () -> Unit) {
    try {
      block()
      fail("Expected InvalidExchangeRateResponseException")
    } catch (_: InvalidExchangeRateResponseException) {
      // expected
    }
  }

  private class FakeExchangeRateDao : ExchangeRateDao {
    val rates = mutableMapOf<String, ExchangeRateEntity>()

    override suspend fun getLatestRate(from: String, to: String): ExchangeRateEntity? =
      rates["${from}_$to"]

    override suspend fun getHistoricalRate(from: String, to: String, date: String): ExchangeRateEntity? =
      rates["${from}_$to"]

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

  private class FakeManualExchangeRateDao : ManualExchangeRateDao {
    val manualRates = mutableMapOf<Triple<String, String, Long>, ManualExchangeRateEntity>()

    override suspend fun insertManualRate(rate: ManualExchangeRateEntity) {
      manualRates[Triple(rate.fromCurrency, rate.toCurrency, rate.effectiveFrom)] = rate
    }

    override suspend fun insertManualRates(rates: List<ManualExchangeRateEntity>) {
      rates.forEach { manualRates[Triple(it.fromCurrency, it.toCurrency, it.effectiveFrom)] = it }
    }

    override suspend fun getManualRateForPeriod(
      from: String,
      to: String,
      effectiveFrom: Long
    ): ManualExchangeRateEntity? = manualRates[Triple(from, to, effectiveFrom)]

    override suspend fun getManualRatesForPair(from: String, to: String): List<ManualExchangeRateEntity> =
      manualRates.values
        .filter { it.fromCurrency == from && it.toCurrency == to }
        .sortedBy { it.effectiveFrom }

    override suspend fun getApplicableManualRate(
      from: String,
      to: String,
      timestamp: Long
    ): ManualExchangeRateEntity? =
      manualRates.values
        .filter { it.fromCurrency == from && it.toCurrency == to && it.isApplicableAt(timestamp) }
        .maxByOrNull { it.effectiveFrom }

    override fun observeManualRatesForPair(from: String, to: String) =
      flowOf(
        manualRates.values
          .filter { it.fromCurrency == from && it.toCurrency == to }
          .sortedByDescending { it.effectiveFrom }
      )

    override fun observeAllManualRates() =
      flowOf(
        manualRates.values.sortedWith(
          compareBy<ManualExchangeRateEntity> { it.fromCurrency }
            .thenBy { it.toCurrency }
            .thenBy { it.effectiveFrom }
        )
      )

    override suspend fun getAllManualRates(): List<ManualExchangeRateEntity> =
      manualRates.values.sortedWith(
        compareBy<ManualExchangeRateEntity> { it.fromCurrency }
          .thenBy { it.toCurrency }
          .thenBy { it.effectiveFrom }
      )

    override suspend fun deleteManualRatePeriod(from: String, to: String, effectiveFrom: Long) {
      manualRates.remove(Triple(from, to, effectiveFrom))
    }

    override suspend fun deleteManualRatesForPair(from: String, to: String) {
      manualRates.keys.removeAll { it.first == from && it.second == to }
    }

    override suspend fun clearAll() {
      manualRates.clear()
    }
  }
}
