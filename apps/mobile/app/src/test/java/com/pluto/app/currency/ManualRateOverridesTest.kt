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
        rates = mapOf("EUR" to 0.90, "USD" to 1.10)
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
      apiService = mockApiService
    )
  }

  @After
  fun tearDown() {
    database.close()
  }

  @Test
  fun `setManualOverride sets direct and reciprocal rate and overrides market rate`() = runBlocking {
    // Set custom street rate: 1 USD = 0.9500 EUR
    val customRate = BigDecimal("0.9500")
    repository.setManualOverride(Currency.USD, Currency.EUR, customRate)

    // Direct rate check
    val rate = repository.getRate(Currency.USD, Currency.EUR, allowOfflineCache = true)
    assertNotNull(rate)
    assertEquals(0, customRate.compareTo(rate!!.rate))
    assertEquals("manual_override", rate.source)

    // Check active overrides list
    val overrides = repository.getManualOverrides()
    assertTrue(overrides.isNotEmpty())

    // Clear override
    repository.clearManualOverride(Currency.USD, Currency.EUR)
    val afterClear = repository.getManualOverrides()
    assertTrue(afterClear.isEmpty())
  }
}
