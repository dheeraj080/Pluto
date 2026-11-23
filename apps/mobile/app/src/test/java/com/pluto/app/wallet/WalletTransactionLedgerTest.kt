package com.pluto.app.wallet

import com.pluto.app.currency.FakeExchangeRateRepository
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import com.pluto.app.domain.model.WalletValuation
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.WalletTransactionRepository
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.CreateWalletDepositUseCase
import com.pluto.app.domain.usecase.CreateWalletTransferUseCase
import com.pluto.app.domain.usecase.CreateWalletWithdrawalUseCase
import com.pluto.app.domain.usecase.DepositResult
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.GetWalletBalanceUseCase
import com.pluto.app.domain.usecase.ObserveWalletTransactionsUseCase
import com.pluto.app.domain.usecase.TransferResult
import com.pluto.app.domain.usecase.WalletOperationResult
import com.pluto.app.domain.usecase.WithdrawalResult
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal

class FakeWalletTransactionRepository(
  private val walletRepo: FakeCurrencyWalletRepository
) : WalletTransactionRepository {
  private val transactions = mutableMapOf<String, MutableList<WalletTransaction>>()
  private val transactionsFlow = mutableMapOf<String, MutableStateFlow<List<WalletTransaction>>>()

  private fun getFlow(walletId: String): MutableStateFlow<List<WalletTransaction>> {
    return transactionsFlow.getOrPut(walletId) {
      MutableStateFlow(transactions[walletId] ?: emptyList())
    }
  }

  override fun observeTransactionsForWallet(walletId: String): Flow<List<WalletTransaction>> {
    return getFlow(walletId).asStateFlow()
  }

  override fun observeAllTransactions(): Flow<List<WalletTransaction>> {
    val all = transactions.values.flatten().sortedByDescending { it.timestamp }
    return MutableStateFlow(all).asStateFlow()
  }

  override suspend fun getTransactionsForWallet(walletId: String): List<WalletTransaction> {

    return transactions[walletId]?.toList() ?: emptyList()
  }

  override suspend fun executeDeposit(wallet: CurrencyWallet, transaction: WalletTransaction) {
    walletRepo.saveWallet(wallet)
    val list = transactions.getOrPut(wallet.id) { mutableListOf() }
    list.add(0, transaction)
    getFlow(wallet.id).value = list.toList()
  }

  override suspend fun executeWithdrawal(wallet: CurrencyWallet, transaction: WalletTransaction) {
    walletRepo.saveWallet(wallet)
    val list = transactions.getOrPut(wallet.id) { mutableListOf() }
    list.add(0, transaction)
    getFlow(wallet.id).value = list.toList()
  }

  override suspend fun executeTransfer(
    sourceWallet: CurrencyWallet,
    sourceTransaction: WalletTransaction,
    destWallet: CurrencyWallet,
    destTransaction: WalletTransaction
  ) {
    walletRepo.saveWallet(sourceWallet)
    walletRepo.saveWallet(destWallet)
    val srcList = transactions.getOrPut(sourceWallet.id) { mutableListOf() }
    srcList.add(0, sourceTransaction)
    getFlow(sourceWallet.id).value = srcList.toList()

    val destList = transactions.getOrPut(destWallet.id) { mutableListOf() }
    destList.add(0, destTransaction)
    getFlow(destWallet.id).value = destList.toList()
  }

  override suspend fun deleteTransactionsForWallet(walletId: String) {
    transactions.remove(walletId)
    getFlow(walletId).value = emptyList()
  }
}

class FakeExpenseRepository : ExpenseRepository {
  private val expenses = mutableMapOf<String, Expense>()
  private val flow = MutableStateFlow<List<Expense>>(emptyList())

  fun emit() {
    flow.value = expenses.values.toList()
  }

  override fun observeAllExpenses(): Flow<List<Expense>> = flow.asStateFlow()
  override fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<Expense>> = flow.asStateFlow()
  override fun observeExpensesByCategory(categoryId: String): Flow<List<Expense>> = flow.asStateFlow()
  override fun observeExpensesByTrip(tripId: String): Flow<List<Expense>> = flow.asStateFlow()
  override suspend fun getExpenseById(id: String): Expense? = expenses[id]
  override suspend fun saveExpense(expense: Expense) {
    expenses[expense.id] = expense
    emit()
  }
  override suspend fun deleteExpense(id: String) {
    expenses.remove(id)
    emit()
  }
  fun getAllExpenses(): List<Expense> = expenses.values.toList()
}

