package com.pluto.app.domain.repository

/**
 * Abstraction for executing multi-step repository operations inside an atomic database transaction.
 * Production implementations delegate to Room's `database.withTransaction`; tests may supply a
 * direct or rollback-verifying runner.
 */
interface TransactionRunner {
  suspend fun <T> runInTransaction(block: suspend () -> T): T
}

object DirectTransactionRunner : TransactionRunner {
  override suspend fun <T> runInTransaction(block: suspend () -> T): T = block()
}
