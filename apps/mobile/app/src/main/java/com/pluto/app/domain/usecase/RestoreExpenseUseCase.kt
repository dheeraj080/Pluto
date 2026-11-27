package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.repository.ExpenseRepository

/**
 * Restores a previously deleted [Expense] snapshot while preserving its original ID,
 * original currency amount, home currency converted amount, exchange rate snapshot,
 * and original creation timestamp.
 */
class RestoreExpenseUseCase(
  private val expenseRepository: ExpenseRepository
) {
  suspend operator fun invoke(expense: Expense): Expense {
    val restored = expense.copy(
      updatedAt = maxOf(expense.updatedAt, System.currentTimeMillis())
    )
    expenseRepository.saveExpense(restored)
    return restored
  }
}