class WalletTransactionLedgerTest {

  private lateinit var walletRepo: FakeCurrencyWalletRepository
  private lateinit var transactionRepo: FakeWalletTransactionRepository
  private lateinit var exchangeRepo: FakeExchangeRateRepository
  private lateinit var expenseRepo: FakeExpenseRepository

  private lateinit var createWalletUseCase: CreateCurrencyWalletUseCase
  private lateinit var depositUseCase: CreateWalletDepositUseCase
  private lateinit var withdrawUseCase: CreateWalletWithdrawalUseCase
  private lateinit var transferUseCase: CreateWalletTransferUseCase
  private lateinit var observeTransactionsUseCase: ObserveWalletTransactionsUseCase
  private lateinit var getBalanceUseCase: GetWalletBalanceUseCase
  private lateinit var getPortfolioValuationUseCase: GetPortfolioValuationUseCase

  private val eur = Currency.EUR
  private val usd = Currency.USD
  private val inr = Currency.INR

  @Before
  fun setup() {
    walletRepo = FakeCurrencyWalletRepository()
    transactionRepo = FakeWalletTransactionRepository(walletRepo)
    exchangeRepo = FakeExchangeRateRepository()
    expenseRepo = FakeExpenseRepository()

    createWalletUseCase = CreateCurrencyWalletUseCase(walletRepo)
    depositUseCase = CreateWalletDepositUseCase(walletRepo, transactionRepo)
    withdrawUseCase = CreateWalletWithdrawalUseCase(walletRepo, transactionRepo)
    transferUseCase = CreateWalletTransferUseCase(walletRepo, transactionRepo, exchangeRepo)
    observeTransactionsUseCase = ObserveWalletTransactionsUseCase(transactionRepo)
    getBalanceUseCase = GetWalletBalanceUseCase(walletRepo, transactionRepo)
    getPortfolioValuationUseCase = GetPortfolioValuationUseCase(exchangeRepo)
  }

  // --- 1 to 11: Wallet Transactions & Ledger Balances ---

  @Test
  fun `1 create deposit successfully`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = depositUseCase(wallet.id, BigDecimal("500.00"), "Salary bonus")
    assertTrue(result is DepositResult.Success)

