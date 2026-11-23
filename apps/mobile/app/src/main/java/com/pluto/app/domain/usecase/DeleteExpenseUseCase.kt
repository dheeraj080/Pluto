package com.pluto.app.domain.usecase

import com.pluto.app.domain.repository.ExpenseRepository

class DeleteExpenseUseCase(
  private val expenseRepository: ExpenseRepository
) {
  suspend operator fun invoke(id: String) {
    expenseRepository.deleteExpense(id)
  }
}
