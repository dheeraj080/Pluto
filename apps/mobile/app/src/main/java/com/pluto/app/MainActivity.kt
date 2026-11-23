package com.pluto.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.credentials.CredentialManager
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.remote.cloud.CloudSyncCoordinator
import com.pluto.app.data.remote.cloud.CloudSyncState
import com.pluto.app.data.remote.cloud.FirestoreCloudSyncRepository
import com.pluto.app.data.remote.cloud.SyncingCurrencyWalletRepository
import com.pluto.app.data.remote.cloud.SyncingExpenseRepository
import com.pluto.app.data.remote.cloud.SyncingUserSettingsRepository
import com.pluto.app.data.remote.cloud.SyncingWalletTransactionRepository
import com.pluto.app.data.remote.cloud.authStateFlow
import com.pluto.app.data.remote.cloud.signOutFromGoogle
import com.pluto.app.data.remote.exchange.ExchangeRateApiClient
import com.pluto.app.data.repository.OfflineFirstExchangeRateRepository
import com.pluto.app.data.repository.OfflineSessionPreferences
import com.pluto.app.data.repository.RoomCurrencyWalletRepository
import com.pluto.app.data.repository.RoomExpenseRepository
import com.pluto.app.data.repository.RoomWalletTransactionRepository
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.usecase.ConvertCurrencyUseCase
import com.pluto.app.domain.usecase.CreateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.CreateExpenseUseCase
import com.pluto.app.domain.usecase.CreateWalletDepositUseCase
import com.pluto.app.domain.usecase.CreateWalletTransferUseCase
import com.pluto.app.domain.usecase.CreateWalletWithdrawalUseCase
import com.pluto.app.domain.usecase.DeleteCurrencyWalletUseCase
import com.pluto.app.domain.usecase.DeleteExpenseUseCase
import com.pluto.app.domain.usecase.GetDashboardSummaryUseCase
import com.pluto.app.domain.usecase.GetPortfolioValuationUseCase
import com.pluto.app.domain.usecase.ObserveCurrencyWalletsUseCase
import com.pluto.app.domain.usecase.ObserveExpensesUseCase
import com.pluto.app.domain.usecase.ObserveWalletTransactionsUseCase
import com.pluto.app.domain.usecase.UpdateCurrencyWalletUseCase
import com.pluto.app.domain.usecase.UpdateExpenseUseCase
import com.pluto.app.ui.MainAppShell
import com.pluto.app.ui.MainViewModel
import com.pluto.app.ui.components.BiometricLockScreen
import com.pluto.app.ui.components.PlutoErrorBoundary
import com.pluto.app.ui.convert.ConverterViewModel
import com.pluto.app.ui.expenses.ExpenseViewModel
import com.pluto.app.ui.home.DashboardViewModel
import com.pluto.app.ui.onboarding.OnboardingScreen
import com.pluto.app.ui.onboarding.OnboardingViewModel
import com.pluto.app.ui.theme.PlutoTheme
import com.pluto.app.ui.wallet.WalletViewModel
import com.pluto.app.util.BiometricSecurityManager
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {

  private val database by lazy {
    AppDatabase.getInstance(applicationContext)
  }

  private val cloudSyncRepository by lazy {
    FirestoreCloudSyncRepository(applicationContext)
  }

  private val offlineSessionPreferences by lazy {
    OfflineSessionPreferences(applicationContext)
  }

  private val rawUserSettingsRepository by lazy {
    SharedPreferencesUserSettingsRepository(applicationContext)
  }

  private val userSettingsRepository by lazy {
    SyncingUserSettingsRepository(
      local = rawUserSettingsRepository,
      cloud = cloudSyncRepository
    )
  }

  private val cloudSyncCoordinator by lazy {
    CloudSyncCoordinator(
      database = database,
      localSettingsRepo = rawUserSettingsRepository,
      cloudRepo = cloudSyncRepository
    )
  }

  private val exchangeRateRepository by lazy {
    OfflineFirstExchangeRateRepository(
      dao = database.exchangeRateDao(),
      apiService = ExchangeRateApiClient.apiService
    )
  }

  private val rawExpenseRepository by lazy {
    RoomExpenseRepository(
      dao = database.expenseDao()
    )
  }

  private val expenseRepository by lazy {
    SyncingExpenseRepository(
      local = rawExpenseRepository,
      cloud = cloudSyncRepository
    )
  }

  private val rawWalletRepository by lazy {
    RoomCurrencyWalletRepository(
      dao = database.currencyWalletDao(),
      transactionDao = database.walletTransactionDao()
    )
  }

  private val walletRepository by lazy {
    SyncingCurrencyWalletRepository(
      local = rawWalletRepository,
      cloud = cloudSyncRepository
    )
  }

  private val rawWalletTransactionRepository by lazy {
    RoomWalletTransactionRepository(
      database = database,
      walletDao = database.currencyWalletDao(),
      transactionDao = database.walletTransactionDao()
    )
  }

  private val walletTransactionRepository by lazy {
    SyncingWalletTransactionRepository(
      local = rawWalletTransactionRepository,
      cloud = cloudSyncRepository
    )
  }

  private val convertCurrencyUseCase by lazy {
    ConvertCurrencyUseCase(exchangeRateRepository)
  }

  private val observeExpensesUseCase by lazy {
    ObserveExpensesUseCase(expenseRepository)
  }

  private val getDashboardSummaryUseCase by lazy {
    GetDashboardSummaryUseCase()
  }

  private val createExpenseUseCase by lazy {
    CreateExpenseUseCase(
      expenseRepository = expenseRepository,
      userSettingsRepository = userSettingsRepository,
      convertCurrencyUseCase = convertCurrencyUseCase
    )
  }

  private val updateExpenseUseCase by lazy {
    UpdateExpenseUseCase(
      expenseRepository = expenseRepository,
      userSettingsRepository = userSettingsRepository,
      convertCurrencyUseCase = convertCurrencyUseCase
    )
  }

  private val deleteExpenseUseCase by lazy {
    DeleteExpenseUseCase(expenseRepository)
  }

  // Wallet Use Cases
  private val observeCurrencyWalletsUseCase by lazy {
    ObserveCurrencyWalletsUseCase(walletRepository)
  }

  private val createCurrencyWalletUseCase by lazy {
    CreateCurrencyWalletUseCase(walletRepository)
  }

  private val updateCurrencyWalletUseCase by lazy {
    UpdateCurrencyWalletUseCase(walletRepository)
  }

  private val deleteCurrencyWalletUseCase by lazy {
    DeleteCurrencyWalletUseCase(walletRepository)
  }

  private val getPortfolioValuationUseCase by lazy {
    GetPortfolioValuationUseCase(exchangeRateRepository)
  }

  private val createWalletDepositUseCase by lazy {
    CreateWalletDepositUseCase(
      walletRepository = walletRepository,
      transactionRepository = walletTransactionRepository
    )
  }

  private val createWalletWithdrawalUseCase by lazy {
    CreateWalletWithdrawalUseCase(
      walletRepository = walletRepository,
      transactionRepository = walletTransactionRepository
    )
  }

  private val createWalletTransferUseCase by lazy {
    CreateWalletTransferUseCase(
      walletRepository = walletRepository,
      transactionRepository = walletTransactionRepository,
      exchangeRateRepository = exchangeRateRepository
    )
  }

  private val observeWalletTransactionsUseCase by lazy {
    ObserveWalletTransactionsUseCase(walletTransactionRepository)
  }

  private val mainViewModel: MainViewModel by viewModels {
    MainViewModel.provideFactory(userSettingsRepository)
  }

  private val onboardingViewModel: OnboardingViewModel by viewModels {
    OnboardingViewModel.provideFactory(userSettingsRepository)
  }

  private val notificationHelper by lazy {
    com.pluto.app.util.SafeToSpendNotificationHelper(applicationContext)
  }

  private val dashboardViewModel: DashboardViewModel by viewModels {
    DashboardViewModel.provideFactory(
      observeExpensesUseCase = observeExpensesUseCase,
      userSettingsRepository = userSettingsRepository,
      getDashboardSummaryUseCase = getDashboardSummaryUseCase,
      walletTransactionRepository = walletTransactionRepository,
      exchangeRateRepository = exchangeRateRepository,
      notificationHelper = notificationHelper
    )
  }

  private val walletViewModel: WalletViewModel by viewModels {
    WalletViewModel.provideFactory(
      observeCurrencyWalletsUseCase = observeCurrencyWalletsUseCase,
      createCurrencyWalletUseCase = createCurrencyWalletUseCase,
      updateCurrencyWalletUseCase = updateCurrencyWalletUseCase,
      deleteCurrencyWalletUseCase = deleteCurrencyWalletUseCase,
      getPortfolioValuationUseCase = getPortfolioValuationUseCase,
      createWalletDepositUseCase = createWalletDepositUseCase,
      createWalletWithdrawalUseCase = createWalletWithdrawalUseCase,
      createWalletTransferUseCase = createWalletTransferUseCase,
      observeWalletTransactionsUseCase = observeWalletTransactionsUseCase,
      userSettingsRepository = userSettingsRepository
    )
  }

  private val converterViewModel: ConverterViewModel by viewModels {
    ConverterViewModel.provideFactory(convertCurrencyUseCase)
  }

  private val processRecurringExpensesUseCase by lazy {
    com.pluto.app.domain.usecase.ProcessRecurringExpensesUseCase(
      expenseRepository = expenseRepository,
      convertCurrencyUseCase = convertCurrencyUseCase
    )
  }

  private val expenseViewModel: ExpenseViewModel by viewModels {
    ExpenseViewModel.provideFactory(
      observeExpensesUseCase = observeExpensesUseCase,
      createExpenseUseCase = createExpenseUseCase,
      updateExpenseUseCase = updateExpenseUseCase,
      deleteExpenseUseCase = deleteExpenseUseCase,
      userSettingsRepository = userSettingsRepository,
      convertCurrencyUseCase = convertCurrencyUseCase,
      exchangeRateRepository = exchangeRateRepository,
      processRecurringExpensesUseCase = processRecurringExpensesUseCase
    )
  }

  override fun onStart() {
    super.onStart()
    lifecycleScope.launch {
      val settings = userSettingsRepository.getSettings()
      BiometricSecurityManager.onAppForegrounded(
        isBiometricEnabled = settings.isBiometricLockEnabled,
        timeoutMinutes = settings.autoLockTimeoutMinutes
      )
    }
  }

  override fun onStop() {
    super.onStop()
    BiometricSecurityManager.onAppBackgrounded()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // Initialize background WorkManager rate prefetching and offline cache warmup
    com.pluto.app.data.worker.ExchangeRateSyncWorker.schedulePeriodicSync(applicationContext)
    com.pluto.app.data.worker.ExchangeRateSyncWorker.syncNow(applicationContext)

    // Observe Privacy Mode to set or clear FLAG_SECURE dynamically
    lifecycleScope.launch {
      userSettingsRepository.observeSettings().collect { settings ->
        if (settings.isPrivacyModeEnabled) {
          window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        }
      }
    }

    lifecycleScope.launch {
      if ((BuildConfig.DEV_MODE || BuildConfig.SEED_SAMPLE_DATA) && database.expenseDao().getExpenseCount() == 0) {
        com.pluto.app.data.util.SampleDataSeeder.seedSampleData(database, userSettingsRepository)
      }
    }

    setContent {
      val userSettings by mainViewModel.userSettings.collectAsStateWithLifecycle()
      val isAppLocked by BiometricSecurityManager.isAppLocked.collectAsStateWithLifecycle()
      var lockErrorMessage by remember { mutableStateOf<String?>(null) }

      PlutoTheme(themeMode = userSettings.themeMode) {
        Surface(modifier = Modifier.fillMaxSize()) {
          PlutoErrorBoundary {
            if (isAppLocked && userSettings.isBiometricLockEnabled) {
              BiometricLockScreen(
                errorMessage = lockErrorMessage,
                onUnlockClick = {
                  BiometricSecurityManager.authenticate(
                    activity = this@MainActivity,
                    onSuccess = { lockErrorMessage = null },
                    onError = { err -> lockErrorMessage = err }
                  )
                }
              )
            } else {
              PlutoApp(
                mainViewModel = mainViewModel,
                onboardingViewModel = onboardingViewModel,
                dashboardViewModel = dashboardViewModel,
                walletViewModel = walletViewModel,
                converterViewModel = converterViewModel,
                expenseViewModel = expenseViewModel,
                cloudSyncCoordinator = cloudSyncCoordinator,
                offlineSessionPreferences = offlineSessionPreferences,
                database = database,
                exchangeRateRepository = exchangeRateRepository,
                userSettingsRepository = userSettingsRepository,
                isDevMode = BuildConfig.DEV_MODE,
                onSeedDummyData = {
                  mainViewModel.seedDummyData(database)
                }
              )
            }
          }
        }
      }
    }
  }
}

