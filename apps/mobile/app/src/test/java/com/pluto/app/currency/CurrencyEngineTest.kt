package com.pluto.app.currency

import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.repository.ExchangeRateRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.ui.convert.ConverterUiState
import com.pluto.app.ui.convert.ConverterViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class FakeExchangeRateRepository : ExchangeRateRepository {
  private val rates = mutableMapOf<Pair<String, String>, ExchangeRate>()
  private val historicalRates = mutableMapOf<Pair<String, String>, ExchangeRate>()
  private val ratesFlow = MutableStateFlow<List<ExchangeRate>>(emptyList())

  fun setRate(exchangeRate: ExchangeRate) {
    rates[Pair(exchangeRate.fromCurrency.code, exchangeRate.toCurrency.code)] = exchangeRate
    ratesFlow.value = rates.values.toList()
  }

  fun setHistoricalRate(exchangeRate: ExchangeRate) {
    historicalRates[Pair(exchangeRate.fromCurrency.code, exchangeRate.toCurrency.code)] = exchangeRate
  }

  fun clear() {
    rates.clear()
    historicalRates.clear()
    ratesFlow.value = emptyList()
  }

  override fun observeRate(from: Currency, to: Currency): Flow<ExchangeRate?> {
    return MutableStateFlow(rates[Pair(from.code, to.code)])
  }

  override suspend fun getRate(from: Currency, to: Currency, allowOfflineCache: Boolean): ExchangeRate? {
    if (from == to) return ExchangeRate.identity(from)
    return rates[Pair(from.code, to.code)]
  }

  override suspend fun getHistoricalRate(from: Currency, to: Currency, timestamp: Long): ExchangeRate? {
    if (from == to) return ExchangeRate.identity(from)
    return historicalRates[Pair(from.code, to.code)] ?: rates[Pair(from.code, to.code)]
  }

  override suspend fun saveRate(exchangeRate: ExchangeRate) {
    setRate(exchangeRate)
  }

  override fun observeAllRates(): Flow<List<ExchangeRate>> = ratesFlow.asStateFlow()
}

@OptIn(ExperimentalCoroutinesApi::class)
class CurrencyEngineTest {

  private val testDispatcher = StandardTestDispatcher()
  private lateinit var fakeRepository: FakeExchangeRateRepository
  private lateinit var useCase: ConvertCurrencyUseCase
  private lateinit var viewModel: ConverterViewModel

  @Before
  fun setUp() {
    Dispatchers.setMain(testDispatcher)
    fakeRepository = FakeExchangeRateRepository()
    useCase = ConvertCurrencyUseCase(fakeRepository)
  }

  @After
  fun tearDown() {
    Dispatchers.resetMain()
  }

  @Test
  fun `identity conversion converts EUR to EUR at 1 to 1 without repo lookup`() = runTest {
    val eur = Currency.EUR
    val money = Money.of("100.00", eur)

    val result = useCase(money, eur)
    assertTrue(result is ConversionResult.Success)
    val success = result as ConversionResult.Success
    assertEquals("100.00", success.convertedMoney.amount.toPlainString())
    assertEquals(eur, success.convertedMoney.currency)
    assertEquals(BigDecimal.ONE.setScale(8), success.exchangeRate.rate)
  }

  @Test
  fun `direct conversion converts EUR to INR accurately`() = runTest {
    val eur = Currency.EUR
    val inr = Currency.INR
    // Rate: 1 EUR = 95.50 INR
    fakeRepository.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = inr,
        rate = BigDecimal("95.50000000"),
        source = "test"
      )
    )

    val money = Money.of("50.00", eur)
    val result = useCase(money, inr)
    assertTrue(result is ConversionResult.Success)
    val success = result as ConversionResult.Success

    // 50 * 95.50 = 4775.00
    assertEquals("4775.00", success.convertedMoney.amount.toPlainString())
    assertEquals("INR", success.convertedMoney.currency.code)
  }

  @Test
  fun `inverse conversion automatically derives INR to EUR when only EUR to INR is stored`() = runTest {
    val eur = Currency.EUR
    val inr = Currency.INR

    fakeRepository.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = inr,
        rate = BigDecimal("100.00000000"),
        source = "test"
      )
    )

    // Convert 5000 INR to EUR (should be 50.00 EUR)
    val inrMoney = Money.of("5000.00", inr)
    val result = useCase(inrMoney, eur)

    assertTrue(result is ConversionResult.Success)
    val success = result as ConversionResult.Success
    assertEquals("50.00", success.convertedMoney.amount.toPlainString())
    assertEquals(eur, success.convertedMoney.currency)
  }

  @Test
  fun `missing rate returns RateUnavailable without inventing fake values`() = runTest {
    val eur = Currency.EUR
    val jpy = Currency.JPY

    val money = Money.of("20.00", eur)
    val result = useCase(money, jpy)

    assertTrue(result is ConversionResult.RateUnavailable)
    val unavailable = result as ConversionResult.RateUnavailable
    assertEquals(eur, unavailable.fromCurrency)
    assertEquals(jpy, unavailable.toCurrency)
  }

  @Test
  fun `converter viewModel reactive swap reverses currencies and calculates result`() = runTest {
    fakeRepository.setRate(
      ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.INR,
        rate = BigDecimal("100.00000000"),
        source = "test"
      )
    )

    viewModel = ConverterViewModel(
      convertCurrencyUseCase = useCase,
      initialSourceCurrency = Currency.EUR,
      initialTargetCurrency = Currency.INR
    )
    viewModel.onAmountChanged("100")
    advanceUntilIdle()

    assertTrue(viewModel.uiState.value is ConverterUiState.Success)
    val success = viewModel.uiState.value as ConverterUiState.Success
    assertEquals("₹10,000.00", success.result.convertedMoney.format())

    // Perform swap: EUR -> INR becomes INR -> EUR
    viewModel.swapCurrencies()
    advanceUntilIdle()

    assertEquals(Currency.INR, viewModel.sourceCurrency.value)
    assertEquals(Currency.EUR, viewModel.targetCurrency.value)
    assertTrue(viewModel.uiState.value is ConverterUiState.Success)
    val swapSuccess = viewModel.uiState.value as ConverterUiState.Success
    assertEquals("€1.00", swapSuccess.result.convertedMoney.format())
  }

  @Test
  fun `converter viewModel invalid amount produces error state safely`() = runTest {
    viewModel = ConverterViewModel(useCase)
    viewModel.onAmountChanged("")
    advanceUntilIdle()

    assertEquals(ConverterUiState.Idle, viewModel.uiState.value)
  }
}
