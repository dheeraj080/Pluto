package com.pluto.app.wallet

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.WalletValuation
import com.pluto.app.domain.repository.CurrencyWalletRepository
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.DeleteCurrencyWalletUseCase
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.UpdateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.WalletOperationResult
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class FakeCurrencyWalletRepository : CurrencyWalletRepository {
  private val wallets = mutableMapOf<String, CurrencyWallet>()
  private val walletsFlow = MutableStateFlow<List<CurrencyWallet>>(emptyList())

  private fun emit() {
    walletsFlow.value = wallets.values.toList()
  }

  override fun observeAllWallets(): Flow<List<CurrencyWallet>> = walletsFlow.asStateFlow()

  override suspend fun getWalletByCurrency(currency: Currency): CurrencyWallet? {
    return wallets.values.find { it.currency.code == currency.code }
  }

  override suspend fun getWalletById(id: String): CurrencyWallet? = wallets[id]

  override suspend fun saveWallet(wallet: CurrencyWallet) {
    wallets[wallet.id] = wallet
    emit()
  }

  override suspend fun deleteWallet(id: String) {
    wallets.remove(id)
    emit()
  }
}

class WalletAndPortfolioTest {

  private lateinit var fakeWalletRepo: FakeCurrencyWalletRepository
  private lateinit var fakeExchangeRepo: FakeExchangeRateRepository
  private lateinit var createWalletUseCase: CreateCurrencyWalletUseCase
  private lateinit var updateWalletUseCase: UpdateCurrencyWalletUseCase
  private lateinit var deleteWalletUseCase: DeleteCurrencyWalletUseCase
  private lateinit var getPortfolioValuationUseCase: GetPortfolioValuationUseCase

  private val inr = Currency.INR
  private val eur = Currency.EUR
  private val usd = Currency.USD

  @Before
  fun setup() {
    fakeWalletRepo = FakeCurrencyWalletRepository()
    fakeExchangeRepo = FakeExchangeRateRepository()
    createWalletUseCase = CreateCurrencyWalletUseCase(fakeWalletRepo)
    updateWalletUseCase = UpdateCurrencyWalletUseCase(fakeWalletRepo)
    deleteWalletUseCase = DeleteCurrencyWalletUseCase(fakeWalletRepo)
    getPortfolioValuationUseCase = GetPortfolioValuationUseCase(fakeExchangeRepo)
  }

  @Test
  fun `create wallet successfully with non-negative balance`() = runTest {
    val result = createWalletUseCase(eur, BigDecimal("1000.00"))
    assertTrue(result is WalletOperationResult.Success)
    val wallet = (result as WalletOperationResult.Success).wallet

    assertEquals(eur, wallet.currency)
    assertEquals("1000.00", wallet.balance.amount.toPlainString())

    val fromRepo = fakeWalletRepo.getWalletByCurrency(eur)
    assertNotNull(fromRepo)
    assertEquals("1000.00", fromRepo?.balance?.amount?.toPlainString())
  }

  @Test
  fun `reject negative balance when creating wallet`() = runTest {
    val result = createWalletUseCase(eur, BigDecimal("-50.00"))
    assertTrue(result is WalletOperationResult.InvalidInput)
  }

  @Test
  fun `prevent duplicate wallet for the same currency`() = runTest {
    createWalletUseCase(eur, BigDecimal("500.00"))
    val duplicateResult = createWalletUseCase(eur, BigDecimal("300.00"))

    assertTrue(duplicateResult is WalletOperationResult.DuplicateCurrency)
    assertEquals(eur, (duplicateResult as WalletOperationResult.DuplicateCurrency).currency)
  }

  @Test
  fun `update wallet balance successfully`() = runTest {
    val createResult = createWalletUseCase(usd, BigDecimal("200.00"))
    val wallet = (createResult as WalletOperationResult.Success).wallet

    val updateResult = updateWalletUseCase(wallet.id, BigDecimal("750.50"))
    assertTrue(updateResult is WalletOperationResult.Success)

    val updated = (updateResult as WalletOperationResult.Success).wallet
    assertEquals(usd, updated.currency)
    assertEquals("750.50", updated.balance.amount.toPlainString())
  }

