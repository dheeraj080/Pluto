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

/**
 * Explicit rate handling policy when updating an existing [Expense].
 */
enum class RateUpdatePolicy {
  /**
   * Preserves the expense's original [Expense.exchangeRate] whenever the currency pair
   * (`originalCurrency` -> `homeCurrency`) is unchanged, even if amount or date is edited.
   * Recalculates [Expense.homeAmount] using that preserved rate. If the currency pair changed,
   * resolves a valid rate for the new currency pair at the transaction timestamp.
   */
  PRESERVE_EXISTING,

  /**
   * Applies an explicit custom exchange rate supplied by the user for this transaction.
   */
  USE_CUSTOM_RATE,

  /**
   * Explicitly refreshes the exchange rate using historical/effective-dated lookup for the
   * edited transaction date (`newTimestamp`).
   */
  REFRESH_FOR_DATE,

  /**
   * Explicitly fetches the latest live market exchange rate (`forceRefresh = true`).
   */
  REFRESH_LIVE
}

sealed interface UpdateExpenseResult {
  data class Success(val expense: Expense) : UpdateExpenseResult
  data class InvalidInput(val reason: String) : UpdateExpenseResult
  data class ConversionUnavailable(val fromCurrency: Currency, val homeCurrency: Currency) : UpdateExpenseResult
  data class Failure(val message: String) : UpdateExpenseResult
}

/**
 * Use case to update an existing expense with strict historical FX snapshot preservation.
 *
 * - Metadata-only edit: preserves original amount, home amount, timestamp, and FX snapshot.
 * - Same-pair amount/date edit with default [RateUpdatePolicy.PRESERVE_EXISTING]: keeps the
 *   original [Expense.exchangeRate] (rate, timestamp, source) intact and recalculates `homeAmount`
 *   with that preserved rate.
 * - Explicit rate change ([RateUpdatePolicy.USE_CUSTOM_RATE], [RateUpdatePolicy.REFRESH_FOR_DATE],
 *   [RateUpdatePolicy.REFRESH_LIVE]) or currency-pair change: resolves and persists the new
 *   conversion snapshot, failing safely without mutating the expense if no rate is available.
 */
