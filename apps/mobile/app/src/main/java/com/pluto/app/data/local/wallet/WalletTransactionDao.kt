package com.pluto.app.data.local.wallet

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface WalletTransactionDao {

  @Insert(onConflict = OnConflictStrategy.ABORT)
  suspend fun insertTransaction(transaction: WalletTransactionEntity)

  @Insert(onConflict = OnConflictStrategy.ABORT)
  suspend fun insertTransactions(transactions: List<WalletTransactionEntity>)

  @Query("SELECT * FROM wallet_transactions WHERE walletId = :walletId ORDER BY timestamp DESC, createdAt DESC")
  fun observeTransactionsForWallet(walletId: String): Flow<List<WalletTransactionEntity>>

  @Query("SELECT * FROM wallet_transactions ORDER BY timestamp DESC, createdAt DESC")
  fun observeAllTransactions(): Flow<List<WalletTransactionEntity>>


  @Query("SELECT * FROM wallet_transactions WHERE walletId = :walletId ORDER BY timestamp DESC, createdAt DESC")
  suspend fun getTransactionsForWallet(walletId: String): List<WalletTransactionEntity>

  @Query("DELETE FROM wallet_transactions WHERE walletId = :walletId")
  suspend fun deleteTransactionsForWallet(walletId: String)

  @Query("SELECT * FROM wallet_transactions ORDER BY timestamp DESC, createdAt DESC")
  suspend fun getAllTransactions(): List<WalletTransactionEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertTransactionsReplace(transactions: List<WalletTransactionEntity>)

  @Query("DELETE FROM wallet_transactions")
  suspend fun clearAll()
}
