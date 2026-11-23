package com.pluto.app.domain.model

import java.math.BigDecimal
import java.util.UUID

/**
 * Type of ledger movements for currency wallets.
 */
enum class WalletTransactionType {
  DEPOSIT,
  WITHDRAWAL,
  TRANSFER_OUT,
  TRANSFER_IN
}

/**
 * Domain model representing an explicit ledger movement for a currency wallet.
 *
 * Distinct from historical expenses:
 * - Does NOT affect expense records.
 * - Records additions, withdrawals, or transfers between currency holdings.
 * - Amounts are always stored as positive values. Signed movement is derived from [type].
 * - For transfers, records exchange rate snapshots and target wallet amounts immutably.
 */
data class WalletTransaction(
  val id: String = UUID.randomUUID().toString(),
  val walletId: String,
  val type: WalletTransactionType,
  val amount: Money,
  val timestamp: Long = System.currentTimeMillis(),
  val note: String = "",
  // Transfer metadata (populated when type is TRANSFER_OUT or TRANSFER_IN)
  val targetWalletId: String? = null,
  val targetAmount: Money? = null,
  val exchangeRate: ExchangeRate? = null,
  val createdAt: Long = System.currentTimeMillis()
) {
  init {
    require(amount.amount > BigDecimal.ZERO) {
      "Wallet transaction amount must be strictly positive: ${amount.amount}"
    }
    if (targetAmount != null) {
      require(targetAmount.amount > BigDecimal.ZERO) {
        "Target transfer amount must be strictly positive: ${targetAmount.amount}"
      }
    }
  }

  val isPositiveMovement: Boolean
    get() = type == WalletTransactionType.DEPOSIT || type == WalletTransactionType.TRANSFER_IN

  val isNegativeMovement: Boolean
    get() = type == WalletTransactionType.WITHDRAWAL || type == WalletTransactionType.TRANSFER_OUT

  /**
   * The signed effect on the wallet balance:
   * +amount for DEPOSIT and TRANSFER_IN
   * -amount for WITHDRAWAL and TRANSFER_OUT
   */
  val signedAmount: Money
    get() = if (isPositiveMovement) amount else amount.negate()
}
