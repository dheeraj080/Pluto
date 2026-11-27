package com.pluto.app.data.remote.cloud

import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.BudgetCycleType
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.DualZoneClockEngine
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.ThemeMode
import com.pluto.app.domain.model.TripSettings
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.repository.CurrencyWalletRepository
import com.pluto.app.domain.repository.ExpenseRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.domain.repository.WalletTransactionRepository
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import java.math.BigDecimal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

/**
 * Shared flag used by [CloudSyncCoordinator] when writing incoming Firestore snapshots
 * into local storage so mirror decorators do not echo remote changes back up to Firestore.
 */
object CloudMirrorGate {
  @Volatile
  var isApplyingRemoteUpdate: Boolean = false
}

class SyncingExpenseRepository(
  private val local: ExpenseRepository,
  private val cloud: FirestoreCloudSyncRepository,
  private val auth: FirebaseAuth = Firebase.auth,
  private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) : ExpenseRepository {

  override fun observeAllExpenses(): Flow<List<Expense>> = local.observeAllExpenses()

  override fun observeExpensesByDateRange(startTime: Long, endTime: Long): Flow<List<Expense>> =
    local.observeExpensesByDateRange(startTime, endTime)

  override fun observeExpensesByCategory(categoryId: String): Flow<List<Expense>> =
    local.observeExpensesByCategory(categoryId)

  override fun observeExpensesByTrip(tripId: String): Flow<List<Expense>> =
    local.observeExpensesByTrip(tripId)

  override suspend fun getExpenseById(id: String): Expense? = local.getExpenseById(id)

  override suspend fun saveExpense(expense: Expense) {
    local.saveExpense(expense)
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      scope.launch {
        cloud.upsertExpense(expense)
      }
    }
  }

  override suspend fun deleteExpense(id: String) {
    local.deleteExpense(id)
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      scope.launch {
        cloud.deleteExpense(id)
      }
    }
  }

  override suspend fun getRecurringExpenses(): List<Expense> = local.getRecurringExpenses()
}

class SyncingCurrencyWalletRepository(
  private val local: CurrencyWalletRepository,
  private val cloud: FirestoreCloudSyncRepository,
  private val auth: FirebaseAuth = Firebase.auth,
  private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) : CurrencyWalletRepository {

  override fun observeAllWallets(): Flow<List<CurrencyWallet>> = local.observeAllWallets()

  override suspend fun getWalletByCurrency(currency: Currency): CurrencyWallet? =
    local.getWalletByCurrency(currency)

  override suspend fun getWalletById(id: String): CurrencyWallet? =
    local.getWalletById(id)

  override suspend fun saveWallet(wallet: CurrencyWallet) {
    local.saveWallet(wallet)
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      scope.launch {
        cloud.upsertWallet(wallet)
      }
    }
  }

  override suspend fun deleteWallet(id: String) {
    local.deleteWallet(id)
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      scope.launch {
        cloud.deleteWallet(id)
      }
    }
  }
}

class SyncingWalletTransactionRepository(
  private val local: WalletTransactionRepository,
  private val cloud: FirestoreCloudSyncRepository,
  private val auth: FirebaseAuth = Firebase.auth,
  private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) : WalletTransactionRepository {

  override fun observeTransactionsForWallet(walletId: String): Flow<List<WalletTransaction>> =
    local.observeTransactionsForWallet(walletId)

  override fun observeAllTransactions(): Flow<List<WalletTransaction>> =
    local.observeAllTransactions()

  override suspend fun getTransactionsForWallet(walletId: String): List<WalletTransaction> =
    local.getTransactionsForWallet(walletId)

  override suspend fun executeDeposit(wallet: CurrencyWallet, transaction: WalletTransaction) {
    local.executeDeposit(wallet, transaction)
    mirrorWalletAndTx(listOf(wallet), listOf(transaction))
  }

  override suspend fun executeWithdrawal(wallet: CurrencyWallet, transaction: WalletTransaction) {
    local.executeWithdrawal(wallet, transaction)
    mirrorWalletAndTx(listOf(wallet), listOf(transaction))
  }

  override suspend fun executeTransfer(
    sourceWallet: CurrencyWallet,
    sourceTransaction: WalletTransaction,
    destWallet: CurrencyWallet,
    destTransaction: WalletTransaction
  ) {
    local.executeTransfer(sourceWallet, sourceTransaction, destWallet, destTransaction)
    mirrorWalletAndTx(listOf(sourceWallet, destWallet), listOf(sourceTransaction, destTransaction))
  }

  override suspend fun deleteTransactionsForWallet(walletId: String) {
    local.deleteTransactionsForWallet(walletId)
  }

  private fun mirrorWalletAndTx(wallets: List<CurrencyWallet>, txs: List<WalletTransaction>) {
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      scope.launch {
        wallets.forEach { cloud.upsertWallet(it) }
        txs.forEach { cloud.upsertWalletTransaction(it) }
      }
    }
  }
}

