package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.repository.ExchangeRateRepository
import java.util.Calendar

/**
 * Domain UseCase to convert money from one currency to another.
 * Handles identity conversions, historical date lookups, cached rates, inverse rates,
 * and offline fallbacks cleanly.
 */
class ConvertCurrencyUseCase(
  private val exchangeRateRepository: ExchangeRateRepository,
  private val nowProvider: () -> Long = { System.currentTimeMillis() }
) {
  suspend operator fun invoke(
    amount: Money,
    targetCurrency: Currency,
    forceRefresh: Boolean = false,
    atTimestamp: Long? = null
  ): ConversionResult {
    if (amount.currency == targetCurrency) {
      val identityRate = ExchangeRate.identity(targetCurrency)
      return ConversionResult.Success(
        convertedMoney = amount,
        exchangeRate = identityRate,
        isCached = false
      )
    }

    val currentNow = nowProvider()

    if (!forceRefresh) {
      val effectiveTimestamp = atTimestamp ?: currentNow

      // 1. Always check effective-dated manual override at the exact lookup timestamp using
      // half-open [effectiveFrom, expiresAt) bounds, short-circuiting before any API lookup.
      val manualOverride = exchangeRateRepository.getManualOverride(
        from = amount.currency,
        to = targetCurrency,
        atTimestamp = effectiveTimestamp
      )
      if (manualOverride != null) {
        val converted = manualOverride.convert(amount)
        return ConversionResult.Success(
          convertedMoney = converted,
          exchangeRate = manualOverride,
          isCached = true
        )
      }

      // 2. For prior calendar days, strictly require date-matched historical rates;
      // never silently fall back to latest/live API rates or current-time manual overrides.
      if (atTimestamp != null && isPriorCalendarDay(atTimestamp, currentNow)) {
        val directHistorical = exchangeRateRepository.getHistoricalRate(
          from = amount.currency,
          to = targetCurrency,
          timestamp = atTimestamp
        )
        if (directHistorical != null) {
          val converted = directHistorical.convert(amount)
          return ConversionResult.Success(
            convertedMoney = converted,
            exchangeRate = directHistorical,
            isCached = true
          )
        }

        val inverseHistorical = exchangeRateRepository.getHistoricalRate(
          from = targetCurrency,
          to = amount.currency,
          timestamp = atTimestamp
        )
        if (inverseHistorical != null) {
          val derivedRate = inverseHistorical.inverse()
          val converted = derivedRate.convert(amount)
          return ConversionResult.Success(
            convertedMoney = converted,
            exchangeRate = derivedRate,
            isCached = true
          )
        }

        return ConversionResult.RateUnavailable(
          fromCurrency = amount.currency,
          toCurrency = targetCurrency,
          reason = "No historical exchange rate found for ${amount.currency.code} to ${targetCurrency.code}"
        )
      }

      // 3. Same calendar day (or current-time lookup) with no applicable manual override at
      // effectiveTimestamp: resolve market/API rate without consulting current-time manual overrides.
      val directMarket = exchangeRateRepository.getMarketRate(
        from = amount.currency,
        to = targetCurrency,
        allowOfflineCache = true
      )
      if (directMarket != null) {
        val converted = directMarket.convert(amount)
        return ConversionResult.Success(
          convertedMoney = converted,
          exchangeRate = directMarket,
          isCached = directMarket.source != "open_er_api"
        )
      }

      val inverseMarket = exchangeRateRepository.getMarketRate(
        from = targetCurrency,
        to = amount.currency,
        allowOfflineCache = true
      )
      if (inverseMarket != null) {
        val derivedRate = inverseMarket.inverse()
        val converted = derivedRate.convert(amount)
        return ConversionResult.Success(
          convertedMoney = converted,
          exchangeRate = derivedRate,
          isCached = derivedRate.source != "open_er_api"
        )
      }

      return ConversionResult.RateUnavailable(
        fromCurrency = amount.currency,
        toCurrency = targetCurrency,
        reason = "No exchange rate found for ${amount.currency.code} to ${targetCurrency.code}"
      )
    }

    // 4. Explicit live refresh (forceRefresh == true)
    val directRate = exchangeRateRepository.getRate(
      from = amount.currency,
      to = targetCurrency,
      allowOfflineCache = false
    )
    if (directRate != null) {
      val converted = directRate.convert(amount)
      return ConversionResult.Success(
        convertedMoney = converted,
        exchangeRate = directRate,
        isCached = directRate.source != "open_er_api"
      )
    }

    val inversePairRate = exchangeRateRepository.getRate(
      from = targetCurrency,
      to = amount.currency,
      allowOfflineCache = false
    )
    if (inversePairRate != null) {
      val derivedRate = inversePairRate.inverse()
      val converted = derivedRate.convert(amount)
      return ConversionResult.Success(
        convertedMoney = converted,
        exchangeRate = derivedRate,
        isCached = derivedRate.source != "open_er_api"
      )
    }

    return ConversionResult.RateUnavailable(
      fromCurrency = amount.currency,
      toCurrency = targetCurrency,
      reason = "No exchange rate found for ${amount.currency.code} to ${targetCurrency.code}"
    )
  }

  companion object {
    fun isPriorCalendarDay(timestamp: Long, nowMillis: Long = System.currentTimeMillis()): Boolean {
      if (timestamp >= nowMillis) return false
      val targetCal = Calendar.getInstance().apply { timeInMillis = timestamp }
      val nowCal = Calendar.getInstance().apply { timeInMillis = nowMillis }
      val targetYear = targetCal.get(Calendar.YEAR)
      val nowYear = nowCal.get(Calendar.YEAR)
      if (targetYear != nowYear) return targetYear < nowYear
      return targetCal.get(Calendar.DAY_OF_YEAR) < nowCal.get(Calendar.DAY_OF_YEAR)
    }
  }
}
