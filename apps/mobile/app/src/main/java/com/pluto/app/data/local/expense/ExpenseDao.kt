package com.pluto.app.data.local.expense

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertExpense(expense: ExpenseEntity)

  @Query("SELECT * FROM expenses WHERE id = :id LIMIT 1")
  suspend fun getExpenseById(id: String): ExpenseEntity?

  @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
  fun observeAllExpenses(): Flow<List<ExpenseEntity>>

  @Query(
    """
    SELECT * FROM expenses 
    WHERE timestamp >= :startTime AND timestamp <= :endTime 
    ORDER BY timestamp DESC
    """
  )
  fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<ExpenseEntity>>

  @Query("SELECT * FROM expenses WHERE categoryId = :categoryId ORDER BY timestamp DESC")
  fun observeExpensesByCategory(categoryId: String): Flow<List<ExpenseEntity>>

  @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY timestamp DESC")
  fun observeExpensesByTrip(tripId: String): Flow<List<ExpenseEntity>>

  @Query("DELETE FROM expenses WHERE id = :id")
  suspend fun deleteExpenseById(id: String)

  @Query("SELECT COUNT(*) FROM expenses")
  suspend fun getExpenseCount(): Int

  @Query("SELECT * FROM expenses WHERE isRecurring = 1 ORDER BY timestamp DESC")
  suspend fun getRecurringExpenses(): List<ExpenseEntity>

  @Query("SELECT * FROM expenses ORDER BY timestamp DESC")
  suspend fun getAllExpenses(): List<ExpenseEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertExpenses(expenses: List<ExpenseEntity>)

  @Query("DELETE FROM expenses")
  suspend fun clearAll()
}
