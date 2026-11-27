package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.repository.ExpenseRepository

class DeleteExpenseUseCase(
  private val expenseRepository: ExpenseRepository
) {
  suspend operator fun invoke(id: String): Expense? {
    val snapshot = expenseRepository.getExpenseById(id)
    expenseRepository.deleteExpense(id)
    return snapshot
  }
}
