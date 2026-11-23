package com.pluto.app.data.remote.cloud

import android.util.Log
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.expense.ExpenseEntityMapper
import com.pluto.app.data.local.wallet.CurrencyWalletEntityMapper
import com.pluto.app.data.local.wallet.WalletTransactionEntityMapper
import com.pluto.app.domain.repository.UserSettingsRepository
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

sealed interface CloudSyncState {
  data object Idle : CloudSyncState
  data object Syncing : CloudSyncState
  data class Synced(
    val lastSyncedMillis: Long,
    val userEmail: String?,
    val syncedRecordsCount: Int
  ) : CloudSyncState
  data class Error(val message: String) : CloudSyncState
}

/**
 * Coordinates initial bidirectional reconciliation and auth-gated real-time Firestore listeners
 * between Room / SharedPreferences and [FirestoreCloudSyncRepository].
 */
class CloudSyncCoordinator(
  private val database: AppDatabase,
  private val localSettingsRepo: UserSettingsRepository,
  private val cloudRepo: FirestoreCloudSyncRepository,
  private val auth: FirebaseAuth = Firebase.auth
) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val syncMutex = Mutex()
  private var observerJob: Job? = null
  private var activeUid: String? = null

  private val _syncState = MutableStateFlow<CloudSyncState>(CloudSyncState.Idle)
  val syncState: StateFlow<CloudSyncState> = _syncState.asStateFlow()

  fun onUserSignedIn(user: FirebaseUser) {
    if (activeUid == user.uid && observerJob?.isActive == true) {
      return
    }
    stopRealtimeObservers()
    activeUid = user.uid
    scope.launch {
      syncOnce(user)
      startRealtimeObservers(user.uid, user.email)
    }
  }

  fun syncNow() {
    val user = auth.currentUser ?: return
    scope.launch {
      syncOnce(user)
    }
  }

  fun stopRealtimeObservers() {
    observerJob?.cancel()
    observerJob = null
    activeUid = null
    _syncState.value = CloudSyncState.Idle
  }

  internal suspend fun syncOnce(user: FirebaseUser) = syncMutex.withLock {
    if (auth.currentUser?.uid != user.uid) return@withLock
    _syncState.value = CloudSyncState.Syncing

    try {
      // 1. Settings reconciliation
      val localSettings = localSettingsRepo.getSettings()
      val cloudSettingsResult = cloudRepo.getSettings()
      val cloudSettings = cloudSettingsResult.getOrNull()
      if (cloudSettings != null && !localSettings.isOnboardingCompleted && cloudSettings.isOnboardingCompleted) {
        CloudMirrorGate.isApplyingRemoteUpdate = true
        try {
          localSettingsRepo.updateSettings(cloudSettings)
        } finally {
          CloudMirrorGate.isApplyingRemoteUpdate = false
        }
      } else if (cloudSettings == null) {
        cloudRepo.saveSettings(localSettings)
      } else if (localSettings.isOnboardingCompleted) {
        val mergedCategoryBudgets = cloudSettings.categoryMonthlyBudgets + localSettings.categoryMonthlyBudgets
        val mergedSettings = localSettings.copy(categoryMonthlyBudgets = mergedCategoryBudgets)
        if (mergedCategoryBudgets != localSettings.categoryMonthlyBudgets) {
          CloudMirrorGate.isApplyingRemoteUpdate = true
          try {
            localSettingsRepo.updateSettings(mergedSettings)
          } finally {
            CloudMirrorGate.isApplyingRemoteUpdate = false
          }
        }
        if (mergedCategoryBudgets != cloudSettings.categoryMonthlyBudgets) {
          cloudRepo.saveSettings(mergedSettings)
        }
      }

      // 2. Expenses reconciliation
      val localExpenses = database.expenseDao().getAllExpenses()
        .mapNotNull { ExpenseEntityMapper.toDomain(it) }
      val cloudExpenses = cloudRepo.getExpenses().getOrNull().orEmpty()
      val cloudExpenseIds = cloudExpenses.map { it.id }.toSet()
      val localExpenseIds = localExpenses.map { it.id }.toSet()

      // Push local expenses missing from cloud
      localExpenses.filter { it.id !in cloudExpenseIds }.forEach { expense ->
        cloudRepo.upsertExpense(expense)
      }
      // Pull cloud expenses missing locally
      val missingLocallyExpenses = cloudExpenses.filter { it.id !in localExpenseIds }
      if (missingLocallyExpenses.isNotEmpty()) {
        database.expenseDao().insertExpenses(
          missingLocallyExpenses.map { ExpenseEntityMapper.toEntity(it) }
        )
      }

      // 3. Wallets reconciliation
      val localWallets = database.currencyWalletDao().getAllWallets()
        .mapNotNull { CurrencyWalletEntityMapper.toDomain(it) }
      val cloudWallets = cloudRepo.getWallets().getOrNull().orEmpty()
      val cloudWalletIds = cloudWallets.map { it.id }.toSet()
      val localWalletIds = localWallets.map { it.id }.toSet()

      localWallets.filter { it.id !in cloudWalletIds }.forEach { wallet ->
        cloudRepo.upsertWallet(wallet)
      }
      val missingLocallyWallets = cloudWallets.filter { it.id !in localWalletIds }
      if (missingLocallyWallets.isNotEmpty()) {
        database.currencyWalletDao().insertWallets(
          missingLocallyWallets.map { CurrencyWalletEntityMapper.toEntity(it) }
        )
      }

      // 4. Wallet transactions reconciliation
      val localTx = database.walletTransactionDao().getAllTransactions()
        .mapNotNull { WalletTransactionEntityMapper.toDomain(it) }
      val cloudTx = cloudRepo.getWalletTransactions().getOrNull().orEmpty()
      val cloudTxIds = cloudTx.map { it.id }.toSet()
      val localTxIds = localTx.map { it.id }.toSet()

      localTx.filter { it.id !in cloudTxIds }.forEach { tx ->
        cloudRepo.upsertWalletTransaction(tx)
      }
      val missingLocallyTx = cloudTx.filter { it.id !in localTxIds }
      if (missingLocallyTx.isNotEmpty()) {
        database.walletTransactionDao().insertTransactionsReplace(
          missingLocallyTx.map { WalletTransactionEntityMapper.toEntity(it) }
        )
      }

      val totalCount = (localExpenseIds + cloudExpenseIds).size +
        (localWalletIds + cloudWalletIds).size +
        (localTxIds + cloudTxIds).size

      _syncState.value = CloudSyncState.Synced(
        lastSyncedMillis = System.currentTimeMillis(),
        userEmail = user.email,
        syncedRecordsCount = totalCount
      )
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      Log.w(TAG, "Cloud sync encountered an error: ${e.message}", e)
      _syncState.value = CloudSyncState.Error(e.localizedMessage ?: "Cloud sync unavailable offline")
    }
  }

  private fun startRealtimeObservers(uid: String, email: String?) {
    observerJob?.cancel()
    observerJob = scope.launch {
      launch {
        cloudRepo.observeExpenses()
          .catch { err -> handleObserverError(err, uid, "expenses") }
          .collect { remoteList ->
            if (auth.currentUser?.uid == uid && remoteList.isNotEmpty()) {
              database.expenseDao().insertExpenses(remoteList.map { ExpenseEntityMapper.toEntity(it) })
              updateSyncedTimestamp(email)
            }
          }
      }
      launch {
        cloudRepo.observeWallets()
          .catch { err -> handleObserverError(err, uid, "wallets") }
          .collect { remoteList ->
            if (auth.currentUser?.uid == uid && remoteList.isNotEmpty()) {
              database.currencyWalletDao().insertWallets(
                remoteList.map { CurrencyWalletEntityMapper.toEntity(it) }
              )
              updateSyncedTimestamp(email)
            }
          }
      }
      launch {
        cloudRepo.observeWalletTransactions()
          .catch { err -> handleObserverError(err, uid, "wallet_transactions") }
          .collect { remoteList ->
            if (auth.currentUser?.uid == uid && remoteList.isNotEmpty()) {
              database.walletTransactionDao().insertTransactionsReplace(
                remoteList.map { WalletTransactionEntityMapper.toEntity(it) }
              )
              updateSyncedTimestamp(email)
            }
          }
      }
    }
  }

  private fun handleObserverError(error: Throwable, uid: String, streamName: String) {
    val firestoreError = generateSequence(error) { it.cause }
      .filterIsInstance<FirebaseFirestoreException>()
      .firstOrNull()
    if (firestoreError == null && error is CancellationException) throw error
    if (auth.currentUser?.uid == uid) {
      val root = firestoreError ?: error
      Log.w(TAG, "Firestore observer error ($streamName): ${root.message}", root)
      _syncState.value = CloudSyncState.Error(root.localizedMessage ?: "Realtime sync interrupted")
    }
  }

  private fun updateSyncedTimestamp(email: String?) {
    val prevCount = (_syncState.value as? CloudSyncState.Synced)?.syncedRecordsCount ?: 0
    _syncState.value = CloudSyncState.Synced(
      lastSyncedMillis = System.currentTimeMillis(),
      userEmail = email,
      syncedRecordsCount = prevCount
    )
  }

  companion object {
    private const val TAG = "CloudSyncCoordinator"
  }
}
