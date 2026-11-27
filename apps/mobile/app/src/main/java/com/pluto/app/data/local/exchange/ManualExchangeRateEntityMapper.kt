package com.pluto.app.data.local.exchange

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import java.math.BigDecimal

/**
 * Mapping between [ManualExchangeRateEntity] (Room `manual_exchange_rates` table)
 * and [ExchangeRate] (Domain model).
 */
object ManualExchangeRateEntityMapper {

  fun toDomain(entity: ManualExchangeRateEntity): ExchangeRate? {
    val from = Currency.findByCode(entity.fromCurrency) ?: return null
    val to = Currency.findByCode(entity.toCurrency) ?: return null
    if (from == to) return null

    val rateBigDecimal = try {
      BigDecimal(entity.rate.trim())
    } catch (_: Exception) {
      return null
    }
    if (rateBigDecimal.compareTo(BigDecimal.ZERO) <= 0) return null

    return ExchangeRate(
      fromCurrency = from,
      toCurrency = to,
      rate = rateBigDecimal,
      timestamp = entity.effectiveFrom,
      source = entity.source
    )
  }
}
