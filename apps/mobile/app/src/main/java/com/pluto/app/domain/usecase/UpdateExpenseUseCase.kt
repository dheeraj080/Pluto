package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import java.math.BigDecimal

sealed interface UpdateExpenseResult {
  data class Success(val expense: Expense) : UpdateExpenseResult
  data class InvalidInput(val reason: String) : UpdateExpenseResult
  data class ConversionUnavailable(val fromCurrency: Currency, val homeCurrency: Currency) : UpdateExpenseResult
  data class Failure(val message: String) : UpdateExpenseResult
}

/**
 * Use case to update an existing expense.
 *
 * Implements strict financial snapshot rules:
 * - Case A (Metadata-only): If amount, currency, and date are unchanged, preserves the original
 *   exchange-rate snapshot, rate timestamp, rate source, and home amount exactly.
 * - Case B (Financial change): If amount, currency, or date change, obtains an appropriate exchange
 *   rate for the edited transaction using [ConvertCurrencyUseCase] and creates a new valid conversion snapshot.
 *   If conversion is unavailable, fails safely and DOES NOT mutate the expense.
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
    newRecurrenceFrequency: com.pluto.app.domain.model.RecurrenceFrequency? = existingExpense.recurrenceFrequency
  ): UpdateExpenseResult {
    // 1. Validation
    if (newAmount <= BigDecimal.ZERO) {
      return UpdateExpenseResult.InvalidInput("Amount must be greater than zero")
    }

    val now = System.currentTimeMillis()
    if (newTimestamp > now + 5 * 60 * 1000L) {
      return UpdateExpenseResult.InvalidInput("Transaction date cannot be in the future")
    }

    val isFinancialChange =
      existingExpense.originalAmount.amount.compareTo(newAmount) != 0 ||
        existingExpense.originalCurrency != newCurrency ||
        existingExpense.homeCurrency != newHomeCurrency ||
        existingExpense.timestamp != newTimestamp

    if (!isFinancialChange) {
      // Case A: Metadata-only edit — Preserve the original conversion snapshot exactly!
      val updatedExpense = existingExpense.copy(
        category = newCategory,
        merchant = newMerchant.trim(),
        note = newNote.trim(),
        receiptUri = newReceiptUri,
        isRecurring = newIsRecurring,
        recurrenceFrequency = if (newIsRecurring) (newRecurrenceFrequency ?: com.pluto.app.domain.model.RecurrenceFrequency.MONTHLY) else null
      )

      return try {
        expenseRepository.saveExpense(updatedExpense)
        UpdateExpenseResult.Success(updatedExpense)
      } catch (e: Exception) {
        UpdateExpenseResult.Failure(e.message ?: "Failed to update expense metadata")
      }
    } else {
      // Case B: Financial change — Calculate a new valid conversion snapshot
      val newOriginalMoney = Money.of(newAmount, newCurrency)
      val homeCurrency = newHomeCurrency

      when (val conversion = convertCurrencyUseCase(newOriginalMoney, homeCurrency)) {
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
            recurrenceFrequency = if (newIsRecurring) (newRecurrenceFrequency ?: com.pluto.app.domain.model.RecurrenceFrequency.MONTHLY) else null
          )

          return try {
            expenseRepository.saveExpense(updatedExpense)
            UpdateExpenseResult.Success(updatedExpense)
          } catch (e: Exception) {
            UpdateExpenseResult.Failure(e.message ?: "Failed to update expense")
          }
        }

        is ConversionResult.RateUnavailable -> {
          return UpdateExpenseResult.ConversionUnavailable(
            fromCurrency = newCurrency,
            homeCurrency = homeCurrency
          )
        }

        is ConversionResult.Pending -> {
          return UpdateExpenseResult.ConversionUnavailable(
            fromCurrency = newCurrency,
            homeCurrency = homeCurrency
          )
        }
      }
    }
  }
}
