package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.repository.CurrencyWalletRepository
import com.pluto.app.domain.repository.DirectTransactionRunner
import com.pluto.app.domain.repository.TransactionRunner
import java.math.BigDecimal

sealed interface WalletOperationResult {
  data class Success(val wallet: CurrencyWallet) : WalletOperationResult
  data class DuplicateCurrency(val currency: Currency) : WalletOperationResult
  data class InvalidInput(val reason: String) : WalletOperationResult
  data class Failure(val message: String) : WalletOperationResult
}

class CreateCurrencyWalletUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {
  suspend operator fun invoke(
    currency: Currency,
    balance: BigDecimal
  ): WalletOperationResult {
    if (balance < BigDecimal.ZERO) {
      return WalletOperationResult.InvalidInput("Wallet balance cannot be negative")
    }

    return try {
      transactionRunner.runInTransaction {
        // Check if wallet for currency already exists inside transaction
        val existing = walletRepository.getWalletByCurrency(currency)
        if (existing != null) {
          return@runInTransaction WalletOperationResult.DuplicateCurrency(currency)
        }

        val wallet = CurrencyWallet.create(currency, balance)
        walletRepository.saveWallet(wallet)
        WalletOperationResult.Success(wallet)
      }
    } catch (e: Exception) {
      WalletOperationResult.Failure(e.message ?: "Failed to save wallet")
    }
  }
}

class UpdateCurrencyWalletUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {
  suspend operator fun invoke(
    walletId: String,
    newBalance: BigDecimal
  ): WalletOperationResult {
    if (newBalance < BigDecimal.ZERO) {
      return WalletOperationResult.InvalidInput("Wallet balance cannot be negative")
    }

    return try {
      transactionRunner.runInTransaction {
        val existing = walletRepository.getWalletById(walletId)
          ?: return@runInTransaction WalletOperationResult.InvalidInput("Wallet not found")

        val updated = existing.copy(
          balance = com.pluto.app.domain.model.Money.of(newBalance, existing.currency),
          updatedAt = System.currentTimeMillis()
        )
        walletRepository.saveWallet(updated)
        WalletOperationResult.Success(updated)
      }
    } catch (e: Exception) {
      WalletOperationResult.Failure(e.message ?: "Failed to update wallet")
    }
  }
}

class DeleteCurrencyWalletUseCase(
  private val walletRepository: CurrencyWalletRepository,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {
  suspend operator fun invoke(walletId: String) {
    transactionRunner.runInTransaction {
      walletRepository.deleteWallet(walletId)
    }
  }
}

class ObserveCurrencyWalletsUseCase(
  private val walletRepository: CurrencyWalletRepository
) {
  operator fun invoke(): kotlinx.coroutines.flow.Flow<List<CurrencyWallet>> {
    return walletRepository.observeAllWallets()
  }
}
