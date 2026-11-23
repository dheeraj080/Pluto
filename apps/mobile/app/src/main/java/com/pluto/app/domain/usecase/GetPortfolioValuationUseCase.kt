package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.PortfolioValuationSummary
import com.pluto.app.domain.model.WalletValuation
import com.pluto.app.domain.repository.ExchangeRateRepository
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Domain UseCase to calculate current portfolio valuation for all wallets.
 *
 * Distinct from historical expense accounting:
 * 1. Uses current / cached exchange rates to evaluate holding values.
 * 2. Employs identity conversion (1:1) when wallet.currency == homeCurrency without network calls.
 * 3. Does not fabricate missing exchange rates: unvalued wallets are explicitly marked as unavailable.
 * 4. Calculates portfolio composition percentage using BigDecimal against valued holdings.
 */
class GetPortfolioValuationUseCase(
  private val exchangeRateRepository: ExchangeRateRepository
) {

  suspend operator fun invoke(
    wallets: List<CurrencyWallet>,
    homeCurrency: Currency,
    destinationCurrency: Currency = homeCurrency
  ): PortfolioValuationSummary {
    if (wallets.isEmpty()) {
      return PortfolioValuationSummary(
        homeCurrency = homeCurrency,
        destinationCurrency = destinationCurrency,
        totalValuedHomeAmount = Money.zero(homeCurrency),
        totalValuedDestAmount = Money.zero(destinationCurrency),
        walletValuations = emptyList(),
        totalWalletsCount = 0,
        valuedWalletsCount = 0,
        unavailableWalletsCount = 0
      )
    }

    var totalValuedBigDecimal = BigDecimal.ZERO
    val intermediateValuations = mutableListOf<WalletValuation>()

    for (wallet in wallets) {
      if (wallet.currency == homeCurrency) {
        // Identity conversion (1:1)
        val homeMoney = wallet.balance
        val identityRate = ExchangeRate.identity(homeCurrency)
        totalValuedBigDecimal = totalValuedBigDecimal.add(homeMoney.amount)
        intermediateValuations.add(
          WalletValuation.Valued(
            wallet = wallet,
            homeValue = homeMoney,
            currentRate = identityRate,
            isIdentity = true,
            isStale = false
          )
        )
      } else {
        // Obtain current or cached exchange rate
        val rate = exchangeRateRepository.getRate(
          from = wallet.currency,
          to = homeCurrency,
          allowOfflineCache = true
        )

        if (rate != null) {
          val convertedHomeMoney = rate.convert(wallet.balance)
          totalValuedBigDecimal = totalValuedBigDecimal.add(convertedHomeMoney.amount)
          val isStale = rate.source.contains("stale")
          intermediateValuations.add(
            WalletValuation.Valued(
              wallet = wallet,
              homeValue = convertedHomeMoney,
              currentRate = rate,
              isIdentity = false,
              isStale = isStale
            )
          )
        } else {
          intermediateValuations.add(
            WalletValuation.Unavailable(
              wallet = wallet,
              reason = "Exchange rate unavailable for ${wallet.currency.code} to ${homeCurrency.code}"
            )
          )
        }
      }
    }

    // Obtain exchange rate from homeCurrency to destinationCurrency for dual-currency valuation
    val rateHomeToDest: ExchangeRate? = if (destinationCurrency == homeCurrency) {
      ExchangeRate.identity(homeCurrency)
    } else {
      exchangeRateRepository.getRate(
        from = homeCurrency,
        to = destinationCurrency,
        allowOfflineCache = true
      )
    }

    // Calculate portfolio composition percentages and destination currency values for valued wallets
    val finalValuations = intermediateValuations.map { valuation ->
      if (valuation is WalletValuation.Valued) {
        val percentage = if (totalValuedBigDecimal.compareTo(BigDecimal.ZERO) > 0) {
          valuation.homeValue.amount.multiply(BigDecimal(100))
            .divide(totalValuedBigDecimal, 1, RoundingMode.HALF_EVEN)
        } else {
          BigDecimal.ZERO.setScale(1)
        }

        val destValue = if (valuation.wallet.currency == destinationCurrency) {
          valuation.wallet.balance
        } else if (rateHomeToDest != null) {
          rateHomeToDest.convert(valuation.homeValue)
        } else if (destinationCurrency == homeCurrency) {
          valuation.homeValue
        } else null

        valuation.copy(
          compositionPercentage = percentage,
          destValue = destValue
        )
      } else {
        valuation
      }
    }

    val valuedCount = finalValuations.count { it is WalletValuation.Valued }
    val unavailableCount = finalValuations.count { it is WalletValuation.Unavailable }

    val totalValuedDestAmount = if (rateHomeToDest != null && totalValuedBigDecimal > BigDecimal.ZERO) {
      rateHomeToDest.convert(Money.of(totalValuedBigDecimal, homeCurrency))
    } else if (destinationCurrency == homeCurrency) {
      Money.of(totalValuedBigDecimal, homeCurrency)
    } else null

    return PortfolioValuationSummary(
      homeCurrency = homeCurrency,
      destinationCurrency = destinationCurrency,
      totalValuedHomeAmount = Money.of(totalValuedBigDecimal, homeCurrency),
      totalValuedDestAmount = totalValuedDestAmount,
      walletValuations = finalValuations,
      totalWalletsCount = wallets.size,
      valuedWalletsCount = valuedCount,
      unavailableWalletsCount = unavailableCount
    )
  }
}
