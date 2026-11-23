package com.pluto.app.data.local.wallet

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import java.math.BigDecimal

object WalletTransactionEntityMapper {

  fun toDomain(entity: WalletTransactionEntity): WalletTransaction? {
    val currency = Currency.findByCode(entity.currencyCode) ?: return null
    val amount = try {
      BigDecimal(entity.amount)
    } catch (_: Exception) {
      return null
    }
    val type = try {
      WalletTransactionType.valueOf(entity.type)
    } catch (_: Exception) {
      return null
    }

    val targetAmount = if (entity.targetAmount != null && entity.targetCurrencyCode != null) {
      Currency.findByCode(entity.targetCurrencyCode)?.let { targetCurr ->
        try {
          Money.of(BigDecimal(entity.targetAmount), targetCurr)
        } catch (_: Exception) {
          null
        }
      }
    } else null

    val exchangeRate = if (entity.exchangeRate != null && entity.targetCurrencyCode != null) {
      Currency.findByCode(entity.targetCurrencyCode)?.let { targetCurr ->
        try {
          ExchangeRate(
            fromCurrency = currency,
            toCurrency = targetCurr,
            rate = BigDecimal(entity.exchangeRate),
            source = entity.exchangeRateSource ?: "transfer_snapshot"
          )
        } catch (_: Exception) {
          null
        }
      }
    } else null

    return WalletTransaction(
      id = entity.id,
      walletId = entity.walletId,
      type = type,
      amount = Money.of(amount, currency),
      timestamp = entity.timestamp,
      note = entity.note,
      targetWalletId = entity.targetWalletId,
      targetAmount = targetAmount,
      exchangeRate = exchangeRate,
      createdAt = entity.createdAt
    )
  }

  fun toEntity(domain: WalletTransaction): WalletTransactionEntity {
    return WalletTransactionEntity(
      id = domain.id,
      walletId = domain.walletId,
      type = domain.type.name,
      amount = domain.amount.amount.toPlainString(),
      currencyCode = domain.amount.currency.code,
      timestamp = domain.timestamp,
      note = domain.note,
      targetWalletId = domain.targetWalletId,
      targetAmount = domain.targetAmount?.amount?.toPlainString(),
      targetCurrencyCode = domain.targetAmount?.currency?.code,
      exchangeRate = domain.exchangeRate?.rate?.toPlainString(),
      exchangeRateSource = domain.exchangeRate?.source,
      createdAt = domain.createdAt
    )
  }
}
