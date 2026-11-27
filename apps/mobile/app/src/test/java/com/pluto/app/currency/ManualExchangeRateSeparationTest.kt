package com.pluto.app.currency

import com.pluto.app.data.local.exchange.ExchangeRateDao
import com.pluto.app.data.local.exchange.ExchangeRateEntity
import com.pluto.app.data.local.exchange.ManualExchangeRateDao
import com.pluto.app.data.local.exchange.ManualExchangeRateEntity
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.data.repository.OverlappingManualRateWindowException
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateExpenseResult
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.UpdateExpenseResult
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.expense.FakeExpenseRepository
import com.pluto.app.onboarding.FakeUserSettingsRepository
import kotlinx.coroutines.flow.first
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

class ManualExchangeRateSeparationTest {

  private lateinit var apiDao: FakeExchangeRateDao
  private lateinit var manualDao: FakeManualExchangeRateDao
  private lateinit var apiService: CountingApiService
  private lateinit var repository: OfflineFirstExchangeRateRepository

  @Before
  fun setUp() {
    apiDao = FakeExchangeRateDao()
    manualDao = FakeManualExchangeRateDao()
    apiService = CountingApiService(
      mapOf(
        "EUR" to BigDecimal("0.920000"),
        "INR" to BigDecimal("84.500000")
      )
    )
    repository = OfflineFirstExchangeRateRepository(apiDao, manualDao, apiService)
  }

  @Test
  fun `manual rate CRUD and BigDecimal precision preservation`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val highPrecisionRate = BigDecimal("0.123456789123")
    repository.setManualOverride(Currency.USD, Currency.EUR, highPrecisionRate, effectiveFrom = t1, expiresAt = null)

    val storedDirect = manualDao.getManualRateForPeriod("USD", "EUR", t1)
    assertNotNull(storedDirect)
    assertEquals("0.123456789123", storedDirect!!.rate)
    assertEquals("manual_override", storedDirect.source)

