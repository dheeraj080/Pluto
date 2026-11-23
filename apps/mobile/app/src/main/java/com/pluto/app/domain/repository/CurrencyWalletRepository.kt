package com.pluto.app.domain.repository

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import kotlinx.coroutines.flow.Flow

/**
 * Domain repository contract for currency wallets.
 */
interface CurrencyWalletRepository {

  /**
   * Observes all user currency wallets.
   */
  fun observeAllWallets(): Flow<List<CurrencyWallet>>

  /**
   * Retrieves a wallet by currency code, or null if it doesn't exist.
   */
  suspend fun getWalletByCurrency(currency: Currency): CurrencyWallet?

  /**
   * Retrieves a wallet by unique ID.
   */
  suspend fun getWalletById(id: String): CurrencyWallet?

  /**
   * Saves or updates a currency wallet.
   */
  suspend fun saveWallet(wallet: CurrencyWallet)

  /**
   * Deletes a wallet by its ID.
   */
  suspend fun deleteWallet(id: String)
}
