package com.pluto.app.data.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.RoomTransactionRunner
import com.pluto.app.data.remote.cloud.FirestoreCloudSyncRepository
import com.pluto.app.data.remote.cloud.SyncingExpenseRepository
import com.pluto.app.data.remote.exchange.ExchangeRateApiClient
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.data.repository.RoomExpenseRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase
import java.util.concurrent.TimeUnit

/**
 * Background WorkManager worker that processes due recurring expenses reliably
 * using [ProcessRecurringExpensesUseCase]'s idempotent, transaction-backed execution.
 */
class RecurringExpenseWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

  override suspend fun doWork(): Result {
    return try {
      val database = AppDatabase.getInstance(applicationContext)
      val cloudRepo = FirestoreCloudSyncRepository(applicationContext)
      val expenseRepo = SyncingExpenseRepository(
        local = RoomExpenseRepository(database.expenseDao()),
        cloud = cloudRepo
      )
      val exchangeRepo = OfflineFirstExchangeRateRepository(
        dao = database.exchangeRateDao(),
        apiService = ExchangeRateApiClient.apiService
      )
      val useCase = ProcessRecurringExpensesUseCase(
        expenseRepository = expenseRepo,
        convertCurrencyUseCase = ConvertCurrencyUseCase(exchangeRepo),
        transactionRunner = RoomTransactionRunner(database)
      )
      useCase.invoke()
      Result.success()
    } catch (_: Exception) {
      if (runAttemptCount < 3) {
        Result.retry()
      } else {
        Result.failure()
      }
    }
  }

  companion object {
    const val UNIQUE_PERIODIC_WORK_NAME = "pluto_recurring_expense_periodic_sync"
    const val UNIQUE_ONE_TIME_WORK_NAME = "pluto_recurring_expense_one_time_sync"

    fun schedulePeriodicProcessing(context: Context) {
      try {
        val periodicRequest = PeriodicWorkRequestBuilder<RecurringExpenseWorker>(
          12, TimeUnit.HOURS,
          30, TimeUnit.MINUTES
        ).build()

        WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
          UNIQUE_PERIODIC_WORK_NAME,
          ExistingPeriodicWorkPolicy.KEEP,
          periodicRequest
        )
      } catch (_: Exception) {
        // Handled gracefully in test/non-WorkManager environments
      }
    }

    fun processNow(context: Context) {
      try {
        val oneTimeRequest = OneTimeWorkRequestBuilder<RecurringExpenseWorker>().build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
          UNIQUE_ONE_TIME_WORK_NAME,
          ExistingWorkPolicy.KEEP,
          oneTimeRequest
        )
      } catch (_: Exception) {
        // Handled gracefully in test/non-WorkManager environments
      }
    }
  }
}
