package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.RecurrenceFrequency
import com.pluto.app.domain.repository.ExpenseRepository
import java.util.UUID

/**
 * Automates logging of due recurring expenses (subscriptions and fixed costs).
 *
 * For each recurring expense configured by the user:
 * - Checks when the next payment was due based on [lastRecurrenceLoggedMillis] or original [timestamp].
 * - If the next due date has arrived (up to [nowMillis]), automatically generates and persists
 *   a new logged transaction instance preserving original amount and category.
 * - Obtains the conversion rate for accurate dual-currency tracking.
 * - Advances [lastRecurrenceLoggedMillis] on the parent recurring expense.
 */
class ProcessRecurringExpensesUseCase(
  private val expenseRepository: ExpenseRepository,
  private val convertCurrencyUseCase: ConvertCurrencyUseCase
) {

  suspend operator fun invoke(nowMillis: Long = System.currentTimeMillis()): List<Expense> {
    val recurringParents = expenseRepository.getRecurringExpenses()
    val newlyLogged = mutableListOf<Expense>()

    for (parent in recurringParents) {
      val freq = parent.recurrenceFrequency ?: RecurrenceFrequency.MONTHLY
      var lastLogged = parent.lastRecurrenceLoggedMillis ?: parent.timestamp
      var nextDue = freq.getNextTimestamp(lastLogged)
      var hasAdvanced = false

      // Catch up any due occurrences (limit iterations to 12 to prevent runaway loops)
      var iterations = 0
      while (nextDue <= nowMillis && iterations < 12) {
        iterations++
        val conversion = convertCurrencyUseCase(parent.originalAmount, parent.homeCurrency)
        val homeMoney = if (conversion is ConversionResult.Success) {
          conversion.convertedMoney
        } else {
          parent.exchangeRate.convert(parent.originalAmount)
        }
        val rate = if (conversion is ConversionResult.Success) {
          conversion.exchangeRate
        } else {
          parent.exchangeRate
        }

        val autoInstance = Expense(
          id = UUID.randomUUID().toString(),
          originalAmount = parent.originalAmount,
          homeAmount = homeMoney,
          exchangeRate = rate,
          category = parent.category,
          timestamp = nextDue,
          merchant = parent.merchant,
          note = if (parent.note.isNotBlank()) "${parent.note} (Auto-logged subscription)" else "Auto-logged subscription",
          location = parent.location,
          tripId = parent.tripId,
          receiptUri = parent.receiptUri,
          isRecurring = false,
          recurrenceFrequency = null,
          lastRecurrenceLoggedMillis = null
        )

        expenseRepository.saveExpense(autoInstance)
        newlyLogged.add(autoInstance)
        lastLogged = nextDue
        hasAdvanced = true
        nextDue = freq.getNextTimestamp(lastLogged)
      }

      if (hasAdvanced) {
        val updatedParent = parent.copy(lastRecurrenceLoggedMillis = lastLogged)
        expenseRepository.saveExpense(updatedParent)
      }
    }

    return newlyLogged
  }
}
