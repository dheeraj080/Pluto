package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.repository.ExpenseRepository
import kotlinx.coroutines.flow.Flow

class ObserveExpensesUseCase(
  private val expenseRepository: ExpenseRepository
) {
  operator fun invoke(): Flow<List<Expense>> {
    return expenseRepository.observeAllExpenses()
  }
}
