package com.pluto.app.domain.repository

import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.WalletTransaction
import kotlinx.coroutines.flow.Flow

/**
 * Domain repository contract for currency wallet ledger transactions.
 */
interface WalletTransactionRepository {

  /**
   * Observes all transactions for a given wallet, sorted by timestamp descending.
   */
  fun observeTransactionsForWallet(walletId: String): Flow<List<WalletTransaction>>

  /**
   * Observes all transactions across all wallets, sorted by timestamp descending.
   */
  fun observeAllTransactions(): Flow<List<WalletTransaction>>


  /**
   * Retrieves all transactions for a given wallet.
   */
  suspend fun getTransactionsForWallet(walletId: String): List<WalletTransaction>

  /**
   * Executes a deposit atomically: updating wallet balance and recording the deposit transaction.
   */
  suspend fun executeDeposit(wallet: CurrencyWallet, transaction: WalletTransaction)

  /**
   * Executes a withdrawal atomically: updating wallet balance and recording the withdrawal transaction.
   */
  suspend fun executeWithdrawal(wallet: CurrencyWallet, transaction: WalletTransaction)

  /**
   * Executes a transfer atomically: updating both source and destination wallet balances
   * and inserting both transfer transactions.
   */
  suspend fun executeTransfer(
    sourceWallet: CurrencyWallet,
    sourceTransaction: WalletTransaction,
    destWallet: CurrencyWallet,
    destTransaction: WalletTransaction
  )

  /**
   * Deletes all transactions associated with a wallet.
   */
  suspend fun deleteTransactionsForWallet(walletId: String)
}
