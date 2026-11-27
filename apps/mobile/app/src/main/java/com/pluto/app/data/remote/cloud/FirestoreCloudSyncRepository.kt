package com.pluto.app.data.remote.cloud

import android.content.Context
import com.pluto.app.R
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

/**
 * Cloud synchronization repository backed by Firebase Firestore using the named applet database ID.
 * All operations require an authenticated Firebase user and scope data strictly under `/users/{uid}/...`.
 */
class FirestoreCloudSyncRepository(
  private val db: FirebaseFirestore,
  private val auth: FirebaseAuth = Firebase.auth
) {
  constructor(context: Context) : this(
    db = FirebaseFirestore.getInstance(
      context.applicationContext.getString(R.string.firestore_database_id)
    ),
    auth = Firebase.auth
  )

  private fun requireUserId(): String {
    return auth.currentUser?.uid
      ?: throw IllegalStateException("User must be signed in with Google before accessing Firestore.")
  }

  private fun settingsDocRef(uid: String) =
    db.collection("users").document(uid).collection("profile").document(SETTINGS_DOC_ID)

  private fun expensesColRef(uid: String) =
    db.collection("users").document(uid).collection("expenses")

  private fun walletsColRef(uid: String) =
    db.collection("users").document(uid).collection("wallets")

  private fun walletTxColRef(uid: String) =
    db.collection("users").document(uid).collection("wallet_transactions")

  // --- Settings ---

  suspend fun saveSettings(settings: UserSettings): Result<Unit> {
    val uid = requireUserId()
    val docRef = settingsDocRef(uid)
    return try {
      val exists = docRef.get().await().exists()
      if (exists) {
        docRef.update(CloudUserSettings.toUpdateMap(settings)).await()
      } else {
        docRef.set(CloudUserSettings.toCreateMap(uid, settings)).await()
      }
      Result.success(Unit)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.WRITE, docRef.path)
      Result.failure(e)
    }
  }

  suspend fun getSettings(): Result<UserSettings?> {
    val uid = requireUserId()
    val docRef = settingsDocRef(uid)
    return try {
      val snapshot = docRef.get().await()
      if (!snapshot.exists()) {
        Result.success(null)
      } else {
        Result.success(CloudUserSettings.fromSnapshot(snapshot)?.toDomain())
      }
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.GET, docRef.path)
      Result.failure(e)
    }
  }

  fun observeSettings(): Flow<UserSettings?> = flow {
    val uid = requireUserId()
    val docRef = settingsDocRef(uid)
    emitAll(
      docRef.snapshots()
        .map { snapshot ->
          CloudUserSettings.fromSnapshot(snapshot)?.toDomain()
        }
        .catch { error ->
          handleFlowError(error, OperationType.GET, docRef.path, uid)
          throw error
        }
    )
  }

  // --- Expenses ---

  suspend fun upsertExpense(expense: Expense): Result<Unit> {
    val uid = requireUserId()
    val docRef = expensesColRef(uid).document(expense.id)
    return try {
      val exists = docRef.get().await().exists()
      if (exists) {
        docRef.update(CloudExpense.toUpdateMap(expense)).await()
      } else {
        docRef.set(CloudExpense.toCreateMap(uid, expense)).await()
      }
      Result.success(Unit)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.WRITE, docRef.path)
      Result.failure(e)
    }
  }

  suspend fun deleteExpense(expenseId: String): Result<Unit> {
    val uid = requireUserId()
    val docRef = expensesColRef(uid).document(expenseId)
    return try {
      docRef.delete().await()
      Result.success(Unit)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.DELETE, docRef.path)
      Result.failure(e)
    }
  }

  suspend fun getExpenses(): Result<List<Expense>> {
    val uid = requireUserId()
    val colRef = expensesColRef(uid)
    return try {
      val snapshot = colRef.get().await()
      val items = snapshot.toObjects(
        CloudExpense::class.java,
        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
      ).mapNotNull { it.toDomain() }
      Result.success(items)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.LIST, colRef.path)
      Result.failure(e)
    }
  }

  fun observeExpenses(): Flow<List<Expense>> = flow {
    val uid = requireUserId()
    val colRef = expensesColRef(uid)
    emitAll(
      colRef.snapshots()
        .map { snapshot ->
          snapshot.toObjects(
            CloudExpense::class.java,
            DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
          ).mapNotNull { it.toDomain() }
        }
        .catch { error ->
          handleFlowError(error, OperationType.LIST, colRef.path, uid)
          throw error
        }
    )
  }

  // --- Wallets ---

  suspend fun upsertWallet(wallet: CurrencyWallet): Result<Unit> {
    val uid = requireUserId()
    val docRef = walletsColRef(uid).document(wallet.id)
    return try {
      val exists = docRef.get().await().exists()
      if (exists) {
        docRef.update(CloudCurrencyWallet.toUpdateMap(wallet)).await()
      } else {
        docRef.set(CloudCurrencyWallet.toCreateMap(uid, wallet)).await()
      }
      Result.success(Unit)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.WRITE, docRef.path)
      Result.failure(e)
    }
  }

  suspend fun deleteWallet(walletId: String): Result<Unit> {
    val uid = requireUserId()
    val docRef = walletsColRef(uid).document(walletId)
    return try {
      docRef.delete().await()
      Result.success(Unit)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.DELETE, docRef.path)
      Result.failure(e)
    }
  }

  suspend fun getWallets(): Result<List<CurrencyWallet>> {
    val uid = requireUserId()
    val colRef = walletsColRef(uid)
    return try {
      val snapshot = colRef.get().await()
      val items = snapshot.toObjects(
        CloudCurrencyWallet::class.java,
        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
      ).mapNotNull { it.toDomain() }
      Result.success(items)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.LIST, colRef.path)
      Result.failure(e)
    }
  }

  fun observeWallets(): Flow<List<CurrencyWallet>> = flow {
    val uid = requireUserId()
    val colRef = walletsColRef(uid)
    emitAll(
      colRef.snapshots()
        .map { snapshot ->
          snapshot.toObjects(
            CloudCurrencyWallet::class.java,
            DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
          ).mapNotNull { it.toDomain() }
        }
        .catch { error ->
          handleFlowError(error, OperationType.LIST, colRef.path, uid)
          throw error
        }
    )
  }

  // --- Wallet Transactions ---

  suspend fun upsertWalletTransaction(tx: WalletTransaction): Result<Unit> {
    val uid = requireUserId()
    val docRef = walletTxColRef(uid).document(tx.id)
    return try {
      val exists = docRef.get().await().exists()
      if (exists) {
        docRef.update(CloudWalletTransaction.toUpdateMap(tx)).await()
      } else {
        docRef.set(CloudWalletTransaction.toCreateMap(uid, tx)).await()
      }
      Result.success(Unit)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.WRITE, docRef.path)
      Result.failure(e)
    }
  }

  suspend fun getWalletTransactions(): Result<List<WalletTransaction>> {
    val uid = requireUserId()
    val colRef = walletTxColRef(uid)
    return try {
      val snapshot = colRef.get().await()
      val items = snapshot.toObjects(
        CloudWalletTransaction::class.java,
        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
      ).mapNotNull { it.toDomain() }
      Result.success(items)
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      handleFirestoreError(e, OperationType.LIST, colRef.path)
      Result.failure(e)
    }
  }

  fun observeWalletTransactions(): Flow<List<WalletTransaction>> = flow {
    val uid = requireUserId()
    val colRef = walletTxColRef(uid)
    emitAll(
      colRef.snapshots()
        .map { snapshot ->
          snapshot.toObjects(
            CloudWalletTransaction::class.java,
            DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
          ).mapNotNull { it.toDomain() }
        }
        .catch { error ->
          handleFlowError(error, OperationType.LIST, colRef.path, uid)
          throw error
        }
    )
  }

  private fun handleFlowError(error: Throwable, op: OperationType, path: String, uid: String) {
    val firestoreError = generateSequence(error) { it.cause }
      .filterIsInstance<FirebaseFirestoreException>()
      .firstOrNull()
    if (firestoreError == null && error is CancellationException) throw error
    val exceptionToLog = firestoreError ?: (error as? Exception)
    if (exceptionToLog != null && auth.currentUser?.uid == uid) {
      handleFirestoreError(exceptionToLog, op, path)
    }
  }

  companion object {
    const val SETTINGS_DOC_ID = "settings"
  }
}
