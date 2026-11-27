package com.pluto.app.data.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.remote.exchange.ExchangeRateApiClient
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.Currency
import java.util.concurrent.TimeUnit

/**
 * Background WorkManager worker responsible for prefetching fresh foreign exchange rates
 * for active travel pairs and popular global currencies.
 *
 * Runs with battery-not-low and network-connected constraints so that travelers always have
 * instantaneous, offline-ready rates cached in Room and memory when opening the app.
 */
class ExchangeRateSyncWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

  override suspend fun doWork(): Result {
    return try {
      val database = AppDatabase.getInstance(applicationContext)
      val apiService = ExchangeRateApiClient.apiService
      val repository = OfflineFirstExchangeRateRepository(
        dao = database.exchangeRateDao(),
        manualDao = database.manualExchangeRateDao(),
        apiService = apiService
      )
      val userSettingsRepository = SharedPreferencesUserSettingsRepository(applicationContext)
      val settings = userSettingsRepository.getSettings()

      val homeCurrency = settings.homeCurrency
      val destinationCurrency = settings.destinationCurrency

      // 1. Prefetch active travel pair
      repository.getRate(homeCurrency, destinationCurrency, allowOfflineCache = false)

      // 2. Prefetch primary global travel currencies to ensure warm offline matrix
      val globalCurrencies = listOf(
        Currency.USD,
        Currency.EUR,
        Currency.GBP,
        Currency.JPY,
        Currency.CAD,
        Currency.AUD
      )

      globalCurrencies.forEach { base ->
        if (base != homeCurrency) {
          repository.getRate(base, homeCurrency, allowOfflineCache = false)
        }
      }

      Result.success()
    } catch (e: Exception) {
      if (runAttemptCount < 3) {
        Result.retry()
      } else {
        Result.failure()
      }
    }
  }

  companion object {
    const val UNIQUE_PERIODIC_WORK_NAME = "pluto_exchange_rate_periodic_sync"
    const val UNIQUE_ONE_TIME_WORK_NAME = "pluto_exchange_rate_one_time_sync"

    /**
     * Schedules periodic exchange rate prefetching every 6 hours with unmetered/connected network
     * and non-low battery constraints.
     */
    fun schedulePeriodicSync(context: Context) {
      try {
        val constraints = Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .setRequiresBatteryNotLow(true)
          .build()

        val periodicRequest = PeriodicWorkRequestBuilder<ExchangeRateSyncWorker>(
          6, TimeUnit.HOURS,
          30, TimeUnit.MINUTES // Flex interval
        )
          .setConstraints(constraints)
          .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
          UNIQUE_PERIODIC_WORK_NAME,
          ExistingPeriodicWorkPolicy.KEEP,
          periodicRequest
        )
      } catch (_: Exception) {
        // Handled gracefully in environments without initialized WorkManager
      }
    }

    /**
     * Triggers an immediate one-time sync task to prefetch rates right after app start or currency change.
     */
    fun syncNow(context: Context) {
      try {
        val constraints = Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build()

        val oneTimeRequest = OneTimeWorkRequestBuilder<ExchangeRateSyncWorker>()
          .setConstraints(constraints)
          .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
          UNIQUE_ONE_TIME_WORK_NAME,
          ExistingWorkPolicy.REPLACE,
          oneTimeRequest
        )
      } catch (_: Exception) {
        // Handled gracefully in environments without initialized WorkManager
      }
    }
  }
}
