package com.pluto.app.data.local.wallet

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.Money
import java.math.BigDecimal

object CurrencyWalletEntityMapper {

  fun toDomain(entity: CurrencyWalletEntity): CurrencyWallet? {
    val currency = Currency.findByCode(entity.currencyCode) ?: return null
    val balanceAmount = try {
      BigDecimal(entity.balance)
    } catch (_: Exception) {
      return null
    }
    val initialBalanceAmount = try {
      BigDecimal(entity.initialBalance)
    } catch (_: Exception) {
      balanceAmount
    }

    return CurrencyWallet(
      id = entity.id,
      currency = currency,
      balance = Money.of(balanceAmount, currency),
      initialBalance = Money.of(initialBalanceAmount, currency),
      createdAt = entity.createdAt,
      updatedAt = entity.updatedAt
    )
  }

  fun toEntity(domain: CurrencyWallet): CurrencyWalletEntity {
    return CurrencyWalletEntity(
      id = domain.id,
      currencyCode = domain.currency.code,
      balance = domain.balance.amount.toPlainString(),
      initialBalance = domain.initialBalance.amount.toPlainString(),
      createdAt = domain.createdAt,
      updatedAt = domain.updatedAt
    )
  }
}