class SyncingUserSettingsRepository(
  private val local: UserSettingsRepository,
  private val cloud: FirestoreCloudSyncRepository,
  private val auth: FirebaseAuth = Firebase.auth,
  private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) : UserSettingsRepository {

  override fun observeSettings(): Flow<UserSettings> = local.observeSettings()

  override suspend fun getSettings(): UserSettings = local.getSettings()

  override suspend fun updateHomeCurrency(homeCurrency: Currency) {
    local.updateHomeCurrency(homeCurrency)
    mirrorCurrentSettings()
  }

  override suspend fun updateDestinationCurrency(destinationCurrency: Currency) {
    local.updateDestinationCurrency(destinationCurrency)
    mirrorCurrentSettings()
  }

  override suspend fun updateSpendingCaps(dailyCap: BigDecimal?, monthlyCap: BigDecimal?) {
    local.updateSpendingCaps(dailyCap, monthlyCap)
    mirrorCurrentSettings()
  }

  override suspend fun updateWarningThreshold(threshold: BigDecimal?, notificationsEnabled: Boolean) {
    local.updateWarningThreshold(threshold, notificationsEnabled)
    mirrorCurrentSettings()
  }

  override suspend fun updateCategoryBudgets(categoryBudgets: Map<String, BigDecimal>) {
    local.updateCategoryBudgets(categoryBudgets)
    mirrorCurrentSettings()
  }

  override suspend fun updateThemeMode(themeMode: ThemeMode) {
    local.updateThemeMode(themeMode)
    mirrorCurrentSettings()
  }

  override suspend fun updatePersona(persona: UserPersona) {
    local.updatePersona(persona)
    mirrorCurrentSettings()
  }

  override suspend fun updateBudgetCycleType(budgetCycleType: BudgetCycleType) {
    local.updateBudgetCycleType(budgetCycleType)
    mirrorCurrentSettings()
  }

  override suspend fun updateAcademicTermSettings(academicTermSettings: AcademicTermSettings) {
    local.updateAcademicTermSettings(academicTermSettings)
    mirrorCurrentSettings()
  }

  override suspend fun updateTripSettings(tripSettings: TripSettings) {
    local.updateTripSettings(tripSettings)
    mirrorCurrentSettings()
  }

  override suspend fun updateBiometricLock(enabled: Boolean, timeoutMinutes: Int) {
    local.updateBiometricLock(enabled, timeoutMinutes)
    mirrorCurrentSettings()
  }

  override suspend fun updatePrivacyMode(enabled: Boolean) {
    local.updatePrivacyMode(enabled)
    mirrorCurrentSettings()
  }

  override suspend fun updateHomeTimeZone(timeZoneId: String?) {
    local.updateHomeTimeZone(timeZoneId)
    mirrorCurrentSettings()
  }

  override suspend fun updateHomeModules(homeModules: List<HomeModuleConfig>) {
    local.updateHomeModules(homeModules)
    mirrorCurrentSettings()
  }

  override suspend fun updateSettings(settings: UserSettings) {
    val normalized = settings.copy(
      homeTimeZoneId = DualZoneClockEngine.normalizeHomeTimeZoneId(
        settings.homeTimeZoneId,
        settings.homeCurrency
      )
    )
    local.updateSettings(normalized)
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      scope.launch {
        cloud.saveSettings(normalized)
      }
    }
  }

  private suspend fun mirrorCurrentSettings() {
    if (!CloudMirrorGate.isApplyingRemoteUpdate && auth.currentUser != null) {
      val latest = local.getSettings()
      scope.launch {
        cloud.saveSettings(latest)
      }
    }
  }
}
