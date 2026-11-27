package com.pluto.app.wallet

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.repository.CurrencyWalletRepository
import com.pluto.app.domain.repository.WalletTransactionRepository
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.CreateWalletDepositUseCase
import com.pluto.app.domain.usecase.CreateWalletTransferUseCase
import com.pluto.app.domain.usecase.CreateWalletWithdrawalUseCase
import com.pluto.app.domain.usecase.DeleteCurrencyWalletUseCase
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.ObserveCurrencyWalletsUseCase
import com.pluto.app.domain.usecase.ObserveWalletTransactionsUseCase
import com.pluto.app.domain.usecase.UpdateCurrencyWalletUseCase
import com.pluto.app.onboarding.FakeUserSettingsRepository
import com.pluto.app.ui.wallet.WalletViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class WalletViewModelSubmissionGuardTest {

  private class SlowWalletRepo(
    private val delegate: FakeCurrencyWalletRepository,
    private val delayMillis: Long = 100L
  ) : CurrencyWalletRepository {
    val saveCount = AtomicInteger(0)
    override fun observeAllWallets(): Flow<List<CurrencyWallet>> = delegate.observeAllWallets()
    override suspend fun getWalletByCurrency(currency: Currency) = delegate.getWalletByCurrency(currency)
    override suspend fun getWalletById(id: String) = delegate.getWalletById(id)
    override suspend fun saveWallet(wallet: CurrencyWallet) {
      saveCount.incrementAndGet()
      delay(delayMillis)
      delegate.saveWallet(wallet)
    }
    override suspend fun deleteWallet(id: String) = delegate.deleteWallet(id)
  }

  private class SlowTxRepo(
    private val delegate: FakeWalletTransactionRepository,
    private val delayMillis: Long = 100L
  ) : WalletTransactionRepository {
    val depositCount = AtomicInteger(0)
    val withdrawCount = AtomicInteger(0)
    val transferCount = AtomicInteger(0)

    override fun observeTransactionsForWallet(walletId: String) = delegate.observeTransactionsForWallet(walletId)
    override fun observeAllTransactions() = delegate.observeAllTransactions()
    override suspend fun getTransactionsForWallet(walletId: String) = delegate.getTransactionsForWallet(walletId)
    override suspend fun deleteTransactionsForWallet(walletId: String) = delegate.deleteTransactionsForWallet(walletId)

    override suspend fun executeDeposit(wallet: CurrencyWallet, transaction: WalletTransaction) {
      depositCount.incrementAndGet()
      delay(delayMillis)
      delegate.executeDeposit(wallet, transaction)
    }

    override suspend fun executeWithdrawal(wallet: CurrencyWallet, transaction: WalletTransaction) {
      withdrawCount.incrementAndGet()
      delay(delayMillis)
      delegate.executeWithdrawal(wallet, transaction)
    }

    override suspend fun executeTransfer(
      sourceWallet: CurrencyWallet,
      sourceTransaction: WalletTransaction,
      destWallet: CurrencyWallet,
      destTransaction: WalletTransaction
    ) {
      transferCount.incrementAndGet()
      delay(delayMillis)
      delegate.executeTransfer(sourceWallet, sourceTransaction, destWallet, destTransaction)
    }
  }

  private fun createViewModel(
    walletRepo: CurrencyWalletRepository,
    txRepo: WalletTransactionRepository,
    exchangeRepo: FakeExchangeRateRepository = FakeExchangeRateRepository()
  ): WalletViewModel {
    val settingsRepo = FakeUserSettingsRepository(UserSettings(homeCurrency = Currency.USD, destinationCurrency = Currency.EUR))
    return WalletViewModel(
      observeCurrencyWalletsUseCase = ObserveCurrencyWalletsUseCase(walletRepo),
      createCurrencyWalletUseCase = CreateCurrencyWalletUseCase(walletRepo),
      updateCurrencyWalletUseCase = UpdateCurrencyWalletUseCase(walletRepo),
      deleteCurrencyWalletUseCase = DeleteCurrencyWalletUseCase(walletRepo),
      getPortfolioValuationUseCase = GetPortfolioValuationUseCase(exchangeRepo),
      createWalletDepositUseCase = CreateWalletDepositUseCase(walletRepo, txRepo),
      createWalletWithdrawalUseCase = CreateWalletWithdrawalUseCase(walletRepo, txRepo),
      createWalletTransferUseCase = CreateWalletTransferUseCase(walletRepo, txRepo, exchangeRepo),
      observeWalletTransactionsUseCase = ObserveWalletTransactionsUseCase(txRepo),
      userSettingsRepository = settingsRepo
    )
  }

  @Test
  fun `saveWallet guards against rapid double taps`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val baseWalletRepo = FakeCurrencyWalletRepository()
      val slowWalletRepo = SlowWalletRepo(baseWalletRepo)
      val txRepo = FakeWalletTransactionRepository(baseWalletRepo)
      val vm = createViewModel(slowWalletRepo, txRepo)

      vm.prepareCreateForm(Currency.EUR)
      vm.onBalanceChanged("500.00")

      var successCallbacks = 0
      vm.saveWallet { successCallbacks++ }
      vm.saveWallet { successCallbacks++ }
      advanceUntilIdle()

      assertEquals(1, slowWalletRepo.saveCount.get())
      assertEquals(1, successCallbacks)
      assertFalse(vm.formState.value.isSubmitting)
      assertEquals(BigDecimal("500.00"), baseWalletRepo.getWalletByCurrency(Currency.EUR)?.balance?.amount)
    } finally {
      Dispatchers.resetMain()
    }
  }

  @Test
  fun `deposit withdraw and transfer ignore overlapping calls and surface errors`() = runTest {
    val dispatcher = StandardTestDispatcher(testScheduler)
    Dispatchers.setMain(dispatcher)
    try {
      val baseWalletRepo = FakeCurrencyWalletRepository()
      val baseTxRepo = FakeWalletTransactionRepository(baseWalletRepo)
      val slowTxRepo = SlowTxRepo(baseTxRepo)
      val exchangeRepo = FakeExchangeRateRepository()
      exchangeRepo.setRate(ExchangeRate(Currency.USD, Currency.EUR, BigDecimal("0.90000000"), source = "test"))

      val wUsd = CurrencyWallet.create(Currency.USD, BigDecimal("1000.00"))
      val wEur = CurrencyWallet.create(Currency.EUR, BigDecimal("100.00"))
      baseWalletRepo.saveWallet(wUsd)
      baseWalletRepo.saveWallet(wEur)

      val vm = createViewModel(baseWalletRepo, slowTxRepo, exchangeRepo)

      // 1. Double deposit -> only one executed
      var depositSuccesses = 0
      vm.deposit(wUsd.id, BigDecimal("250.00"), "Bonus", onSuccess = { depositSuccesses++ }, onError = {})
      assertTrue(vm.isTransactionSubmitting.value)
      vm.deposit(wUsd.id, BigDecimal("250.00"), "Duplicate", onSuccess = { depositSuccesses++ }, onError = {})
      advanceUntilIdle()

      assertEquals(1, slowTxRepo.depositCount.get())
      assertEquals(1, depositSuccesses)
      assertFalse(vm.isTransactionSubmitting.value)
      assertEquals(BigDecimal("1250.00"), baseWalletRepo.getWalletById(wUsd.id)?.balance?.amount)

      // 2. Double withdrawal -> only one executed
      var withdrawSuccesses = 0
      vm.withdraw(wUsd.id, BigDecimal("50.00"), "ATM", onSuccess = { withdrawSuccesses++ }, onError = {})
      vm.withdraw(wUsd.id, BigDecimal("50.00"), "Duplicate", onSuccess = { withdrawSuccesses++ }, onError = {})
      advanceUntilIdle()

      assertEquals(1, slowTxRepo.withdrawCount.get())
      assertEquals(1, withdrawSuccesses)
      assertEquals(BigDecimal("1200.00"), baseWalletRepo.getWalletById(wUsd.id)?.balance?.amount)

      // 3. Double transfer -> only one executed
      var transferSuccesses = 0
      vm.transfer(wUsd.id, wEur.id, BigDecimal("100.00"), "FX", onSuccess = { transferSuccesses++ }, onError = {})
      vm.transfer(wUsd.id, wEur.id, BigDecimal("100.00"), "Dup FX", onSuccess = { transferSuccesses++ }, onError = {})
      advanceUntilIdle()

      assertEquals(1, slowTxRepo.transferCount.get())
      assertEquals(1, transferSuccesses)
      assertEquals(BigDecimal("1100.00"), baseWalletRepo.getWalletById(wUsd.id)?.balance?.amount)
      assertEquals(BigDecimal("190.00"), baseWalletRepo.getWalletById(wEur.id)?.balance?.amount)

      // 4. Error callback delivers message cleanly and clears submitting flag
      var capturedError: String? = null
      vm.withdraw(wUsd.id, BigDecimal("99999.00"), "Too much", onSuccess = {}, onError = { capturedError = it })
      advanceUntilIdle()

      assertFalse(vm.isTransactionSubmitting.value)
      assertTrue(capturedError?.contains("Insufficient funds") == true)
    } finally {
      Dispatchers.resetMain()
    }
  }
}
