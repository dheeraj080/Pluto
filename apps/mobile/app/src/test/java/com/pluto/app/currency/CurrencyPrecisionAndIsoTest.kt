package com.pluto.app.currency

import com.pluto.app.data.remote.cloud.CloudUserSettings
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.ui.convert.ConverterUiState
import com.pluto.app.ui.convert.ConverterViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal
import java.util.Locale

@OptIn(ExperimentalCoroutinesApi::class)
class CurrencyPrecisionAndIsoTest {

  private val testDispatcher = StandardTestDispatcher()

  @Before
  fun setUp() {
    Dispatchers.setMain(testDispatcher)
  }

  @After
  fun tearDown() {
    Dispatchers.resetMain()
  }

  @Test
  fun `default currencies include zero two and three decimal ISO currencies`() {
    val codes = Currency.DEFAULT_CURRENCIES.map { it.code }.toSet()
    assertTrue(codes.containsAll(listOf("JPY", "KRW", "USD", "EUR", "GBP", "INR", "KWD", "BHD", "OMR", "JOD", "TND")))

    assertEquals(0, Currency.JPY.decimalPlaces)
    assertEquals(0, Currency.KRW.decimalPlaces)
    assertEquals(2, Currency.USD.decimalPlaces)
    assertEquals(2, Currency.EUR.decimalPlaces)
    assertEquals(2, Currency.GBP.decimalPlaces)
    assertEquals(2, Currency.INR.decimalPlaces)
    assertEquals(3, Currency.KWD.decimalPlaces)
    assertEquals(3, Currency.BHD.decimalPlaces)
    assertEquals(3, Currency.OMR.decimalPlaces)
    assertEquals(3, Currency.JOD.decimalPlaces)
    assertEquals(3, Currency.TND.decimalPlaces)
  }

  @Test
  fun `findByCode resolves non-default circulating ISO 4217 currencies via java util Currency`() {
    val aed = Currency.findByCode(" aed ")
    assertNotNull(aed)
    assertEquals("AED", aed?.code)
    assertEquals(2, aed?.decimalPlaces)

    val vnd = Currency.findByCode("VND")
    assertNotNull(vnd)
    assertEquals("VND", vnd?.code)
    assertEquals(0, vnd?.decimalPlaces)

    val iqd = Currency.findByCode("IQD")
    assertNotNull(iqd)
    assertEquals("IQD", iqd?.code)
    assertEquals(3, iqd?.decimalPlaces)
  }

  @Test
  fun `unknown or non-monetary currency codes are rejected explicitly without substituting USD`() {
    assertNull(Currency.findByCode(""))
    assertNull(Currency.findByCode("US"))
    assertNull(Currency.findByCode("123"))
    assertNull(Currency.findByCode("ZZZ"))
    assertNull(Currency.findByCode("XXX")) // Non-monetary ISO code (-1 fraction digits)

    val error = runCatching { Currency.requireByCode("ZZZ") }.exceptionOrNull()
    assertTrue(error is IllegalArgumentException)

    val cloudSettingsError = runCatching {
      CloudUserSettings(homeCurrencyCode = "ZZZ", destinationCurrencyCode = "EUR").toDomain()
    }.exceptionOrNull()
    assertTrue(cloudSettingsError is IllegalArgumentException)
  }

  @Test
  fun `money formatting and conversion preserve zero two and three decimal scales with HALF_EVEN`() {
    val jpy = Money.of("1500.5", Currency.JPY)
    assertEquals("1500", jpy.amount.toPlainString()) // HALF_EVEN: 1500.5 -> 1500
    assertEquals("¥1,500", jpy.format(Locale.US))

    val usd = Money.of("12.345", Currency.USD)
    assertEquals("12.34", usd.amount.toPlainString()) // HALF_EVEN: 12.345 -> 12.34
    assertEquals("$12.34", usd.format(Locale.US))

    val kwd = Money.of("12.3455", Currency.KWD)
    assertEquals("12.346", kwd.amount.toPlainString()) // HALF_EVEN: 12.3455 -> 12.346
    assertEquals("KD12.346", kwd.format(Locale.US))

    val usdToKwd = ExchangeRate(
      fromCurrency = Currency.USD,
      toCurrency = Currency.KWD,
      rate = BigDecimal("0.30750000"),
      source = "test"
    )
    val convertedKwd = usdToKwd.convert(Money.of("100.00", Currency.USD))
    assertEquals("30.750", convertedKwd.amount.toPlainString())
    assertEquals(Currency.KWD, convertedKwd.currency)

    val kwdToJpy = ExchangeRate(
      fromCurrency = Currency.KWD,
      toCurrency = Currency.JPY,
      rate = BigDecimal("495.12500000"),
      source = "test"
    )
    val convertedJpy = kwdToJpy.convert(Money.of("1.000", Currency.KWD))
    assertEquals("495", convertedJpy.amount.toPlainString())
  }

  @Test
  fun `currency input sanitization and scale normalization enforce decimalPlaces`() {
    assertEquals("0", Currency.JPY.zeroPlaceholder())
    assertEquals("0.00", Currency.USD.zeroPlaceholder())
    assertEquals("0.000", Currency.KWD.zeroPlaceholder())

    // 0-decimal rejects '.'
    assertNull(Currency.JPY.sanitizeAmountInput("1500."))
    assertEquals("1500", Currency.JPY.sanitizeAmountInput("1500"))

    // 2-decimal rejects 3rd decimal digit
    assertEquals("12.34", Currency.USD.sanitizeAmountInput("12.34"))
    assertNull(Currency.USD.sanitizeAmountInput("12.345"))

    // 3-decimal allows 3 decimal digits and rejects 4th
    assertEquals("12.345", Currency.KWD.sanitizeAmountInput("12.345"))
    assertNull(Currency.KWD.sanitizeAmountInput("12.3456"))

    // Switching scales rounds down excess fractional digits with HALF_EVEN
    assertEquals("12.34", Currency.USD.normalizeForScale("12.345"))
    assertEquals("12", Currency.JPY.normalizeForScale("12.345"))
    assertEquals("12.3", Currency.KWD.normalizeForScale("12.3"))
  }

  @Test
  fun `converter viewModel enforces source currency scale on input and currency swap`() = runTest {
    val repo = FakeExchangeRateRepository()
    repo.setRate(
      ExchangeRate(
        fromCurrency = Currency.KWD,
        toCurrency = Currency.JPY,
        rate = BigDecimal("500.00000000"),
        source = "test"
      )
    )
    val viewModel = ConverterViewModel(ConvertCurrencyUseCase(repo))
    viewModel.setSourceCurrency(Currency.KWD)
    viewModel.setTargetCurrency(Currency.JPY)

    // 3 decimals accepted for KWD, 4th decimal rejected
    viewModel.onAmountChanged("1.234")
    assertEquals("1.234", viewModel.amountInput.value)
    viewModel.onAmountChanged("1.2345")
    assertEquals("1.234", viewModel.amountInput.value)

    advanceUntilIdle()
    val state = viewModel.uiState.value as ConverterUiState.Success
    assertEquals("617", state.result.convertedMoney.amount.toPlainString())

    // Swap to JPY -> amount normalized to 0 decimals cleanly and '.' rejected
    viewModel.swapCurrencies()
    assertEquals("1", viewModel.amountInput.value)
    viewModel.onAmountChanged("100.")
    assertEquals("1", viewModel.amountInput.value)
  }
}
