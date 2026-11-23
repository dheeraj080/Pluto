package com.pluto.app.data.repository

import com.pluto.app.data.local.expense.ExpenseDao
import com.pluto.app.data.local.expense.ExpenseEntityMapper
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.repository.ExpenseRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Concrete implementation of [ExpenseRepository] backed by Room database.
 */
class RoomExpenseRepository(
  private val dao: ExpenseDao
) : ExpenseRepository {

  override fun observeAllExpenses(): Flow<List<Expense>> {
    return dao.observeAllExpenses().map { list ->
      list.mapNotNull { ExpenseEntityMapper.toDomain(it) }
    }
  }

  override fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<Expense>> {
    return dao.observeExpensesByDateRange(startTime, endTime).map { list ->
      list.mapNotNull { ExpenseEntityMapper.toDomain(it) }
    }
  }

  override fun observeExpensesByCategory(categoryId: String): Flow<List<Expense>> {
    return dao.observeExpensesByCategory(categoryId).map { list ->
      list.mapNotNull { ExpenseEntityMapper.toDomain(it) }
    }
  }

  override fun observeExpensesByTrip(tripId: String): Flow<List<Expense>> {
    return dao.observeExpensesByTrip(tripId).map { list ->
      list.mapNotNull { ExpenseEntityMapper.toDomain(it) }
    }
  }

  override suspend fun getExpenseById(id: String): Expense? {
    return dao.getExpenseById(id)?.let { ExpenseEntityMapper.toDomain(it) }
  }

  override suspend fun saveExpense(expense: Expense) {
    dao.insertExpense(ExpenseEntityMapper.toEntity(expense))
  }

  override suspend fun deleteExpense(id: String) {
    dao.deleteExpenseById(id)
  }

  override suspend fun getRecurringExpenses(): List<Expense> {
    return dao.getRecurringExpenses().mapNotNull { ExpenseEntityMapper.toDomain(it) }
  }
}
