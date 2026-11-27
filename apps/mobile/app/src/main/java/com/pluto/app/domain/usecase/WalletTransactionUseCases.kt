package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import com.pluto.app.domain.repository.CurrencyWalletRepository
import com.pluto.app.domain.repository.DirectTransactionRunner
import com.pluto.app.domain.repository.ExchangeRateRepository
import com.pluto.app.domain.repository.TransactionRunner
import com.pluto.app.domain.repository.WalletTransactionRepository
import kotlinx.coroutines.flow.Flow
import java.math.BigDecimal

sealed interface DepositResult {
  data class Success(val transaction: WalletTransaction, val updatedWallet: CurrencyWallet) : DepositResult
  data class InvalidAmount(val reason: String) : DepositResult
  data class WalletNotFound(val walletId: String) : DepositResult
  data class Failure(val message: String) : DepositResult
}

sealed interface WithdrawalResult {
  data class Success(val transaction: WalletTransaction, val updatedWallet: CurrencyWallet) : WithdrawalResult
  data class InvalidAmount(val reason: String) : WithdrawalResult
  data class WalletNotFound(val walletId: String) : WithdrawalResult
  data class InsufficientFunds(val available: Money, val requested: Money) : WithdrawalResult
  data class Failure(val message: String) : WithdrawalResult
}

sealed interface TransferResult {
  data class Success(
    val sourceTransaction: WalletTransaction,
    val destinationTransaction: WalletTransaction,
    val updatedSourceWallet: CurrencyWallet,
    val updatedDestinationWallet: CurrencyWallet
  ) : TransferResult
  data class InvalidAmount(val reason: String) : TransferResult
  data class SameWallet(val walletId: String) : TransferResult
  data class WalletNotFound(val walletId: String) : TransferResult
  data class InsufficientFunds(val available: Money, val requested: Money) : TransferResult
  data class RateUnavailable(val from: Currency, val to: Currency) : TransferResult
  data class Failure(val message: String) : TransferResult
}

class CreateWalletDepositUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRepository: WalletTransactionRepository,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {
  suspend operator fun invoke(
    walletId: String,
    amount: BigDecimal,
    note: String = ""
  ): DepositResult {
    if (amount <= BigDecimal.ZERO) {
      return DepositResult.InvalidAmount("Deposit amount must be strictly greater than zero")
    }

    return try {
      transactionRunner.runInTransaction {
        val wallet = walletRepository.getWalletById(walletId)
          ?: return@runInTransaction DepositResult.WalletNotFound(walletId)

        val depositMoney = Money.of(amount, wallet.currency)
        val newBalance = wallet.balance + depositMoney

        val now = System.currentTimeMillis()
        val transaction = WalletTransaction(
          walletId = wallet.id,
          type = WalletTransactionType.DEPOSIT,
          amount = depositMoney,
          timestamp = now,
          note = note.trim(),
          createdAt = now
        )

        val updatedWallet = wallet.copy(
          balance = newBalance,
          updatedAt = now
        )

        transactionRepository.executeDeposit(updatedWallet, transaction)
        DepositResult.Success(transaction, updatedWallet)
      }
    } catch (e: Exception) {
      DepositResult.Failure(e.message ?: "Failed to record deposit")
    }
  }
}

class CreateWalletWithdrawalUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRepository: WalletTransactionRepository,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {
  suspend operator fun invoke(
    walletId: String,
    amount: BigDecimal,
    note: String = ""
  ): WithdrawalResult {
    if (amount <= BigDecimal.ZERO) {
      return WithdrawalResult.InvalidAmount("Withdrawal amount must be strictly greater than zero")
    }

    return try {
      transactionRunner.runInTransaction {
        val wallet = walletRepository.getWalletById(walletId)
          ?: return@runInTransaction WithdrawalResult.WalletNotFound(walletId)

        val withdrawalMoney = Money.of(amount, wallet.currency)
        if (withdrawalMoney > wallet.balance) {
          return@runInTransaction WithdrawalResult.InsufficientFunds(
            available = wallet.balance,
            requested = withdrawalMoney
          )
        }

        val newBalance = wallet.balance - withdrawalMoney
        if (newBalance.amount < BigDecimal.ZERO) {
          return@runInTransaction WithdrawalResult.InsufficientFunds(
            available = wallet.balance,
            requested = withdrawalMoney
          )
        }

        val now = System.currentTimeMillis()
        val transaction = WalletTransaction(
          walletId = wallet.id,
          type = WalletTransactionType.WITHDRAWAL,
          amount = withdrawalMoney,
          timestamp = now,
          note = note.trim(),
          createdAt = now
        )

        val updatedWallet = wallet.copy(
          balance = newBalance,
          updatedAt = now
        )

        transactionRepository.executeWithdrawal(updatedWallet, transaction)
        WithdrawalResult.Success(transaction, updatedWallet)
      }
    } catch (e: Exception) {
      WithdrawalResult.Failure(e.message ?: "Failed to record withdrawal")
    }
  }
}

class CreateWalletTransferUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRepository: WalletTransactionRepository,
  private val exchangeRateRepository: ExchangeRateRepository,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {
  suspend operator fun invoke(
    sourceWalletId: String,
    destinationWalletId: String,
    sourceAmount: BigDecimal,
    note: String = ""
  ): TransferResult {
    if (sourceAmount <= BigDecimal.ZERO) {
      return TransferResult.InvalidAmount("Transfer amount must be strictly greater than zero")
    }
    if (sourceWalletId == destinationWalletId) {
      return TransferResult.SameWallet(sourceWalletId)
    }

    // Resolve wallets and pre-check funds before FX lookup to avoid unnecessary network calls
    val initialSourceWallet = walletRepository.getWalletById(sourceWalletId)
      ?: return TransferResult.WalletNotFound(sourceWalletId)
    val initialDestWallet = walletRepository.getWalletById(destinationWalletId)
      ?: return TransferResult.WalletNotFound(destinationWalletId)

    val initialSendMoney = Money.of(sourceAmount, initialSourceWallet.currency)
    if (initialSendMoney > initialSourceWallet.balance) {
      return TransferResult.InsufficientFunds(
        available = initialSourceWallet.balance,
        requested = initialSendMoney
      )
    }

    val exchangeRate: ExchangeRate = if (initialSourceWallet.currency == initialDestWallet.currency) {
      ExchangeRate.identity(initialSourceWallet.currency)
    } else {
      exchangeRateRepository.getRate(
        from = initialSourceWallet.currency,
        to = initialDestWallet.currency,
        allowOfflineCache = true
      ) ?: return TransferResult.RateUnavailable(initialSourceWallet.currency, initialDestWallet.currency)
    }

    return try {
      transactionRunner.runInTransaction {
        val sourceWallet = walletRepository.getWalletById(sourceWalletId)
          ?: return@runInTransaction TransferResult.WalletNotFound(sourceWalletId)
        val destWallet = walletRepository.getWalletById(destinationWalletId)
          ?: return@runInTransaction TransferResult.WalletNotFound(destinationWalletId)

        val sendMoney = Money.of(sourceAmount, sourceWallet.currency)
        if (sendMoney > sourceWallet.balance) {
          return@runInTransaction TransferResult.InsufficientFunds(
            available = sourceWallet.balance,
            requested = sendMoney
          )
        }

        val effectiveRate = if (sourceWallet.currency == destWallet.currency) {
          ExchangeRate.identity(sourceWallet.currency)
        } else if (
          exchangeRate.fromCurrency == sourceWallet.currency &&
          exchangeRate.toCurrency == destWallet.currency
        ) {
          exchangeRate
        } else {
          return@runInTransaction TransferResult.RateUnavailable(sourceWallet.currency, destWallet.currency)
        }

        val receiveMoney = effectiveRate.convert(sendMoney)
        val now = System.currentTimeMillis()
        val sourceTransaction = WalletTransaction(
          walletId = sourceWallet.id,
          type = WalletTransactionType.TRANSFER_OUT,
          amount = sendMoney,
          timestamp = now,
          note = note.trim(),
          targetWalletId = destWallet.id,
          targetAmount = receiveMoney,
          exchangeRate = effectiveRate,
          createdAt = now
        )

        val destTransaction = WalletTransaction(
          walletId = destWallet.id,
          type = WalletTransactionType.TRANSFER_IN,
          amount = receiveMoney,
          timestamp = now,
          note = note.trim(),
          targetWalletId = sourceWallet.id,
          targetAmount = sendMoney,
          exchangeRate = effectiveRate,
          createdAt = now
        )

        val updatedSourceWallet = sourceWallet.copy(
          balance = sourceWallet.balance - sendMoney,
          updatedAt = now
        )
        val updatedDestWallet = destWallet.copy(
          balance = destWallet.balance + receiveMoney,
          updatedAt = now
        )

        transactionRepository.executeTransfer(
          sourceWallet = updatedSourceWallet,
          sourceTransaction = sourceTransaction,
          destWallet = updatedDestWallet,
          destTransaction = destTransaction
        )
        TransferResult.Success(
          sourceTransaction = sourceTransaction,
          destinationTransaction = destTransaction,
          updatedSourceWallet = updatedSourceWallet,
          updatedDestinationWallet = updatedDestWallet
        )
      }
    } catch (e: Exception) {
      TransferResult.Failure(e.message ?: "Failed to execute transfer")
    }
  }
}

class ObserveWalletTransactionsUseCase(
  private val transactionRepository: WalletTransactionRepository
) {
  operator fun invoke(walletId: String): Flow<List<WalletTransaction>> {
    return transactionRepository.observeTransactionsForWallet(walletId)
  }
}

class GetWalletBalanceUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRepository: WalletTransactionRepository
) {
  suspend operator fun invoke(walletId: String): Money? {
    val wallet = walletRepository.getWalletById(walletId) ?: return null
    val txs = transactionRepository.getTransactionsForWallet(walletId)
    var balance = wallet.initialBalance
    for (tx in txs) {
      when (tx.type) {
        WalletTransactionType.DEPOSIT, WalletTransactionType.TRANSFER_IN -> balance += tx.amount
        WalletTransactionType.WITHDRAWAL, WalletTransactionType.TRANSFER_OUT -> balance -= tx.amount
      }
    }
    return balance
  }
}
