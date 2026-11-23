package com.pluto.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffoldDefaults
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteType
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.remote.cloud.CloudSyncState
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.ThemeMode
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.ExchangeRateRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.ui.budgets.BudgetsScreen
import com.pluto.app.ui.convert.ConverterScreen
import com.pluto.app.ui.convert.ConverterViewModel
import com.pluto.app.ui.currency.CurrencySelectionScreen
import com.pluto.app.ui.expenses.ExpenseDetailBottomSheet
import com.pluto.app.ui.expenses.ExpenseEntryScreen
import com.pluto.app.ui.expenses.ExpenseViewModel
import com.pluto.app.ui.expenses.ExpensesScreen
import com.pluto.app.ui.home.DashboardViewModel
import com.pluto.app.ui.home.HomeScreen
import com.pluto.app.ui.insights.InsightsScreen
import com.pluto.app.ui.navigation.BudgetsRoute
import com.pluto.app.ui.navigation.ConverterRoute
import com.pluto.app.ui.navigation.CurrencyPickerRoute
import com.pluto.app.ui.navigation.CurrencyPickerTarget
import com.pluto.app.ui.navigation.ExpensesRoute
import com.pluto.app.ui.navigation.HomeRoute
import com.pluto.app.ui.navigation.InsightsRoute
import com.pluto.app.ui.navigation.SettingsRoute
import com.pluto.app.ui.navigation.TopLevelDestination
import com.pluto.app.ui.navigation.WalletDetailRoute
import com.pluto.app.ui.navigation.WalletsRoute
import com.pluto.app.ui.settings.SettingsDialogsHost
import com.pluto.app.ui.settings.SettingsScreen
import com.pluto.app.ui.wallet.WalletDetailScreen
import com.pluto.app.ui.wallet.WalletEntryScreen
import com.pluto.app.ui.wallet.WalletListScreen
import com.pluto.app.ui.wallet.WalletViewModel
import kotlinx.coroutines.launch