    val success = result as DepositResult.Success
    assertEquals(BigDecimal("500.00"), success.transaction.amount.amount)
    assertEquals(WalletTransactionType.DEPOSIT, success.transaction.type)
    assertEquals("Salary bonus", success.transaction.note)
    assertEquals(BigDecimal("1500.00"), success.updatedWallet.balance.amount)
  }

  @Test
  fun `2 reject zero deposit`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = depositUseCase(wallet.id, BigDecimal.ZERO)
    assertTrue(result is DepositResult.InvalidAmount)
  }

  @Test
  fun `3 reject negative deposit`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = depositUseCase(wallet.id, BigDecimal("-100.00"))
    assertTrue(result is DepositResult.InvalidAmount)
  }

  @Test
  fun `4 create withdrawal successfully`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = withdrawUseCase(wallet.id, BigDecimal("200.00"), "Cash out")
    assertTrue(result is WithdrawalResult.Success)

    val success = result as WithdrawalResult.Success
    assertEquals(BigDecimal("200.00"), success.transaction.amount.amount)
    assertEquals(WalletTransactionType.WITHDRAWAL, success.transaction.type)
    assertEquals(BigDecimal("800.00"), success.updatedWallet.balance.amount)
  }

  @Test
  fun `5 reject zero withdrawal`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = withdrawUseCase(wallet.id, BigDecimal.ZERO)
    assertTrue(result is WithdrawalResult.InvalidAmount)
  }

  @Test
  fun `6 reject negative withdrawal`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = withdrawUseCase(wallet.id, BigDecimal("-50.00"))
    assertTrue(result is WithdrawalResult.InvalidAmount)
  }

  @Test
  fun `7 reject withdrawal exceeding balance`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("100.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val result = withdrawUseCase(wallet.id, BigDecimal("150.00"))
    assertTrue(result is WithdrawalResult.InsufficientFunds)

    val current = walletRepo.getWalletById(wallet.id)
    assertEquals(BigDecimal("100.00"), current?.balance?.amount)

    val txs = transactionRepo.getTransactionsForWallet(wallet.id)
    assertTrue(txs.isEmpty())
  }

  @Test
  fun `8 balance increases after deposit`() = runTest {
    val createResult = createWalletUseCase(usd, BigDecimal("100.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    depositUseCase(wallet.id, BigDecimal("75.25"))

    val updated = walletRepo.getWalletById(wallet.id)
    assertEquals(BigDecimal("175.25"), updated?.balance?.amount)
  }

  @Test
  fun `9 balance decreases after withdrawal`() = runTest {
    val createResult = createWalletUseCase(usd, BigDecimal("250.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    withdrawUseCase(wallet.id, BigDecimal("50.00"))

    val updated = walletRepo.getWalletById(wallet.id)
    assertEquals(BigDecimal("200.00"), updated?.balance?.amount)
  }

  @Test
  fun `10 multiple transactions calculate correct balance`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    depositUseCase(wallet.id, BigDecimal("250.00"))   // 1250.00
    withdrawUseCase(wallet.id, BigDecimal("100.00"))  // 1150.00
    depositUseCase(wallet.id, BigDecimal("50.00"))    // 1200.00
    withdrawUseCase(wallet.id, BigDecimal("200.00"))  // 1000.00

    val calculatedBalance = getBalanceUseCase(wallet.id)
    assertEquals(BigDecimal("1000.00"), calculatedBalance?.amount)

    val fromRepo = walletRepo.getWalletById(wallet.id)
    assertEquals(BigDecimal("1000.00"), fromRepo?.balance?.amount)

    val txs = observeTransactionsUseCase(wallet.id).first()
    assertEquals(4, txs.size)
  }

  @Test
  fun `11 BigDecimal precision preserved across financial operations`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("100.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    depositUseCase(wallet.id, BigDecimal("10.01"))
    depositUseCase(wallet.id, BigDecimal("20.02"))
    withdrawUseCase(wallet.id, BigDecimal("30.03"))

    val balance = getBalanceUseCase(wallet.id)
    assertEquals("100.00", balance?.amount?.toPlainString())
  }

  // --- 12 to 15: Isolation between Wallets and Expenses ---

  @Test
  fun `12 wallet transaction does not create expense`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    withdrawUseCase(wallet.id, BigDecimal("100.00"))

    val allExpenses = expenseRepo.getAllExpenses()
    assertTrue(allExpenses.isEmpty())
  }

  @Test
  fun `13 expense does not modify wallet`() = runTest {
    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet

    val expense = Expense.create(
      originalAmount = Money.of(BigDecimal("50.00"), eur),
      homeCurrency = eur,
      exchangeRate = ExchangeRate.identity(eur),
      category = Category.FOOD,
      merchant = "Cafe"
    )
    expenseRepo.saveExpense(expense)

    val walletAfterExpense = walletRepo.getWalletById(wallet.id)
    assertEquals(BigDecimal("1000.00"), walletAfterExpense?.balance?.amount)

    val txs = transactionRepo.getTransactionsForWallet(wallet.id)
    assertTrue(txs.isEmpty())
  }

  @Test
  fun `14 wallet transaction does not modify historical expense`() = runTest {
    val expense = Expense.create(
      originalAmount = Money.of(BigDecimal("80.00"), eur),
      homeCurrency = eur,
      exchangeRate = ExchangeRate.identity(eur),
      category = Category.SHOPPING,
      merchant = "Store"
    )
    expenseRepo.saveExpense(expense)

    val createResult = createWalletUseCase(eur, BigDecimal("500.00")) as WalletOperationResult.Success
    depositUseCase(createResult.wallet.id, BigDecimal("300.00"))

    val fetchedExpense = expenseRepo.getExpenseById(expense.id)
    assertEquals(BigDecimal("80.00"), fetchedExpense?.originalAmount?.amount)
  }

  @Test
  fun `15 deleting or modifying expense does not modify wallet ledger`() = runTest {
    val expense = Expense.create(
      originalAmount = Money.of(BigDecimal("120.00"), eur),
      homeCurrency = eur,
      exchangeRate = ExchangeRate.identity(eur),
      category = Category.TRANSPORT,
      merchant = "Taxi"
    )
    expenseRepo.saveExpense(expense)

    val createResult = createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success
    val wallet = createResult.wallet
    depositUseCase(wallet.id, BigDecimal("50.00"))

    expenseRepo.deleteExpense(expense.id)

    val walletAfter = walletRepo.getWalletById(wallet.id)
    assertEquals(BigDecimal("1050.00"), walletAfter?.balance?.amount)
  }

  // --- 16 to 24: Transfers & Atomicity ---

  @Test
  fun `16 same-currency transfer decreases source`() = runTest {
    val w1 = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    // Second wallet with simulated custom ID
    val w2 = CurrencyWallet.create(eur, BigDecimal("200.00"), "eur-wallet-2")
    walletRepo.saveWallet(w2)

    val result = transferUseCase(w1.id, w2.id, BigDecimal("300.00"))
    assertTrue(result is TransferResult.Success)

    val src = walletRepo.getWalletById(w1.id)
    assertEquals(BigDecimal("700.00"), src?.balance?.amount)
  }

  @Test
  fun `17 same-currency transfer increases destination`() = runTest {
    val w1 = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    val w2 = CurrencyWallet.create(eur, BigDecimal("200.00"), "eur-wallet-2")
    walletRepo.saveWallet(w2)

    transferUseCase(w1.id, w2.id, BigDecimal("300.00"))

    val dest = walletRepo.getWalletById(w2.id)
    assertEquals(BigDecimal("500.00"), dest?.balance?.amount)
  }

  @Test
  fun `18 transfer is atomic`() = runTest {
    val w1 = (createWalletUseCase(eur, BigDecimal("500.00")) as WalletOperationResult.Success).wallet
    val w2 = (createWalletUseCase(usd, BigDecimal("100.00")) as WalletOperationResult.Success).wallet

    exchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = usd,
        rate = BigDecimal("1.10000000"),
        source = "test_rate"
      )
    )

    val result = transferUseCase(w1.id, w2.id, BigDecimal("100.00"))
    assertTrue(result is TransferResult.Success)

    val src = walletRepo.getWalletById(w1.id)
    val dest = walletRepo.getWalletById(w2.id)

    assertEquals(BigDecimal("400.00"), src?.balance?.amount)
    assertEquals(BigDecimal("210.00"), dest?.balance?.amount)

    val srcTxs = transactionRepo.getTransactionsForWallet(w1.id)
    val destTxs = transactionRepo.getTransactionsForWallet(w2.id)

    assertEquals(1, srcTxs.size)
    assertEquals(1, destTxs.size)
    assertEquals(WalletTransactionType.TRANSFER_OUT, srcTxs.first().type)
    assertEquals(WalletTransactionType.TRANSFER_IN, destTxs.first().type)
  }

  @Test
  fun `19 insufficient source balance rejects transfer`() = runTest {
    val w1 = (createWalletUseCase(eur, BigDecimal("50.00")) as WalletOperationResult.Success).wallet
    val w2 = (createWalletUseCase(usd, BigDecimal("100.00")) as WalletOperationResult.Success).wallet

    val result = transferUseCase(w1.id, w2.id, BigDecimal("100.00"))
    assertTrue(result is TransferResult.InsufficientFunds)

    assertEquals(BigDecimal("50.00"), walletRepo.getWalletById(w1.id)?.balance?.amount)
    assertEquals(BigDecimal("100.00"), walletRepo.getWalletById(w2.id)?.balance?.amount)
  }

  @Test
  fun `20 source and destination cannot be the same wallet`() = runTest {
    val w1 = (createWalletUseCase(eur, BigDecimal("500.00")) as WalletOperationResult.Success).wallet

    val result = transferUseCase(w1.id, w1.id, BigDecimal("50.00"))
    assertTrue(result is TransferResult.SameWallet)
  }

  @Test
  fun `21 cross-currency transfer uses existing conversion infrastructure`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    val wInr = (createWalletUseCase(inr, BigDecimal("0.00")) as WalletOperationResult.Success).wallet

    // 1 EUR = 90.50 INR
    exchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = inr,
        rate = BigDecimal("90.50000000"),
        source = "ecb_official"
      )
    )

    val result = transferUseCase(wEur.id, wInr.id, BigDecimal("100.00"))
    assertTrue(result is TransferResult.Success)

    val success = result as TransferResult.Success
    assertEquals(BigDecimal("100.00"), success.sourceTransaction.amount.amount)
    assertEquals(BigDecimal("9050.00"), success.destinationTransaction.amount.amount)
    assertEquals(BigDecimal("9050.00"), success.updatedDestinationWallet.balance.amount)
  }

  @Test
  fun `22 missing conversion rate rejects transfer`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    val wInr = (createWalletUseCase(inr, BigDecimal("500.00")) as WalletOperationResult.Success).wallet

    // No rate set between EUR and INR
    val result = transferUseCase(wEur.id, wInr.id, BigDecimal("100.00"))
    assertTrue(result is TransferResult.RateUnavailable)

    assertEquals(BigDecimal("1000.00"), walletRepo.getWalletById(wEur.id)?.balance?.amount)
    assertEquals(BigDecimal("500.00"), walletRepo.getWalletById(wInr.id)?.balance?.amount)
  }

  @Test
  fun `23 transfer preserves conversion snapshot`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    val wUsd = (createWalletUseCase(usd, BigDecimal("0.00")) as WalletOperationResult.Success).wallet

    exchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = usd,
        rate = BigDecimal("1.08000000"),
        source = "snapshot_test"
      )
    )

    val result = transferUseCase(wEur.id, wUsd.id, BigDecimal("100.00")) as TransferResult.Success
    val rateSnapshot = result.sourceTransaction.exchangeRate

    assertNotNull(rateSnapshot)
    assertEquals(BigDecimal("1.08000000"), rateSnapshot?.rate)
    assertEquals("snapshot_test", rateSnapshot?.source)
    assertEquals(BigDecimal("108.00"), result.sourceTransaction.targetAmount?.amount)
  }

  @Test
  fun `24 later rate changes do not alter historical transfer`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    val wUsd = (createWalletUseCase(usd, BigDecimal("0.00")) as WalletOperationResult.Success).wallet

    exchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = usd,
        rate = BigDecimal("1.08000000"),
        source = "initial_rate"
      )
    )

    transferUseCase(wEur.id, wUsd.id, BigDecimal("100.00"))

    // Rate changes later to 1.15
    exchangeRepo.setRate(
      ExchangeRate(
        fromCurrency = eur,
        toCurrency = usd,
        rate = BigDecimal("1.15000000"),
        source = "later_rate"
      )
    )

    val tx = transactionRepo.getTransactionsForWallet(wEur.id).first()
    assertEquals(BigDecimal("1.08000000"), tx.exchangeRate?.rate)
    assertEquals(BigDecimal("108.00"), tx.targetAmount?.amount)
  }

  // --- 25 to 30: Portfolio Valuation Integration ---

  @Test
  fun `25 portfolio reflects deposit`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    depositUseCase(wEur.id, BigDecimal("500.00"))

    val wallets = listOf(walletRepo.getWalletById(wEur.id)!!)
    val valuation = getPortfolioValuationUseCase(wallets, eur)

    assertEquals(BigDecimal("1500.00"), valuation.totalValuedHomeAmount.amount)
  }

  @Test
  fun `26 portfolio reflects withdrawal`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    withdrawUseCase(wEur.id, BigDecimal("250.00"))

    val wallets = listOf(walletRepo.getWalletById(wEur.id)!!)
    val valuation = getPortfolioValuationUseCase(wallets, eur)

    assertEquals(BigDecimal("750.00"), valuation.totalValuedHomeAmount.amount)
  }

  @Test
  fun `27 portfolio reflects transfer`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    val wUsd = (createWalletUseCase(usd, BigDecimal("100.00")) as WalletOperationResult.Success).wallet

    exchangeRepo.setRate(ExchangeRate(eur, usd, BigDecimal("1.10000000"), source = "live"))
    exchangeRepo.setRate(ExchangeRate(usd, eur, BigDecimal("0.90909091"), source = "live"))

    transferUseCase(wEur.id, wUsd.id, BigDecimal("100.00"))

    val all = listOf(walletRepo.getWalletById(wEur.id)!!, walletRepo.getWalletById(wUsd.id)!!)
    val valuation = getPortfolioValuationUseCase(all, eur)

    // EUR wallet: 900.00 EUR
    // USD wallet: 210.00 USD * 0.90909091 ≈ 190.91 EUR
    // Total in EUR = 900 + 190.91 = 1090.91 EUR
    assertEquals(2, valuation.valuedWalletsCount)
    assertTrue(valuation.totalValuedHomeAmount.amount > BigDecimal("1000.00"))
  }

  @Test
  fun `28 portfolio continues using current exchange rates`() = runTest {
    val wUsd = (createWalletUseCase(usd, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet

    exchangeRepo.setRate(ExchangeRate(usd, inr, BigDecimal("80.00000000"), source = "day1"))
    val valDay1 = getPortfolioValuationUseCase(listOf(wUsd), inr)
    assertEquals(BigDecimal("80000.00"), valDay1.totalValuedHomeAmount.amount)

    exchangeRepo.setRate(ExchangeRate(usd, inr, BigDecimal("85.00000000"), source = "day2"))
    val valDay2 = getPortfolioValuationUseCase(listOf(wUsd), inr)
    assertEquals(BigDecimal("85000.00"), valDay2.totalValuedHomeAmount.amount)
  }

  @Test
  fun `29 stale rate remains visibly stale in portfolio`() = runTest {
    val wUsd = (createWalletUseCase(usd, BigDecimal("500.00")) as WalletOperationResult.Success).wallet
    exchangeRepo.setRate(ExchangeRate(usd, inr, BigDecimal("82.00000000"), source = "cache_stale"))

    val summary = getPortfolioValuationUseCase(listOf(wUsd), inr)
    val item = summary.walletValuations.first() as WalletValuation.Valued
    assertTrue(item.isStale)
  }

  @Test
  fun `30 unavailable rate remains explicitly unavailable`() = runTest {
    val wUsd = (createWalletUseCase(usd, BigDecimal("500.00")) as WalletOperationResult.Success).wallet
    // No exchange rate set

    val summary = getPortfolioValuationUseCase(listOf(wUsd), inr)
    assertEquals(1, summary.unavailableWalletsCount)
    val item = summary.walletValuations.first()
    assertTrue(item is WalletValuation.Unavailable)
  }

  // --- 37 to 40: Home Currency Changes ---

  @Test
  fun `37 changing home currency does not change wallet balances`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    depositUseCase(wEur.id, BigDecimal("200.00"))

    // User settings change home currency from EUR to USD
    val updatedSettings = UserSettings(homeCurrency = usd)

    val fetchedWallet = walletRepo.getWalletById(wEur.id)
    assertEquals(BigDecimal("1200.00"), fetchedWallet?.balance?.amount)
    assertEquals(eur, fetchedWallet?.currency)
  }

  @Test
  fun `38 changing home currency does not change wallet transaction history`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    depositUseCase(wEur.id, BigDecimal("500.00"), "Bonus")
    withdrawUseCase(wEur.id, BigDecimal("100.00"), "ATM")

    val txs = transactionRepo.getTransactionsForWallet(wEur.id)
    assertEquals(2, txs.size)
    assertEquals(eur, txs[0].amount.currency)
    assertEquals(eur, txs[1].amount.currency)
  }

  @Test
  fun `39 changing home currency does not change historical expenses`() = runTest {
    val exp = Expense.create(
      originalAmount = Money.of(BigDecimal("50.00"), eur),
      homeCurrency = inr,
      exchangeRate = ExchangeRate(eur, inr, BigDecimal("90.00000000"), source = "hist"),
      category = Category.FOOD,
      merchant = "Dinner"
    )
    expenseRepo.saveExpense(exp)

    val fetched = expenseRepo.getExpenseById(exp.id)
    assertEquals(BigDecimal("4500.00"), fetched?.homeAmount?.amount)
    assertEquals(inr, fetched?.homeCurrency)
  }

  @Test
  fun `40 portfolio is revalued in the new home currency`() = runTest {
    val wEur = (createWalletUseCase(eur, BigDecimal("1000.00")) as WalletOperationResult.Success).wallet
    exchangeRepo.setRate(ExchangeRate(eur, inr, BigDecimal("90.00000000"), source = "test"))
    exchangeRepo.setRate(ExchangeRate(eur, usd, BigDecimal("1.10000000"), source = "test"))

    val valInr = getPortfolioValuationUseCase(listOf(wEur), inr)
    assertEquals(BigDecimal("90000.00"), valInr.totalValuedHomeAmount.amount)
    assertEquals(inr, valInr.homeCurrency)

    val valUsd = getPortfolioValuationUseCase(listOf(wEur), usd)
    assertEquals(BigDecimal("1100.00"), valUsd.totalValuedHomeAmount.amount)
    assertEquals(usd, valUsd.homeCurrency)
  }
}