    val retrieved = repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t1)
    assertNotNull(retrieved)
    assertEquals(highPrecisionRate, retrieved!!.rate)
    assertEquals("0.123456789123", retrieved.rate.toPlainString())

    // Update exact period (USD, EUR, t1) in place cleanly without duplicate rows
    val updatedPrecision = BigDecimal("0.987654321098765")
    repository.setManualOverride(Currency.USD, Currency.EUR, updatedPrecision, effectiveFrom = t1, expiresAt = null)
    assertEquals(2, manualDao.getAllManualRates().size) // direct + inverse for period t1
    assertEquals("0.987654321098765", repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t1)?.rate?.toPlainString())

    // Delete manual override
    repository.clearManualOverride(Currency.USD, Currency.EUR)
    assertTrue(manualDao.getAllManualRates().isEmpty())
    assertNull(repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t1))
  }

  @Test
  fun `active manual override wins over fresh API cache and avoids network request`() = runBlocking {
    val now = System.currentTimeMillis()
    apiDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.9100",
      effectiveDate = "2026-11-25",
      fetchedAt = now,
      source = "open_er_api"
    )

    // Warm memory cache with API rate first
    val cachedApi = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertEquals(BigDecimal("0.9100"), cachedApi?.rate)
    assertEquals(0, apiService.callCount)

    // Set manual override; must win immediately over both LRU memory cache and Room API cache
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.9650"))

    val resolvedOffline = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertEquals(BigDecimal("0.9650"), resolvedOffline?.rate)
    assertEquals("manual_override", resolvedOffline?.source)

    // Even with allowOfflineCache = false, active manual override wins and triggers zero network calls
    val resolvedLive = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false)
    assertEquals(BigDecimal("0.9650"), resolvedLive?.rate)
    assertEquals("manual_override", resolvedLive?.source)
    assertEquals(0, apiService.callCount)

    // Reactive observer sees manual rate immediately
    val observed = repository.observeRate(Currency.USD, Currency.EUR).first()
    assertEquals(BigDecimal("0.9650"), observed?.rate)
  }

  @Test
  fun `API refresh never overwrites manual rates and manual rates never overwrite API cache`() = runBlocking {
    // 1. Seed fresh API cache
    val initialApi = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false)
    assertEquals(BigDecimal("0.920000"), initialApi?.rate)
    assertEquals(1, apiService.callCount)

    // 2. Add manual override: API cache must remain intact
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.9555"))
    assertEquals("0.920000", apiDao.getLatestRate("USD", "EUR")?.rate)
    assertEquals("open_er_api", apiDao.getLatestRate("USD", "EUR")?.source)

    // 3. Perform API refresh with changed market rates: manual override must remain intact
    apiService.rates = mapOf(
      "EUR" to BigDecimal("0.880000"),
      "INR" to BigDecimal("85.100000")
    )
    repository.fetchAndCacheLatestRates(Currency.USD)

    assertEquals("0.880000", apiDao.getLatestRate("USD", "EUR")?.rate)
    assertEquals("0.9555", manualDao.getManualRatesForPair("USD", "EUR").lastOrNull()?.rate)
    assertEquals(BigDecimal("0.9555"), repository.getRate(Currency.USD, Currency.EUR)?.rate)

    // 4. Deleting manual override exposes the refreshed API rate cleanly
    repository.clearManualOverride(Currency.USD, Currency.EUR)
    assertTrue(manualDao.getManualRatesForPair("USD", "EUR").isEmpty())
    val afterClear = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertEquals(BigDecimal("0.880000"), afterClear?.rate)
    assertEquals("open_er_api", afterClear?.source)
  }

  @Test
  fun `expired manual rate does not win and falls back to fresh API cache or live API`() = runBlocking {
    val now = System.currentTimeMillis()
    apiDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.9150",
      effectiveDate = "2026-11-25",
      fetchedAt = now,
      source = "open_er_api"
    )

    repository.setManualOverride(
      from = Currency.USD,
      to = Currency.EUR,
      rate = BigDecimal("0.9900"),
      effectiveFrom = now - 120_000L,
      expiresAt = now - 1_000L
    )

    assertNull(repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = now))
    assertTrue(repository.getManualOverrides().isEmpty())

    val resolved = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertEquals(BigDecimal("0.9150"), resolved?.rate)
    assertEquals("open_er_api", resolved?.source)

    // Lookup for a historical transaction timestamp inside the active window still resolves the manual override
    val historicalInsideWindow = repository.getHistoricalRate(Currency.USD, Currency.EUR, now - 60_000L)
    assertEquals(BigDecimal("0.9900"), historicalInsideWindow?.rate)
    assertEquals("manual_override", historicalInsideWindow?.source)
  }

  @Test
  fun `future-dated manual rate does not win now or override earlier historical transactions`() = runBlocking {
    val now = System.currentTimeMillis()
    val tomorrow = now + 86_400_000L
    val yesterday = now - 86_400_000L

    val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
    apiDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.9100",
      effectiveDate = dateFormat.format(java.util.Date(yesterday)),
      fetchedAt = now,
      source = "open_er_api"
    )

    repository.setManualOverride(
      from = Currency.USD,
      to = Currency.EUR,
      rate = BigDecimal("1.2500"),
      effectiveFrom = tomorrow,
      expiresAt = null
    )

    // Current lookup must ignore future-dated manual rate
    val currentRate = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertEquals(BigDecimal("0.9100"), currentRate?.rate)
    assertEquals("open_er_api", currentRate?.source)

    // Historical transaction from yesterday must NOT be overridden by future-dated manual rate
    val earlierTxRate = repository.getHistoricalRate(Currency.USD, Currency.EUR, yesterday)
    assertEquals(BigDecimal("0.9100"), earlierTxRate?.rate)
    assertEquals("open_er_api", earlierTxRate?.source)

    // Lookup for the future effective timestamp uses the scheduled manual rate
    assertEquals(
      BigDecimal("1.2500"),
      repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = tomorrow + 1000L)?.rate
    )
  }

  @Test
  fun `falls back to stale and inverse API cache when manual override is inactive and API fails`() = runBlocking {
    val staleTime = System.currentTimeMillis() - (48 * 60 * 60 * 1000L)
    apiService.shouldThrow = true

    // Expired manual override must not block stale cache fallback
    repository.setManualOverride(
      from = Currency.USD,
      to = Currency.EUR,
      rate = BigDecimal("0.9999"),
      effectiveFrom = staleTime - 10_000L,
      expiresAt = staleTime
    )

    apiDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.9050",
      effectiveDate = "2026-11-23",
      fetchedAt = staleTime,
      source = "open_er_api"
    )

    val staleFallback = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertEquals(BigDecimal("0.9050"), staleFallback?.rate)
    assertEquals("open_er_api_stale", staleFallback?.source)

    // Inverse API cache fallback when only GBP -> JPY is in API cache and API is unreachable
    apiDao.rates["GBP_JPY"] = ExchangeRateEntity(
      fromCurrency = "GBP",
      toCurrency = "JPY",
      rate = "200.00",
      effectiveDate = "2026-11-23",
      fetchedAt = System.currentTimeMillis(),
      source = "open_er_api"
    )
    val inverseFallback = repository.getRate(Currency.JPY, Currency.GBP, allowOfflineCache = true)
    assertNotNull(inverseFallback)
    assertEquals(0, BigDecimal("0.005").compareTo(inverseFallback!!.rate))
    assertEquals("derived_inverse_cached", inverseFallback.source)
  }

  @Test
  fun `existing expense snapshots remain immutable after adding, updating, or deleting manual rates`() = runBlocking {
    val expenseRepo = FakeExpenseRepository()
    val settingsRepo = FakeUserSettingsRepository(
      UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR, isOnboardingCompleted = true)
    )
    val convertUseCase = ConvertCurrencyUseCase(repository)
    val createExpenseUseCase = CreateExpenseUseCase(expenseRepo, settingsRepo, convertUseCase)
    val updateExpenseUseCase = UpdateExpenseUseCase(expenseRepo, settingsRepo, convertUseCase)

    // Create expense using initial API rate (1 EUR -> 1.10 USD)
    apiDao.rates["EUR_USD"] = ExchangeRateEntity(
      fromCurrency = "EUR",
      toCurrency = "USD",
      rate = "1.1000",
      effectiveDate = "2026-11-25",
      fetchedAt = System.currentTimeMillis(),
      source = "open_er_api"
    )
    val createdResult = createExpenseUseCase(
      amount = BigDecimal("100.00"),
      currency = Currency.EUR,
      category = Category.FOOD,
      merchant = "Bistro"
    )
    assertTrue(createdResult is CreateExpenseResult.Success)
    val created = (createdResult as CreateExpenseResult.Success).expense
    assertEquals(BigDecimal("110.00"), created.homeAmount.amount)
    assertEquals(BigDecimal("1.1000"), created.exchangeRate.rate)
    assertEquals("open_er_api", created.exchangeRate.source)

    // Add, update, and delete manual overrides
    repository.setManualOverride(Currency.EUR, Currency.USD, BigDecimal("1.2500"))
    repository.setManualOverride(Currency.EUR, Currency.USD, BigDecimal("1.3000"))
    repository.clearManualOverride(Currency.EUR, Currency.USD)

    // Existing stored expense snapshot must remain untouched
    val storedAfterChanges = expenseRepo.getExpenseById(created.id)!!
    assertEquals(BigDecimal("110.00"), storedAfterChanges.homeAmount.amount)
    assertEquals(BigDecimal("1.1000"), storedAfterChanges.exchangeRate.rate)
    assertEquals("open_er_api", storedAfterChanges.exchangeRate.source)

    // Metadata-only edit while a different manual override is active must still preserve snapshot
    repository.setManualOverride(Currency.EUR, Currency.USD, BigDecimal("1.4000"))
    val metadataUpdate = updateExpenseUseCase(
      existingExpense = storedAfterChanges,
      newAmount = storedAfterChanges.originalAmount.amount,
      newCurrency = storedAfterChanges.originalCurrency,
      newCategory = Category.SHOPPING,
      newTimestamp = storedAfterChanges.timestamp,
      newMerchant = "Bistro Updated",
      newNote = "Receipt added"
    )
    assertTrue(metadataUpdate is UpdateExpenseResult.Success)
    val updatedExpense = (metadataUpdate as UpdateExpenseResult.Success).expense
    assertEquals(BigDecimal("110.00"), updatedExpense.homeAmount.amount)
    assertEquals(BigDecimal("1.1000"), updatedExpense.exchangeRate.rate)
    assertEquals("open_er_api", updatedExpense.exchangeRate.source)
  }

  @Test
  fun `rejects invalid manual rate inputs`() = runBlocking {
    try {
      repository.setManualOverride(Currency.USD, Currency.USD, BigDecimal("1.0"))
      fail("Expected IllegalArgumentException for identical currencies")
    } catch (_: IllegalArgumentException) {
      // expected
    }

    try {
      repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal.ZERO)
      fail("Expected IllegalArgumentException for zero rate")
    } catch (_: IllegalArgumentException) {
      // expected
    }

    try {
      repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("-0.5"))
      fail("Expected IllegalArgumentException for negative rate")
    } catch (_: IllegalArgumentException) {
      // expected
    }

    try {
      repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.95"), effectiveFrom = 2000L, expiresAt = 1000L)
      fail("Expected IllegalArgumentException when expiresAt precedes effectiveFrom")
    } catch (_: IllegalArgumentException) {
      // expected
    }

    try {
      repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.95"), effectiveFrom = 2000L, expiresAt = 2000L)
      fail("Expected IllegalArgumentException when expiresAt equals effectiveFrom (exclusive)")
    } catch (_: IllegalArgumentException) {
      // expected
    }

    assertTrue(manualDao.getAllManualRates().isEmpty())
  }

  @Test
  fun `multiple non-overlapping effective periods coexist and resolve accurately by timestamp`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val t2 = 1_700_100_000_000L
    val t3 = 1_700_200_000_000L

    apiDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.9000",
      effectiveDate = "2023-11-15",
      fetchedAt = t2,
      source = "open_er_api"
    )

    // Three adjacent half-open windows: [t1, t2), [t2, t3), [t3, null)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.91"), effectiveFrom = t1, expiresAt = t2)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.93"), effectiveFrom = t2, expiresAt = t3)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.95"), effectiveFrom = t3, expiresAt = null)

    val periods = repository.getManualOverridesForPair(Currency.USD, Currency.EUR)
    assertEquals(3, periods.size)
    assertEquals(listOf(BigDecimal("0.91"), BigDecimal("0.93"), BigDecimal("0.95")), periods.map { it.rate })

    // Verify exact boundaries: effectiveFrom is inclusive, expiresAt is exclusive
    assertNull(repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t1 - 1L))
    assertEquals(BigDecimal("0.91"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t1)?.rate)
    assertEquals(BigDecimal("0.91"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t2 - 1L)?.rate)
    assertEquals(BigDecimal("0.93"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t2)?.rate)
    assertEquals(BigDecimal("0.93"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t3 - 1L)?.rate)
    assertEquals(BigDecimal("0.95"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t3)?.rate)
    assertEquals(BigDecimal("0.95"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t3 + 500_000L)?.rate)
  }

  @Test
  fun `expiresAt is strictly exclusive when no subsequent period exists`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val t2 = 1_700_050_000_000L
    val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
    apiDao.rates["USD_EUR"] = ExchangeRateEntity(
      fromCurrency = "USD",
      toCurrency = "EUR",
      rate = "0.8900",
      effectiveDate = dateFormat.format(java.util.Date(t2)),
      fetchedAt = t2,
      source = "open_er_api"
    )

    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.97"), effectiveFrom = t1, expiresAt = t2)

    assertEquals(BigDecimal("0.97"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t2 - 1L)?.rate)
    assertNull(repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t2))
    assertEquals(BigDecimal("0.8900"), repository.getHistoricalRate(Currency.USD, Currency.EUR, t2)?.rate)
  }

  @Test
  fun `overlapping manual rate windows are rejected deterministically without mutating existing periods`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val t2 = 1_700_100_000_000L
    val t3 = 1_700_200_000_000L

    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.91"), effectiveFrom = t1, expiresAt = t2)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.95"), effectiveFrom = t3, expiresAt = null)

    val overlappingAttempts = listOf(
      // Partial overlap across t1..t2
      Triple(Currency.USD, Currency.EUR, (t1 + 10_000L) to (t2 + 10_000L)),
      // Contained inside [t1, t2)
      Triple(Currency.USD, Currency.EUR, (t1 + 5_000L) to (t2 - 5_000L)),
      // Enclosing [t1, t2)
      Triple(Currency.USD, Currency.EUR, (t1 - 5_000L) to (t2 + 5_000L)),
      // Open-ended overlapping [t3, null)
      Triple(Currency.USD, Currency.EUR, (t2 + 10_000L) to null),
      // Inverse direction overlapping [t1, t2)
      Triple(Currency.EUR, Currency.USD, (t1 + 1_000L) to (t2 - 1_000L))
    )

    for ((from, to, bounds) in overlappingAttempts) {
      try {
        repository.setManualOverride(from, to, BigDecimal("0.99"), effectiveFrom = bounds.first, expiresAt = bounds.second)
        fail("Expected OverlappingManualRateWindowException for [${bounds.first}, ${bounds.second})")
      } catch (_: OverlappingManualRateWindowException) {
        // expected
      }
    }

    // Existing periods remain untouched
    val stored = repository.getManualOverridesForPair(Currency.USD, Currency.EUR)
    assertEquals(2, stored.size)
    assertEquals(listOf(BigDecimal("0.91"), BigDecimal("0.95")), stored.map { it.rate })
  }

  @Test
  fun `editing or deleting one effective period leaves other periods intact`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val t2 = 1_700_100_000_000L
    val t3 = 1_700_200_000_000L

    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.91"), effectiveFrom = t1, expiresAt = t2)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.93"), effectiveFrom = t2, expiresAt = t3)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.95"), effectiveFrom = t3, expiresAt = null)

    // Edit middle period [t2, t3) in place (adjusting rate and shrinking end to t3 - 10_000)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.935"), effectiveFrom = t2, expiresAt = t3 - 10_000L)

    assertEquals(BigDecimal("0.91"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t1)?.rate)
    assertEquals(BigDecimal("0.935"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t2)?.rate)
    assertNull(repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t3 - 5_000L))
    assertEquals(BigDecimal("0.95"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t3)?.rate)

    // Attempting to expand period 2 past t3 into period 3 must be rejected
    try {
      repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.935"), effectiveFrom = t2, expiresAt = t3 + 1_000L)
      fail("Expected OverlappingManualRateWindowException when expanding period into next period")
    } catch (_: OverlappingManualRateWindowException) {
      // expected
    }

    // Delete ONLY the middle period [t2, ...) -> periods t1 and t3 survive intact
    repository.clearManualOverride(Currency.USD, Currency.EUR, effectiveFrom = t2)

    val remaining = repository.getManualOverridesForPair(Currency.USD, Currency.EUR)
    assertEquals(2, remaining.size)
    assertEquals(listOf(BigDecimal("0.91"), BigDecimal("0.95")), remaining.map { it.rate })
    assertEquals(BigDecimal("0.91"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t1)?.rate)
    assertNull(repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t2))
    assertEquals(BigDecimal("0.95"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = t3)?.rate)
  }

  @Test
  fun `three-arg setManualOverride closes previous open-ended period to preserve history`() = runBlocking {
    val pastOpen = System.currentTimeMillis() - 60_000L
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.91"), effectiveFrom = pastOpen, expiresAt = null)

    // Setting a current override via 3-arg convenience closes [pastOpen, null) at [pastOpen, now) and inserts [now, null)
    repository.setManualOverride(Currency.USD, Currency.EUR, BigDecimal("0.96"))

    val periods = repository.getManualOverridesForPair(Currency.USD, Currency.EUR)
    assertEquals(2, periods.size)
    assertEquals(BigDecimal("0.91"), repository.getManualOverride(Currency.USD, Currency.EUR, atTimestamp = pastOpen + 1_000L)?.rate)
    assertEquals(BigDecimal("0.96"), repository.getManualOverride(Currency.USD, Currency.EUR)?.rate)
  }

  @Test
  fun `reciprocal manual rate resolution preserves high BigDecimal precision without premature rounding`() = runBlocking {
    val t1 = 1_700_000_000_000L
    val extremeRate = BigDecimal("1500000000000") // 1.5e12: 8-digit scale would prematurely round 1/rate to 0
    repository.setManualOverride(Currency.USD, Currency.JPY, extremeRate, effectiveFrom = t1, expiresAt = null)

    val storedInverse = manualDao.getManualRateForPeriod("JPY", "USD", t1)
    assertNotNull(storedInverse)
    val storedInverseBd = BigDecimal(storedInverse!!.rate)
    assertTrue("Reciprocal must remain strictly positive", storedInverseBd.compareTo(BigDecimal.ZERO) > 0)
    // Product rate * (1 / rate) stays accurate within DECIMAL128 precision (~1e-30)
    val product = extremeRate.multiply(storedInverseBd)
    val error = BigDecimal.ONE.subtract(product).abs()
    assertTrue("Expected < 1e-30 relative error, got $error", error < BigDecimal("1E-30"))

    // Verify dynamic derivation via deriveInverseManualRate when direct row is absent
    manualDao.manualRates.remove(Triple("JPY", "USD", t1))
    val derivedInverse = repository.getManualOverride(Currency.JPY, Currency.USD, atTimestamp = t1)
    assertNotNull(derivedInverse)
    assertTrue(derivedInverse!!.rate.compareTo(BigDecimal.ZERO) > 0)
    val derivedError = BigDecimal.ONE.subtract(extremeRate.multiply(derivedInverse.rate)).abs()
    assertTrue("Expected < 1e-30 relative error on derived inverse, got $derivedError", derivedError < BigDecimal("1E-30"))
  }

  private class CountingApiService(
    var rates: Map<String, BigDecimal>,
    var shouldThrow: Boolean = false
  ) : ExchangeRateApiService {
    var callCount: Int = 0

    override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto {
      callCount++
      if (shouldThrow) {
        throw IllegalStateException("Offline simulated")
      }
      return ExchangeRateResponseDto(
        result = "success",
        baseCode = baseCurrency,
        timeLastUpdateUnix = System.currentTimeMillis() / 1000,
        timeLastUpdateUtc = "Wed, 25 Nov 2026 00:00:00 +0000",
        rates = rates
      )
    }
  }

  private class FakeExchangeRateDao : ExchangeRateDao {
    val rates = mutableMapOf<String, ExchangeRateEntity>()

    override suspend fun getLatestRate(from: String, to: String): ExchangeRateEntity? =
      rates["${from}_$to"]

    override suspend fun getHistoricalRate(from: String, to: String, date: String): ExchangeRateEntity? =
      rates["${from}_$to"]?.takeIf { it.effectiveDate == date }

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