/**
 * Main application shell powered by type-safe Jetpack Navigation Compose and
 * Material 3 adaptive NavigationSuiteScaffold (NavigationBar on phones, NavigationRail on tablets).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppShell(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel,
  walletViewModel: WalletViewModel,
  converterViewModel: ConverterViewModel,
  expenseViewModel: ExpenseViewModel,
  onUpdateHomeCurrency: (Currency) -> Unit,
  onUpdateDestinationCurrency: (Currency) -> Unit,
  onUpdateSpendingCaps: (Double?, Double?) -> Unit,
  onUpdateWarningThreshold: (Double?, Boolean) -> Unit = { _, _ -> },
  onUpdateThemeMode: (ThemeMode) -> Unit = {},
  onUpdateBiometricLock: (Boolean, Int) -> Unit = { _, _ -> },
  onUpdatePrivacyMode: (Boolean) -> Unit = {},
  onUpdateHomeTimeZone: (String?) -> Unit = {},
  onUpdateHomeModules: (List<HomeModuleConfig>) -> Unit = {},
  onApplyPersonaPreset: (UserPersona) -> Unit = {},
  onResetOnboarding: () -> Unit,
  onSeedDummyData: () -> Unit = {},
  database: AppDatabase? = null,
  exchangeRateRepository: ExchangeRateRepository? = null,
  userSettingsRepository: UserSettingsRepository? = null,
  cloudSyncState: CloudSyncState = CloudSyncState.Idle,
  signedInEmail: String? = null,
  signedInDisplayName: String? = null,
  isOfflineMode: Boolean = false,
  onGoogleSignInSuccess: () -> Unit = {},
  onSyncNowClick: () -> Unit = {},
  onSignOutClick: () -> Unit = {},
  isDevMode: Boolean = false,
  modifier: Modifier = Modifier
) {
  val navController = rememberNavController()
  val navBackStackEntry by navController.currentBackStackEntryAsState()
  val currentDestination = navBackStackEntry?.destination

  val isTopLevelRoute = currentDestination == null ||
    currentDestination.hasRoute<HomeRoute>() ||
    currentDestination.hasRoute<ExpensesRoute>() ||
    currentDestination.hasRoute<BudgetsRoute>() ||
    currentDestination.hasRoute<InsightsRoute>()

  var isAddingOrEditingExpense by rememberSaveable { mutableStateOf(false) }
  var selectedExpenseDetail by remember { mutableStateOf<Expense?>(null) }
  var isAddingOrEditingWallet by rememberSaveable { mutableStateOf(false) }
  var showCustomRatesDialog by rememberSaveable { mutableStateOf(false) }
  var showBackupRestoreDialog by rememberSaveable { mutableStateOf(false) }

  val snackbarHostState = remember { SnackbarHostState() }
  val coroutineScope = rememberCoroutineScope()
  val context = LocalContext.current
  val allWallets by walletViewModel.allWallets.collectAsStateWithLifecycle()

  SettingsDialogsHost(
    userSettings = userSettings,
    showCustomRatesDialog = showCustomRatesDialog,
    onDismissCustomRates = { showCustomRatesDialog = false },
    showBackupRestoreDialog = showBackupRestoreDialog,
    onDismissBackupRestore = { showBackupRestoreDialog = false },
    database = database,
    exchangeRateRepository = exchangeRateRepository,
    userSettingsRepository = userSettingsRepository,
    snackbarHostState = snackbarHostState,
    coroutineScope = coroutineScope,
    context = context
  )

  if (isAddingOrEditingWallet) {
    ModalBottomSheet(
      onDismissRequest = { isAddingOrEditingWallet = false },
      containerColor = MaterialTheme.colorScheme.surface
    ) {
      WalletEntryScreen(
        viewModel = walletViewModel,
        userSettings = userSettings,
        onNavigateBack = { isAddingOrEditingWallet = false },
        onOpenCurrencyPicker = { navController.navigate(CurrencyPickerRoute(CurrencyPickerTarget.WALLET)) }
      )
    }
  }

  if (isAddingOrEditingExpense) {
    ModalBottomSheet(
      onDismissRequest = { isAddingOrEditingExpense = false },
      containerColor = MaterialTheme.colorScheme.surface
    ) {
      ExpenseEntryScreen(
        viewModel = expenseViewModel,
        userSettings = userSettings,
        onNavigateBack = { isAddingOrEditingExpense = false },
        onOpenLocalCurrencyPicker = { navController.navigate(CurrencyPickerRoute(CurrencyPickerTarget.EXPENSE_LOCAL)) },
        onOpenHomeCurrencyPicker = { navController.navigate(CurrencyPickerRoute(CurrencyPickerTarget.EXPENSE_HOME)) },
        onExpenseSaved = { savedExpense ->
          isAddingOrEditingExpense = false
          if (selectedExpenseDetail?.id == savedExpense.id) {
            selectedExpenseDetail = savedExpense
          }
          coroutineScope.launch { snackbarHostState.showSnackbar("Expense saved") }
        }
      )
    }
  }

  selectedExpenseDetail?.let { expense ->
    ExpenseDetailBottomSheet(
      expense = expense,
      userSettings = userSettings,
      onDismiss = { selectedExpenseDetail = null },
      onEditExpense = { toEdit ->
        selectedExpenseDetail = null
        expenseViewModel.prepareEditForm(toEdit)
        isAddingOrEditingExpense = true
      },
      onDeleteExpense = { id ->
        expenseViewModel.deleteExpense(id) {
          selectedExpenseDetail = null
          coroutineScope.launch { snackbarHostState.showSnackbar("Expense deleted") }
        }
      }
    )
  }

  val layoutType = if (isTopLevelRoute) {
    NavigationSuiteScaffoldDefaults.calculateFromAdaptiveInfo(currentWindowAdaptiveInfo())
  } else {
    NavigationSuiteType.None
  }

  val selectedTab = when {
    currentDestination?.hasRoute<ExpensesRoute>() == true -> TopLevelDestination.EXPENSES
    currentDestination?.hasRoute<BudgetsRoute>() == true -> TopLevelDestination.BUDGETS
    currentDestination?.hasRoute<InsightsRoute>() == true -> TopLevelDestination.INSIGHTS
    else -> TopLevelDestination.HOME
  }

  val navigateToTopLevel: (TopLevelDestination) -> Unit = { destination ->
    navController.navigate(destination.navRoute) {
      popUpTo<HomeRoute> { saveState = true }
      launchSingleTop = true
      restoreState = true
    }
  }

  val useRail = layoutType == NavigationSuiteType.NavigationRail ||
    layoutType == NavigationSuiteType.NavigationDrawer
  val showBottomBar = layoutType == NavigationSuiteType.NavigationBar

  Row(modifier = modifier.fillMaxSize()) {
    if (useRail) {
      NavigationRail(
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
          .fillMaxHeight()
          .testTag("main_bottom_nav_bar")
      ) {
        Spacer(modifier = Modifier.weight(1f))
        TopLevelDestination.entries.forEach { destination ->
          val selected = selectedTab == destination
          NavigationRailItem(
            selected = selected,
            onClick = { navigateToTopLevel(destination) },
            icon = {
              Icon(
                imageVector = if (selected) destination.selectedIcon else destination.unselectedIcon,
                contentDescription = destination.title,
                modifier = Modifier.size(22.dp)
              )
            },
            label = {
              Text(
                text = destination.title,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
              )
            },
            colors = NavigationRailItemDefaults.colors(
              selectedIconColor = MaterialTheme.colorScheme.onPrimary,
              selectedTextColor = MaterialTheme.colorScheme.primary,
              indicatorColor = MaterialTheme.colorScheme.primary,
              unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
              unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
            ),
            modifier = Modifier.testTag("nav_tab_${destination.name.lowercase()}")
          )
        }
        Spacer(modifier = Modifier.weight(1f))
      }
    }

    Scaffold(
      modifier = Modifier.weight(1f),
      snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
      bottomBar = {
        if (showBottomBar) {
          PlutoNavigationBar(
            selectedTab = selectedTab,
            onTabSelected = navigateToTopLevel
          )
        }
      },
      contentWindowInsets = WindowInsets(0, 0, 0, 0)
    ) { innerPadding ->
      Box(
        modifier = Modifier
          .fillMaxSize()
          .padding(innerPadding)
      ) {
        NavHost(
          navController = navController,
          startDestination = HomeRoute
        ) {
          composable<HomeRoute> {
            HomeScreen(
              userSettings = userSettings,
              dashboardViewModel = dashboardViewModel,
              walletViewModel = walletViewModel,
              onAddExpenseClick = {
                expenseViewModel.prepareCreateForm()
                isAddingOrEditingExpense = true
              },
              onNavigateToConvert = { navController.navigate(ConverterRoute) },
              onNavigateToExpenses = {
                navController.navigate(ExpensesRoute) {
                  popUpTo<HomeRoute> { saveState = true }
                  launchSingleTop = true
                  restoreState = true
                }
              },
              onNavigateToWallets = { navController.navigate(WalletsRoute) },
              onExpenseClick = { expense -> selectedExpenseDetail = expense },
              onNavigateToProfile = { navController.navigate(SettingsRoute) },
              onChangeDestinationClick = {
                navController.navigate(CurrencyPickerRoute(CurrencyPickerTarget.DESTINATION))
              },
              onSelectDestinationCurrency = onUpdateDestinationCurrency,
              onSelectHomeCurrency = onUpdateHomeCurrency,
              onUpdateSpendingCaps = onUpdateSpendingCaps,
              onUpdateAcademicTermSettings = { term -> dashboardViewModel.updateAcademicTermSettings(term) },
              onUpdateWarningThreshold = onUpdateWarningThreshold,
              onUpdateHomeTimeZone = onUpdateHomeTimeZone,
              onUpdateHomeModules = { modules ->
                dashboardViewModel.updateHomeModules(modules)
                onUpdateHomeModules(modules)
              },
              onApplyPersonaPreset = { persona ->
                dashboardViewModel.updatePersona(persona)
                onApplyPersonaPreset(persona)
              }
            )
          }

          composable<ExpensesRoute> {
            ExpensesScreen(
              userSettings = userSettings,
              viewModel = expenseViewModel,
              onAddExpenseClick = {
                expenseViewModel.prepareCreateForm()
                isAddingOrEditingExpense = true
              },
              onExpenseClick = { expense -> selectedExpenseDetail = expense },
              onNavigateToProfile = { navController.navigate(SettingsRoute) },
              onEditExpense = { toEdit ->
                expenseViewModel.prepareEditForm(toEdit)
                isAddingOrEditingExpense = true
              },
              onDeleteExpense = { id ->
                expenseViewModel.deleteExpense(id) {
                  coroutineScope.launch { snackbarHostState.showSnackbar("Expense deleted") }
                }
              }
            )
          }

          composable<BudgetsRoute> {
            BudgetsScreen(
              userSettings = userSettings,
              dashboardViewModel = dashboardViewModel,
              onNavigateToProfile = { navController.navigate(SettingsRoute) },
              onUpdateSpendingCaps = onUpdateSpendingCaps
            )
          }

          composable<InsightsRoute> {
            InsightsScreen(
              userSettings = userSettings,
              dashboardViewModel = dashboardViewModel,
              expenseViewModel = expenseViewModel,
              onNavigateToProfile = { navController.navigate(SettingsRoute) },
              onExpenseClick = { expense -> selectedExpenseDetail = expense },
              onShowSnackbar = { msg ->
                coroutineScope.launch { snackbarHostState.showSnackbar(msg) }
              }
            )
          }

          composable<SettingsRoute> {
            SettingsScreen(
              userSettings = userSettings,
              onChangeHomeCurrencyClick = {
                navController.navigate(CurrencyPickerRoute(CurrencyPickerTarget.HOME))
              },
              onChangeDestinationClick = {
                navController.navigate(CurrencyPickerRoute(CurrencyPickerTarget.DESTINATION))
              },
              onUpdateSpendingCaps = onUpdateSpendingCaps,
              onUpdateCategoryBudgets = { budgets -> dashboardViewModel.updateCategoryBudgets(budgets) },
              onResetOnboardingClick = onResetOnboarding,
              onSeedDummyDataClick = {
                onSeedDummyData()
                coroutineScope.launch {
                  snackbarHostState.showSnackbar("Sample 30-day travel data loaded")
                }
              },
              onNavigateToConverter = { navController.navigate(ConverterRoute) },
              onNavigateBack = { navController.popBackStack() },
              onUpdateThemeMode = onUpdateThemeMode,
              onUpdatePersona = { persona -> dashboardViewModel.updatePersona(persona) },
              onUpdateAcademicTermSettings = { term -> dashboardViewModel.updateAcademicTermSettings(term) },
              onUpdateBiometricLock = onUpdateBiometricLock,
              onUpdatePrivacyMode = onUpdatePrivacyMode,
              onUpdateWarningThreshold = onUpdateWarningThreshold,
              onOpenCustomRates = { showCustomRatesDialog = true },
              onOpenBackupRestore = { showBackupRestoreDialog = true },
              cloudSyncState = cloudSyncState,
              signedInEmail = signedInEmail,
              signedInDisplayName = signedInDisplayName,
              isOfflineMode = isOfflineMode,
              onGoogleSignInSuccess = onGoogleSignInSuccess,
              onSyncNowClick = onSyncNowClick,
              onSignOutClick = onSignOutClick,
              isDevMode = isDevMode
            )
          }

          composable<ConverterRoute> {
            ConverterScreen(
              viewModel = converterViewModel,
              onOpenCurrencyPicker = { isSource, _ ->
                val target = if (isSource) {
                  CurrencyPickerTarget.CONVERTER_SOURCE
                } else {
                  CurrencyPickerTarget.CONVERTER_TARGET
                }
                navController.navigate(CurrencyPickerRoute(target))
              },
              onNavigateBack = { navController.popBackStack() }
            )
          }

          composable<WalletsRoute> {
            WalletListScreen(
              viewModel = walletViewModel,
              userSettings = userSettings,
              onNavigateBack = { navController.popBackStack() },
              onAddWalletClick = {
                walletViewModel.prepareCreateForm(userSettings.destinationCurrency)
                isAddingOrEditingWallet = true
              },
              onWalletClick = { wallet -> navController.navigate(WalletDetailRoute(wallet.id)) },
              onEditWalletClick = { wallet ->
                walletViewModel.prepareEditForm(wallet)
                isAddingOrEditingWallet = true
              }
            )
          }

          composable<WalletDetailRoute> { backStackEntry ->
            val route = backStackEntry.toRoute<WalletDetailRoute>()
            val wallet = allWallets.find { it.id == route.walletId }
            if (wallet != null) {
              WalletDetailScreen(
                wallet = wallet,
                viewModel = walletViewModel,
                onNavigateBack = { navController.popBackStack() }
              )
            }
          }

          composable<CurrencyPickerRoute> { backStackEntry ->
            val target = backStackEntry.toRoute<CurrencyPickerRoute>().target
            val (pickerTitle, initialCurrency) = when (target) {
              CurrencyPickerTarget.HOME -> "Select Home Currency" to userSettings.homeCurrency
              CurrencyPickerTarget.DESTINATION -> "Select Visiting Destination" to userSettings.destinationCurrency
              CurrencyPickerTarget.CONVERTER_SOURCE -> "Convert From" to converterViewModel.sourceCurrency.value
              CurrencyPickerTarget.CONVERTER_TARGET -> "Convert To" to converterViewModel.targetCurrency.value
              CurrencyPickerTarget.EXPENSE_LOCAL -> "Select Local (Spent) Currency" to expenseViewModel.formState.value.localCurrency
              CurrencyPickerTarget.EXPENSE_HOME -> "Select Home (Target) Currency" to expenseViewModel.formState.value.homeCurrency
              CurrencyPickerTarget.WALLET -> "Select Wallet Currency" to walletViewModel.formState.value.currency
            }
            CurrencySelectionScreen(
              title = pickerTitle,
              selectedCurrency = initialCurrency,
              onCurrencySelected = { newCurrency ->
                when (target) {
                  CurrencyPickerTarget.HOME -> {
                    onUpdateHomeCurrency(newCurrency)
                    coroutineScope.launch { snackbarHostState.showSnackbar("Home currency updated to ${newCurrency.code}") }
                  }
                  CurrencyPickerTarget.DESTINATION -> {
                    onUpdateDestinationCurrency(newCurrency)
                    coroutineScope.launch { snackbarHostState.showSnackbar("Visiting destination set to ${newCurrency.name}") }
                  }
                  CurrencyPickerTarget.CONVERTER_SOURCE -> converterViewModel.setSourceCurrency(newCurrency)
                  CurrencyPickerTarget.CONVERTER_TARGET -> converterViewModel.setTargetCurrency(newCurrency)
                  CurrencyPickerTarget.EXPENSE_LOCAL -> expenseViewModel.onLocalCurrencyChanged(newCurrency)
                  CurrencyPickerTarget.EXPENSE_HOME -> expenseViewModel.onHomeCurrencyChanged(newCurrency)
                  CurrencyPickerTarget.WALLET -> walletViewModel.onCurrencyChanged(newCurrency)
                }
                navController.popBackStack()
              },
              onBackClick = { navController.popBackStack() }
            )
          }
        }
      }
    }
  }
}
