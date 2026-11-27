package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.ConversionResult
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.RecurrenceFrequency
import com.pluto.app.domain.repository.DirectTransactionRunner
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.TransactionRunner
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.math.BigDecimal

/**
 * Automates idempotent logging of due recurring expenses (subscriptions and fixed costs).
 *
 * Guarantees against duplicate occurrences even under concurrent ViewModel + WorkManager runs:
 * - Process-wide [processingMutex] serializes overlapping invocations.
 * - Exchange rates are pre-resolved outside the DB transaction lock.
 * - Each parent is re-read and advanced inside [TransactionRunner.runInTransaction].
 * - Each scheduled occurrence uses deterministic ID `"rec_<parentId>_<dueTimestamp>"` and is
 *   inserted only if absent from the repository.
 */
class ProcessRecurringExpensesUseCase(
  private val expenseRepository: ExpenseRepository,
  private val convertCurrencyUseCase: ConvertCurrencyUseCase,
  private val transactionRunner: TransactionRunner = DirectTransactionRunner
) {

  suspend operator fun invoke(nowMillis: Long = System.currentTimeMillis()): List<Expense> =
    processingMutex.withLock {
      val recurringParents = expenseRepository.getRecurringExpenses()
      if (recurringParents.isEmpty()) return@withLock emptyList()

      // Pre-resolve FX rates outside DB transaction to avoid holding SQLite write locks over network calls
      val resolvedRates = mutableMapOf<Pair<Currency, Currency>, ExchangeRate>()
      recurringParents
        .map { it.originalCurrency to it.homeCurrency }
        .distinct()
        .forEach { (from, to) ->
          val probe = Money.of(BigDecimal.ONE, from)
          val conversion = convertCurrencyUseCase(probe, to)
          if (conversion is ConversionResult.Success) {
            resolvedRates[from to to] = conversion.exchangeRate
          }
        }

      val newlyLogged = mutableListOf<Expense>()

      for (parentSummary in recurringParents) {
        transactionRunner.runInTransaction {
          val parent = expenseRepository.getExpenseById(parentSummary.id) ?: return@runInTransaction
          if (!parent.isRecurring) return@runInTransaction

          val freq = parent.recurrenceFrequency ?: RecurrenceFrequency.MONTHLY
          var lastLogged = parent.lastRecurrenceLoggedMillis ?: parent.timestamp
          var nextDue = freq.getNextTimestamp(lastLogged)
          var hasAdvanced = false

          // Catch up any due occurrences (limit iterations to 12 to prevent runaway loops)
          var iterations = 0
          while (nextDue <= nowMillis && iterations < 12) {
            iterations++
            val deterministicId = occurrenceId(parent.id, nextDue)
            val existingOccurrence = expenseRepository.getExpenseById(deterministicId)
            if (existingOccurrence == null) {
              val rate = resolvedRates[parent.originalCurrency to parent.homeCurrency] ?: parent.exchangeRate
              val homeMoney = rate.convert(parent.originalAmount)

              val autoInstance = Expense(
                id = deterministicId,
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
                lastRecurrenceLoggedMillis = null,
                createdAt = nowMillis,
                updatedAt = nowMillis
              )

              expenseRepository.saveExpense(autoInstance)
              newlyLogged.add(autoInstance)
            }
            lastLogged = nextDue
            hasAdvanced = true
            nextDue = freq.getNextTimestamp(lastLogged)
          }

          if (hasAdvanced) {
            val updatedParent = parent.copy(
              lastRecurrenceLoggedMillis = lastLogged,
              updatedAt = maxOf(parent.updatedAt, nowMillis)
            )
            expenseRepository.saveExpense(updatedParent)
          }
        }
      }

      newlyLogged
    }

  companion object {
    private val processingMutex = Mutex()

    fun occurrenceId(parentId: String, dueTimestamp: Long): String {
      return "rec_${parentId}_$dueTimestamp"
    }
  }
}
