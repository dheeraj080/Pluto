package com.pluto.app.currency

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.remote.exchange.ExchangeRateApiService
import com.pluto.app.data.remote.exchange.ExchangeRateResponseDto
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.domain.model.Currency
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.math.BigDecimal

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ManualRateOverridesTest {

  private lateinit var database: AppDatabase
  private lateinit var repository: OfflineFirstExchangeRateRepository

  private val mockApiService = object : ExchangeRateApiService {
    override suspend fun getLatestRates(baseCurrency: String): ExchangeRateResponseDto {
      return ExchangeRateResponseDto(
        result = "success",
        baseCode = baseCurrency,
        timeLastUpdateUnix = 1000L,
        timeLastUpdateUtc = "2026-11-10",
        rates = mapOf(
          "EUR" to BigDecimal("0.90"),
          "USD" to BigDecimal("1.10")
        )
      )
    }
  }

  @Before
  fun setup() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
      .allowMainThreadQueries()
      .build()
    repository = OfflineFirstExchangeRateRepository(
      dao = database.exchangeRateDao(),
      manualDao = database.manualExchangeRateDao(),
      apiService = mockApiService
    )
  }

  @After
  fun tearDown() {
    database.close()
  }

  @Test
  fun `setManualOverride sets direct and reciprocal rate in manual table without polluting API cache`() = runBlocking {
    // Seed API cache first
    val marketRate = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = false)
    assertNotNull(marketRate)
    assertEquals(0, BigDecimal("0.90").compareTo(marketRate!!.rate))

    // Set custom street rate: 1 USD = 0.9500 EUR
    val customRate = BigDecimal("0.9500")
    repository.setManualOverride(Currency.USD, Currency.EUR, customRate)

    // Direct rate check wins over API cache
    val rate = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertNotNull(rate)
    assertEquals(0, customRate.compareTo(rate!!.rate))
    assertEquals("manual_override", rate.source)

    // Verify manual override was NOT written into exchange_rates API cache
    val cachedApiEntry = database.exchangeRateDao().getLatestRate("USD", "EUR")
    assertNotNull(cachedApiEntry)
    assertEquals("open_er_api", cachedApiEntry!!.source)
    assertEquals(0, BigDecimal("0.90").compareTo(BigDecimal(cachedApiEntry.rate)))

    // Check active overrides list
    val overrides = repository.getManualOverrides()
    assertTrue(overrides.isNotEmpty())
    assertEquals(2, database.manualExchangeRateDao().getAllManualRates().size)

    // Clear override
    repository.clearManualOverride(Currency.USD, Currency.EUR)
    val afterClear = repository.getManualOverrides()
    assertTrue(afterClear.isEmpty())
    assertTrue(database.manualExchangeRateDao().getAllManualRates().isEmpty())
  }
}
