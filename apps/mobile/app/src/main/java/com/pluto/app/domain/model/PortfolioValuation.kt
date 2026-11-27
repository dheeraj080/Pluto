package com.pluto.app.domain.model

import java.math.BigDecimal

/**
 * Valuation status of an individual wallet.
 */
sealed interface WalletValuation {
  val wallet: CurrencyWallet

  /**
   * Wallet successfully valued in the reference currency and primary currency.
   */
  data class Valued(
    override val wallet: CurrencyWallet,
    val homeValue: Money,
    val destValue: Money? = null,
    val currentRate: ExchangeRate,
    val isIdentity: Boolean = false,
    val isStale: Boolean = false,
    val compositionPercentage: BigDecimal = BigDecimal.ZERO // Percentage of total valued portfolio
  ) : WalletValuation

  /**
   * Valuation unavailable because no exchange rate exists for this currency pair.
   */
  data class Unavailable(
    override val wallet: CurrencyWallet,
    val reason: String = "Exchange rate unavailable"
  ) : WalletValuation
}

/**
 * Portfolio valuation status across all wallets.
 * Supports dual-currency: a primary spending amount and a reference-currency equivalent.
 */
data class PortfolioValuationSummary(
  val homeCurrency: Currency,
  val destinationCurrency: Currency = homeCurrency,
  val totalValuedHomeAmount: Money,
  val totalValuedDestAmount: Money? = null,
  val walletValuations: List<WalletValuation>,
  val totalWalletsCount: Int,
  val valuedWalletsCount: Int,
  val unavailableWalletsCount: Int
) {
  val isFullyValued: Boolean
    get() = totalWalletsCount > 0 && unavailableWalletsCount == 0

  val isPartiallyValued: Boolean
    get() = valuedWalletsCount > 0 && unavailableWalletsCount > 0

  val hasAnyWallets: Boolean
    get() = totalWalletsCount > 0
}
