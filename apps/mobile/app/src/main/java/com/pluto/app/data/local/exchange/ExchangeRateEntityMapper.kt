package com.pluto.app.data.local.exchange

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Mapping between [ExchangeRateEntity] (Room persistence) and [ExchangeRate] (Domain model).
 */
object ExchangeRateEntityMapper {

  private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)

  fun toDomain(entity: ExchangeRateEntity): ExchangeRate? {
    val from = Currency.findByCode(entity.fromCurrency) ?: return null
    val to = Currency.findByCode(entity.toCurrency) ?: return null
    val rateBigDecimal = try {
      BigDecimal(entity.rate)
    } catch (_: Exception) {
      return null
    }

    return ExchangeRate(
      fromCurrency = from,
      toCurrency = to,
      rate = rateBigDecimal,
      timestamp = entity.fetchedAt,
      source = entity.source
    )
  }

  fun toEntity(
    domain: ExchangeRate,
    effectiveDate: String = dateFormat.format(Date(domain.timestamp))
  ): ExchangeRateEntity {
    return ExchangeRateEntity(
      fromCurrency = domain.fromCurrency.code,
      toCurrency = domain.toCurrency.code,
      rate = domain.rate.toPlainString(),
      effectiveDate = effectiveDate,
      fetchedAt = domain.timestamp,
      source = domain.source
    )
  }
}
