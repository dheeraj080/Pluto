package com.pluto.app.data.local.expense

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import java.math.BigDecimal

/**
 * Bidirectional mapping between [ExpenseEntity] (Room data layer) and [Expense] (domain model).
 */
object ExpenseEntityMapper {

  fun toDomain(entity: ExpenseEntity): Expense? {
    val originalCurrency = Currency.findByCode(entity.originalCurrencyCode) ?: return null
    val homeCurrency = Currency.findByCode(entity.homeCurrencyCode) ?: return null

    val originalAmountBigDecimal = try {
      BigDecimal(entity.originalAmount)
    } catch (_: Exception) {
      return null
    }

    val homeAmountBigDecimal = try {
      BigDecimal(entity.homeAmount)
    } catch (_: Exception) {
      return null
    }

    val rateBigDecimal = try {
      BigDecimal(entity.exchangeRate)
    } catch (_: Exception) {
      return null
    }

    val exchangeRate = ExchangeRate(
      fromCurrency = originalCurrency,
      toCurrency = homeCurrency,
      rate = rateBigDecimal,
      timestamp = entity.exchangeRateTimestamp,
      source = entity.exchangeRateSource
    )

    val category = Category.findById(entity.categoryId)
    val recurrenceFreq = com.pluto.app.domain.model.RecurrenceFrequency.fromName(entity.recurrenceFrequency)

    return Expense(
      id = entity.id,
      originalAmount = Money.of(originalAmountBigDecimal, originalCurrency),
      homeAmount = Money.of(homeAmountBigDecimal, homeCurrency),
      exchangeRate = exchangeRate,
      category = category,
      timestamp = entity.timestamp,
      merchant = entity.merchant,
      note = entity.note,
      location = entity.location,
      tripId = entity.tripId,
      receiptUri = entity.receiptUri,
      isRecurring = entity.isRecurring,
      recurrenceFrequency = recurrenceFreq,
      lastRecurrenceLoggedMillis = entity.lastRecurrenceLoggedMillis,
      createdAt = entity.createdAt,
      updatedAt = entity.updatedAt
    )
  }

  fun toEntity(domain: Expense): ExpenseEntity {
    return ExpenseEntity(
      id = domain.id,
      originalAmount = domain.originalAmount.amount.toPlainString(),
      originalCurrencyCode = domain.originalCurrency.code,
      homeAmount = domain.homeAmount.amount.toPlainString(),
      homeCurrencyCode = domain.homeCurrency.code,
      exchangeRate = domain.exchangeRate.rate.toPlainString(),
      exchangeRateTimestamp = domain.exchangeRate.timestamp,
      exchangeRateSource = domain.exchangeRate.source,
      categoryId = domain.category.id,
      timestamp = domain.timestamp,
      merchant = domain.merchant,
      note = domain.note,
      location = domain.location,
      tripId = domain.tripId,
      receiptUri = domain.receiptUri,
      isRecurring = domain.isRecurring,
      recurrenceFrequency = domain.recurrenceFrequency?.name,
      lastRecurrenceLoggedMillis = domain.lastRecurrenceLoggedMillis,
      createdAt = domain.createdAt,
      updatedAt = domain.updatedAt
    )
  }
}
