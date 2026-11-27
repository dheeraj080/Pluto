package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import java.math.BigDecimal
import java.util.UUID

sealed interface CreateExpenseResult {
  data class Success(val expense: Expense) : CreateExpenseResult
  data class InvalidInput(val reason: String) : CreateExpenseResult
  data class ConversionUnavailable(val fromCurrency: Currency, val homeCurrency: Currency) : CreateExpenseResult
  data class Failure(val message: String) : CreateExpenseResult
}

/**
 * Encapsulates expense creation business rules:
 * - Validates input amount (must be positive), optional custom rate (must be positive), and transaction date (no future dates).
 * - Reads user's current reference home currency unless overridden via [targetHomeCurrency].
 * - Resolves exchange rate (custom per-expense rate, identity, historical lookup for backdated transactions, or live/cached rate).
 * - Immutably captures the original amount, converted amount, and exchange rate snapshot.
 * - Persists through [ExpenseRepository].
 */
class CreateExpenseUseCase(
  private val expenseRepository: ExpenseRepository,
  private val userSettingsRepository: UserSettingsRepository,
  private val convertCurrencyUseCase: ConvertCurrencyUseCase
) {

  suspend operator fun invoke(
    amount: BigDecimal,
    currency: Currency,
    category: Category,
    timestamp: Long = System.currentTimeMillis(),
    merchant: String = "",
    note: String = "",
    location: String? = null,
    tripId: String? = null,
    receiptUri: String? = null,
    targetHomeCurrency: Currency? = null,
    isRecurring: Boolean = false,
    recurrenceFrequency: com.pluto.app.domain.model.RecurrenceFrequency? = null,
    customExchangeRate: BigDecimal? = null,
    forceLiveRate: Boolean = false
  ): CreateExpenseResult {
    // 1. Validation
    if (amount <= BigDecimal.ZERO) {
      return CreateExpenseResult.InvalidInput("Amount must be greater than zero")
    }
    if (customExchangeRate != null && customExchangeRate <= BigDecimal.ZERO) {
      return CreateExpenseResult.InvalidInput("Exchange rate must be greater than zero")
    }

    val now = System.currentTimeMillis()
    // Disallow transactions dated significantly in the future (allow up to 5 min clock skew)
    if (timestamp > now + 5 * 60 * 1000L) {
      return CreateExpenseResult.InvalidInput("Transaction date cannot be in the future")
    }

    val originalMoney = Money.of(amount, currency)
    val homeCurrency = targetHomeCurrency ?: userSettingsRepository.getSettings().homeCurrency

    // 2. Currency Conversion (explicit per-expense custom rate or resolved historical/market rate)
    val conversion = if (customExchangeRate != null) {
      if (currency == homeCurrency) {
        val identityRate = ExchangeRate.identity(homeCurrency)
        ConversionResult.Success(
          convertedMoney = originalMoney,
          exchangeRate = identityRate,
          isCached = false
        )
      } else {
        val customRateObj = ExchangeRate(
          fromCurrency = currency,
          toCurrency = homeCurrency,
          rate = customExchangeRate,
          timestamp = now,
          source = "expense_custom_rate"
        )
        ConversionResult.Success(
          convertedMoney = customRateObj.convert(originalMoney),
          exchangeRate = customRateObj,
          isCached = false
        )
      }
    } else {
      convertCurrencyUseCase(
        amount = originalMoney,
        targetCurrency = homeCurrency,
        forceRefresh = forceLiveRate,
        atTimestamp = if (forceLiveRate) null else timestamp
      )
    }

    when (conversion) {
      is ConversionResult.Success -> {
        val expense = Expense(
          id = UUID.randomUUID().toString(),
          originalAmount = originalMoney,
          homeAmount = conversion.convertedMoney,
          exchangeRate = conversion.exchangeRate,
          category = category,
          timestamp = timestamp,
          merchant = merchant.trim(),
          note = note.trim(),
          location = location?.trim(),
          tripId = tripId,
          receiptUri = receiptUri,
          isRecurring = isRecurring,
          recurrenceFrequency = if (isRecurring) (recurrenceFrequency ?: com.pluto.app.domain.model.RecurrenceFrequency.MONTHLY) else null,
          lastRecurrenceLoggedMillis = if (isRecurring) timestamp else null,
          createdAt = now,
          updatedAt = now
        )

        return try {
          expenseRepository.saveExpense(expense)
          CreateExpenseResult.Success(expense)
        } catch (e: Exception) {
          CreateExpenseResult.Failure(e.message ?: "Failed to persist expense")
        }
      }

      is ConversionResult.RateUnavailable -> {
        return CreateExpenseResult.ConversionUnavailable(
          fromCurrency = currency,
          homeCurrency = homeCurrency
        )
      }

      is ConversionResult.Pending -> {
        return CreateExpenseResult.ConversionUnavailable(
          fromCurrency = currency,
          homeCurrency = homeCurrency
        )
      }
    }
  }
}