@Composable
fun PlutoApp(
  mainViewModel: MainViewModel,
  onboardingViewModel: OnboardingViewModel,
  dashboardViewModel: DashboardViewModel,
  walletViewModel: WalletViewModel,
  converterViewModel: ConverterViewModel,
  expenseViewModel: ExpenseViewModel,
  cloudSyncCoordinator: CloudSyncCoordinator? = null,
  offlineSessionPreferences: OfflineSessionPreferences? = null,
  database: AppDatabase? = null,
  exchangeRateRepository: com.pluto.app.domain.repository.ExchangeRateRepository? = null,
  userSettingsRepository: com.pluto.app.domain.repository.UserSettingsRepository? = null,
  isDevMode: Boolean = BuildConfig.DEV_MODE,
  onSeedDummyData: () -> Unit = {}
) {
  val context = LocalContext.current
  val coroutineScope = rememberCoroutineScope()
  val credentialManager = remember(context) { CredentialManager.create(context) }
  val sessionPrefs = offlineSessionPreferences ?: remember(context) {
    OfflineSessionPreferences(context)
  }

  val firebaseAuth = remember { Firebase.auth }
  val currentUser by firebaseAuth.authStateFlow()
    .collectAsStateWithLifecycle(initialValue = firebaseAuth.currentUser)
  val userSettings by mainViewModel.userSettings.collectAsStateWithLifecycle()

  val signedInUser = currentUser

  key("active_session") {
    LaunchedEffect(signedInUser?.uid) {
      if (signedInUser != null) {
        if (sessionPrefs.isOfflineMode.value) {
          sessionPrefs.setOfflineMode(false)
        }
        cloudSyncCoordinator?.onUserSignedIn(signedInUser)
      } else {
        cloudSyncCoordinator?.stopRealtimeObservers()
      }
    }

    val cloudSyncState by cloudSyncCoordinator?.syncState?.collectAsStateWithLifecycle()
      ?: remember { mutableStateOf(CloudSyncState.Idle) }

    Crossfade(
      targetState = userSettings.isOnboardingCompleted,
      label = "app_root_crossfade"
    ) { isCompleted ->
      if (!isCompleted) {
        OnboardingScreen(
          viewModel = onboardingViewModel,
          onOnboardingFinished = {}
        )
      } else {
        MainAppShell(
          userSettings = userSettings,
          dashboardViewModel = dashboardViewModel,
          walletViewModel = walletViewModel,
          converterViewModel = converterViewModel,
          expenseViewModel = expenseViewModel,
          isDevMode = isDevMode,
          database = database,
          exchangeRateRepository = exchangeRateRepository,
          userSettingsRepository = userSettingsRepository,
          cloudSyncState = cloudSyncState,
          signedInEmail = signedInUser?.email,
          signedInDisplayName = signedInUser?.displayName,
          isOfflineMode = signedInUser == null,
          onGoogleSignInSuccess = { sessionPrefs.setOfflineMode(false) },
          onSyncNowClick = { cloudSyncCoordinator?.syncNow() },
          onSignOutClick = {
            sessionPrefs.setOfflineMode(true)
            cloudSyncCoordinator?.stopRealtimeObservers()
            signOutFromGoogle(credentialManager, coroutineScope)
          },
          onUpdateHomeCurrency = mainViewModel::updateHomeCurrency,
          onUpdateDestinationCurrency = mainViewModel::updateDestinationCurrency,
          onUpdateSpendingCaps = mainViewModel::updateSpendingCaps,
          onUpdateWarningThreshold = mainViewModel::updateWarningThreshold,
          onUpdateThemeMode = mainViewModel::updateThemeMode,
          onUpdateBiometricLock = mainViewModel::updateBiometricLock,
          onUpdatePrivacyMode = mainViewModel::updatePrivacyMode,
          onUpdateHomeTimeZone = mainViewModel::updateHomeTimeZone,
          onUpdateHomeModules = mainViewModel::updateHomeModules,
          onApplyPersonaPreset = mainViewModel::applyPersonaPreset,
          onResetOnboarding = mainViewModel::resetOnboarding,
          onSeedDummyData = onSeedDummyData
        )
      }
    }
  }
}
