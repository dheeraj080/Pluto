package com.pluto.app.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.wallet.WalletViewModel
import java.math.BigDecimal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel,
  walletViewModel: WalletViewModel,
  onAddExpenseClick: () -> Unit,
  onNavigateToConvert: () -> Unit,
  onNavigateToExpenses: () -> Unit,
  onNavigateToWallets: () -> Unit,
  onExpenseClick: (Expense) -> Unit,
  onNavigateToProfile: () -> Unit = {},
  onChangeDestinationClick: () -> Unit = {},
  onSelectDestinationCurrency: (Currency) -> Unit = {},
  onSelectHomeCurrency: (Currency) -> Unit = {},
  onUpdateSpendingCaps: (BigDecimal?, BigDecimal?) -> Unit = { _, _ -> },
  onUpdateWarningThreshold: (BigDecimal?, Boolean) -> Unit = { _, _ -> },
  onUpdateHomeTimeZone: (String?) -> Unit = {},
  onUpdateAcademicTermSettings: (AcademicTermSettings) -> Unit = {},
  onUpdateHomeModules: (List<HomeModuleConfig>) -> Unit = {},
  onApplyPersonaPreset: (UserPersona) -> Unit = {},
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destinationCurrency = userSettings.destinationCurrency
  val uiState by dashboardViewModel.uiState.collectAsStateWithLifecycle()
  val fxStatus by dashboardViewModel.fxStatus.collectAsStateWithLifecycle()
  val allWallets by walletViewModel.allWallets.collectAsStateWithLifecycle()
  val portfolioValuation by walletViewModel.portfolioValuation.collectAsStateWithLifecycle()
  val isWalletTxSubmitting by walletViewModel.isTransactionSubmitting.collectAsStateWithLifecycle()

  var showCapsDialog by remember { mutableStateOf(false) }
  var showCategoryBudgetsDialog by remember { mutableStateOf(false) }
  var showIncomeDialog by remember { mutableStateOf(false) }
  var showTransferDialog by remember { mutableStateOf(false) }
  var incomeDialogError by remember { mutableStateOf<String?>(null) }
  var transferDialogError by remember { mutableStateOf<String?>(null) }
  var showTimeZonePicker by remember { mutableStateOf(false) }
  var showTermDialog by remember { mutableStateOf(false) }
  var showCustomizeSheet by remember { mutableStateOf(false) }

  if (showCapsDialog) {
    SpendingCapsDialog(
      userSettings = userSettings,
      dashboardViewModel = dashboardViewModel,
      onDismiss = { showCapsDialog = false },
      onSave = { daily, monthly ->
        onUpdateSpendingCaps(daily, monthly)
        showCapsDialog = false
      }
    )
  }

  if (showCategoryBudgetsDialog) {
    CategoryBudgetsDialog(
      userSettings = userSettings,
      dashboardViewModel = dashboardViewModel,
      onDismiss = { showCategoryBudgetsDialog = false },
      onSave = { budgets ->
        dashboardViewModel.updateCategoryBudgets(budgets)
        showCategoryBudgetsDialog = false
      }
    )
  }

  if (showIncomeDialog) {
    QuickIncomeDialog(
      wallets = allWallets,
      defaultCurrency = destinationCurrency,
      isSubmitting = isWalletTxSubmitting,
      errorMessage = incomeDialogError,
      onClearError = { incomeDialogError = null },
      onDismiss = {
        incomeDialogError = null
        showIncomeDialog = false
      },
      onConfirm = { walletId, amount, note ->
        incomeDialogError = null
        walletViewModel.deposit(
          walletId = walletId,
          amount = amount,
          note = note,
          onSuccess = {
            incomeDialogError = null
            showIncomeDialog = false
          },
          onError = { msg -> incomeDialogError = msg }
        )
      }
    )
  }

  if (showTransferDialog) {
    QuickTransferDialog(
      wallets = allWallets,
      defaultSourceCurrency = homeCurrency,
      defaultTargetCurrency = destinationCurrency,
      isSubmitting = isWalletTxSubmitting,
      errorMessage = transferDialogError,
      onClearError = { transferDialogError = null },
      onDismiss = {
        transferDialogError = null
        showTransferDialog = false
      },
      onConfirm = { srcId, dstId, amount, note ->
        transferDialogError = null
        walletViewModel.transfer(
          sourceWalletId = srcId,
          destinationWalletId = dstId,
          amount = amount,
          note = note,
          onSuccess = {
            transferDialogError = null
            showTransferDialog = false
          },
          onError = { msg -> transferDialogError = msg }
        )
      }
    )
  }

  if (showTimeZonePicker) {
    HomeTimeZonePickerSheet(
      userSettings = userSettings,
      onSelectTimeZone = onUpdateHomeTimeZone,
      onDismiss = { showTimeZonePicker = false }
    )
  }

  if (showTermDialog) {
    TermSettingsDialog(
      userSettings = userSettings,
      onDismiss = { showTermDialog = false },
      onSave = { updatedTerm ->
        onUpdateAcademicTermSettings(updatedTerm)
        showTermDialog = false
      }
    )
  }

  if (showCustomizeSheet) {
    HomeCustomizeSheet(
      currentPersona = userSettings.persona,
      currentModules = userSettings.homeModules,
      onUpdateModules = onUpdateHomeModules,
      onApplyPersonaPreset = onApplyPersonaPreset,
      onDismiss = { showCustomizeSheet = false }
    )
  }

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        title = {
          Text(
            text = "Welcome back",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier
              .plutoHeading()
              .testTag("home_topbar_title")
          )
        },
        actions = {
          val switchChipInteraction = remember { MutableInteractionSource() }
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .plutoPressableScale(
                enabled = true,
                pressedScale = PlutoMotion.PressScale,
                interactionSource = switchChipInteraction
              )
              .clip(PlutoShapes.medium)
              .clickable(
                interactionSource = switchChipInteraction,
                indication = androidx.compose.material3.ripple(),
                role = Role.Button
              ) { onChangeDestinationClick() }
              .semantics(mergeDescendants = true) {
                contentDescription = "Change primary or reference currency. Currently ${userSettings.destinationCurrency.code} and ${userSettings.homeCurrency.code}"
              }
              .testTag("home_currency_switch_chip")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.SwapHoriz,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.primary
              )
              Spacer(modifier = Modifier.width(4.dp))
              Text(
                text = "${userSettings.destinationCurrency.code} / ${userSettings.homeCurrency.code}",
                style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
              )
            }
          }

          Spacer(modifier = Modifier.width(6.dp))

          IconButton(
            onClick = onNavigateToProfile,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("home_profile_button")
              .padding(end = 8.dp)
          ) {
            Surface(
              shape = CircleShape,
              color = MaterialTheme.colorScheme.primaryContainer,
              modifier = Modifier.size(38.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.AccountCircle,
                  contentDescription = "Profile and Settings",
                  tint = MaterialTheme.colorScheme.onPrimaryContainer,
                  modifier = Modifier.size(24.dp)
                )
              }
            }
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.background
        )
      )
    }
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
    ) {
      when (val state = uiState) {
        is DashboardUiState.Loading -> {
          Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(modifier = Modifier.testTag("dashboard_loading"))
          }
        }

        is DashboardUiState.Empty -> {
          HomeDashboardContent(
            summary = state.summary,
            portfolioValuation = portfolioValuation,
            wallets = allWallets,
            userSettings = userSettings,
            fxStatus = fxStatus,
            isEmptyState = true,
            onOpenCapsDialog = { showCapsDialog = true },
            onOpenCategoryBudgetsDialog = { showCategoryBudgetsDialog = true },
            onOpenTermDialog = { showTermDialog = true },
            onOpenTimeZonePicker = { showTimeZonePicker = true },
            onOpenCustomizeSheet = { showCustomizeSheet = true },
            onUpdateWarningThreshold = onUpdateWarningThreshold,
            onTestNotification = { dashboardViewModel.sendTestNotification(state.summary) },
            onAddExpenseClick = onAddExpenseClick,
            onExpenseClick = onExpenseClick,
            onNavigateToWallets = onNavigateToWallets,
            onNavigateToConvert = onNavigateToConvert,
            onNavigateToExpenses = onNavigateToExpenses,
            onAddIncomeClick = { showIncomeDialog = true },
            onTransferClick = { showTransferDialog = true }
          )
        }

        is DashboardUiState.Content -> {
          HomeDashboardContent(
            summary = state.summary,
            portfolioValuation = portfolioValuation,
            wallets = allWallets,
            userSettings = userSettings,
            fxStatus = fxStatus,
            isEmptyState = false,
            onOpenCapsDialog = { showCapsDialog = true },
            onOpenCategoryBudgetsDialog = { showCategoryBudgetsDialog = true },
            onOpenTermDialog = { showTermDialog = true },
            onOpenTimeZonePicker = { showTimeZonePicker = true },
            onOpenCustomizeSheet = { showCustomizeSheet = true },
            onUpdateWarningThreshold = onUpdateWarningThreshold,
            onTestNotification = { dashboardViewModel.sendTestNotification(state.summary) },
            onAddExpenseClick = onAddExpenseClick,
            onExpenseClick = onExpenseClick,
            onNavigateToWallets = onNavigateToWallets,
            onNavigateToConvert = onNavigateToConvert,
            onNavigateToExpenses = onNavigateToExpenses,
            onAddIncomeClick = { showIncomeDialog = true },
            onTransferClick = { showTransferDialog = true }
          )
        }

        is DashboardUiState.Error -> {
          Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
          ) {
            com.pluto.app.ui.components.EmptyState(
              icon = Icons.Rounded.Warning,
              title = "Couldn't load dashboard",
              description = state.message,
              actionText = "Retry",
              onActionClick = dashboardViewModel::retry,
              actionTestTag = "dashboard_retry_button"
            )
          }
        }
      }
    }
  }
}