class UpdateExpenseUseCase(
  private val expenseRepository: ExpenseRepository,
  private val userSettingsRepository: UserSettingsRepository,
  private val convertCurrencyUseCase: ConvertCurrencyUseCase
) {

  suspend operator fun invoke(
    existingExpense: Expense,
    newAmount: BigDecimal,
    newCurrency: Currency,
    newCategory: Category,
    newTimestamp: Long,
    newMerchant: String,
    newNote: String,
    newReceiptUri: String? = existingExpense.receiptUri,
    newHomeCurrency: Currency = existingExpense.homeCurrency,
    newIsRecurring: Boolean = existingExpense.isRecurring,
    newRecurrenceFrequency: com.pluto.app.domain.model.RecurrenceFrequency? = existingExpense.recurrenceFrequency,
    rateUpdatePolicy: RateUpdatePolicy = RateUpdatePolicy.PRESERVE_EXISTING,
    customExchangeRate: BigDecimal? = null
  ): UpdateExpenseResult {
    // 1. Validation
    if (newAmount <= BigDecimal.ZERO) {
      return UpdateExpenseResult.InvalidInput("Amount must be greater than zero")
    }
    if (customExchangeRate != null && customExchangeRate <= BigDecimal.ZERO) {
      return UpdateExpenseResult.InvalidInput("Exchange rate must be greater than zero")
    }

    val now = System.currentTimeMillis()
    if (newTimestamp > now + 5 * 60 * 1000L) {
      return UpdateExpenseResult.InvalidInput("Transaction date cannot be in the future")
    }

    val effectivePolicy = if (customExchangeRate != null) {
      RateUpdatePolicy.USE_CUSTOM_RATE
    } else if (rateUpdatePolicy == RateUpdatePolicy.USE_CUSTOM_RATE) {
      return UpdateExpenseResult.InvalidInput("Custom exchange rate must be provided")
    } else {
      rateUpdatePolicy
    }

    val currenciesChanged =
      existingExpense.originalCurrency != newCurrency ||
        existingExpense.homeCurrency != newHomeCurrency
    val amountChanged = existingExpense.originalAmount.amount.compareTo(newAmount) != 0
    val dateChanged = existingExpense.timestamp != newTimestamp

    val updatedRecurrenceFreq = if (newIsRecurring) {
      newRecurrenceFrequency ?: com.pluto.app.domain.model.RecurrenceFrequency.MONTHLY
    } else {
      null
    }

    // Case A: Metadata-only edit (no financial, date, currency, or rate policy changes)
    if (!currenciesChanged && !amountChanged && !dateChanged && effectivePolicy == RateUpdatePolicy.PRESERVE_EXISTING) {
      val updatedExpense = existingExpense.copy(
        category = newCategory,
        merchant = newMerchant.trim(),
        note = newNote.trim(),
        receiptUri = newReceiptUri,
        isRecurring = newIsRecurring,
        recurrenceFrequency = updatedRecurrenceFreq,
        createdAt = existingExpense.createdAt,
        updatedAt = now
      )

      return try {
        expenseRepository.saveExpense(updatedExpense)
        UpdateExpenseResult.Success(updatedExpense)
      } catch (e: Exception) {
        UpdateExpenseResult.Failure(e.message ?: "Failed to update expense metadata")
      }
    }

    val newOriginalMoney = Money.of(newAmount, newCurrency)

    // Case B: Currency pair unchanged & preserving existing historical FX snapshot
    if (!currenciesChanged && effectivePolicy == RateUpdatePolicy.PRESERVE_EXISTING) {
      val preservedRate = existingExpense.exchangeRate
      val recalculatedHomeAmount = if (!amountChanged) {
        existingExpense.homeAmount
      } else if (newCurrency == newHomeCurrency) {
        newOriginalMoney
      } else {
        preservedRate.convert(newOriginalMoney)
      }

      val updatedExpense = existingExpense.copy(
        originalAmount = newOriginalMoney,
        homeAmount = recalculatedHomeAmount,
        exchangeRate = preservedRate,
        category = newCategory,
        timestamp = newTimestamp,
        merchant = newMerchant.trim(),
        note = newNote.trim(),
        receiptUri = newReceiptUri,
        isRecurring = newIsRecurring,
        recurrenceFrequency = updatedRecurrenceFreq,
        createdAt = existingExpense.createdAt,
        updatedAt = now
      )

      return try {
        expenseRepository.saveExpense(updatedExpense)
        UpdateExpenseResult.Success(updatedExpense)
      } catch (e: Exception) {
        UpdateExpenseResult.Failure(e.message ?: "Failed to update expense")
      }
    }

    // Case C: Explicit custom exchange rate for this transaction
    if (effectivePolicy == RateUpdatePolicy.USE_CUSTOM_RATE && customExchangeRate != null) {
      val resolvedRate = if (newCurrency == newHomeCurrency) {
        ExchangeRate.identity(newHomeCurrency)
      } else {
        ExchangeRate(
          fromCurrency = newCurrency,
          toCurrency = newHomeCurrency,
          rate = customExchangeRate,
          timestamp = now,
          source = "expense_custom_rate"
        )
      }
      val convertedHome = if (newCurrency == newHomeCurrency) {
        newOriginalMoney
      } else {
        resolvedRate.convert(newOriginalMoney)
      }

      val updatedExpense = existingExpense.copy(
        originalAmount = newOriginalMoney,
        homeAmount = convertedHome,
        exchangeRate = resolvedRate,
        category = newCategory,
        timestamp = newTimestamp,
        merchant = newMerchant.trim(),
        note = newNote.trim(),
        receiptUri = newReceiptUri,
        isRecurring = newIsRecurring,
        recurrenceFrequency = updatedRecurrenceFreq,
        createdAt = existingExpense.createdAt,
        updatedAt = now
      )

      return try {
        expenseRepository.saveExpense(updatedExpense)
        UpdateExpenseResult.Success(updatedExpense)
      } catch (e: Exception) {
        UpdateExpenseResult.Failure(e.message ?: "Failed to update expense with custom rate")
      }
    }

    // Case D: Currency pair changed OR explicit rate refresh requested
    val forceRefresh = effectivePolicy == RateUpdatePolicy.REFRESH_LIVE
    val conversion = convertCurrencyUseCase(
      amount = newOriginalMoney,
      targetCurrency = newHomeCurrency,
      forceRefresh = forceRefresh,
      atTimestamp = if (forceRefresh) null else newTimestamp
    )

    return when (conversion) {
      is ConversionResult.Success -> {
        val updatedExpense = existingExpense.copy(
          originalAmount = newOriginalMoney,
          homeAmount = conversion.convertedMoney,
          exchangeRate = conversion.exchangeRate,
          category = newCategory,
          timestamp = newTimestamp,
          merchant = newMerchant.trim(),
          note = newNote.trim(),
          receiptUri = newReceiptUri,
          isRecurring = newIsRecurring,
          recurrenceFrequency = updatedRecurrenceFreq,
          createdAt = existingExpense.createdAt,
          updatedAt = now
        )

        try {
          expenseRepository.saveExpense(updatedExpense)
          UpdateExpenseResult.Success(updatedExpense)
        } catch (e: Exception) {
          UpdateExpenseResult.Failure(e.message ?: "Failed to update expense")
        }
      }

      is ConversionResult.RateUnavailable -> {
        UpdateExpenseResult.ConversionUnavailable(
          fromCurrency = newCurrency,
          homeCurrency = newHomeCurrency
        )
      }

      is ConversionResult.Pending -> {
        UpdateExpenseResult.ConversionUnavailable(
          fromCurrency = newCurrency,
          homeCurrency = newHomeCurrency
        )
      }
    }
  }
}
