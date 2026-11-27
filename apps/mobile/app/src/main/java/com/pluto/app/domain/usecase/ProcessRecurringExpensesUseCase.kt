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
 * - Exchange rates are pre-resolved for each due date outside the DB transaction lock; a due
 *   occurrence uses its own historical rate and falls back to the parent's recorded snapshot,
 *   never to today's market rate.
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

      // Pre-resolve one rate per due date outside the DB transaction lock. A due occurrence
      // must use the rate for its own date; if none is available, the parent's recorded snapshot
      // is used instead. Today's market rate is never applied to an earlier occurrence.
      val resolvedRates = mutableMapOf<Triple<Currency, Currency, Long>, ExchangeRate>()
      recurringParents.forEach { parent ->
        val frequency = parent.recurrenceFrequency ?: RecurrenceFrequency.MONTHLY
        var lastLogged = parent.lastRecurrenceLoggedMillis ?: parent.timestamp
        var dueTimestamp = frequency.getNextTimestamp(lastLogged)
        var iterations = 0
        while (dueTimestamp <= nowMillis && iterations < 12) {
          iterations++
          val key = Triple(parent.originalCurrency, parent.homeCurrency, dueTimestamp)
          if (!resolvedRates.containsKey(key)) {
            val probe = Money.of(BigDecimal.ONE, parent.originalCurrency)
            val conversion = convertCurrencyUseCase(
              amount = probe,
              targetCurrency = parent.homeCurrency,
              atTimestamp = dueTimestamp
            )
            if (conversion is ConversionResult.Success) {
              resolvedRates[key] = conversion.exchangeRate
            }
          }
          lastLogged = dueTimestamp
          dueTimestamp = frequency.getNextTimestamp(lastLogged)
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
              val rate = resolvedRates[
                Triple(parent.originalCurrency, parent.homeCurrency, nextDue)
              ] ?: parent.exchangeRate
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
