package com.pluto.app.data.local

import androidx.room.withTransaction
import com.pluto.app.domain.repository.TransactionRunner

class RoomTransactionRunner(
  private val database: AppDatabase
) : TransactionRunner {
  override suspend fun <T> runInTransaction(block: suspend () -> T): T {
    return database.withTransaction { block() }
  }
}
