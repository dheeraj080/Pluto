package com.pluto.app.data.repository

import androidx.room.withTransaction
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.wallet.CurrencyWalletDao
import com.pluto.app.data.local.wallet.CurrencyWalletEntityMapper
import com.pluto.app.data.local.wallet.WalletTransactionDao
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.repository.CurrencyWalletRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class RoomCurrencyWalletRepository(
  private val dao: CurrencyWalletDao,
  private val transactionDao: WalletTransactionDao? = null,
  private val database: AppDatabase? = null
) : CurrencyWalletRepository {

  override fun observeAllWallets(): Flow<List<CurrencyWallet>> {
    return dao.observeAllWallets().map { list ->
      list.mapNotNull { CurrencyWalletEntityMapper.toDomain(it) }
    }
  }

  override suspend fun getWalletByCurrency(currency: Currency): CurrencyWallet? {
    return dao.getWalletByCurrency(currency.code)?.let {
      CurrencyWalletEntityMapper.toDomain(it)
    }
  }

  override suspend fun getWalletById(id: String): CurrencyWallet? {
    return dao.getWalletById(id)?.let {
      CurrencyWalletEntityMapper.toDomain(it)
    }
  }

  override suspend fun saveWallet(wallet: CurrencyWallet) {
    dao.insertWallet(CurrencyWalletEntityMapper.toEntity(wallet))
  }

  override suspend fun deleteWallet(id: String) {
    val deleteBlock: suspend () -> Unit = {
      transactionDao?.deleteTransactionsForWallet(id)
      dao.deleteWalletById(id)
    }
    if (database != null) {
      database.withTransaction { deleteBlock() }
    } else {
      deleteBlock()
    }
  }
}
