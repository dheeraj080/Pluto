package com.pluto.app.data.local.wallet

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CurrencyWalletDao {

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertWallet(wallet: CurrencyWalletEntity)

  @Query("SELECT * FROM wallets ORDER BY createdAt ASC")
  fun observeAllWallets(): Flow<List<CurrencyWalletEntity>>

  @Query("SELECT * FROM wallets WHERE currencyCode = :currencyCode LIMIT 1")
  suspend fun getWalletByCurrency(currencyCode: String): CurrencyWalletEntity?

  @Query("SELECT * FROM wallets WHERE id = :id LIMIT 1")
  suspend fun getWalletById(id: String): CurrencyWalletEntity?

  @Query("DELETE FROM wallets WHERE id = :id")
  suspend fun deleteWalletById(id: String)

  @Query("SELECT * FROM wallets ORDER BY createdAt ASC")
  suspend fun getAllWallets(): List<CurrencyWalletEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertWallets(wallets: List<CurrencyWalletEntity>)

  @Query("DELETE FROM wallets")
  suspend fun clearAll()
}