  @Test
  fun `delete wallet removes it from repository`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("100.00"))
    val wallet = (createResult as WalletOperationResult.Success).wallet

    assertNotNull(fakeWalletRepo.getWalletById(wallet.id))
    deleteWalletUseCase(wallet.id)
    assertNull(fakeWalletRepo.getWalletById(wallet.id))
  }

  @Test
  fun `portfolio valuation values same-currency wallet at 1 to 1 without network request`() = runTest {
    val inrWallet = CurrencyWallet.create(inr, BigDecimal("50000.00"))
    val summary = getPortfolioValuationUseCase(listOf(inrWallet), inr)

    assertEquals(1, summary.totalWalletsCount)
    assertEquals(1, summary.valuedWalletsCount)
    assertEquals("50000.00", summary.totalValuedHomeAmount.amount.toPlainString())
    assertEquals(inr, summary.totalValuedHomeAmount.currency)

    val valResult = summary.walletValuations.first() as WalletValuation.Valued
    assertTrue(valResult.isIdentity)
    assertEquals("50000.00", valResult.homeValue.amount.toPlainString())
    assertEquals("100.0", valResult.compositionPercentage.toPlainString())
  }

  @Test
  fun `portfolio valuation converts foreign wallets using current rates and calculates percentages`() = runTest {
    // 1 EUR = 100 INR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = inr,
        rate = BigDecimal("100.00000000"),
        source = "live_test"
      )
    )
    // 1 USD = 80 INR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = usd,
        toCurrency = inr,
        rate = BigDecimal("80.00000000"),
        source = "live_test"
      )
    )

    val eurWallet = CurrencyWallet.create(eur, BigDecimal("1000.00")) // => 100,000 INR
    val usdWallet = CurrencyWallet.create(usd, BigDecimal("500.00"))  // => 40,000 INR

    val summary = getPortfolioValuationUseCase(listOf(eurWallet, usdWallet), inr)

    assertEquals(2, summary.totalWalletsCount)
    assertEquals(2, summary.valuedWalletsCount)
    assertEquals(0, summary.unavailableWalletsCount)
    // Total = 100,000 + 40,000 = 140,000.00 INR
    assertEquals("140000.00", summary.totalValuedHomeAmount.amount.toPlainString())

    val eurValuation = summary.walletValuations.find { it.wallet.currency == eur } as WalletValuation.Valued
    assertEquals("100000.00", eurValuation.homeValue.amount.toPlainString())
    // 100000 / 140000 = 71.4%
    assertEquals("71.4", eurValuation.compositionPercentage.toPlainString())

    val usdValuation = summary.walletValuations.find { it.wallet.currency == usd } as WalletValuation.Valued
    assertEquals("40000.00", usdValuation.homeValue.amount.toPlainString())
    // 40000 / 140000 = 28.6%
    assertEquals("28.6", usdValuation.compositionPercentage.toPlainString())
  }

  @Test
  fun `missing exchange rate produces explicit unavailable state without fabricating values`() = runTest {
    // EUR has a rate, but USD does NOT
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = inr,
        rate = BigDecimal("100.00000000"),
        source = "live_test"
      )
    )

    val eurWallet = CurrencyWallet.create(eur, BigDecimal("1000.00")) // => 100,000 INR
    val usdWallet = CurrencyWallet.create(usd, BigDecimal("500.00"))  // => No rate

    val summary = getPortfolioValuationUseCase(listOf(eurWallet, usdWallet), inr)

    assertEquals(2, summary.totalWalletsCount)
    assertEquals(1, summary.valuedWalletsCount)
    assertEquals(1, summary.unavailableWalletsCount)
    assertTrue(summary.isPartiallyValued)
    assertFalse(summary.isFullyValued)

    assertEquals("100000.00", summary.totalValuedHomeAmount.amount.toPlainString())

    val usdValuation = summary.walletValuations.find { it.wallet.currency == usd }
    assertTrue(usdValuation is WalletValuation.Unavailable)
  }

  @Test
  fun `portfolio valuation calculates both primary destination and secondary home currency amounts`() = runTest {
    // 1 USD = 80 INR
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = usd,
        toCurrency = inr,
        rate = BigDecimal("80.00000000"),
        source = "test"
      )
    )
    // 1 INR = 0.011 EUR (so 1 USD = 0.88 EUR)
    fakeExchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = inr,
        toCurrency = eur,
        rate = BigDecimal("0.01100000"),
        source = "test"
      )
    )

    val usdWallet = CurrencyWallet.create(usd, BigDecimal("100.00")) // 100 USD = 8,000 INR
    val summary = getPortfolioValuationUseCase(
      wallets = listOf(usdWallet),
      homeCurrency = inr,
      destinationCurrency = eur
    )

    // Secondary: Home Currency (INR)
    assertEquals("8000.00", summary.totalValuedHomeAmount.amount.toPlainString())
    assertEquals(inr, summary.totalValuedHomeAmount.currency)

    // Primary: Destination Currency (EUR) = 8000 * 0.011 = 88.00 EUR
    assertNotNull(summary.totalValuedDestAmount)
    assertEquals("88.00", summary.totalValuedDestAmount?.amount?.toPlainString())
    assertEquals(eur, summary.totalValuedDestAmount?.currency)

    val valuation = summary.walletValuations.first() as WalletValuation.Valued
    assertEquals("8000.00", valuation.homeValue.amount.toPlainString())
    assertEquals("88.00", valuation.destValue?.amount?.toPlainString())
  }
}
