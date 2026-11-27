package com.pluto.app.domain.repository

import com.pluto.app.domain.model.Expense
import kotlinx.coroutines.flow.Flow

/**
 * Domain repository contract for expense management.
 *
 * Manages persisting, querying, and updating expenses while preserving
 * both original currency and reference currency financial representations.
 */
interface ExpenseRepository {
  /**
   * Observes all recorded expenses, ordered by timestamp descending.
   */
  fun observeAllExpenses(): Flow<List<Expense>>

  /**
   * Observes expenses filtered by a specific date range [startTime, endTime].
   */
  fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<Expense>>

  /**
   * Observes expenses for a specific category.
   */
  fun observeExpensesByCategory(categoryId: String): Flow<List<Expense>>

  /**
   * Observes expenses associated with a specific period id.
   */
  fun observeExpensesByTrip(tripId: String): Flow<List<Expense>>

  /**
   * Gets a specific expense by its unique identifier.
   */
  suspend fun getExpenseById(id: String): Expense?

  /**
   * Saves or updates an expense.
   */
  suspend fun saveExpense(expense: Expense)

  /**
   * Deletes an expense by its unique identifier.
   */
  suspend fun deleteExpense(id: String)

  /**
   * Retrieves all recurring expenses configured for recurring automation.
   */
  suspend fun getRecurringExpenses(): List<Expense> = emptyList()
}
