package com.pluto.app.data.repository

import androidx.room.withTransaction
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.wallet.CurrencyWalletDao
import com.pluto.app.data.local.wallet.CurrencyWalletEntityMapper
import com.pluto.app.data.local.wallet.WalletTransactionDao
import com.pluto.app.data.local.wallet.WalletTransactionEntityMapper
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.repository.WalletTransactionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class RoomWalletTransactionRepository(
  private val database: AppDatabase,
  private val walletDao: CurrencyWalletDao,
  private val transactionDao: WalletTransactionDao
) : WalletTransactionRepository {

  override fun observeTransactionsForWallet(walletId: String): Flow<List<WalletTransaction>> {
    return transactionDao.observeTransactionsForWallet(walletId).map { list ->
      list.mapNotNull { WalletTransactionEntityMapper.toDomain(it) }
    }
  }

  override fun observeAllTransactions(): Flow<List<WalletTransaction>> {
    return transactionDao.observeAllTransactions().map { list ->
      list.mapNotNull { WalletTransactionEntityMapper.toDomain(it) }
    }
  }


  override suspend fun getTransactionsForWallet(walletId: String): List<WalletTransaction> {
    return transactionDao.getTransactionsForWallet(walletId).mapNotNull {
      WalletTransactionEntityMapper.toDomain(it)
    }
  }

  override suspend fun executeDeposit(wallet: CurrencyWallet, transaction: WalletTransaction) {
    database.withTransaction {
      walletDao.insertWallet(CurrencyWalletEntityMapper.toEntity(wallet))
      transactionDao.insertTransaction(WalletTransactionEntityMapper.toEntity(transaction))
    }
  }

  override suspend fun executeWithdrawal(wallet: CurrencyWallet, transaction: WalletTransaction) {
    database.withTransaction {
      walletDao.insertWallet(CurrencyWalletEntityMapper.toEntity(wallet))
      transactionDao.insertTransaction(WalletTransactionEntityMapper.toEntity(transaction))
    }
  }

  override suspend fun executeTransfer(
    sourceWallet: CurrencyWallet,
    sourceTransaction: WalletTransaction,
    destWallet: CurrencyWallet,
    destTransaction: WalletTransaction
  ) {
    database.withTransaction {
      walletDao.insertWallet(CurrencyWalletEntityMapper.toEntity(sourceWallet))
      walletDao.insertWallet(CurrencyWalletEntityMapper.toEntity(destWallet))
      transactionDao.insertTransaction(WalletTransactionEntityMapper.toEntity(sourceTransaction))
      transactionDao.insertTransaction(WalletTransactionEntityMapper.toEntity(destTransaction))
    }
  }

  override suspend fun deleteTransactionsForWallet(walletId: String) {
    transactionDao.deleteTransactionsForWallet(walletId)
  }
}
