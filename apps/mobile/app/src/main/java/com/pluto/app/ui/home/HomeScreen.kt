package com.pluto.app.ui.home

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Paid
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.PortfolioValuationSummary
import com.pluto.app.domain.model.UnifiedTransactionItem
import com.pluto.app.domain.model.UnifiedTransactionType
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.wallet.WalletViewModel
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
  onUpdateSpendingCaps: (Double?, Double?) -> Unit = { _, _ -> },
  onUpdateWarningThreshold: (Double?, Boolean) -> Unit = { _, _ -> },
  onUpdateHomeTimeZone: (String?) -> Unit = {},
  onUpdateAcademicTermSettings: (AcademicTermSettings) -> Unit = {},
  onUpdateHomeModules: (List<HomeModuleConfig>) -> Unit = {},
  onApplyPersonaPreset: (UserPersona) -> Unit = {},
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destinationCurrency = userSettings.destinationCurrency
  val uiState by dashboardViewModel.uiState.collectAsStateWithLifecycle()
  val allWallets by walletViewModel.allWallets.collectAsStateWithLifecycle()
  val portfolioValuation by walletViewModel.portfolioValuation.collectAsStateWithLifecycle()

  var showCapsDialog by remember { mutableStateOf(false) }
  var showCategoryBudgetsDialog by remember { mutableStateOf(false) }
  var showIncomeDialog by remember { mutableStateOf(false) }
  var showTransferDialog by remember { mutableStateOf(false) }
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
      onDismiss = { showIncomeDialog = false },
      onConfirm = { walletId, amount, note ->
        walletViewModel.deposit(walletId, amount, note, onSuccess = { showIncomeDialog = false }, onError = {})
      }
    )
  }

  if (showTransferDialog) {
    QuickTransferDialog(
      wallets = allWallets,
      defaultSourceCurrency = homeCurrency,
      defaultTargetCurrency = destinationCurrency,
      onDismiss = { showTransferDialog = false },
      onConfirm = { srcId, dstId, amount, note ->
        walletViewModel.transfer(srcId, dstId, amount, note, onSuccess = { showTransferDialog = false }, onError = {})
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
              .testTag("home_currency_switch_chip")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.SwapHoriz,
                contentDescription = "Switch Currency",
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
      }
    }
  }
}

@Composable
internal fun HomeDashboardContent(
  summary: DashboardSummary,
  userSettings: UserSettings,
  onOpenCapsDialog: () -> Unit,
  onOpenCategoryBudgetsDialog: () -> Unit,
  onOpenTermDialog: () -> Unit = {},
  onOpenTimeZonePicker: () -> Unit = {},
  onOpenCustomizeSheet: () -> Unit = {},
  onUpdateWarningThreshold: (Double?, Boolean) -> Unit = { _, _ -> },
  onTestNotification: () -> Boolean = { false },
  onAddExpenseClick: () -> Unit,
  onExpenseClick: (Expense) -> Unit,
  portfolioValuation: PortfolioValuationSummary? = null,
  wallets: List<CurrencyWallet> = emptyList(),
  onNavigateToWallets: () -> Unit = {},
  onNavigateToConvert: () -> Unit = {},
  onNavigateToExpenses: () -> Unit = {},
  onAddIncomeClick: () -> Unit = {},
  onTransferClick: () -> Unit = {}
) {
  var isCategoryExpanded by remember { mutableStateOf(false) }
  val activeModules = remember(userSettings.homeModules, userSettings.persona) {
    HomeLayoutPresets.normalize(userSettings.homeModules, userSettings.persona)
      .filter { it.isEnabled }
  }

  Box(
    modifier = Modifier.fillMaxSize(),
    contentAlignment = Alignment.TopCenter
  ) {
    Column(
      modifier = Modifier
        .widthIn(max = 840.dp)
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 8.dp)
        .animateContentSize(),
      verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      // 1. Stacked Dual Wallet Hero Cards with inline Dual-Zone Clock
      StackedCardsHero(
        summary = summary,
        portfolioValuation = portfolioValuation,
        userSettings = userSettings,
        wallets = wallets,
        onNavigateToWallets = onNavigateToWallets,
        onClockClick = onOpenTimeZonePicker
      )

      // 2. Fixed 4-Action Pill Dock (+ Expense, Convert, Transfer, + Income)
      FixedActionDock(
        onAddExpense = onAddExpenseClick,
        onConvert = onNavigateToConvert,
        onTransfer = onTransferClick,
        onAddIncome = onAddIncomeClick
      )

      // 3. Customizable Modular Feed
      activeModules.forEach { module ->
        when (module.id) {
          HomeModuleId.STACKED_WALLETS -> {
            PortfolioOverviewModuleCard(
              portfolioValuation = portfolioValuation,
              wallets = wallets,
              userSettings = userSettings,
              onNavigateToWallets = onNavigateToWallets
            )
          }

          HomeModuleId.DAILY_SAFE_TO_SPEND -> {
            DailySafeToSpendModuleCard(
              summary = summary,
              userSettings = userSettings,
              onOpenCapsDialog = onOpenCapsDialog,
              onUpdateWarningThreshold = onUpdateWarningThreshold,
              onTestNotification = onTestNotification
            )
          }

          HomeModuleId.CYCLE_RUNWAY -> {
            CycleRunwayModuleCard(
              runwaySummary = summary.termRunwaySummary,
              userSettings = userSettings,
              onEditTermClick = onOpenTermDialog
            )
          }

          HomeModuleId.CASH_FLOW_SUMMARY -> {
            CashFlowSummaryBar(
              summary = summary,
              modifier = Modifier.testTag("module_card_cash_flow_summary")
            )
          }

          HomeModuleId.SPENDING_TREND -> {
            SpendingTrendCard(summary = summary)
          }

          HomeModuleId.CATEGORY_BUDGETS -> {
            CategoryBudgetsModuleCard(
              categories = summary.categoryBreakdowns,
              isExpanded = isCategoryExpanded,
              onToggle = { isCategoryExpanded = !isCategoryExpanded },
              onManageBudgetsClick = onOpenCategoryBudgetsDialog
            )
          }

          HomeModuleId.RECENT_EXPENSES -> {
            ManageExpensesSection(
              items = summary.unifiedRecentTransactions,
              onExpenseClick = onExpenseClick,
              onViewAllClick = onNavigateToExpenses,
              onAddExpenseClick = onAddExpenseClick
            )
          }
        }
      }

      // 4. Customize Home Trigger
      Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
      ) {
        val customizeInteraction = remember { MutableInteractionSource() }
        OutlinedButton(
          onClick = onOpenCustomizeSheet,
          interactionSource = customizeInteraction,
          shape = PlutoShapes.extraLarge,
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
          modifier = Modifier
            .heightIn(min = 48.dp)
            .minimumInteractiveComponentSize()
            .plutoPressableScale(
              enabled = true,
              pressedScale = PlutoMotion.PressScale,
              interactionSource = customizeInteraction
            )
            .testTag("customize_home_button")
        ) {
          Icon(
            imageVector = Icons.Rounded.Tune,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
          )
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = "Customize Home",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold
          )
        }
      }

      Spacer(modifier = Modifier.height(80.dp))
    }
  }
}

/**
 * Recent Expenses section rendered as a clean borderless Ivory White card.
 */
@Composable
fun ManageExpensesSection(
  items: List<UnifiedTransactionItem>,
  onExpenseClick: (Expense) -> Unit,
  onViewAllClick: () -> Unit,
  onAddExpenseClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .testTag("manage_expenses_section")
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        text = "Recent Activity",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.plutoHeading()
      )
      val viewAllInteraction = remember { MutableInteractionSource() }
      TextButton(
        onClick = onViewAllClick,
        interactionSource = viewAllInteraction,
        modifier = Modifier
          .minimumInteractiveComponentSize()
          .plutoPressableScale(
            enabled = true,
            pressedScale = PlutoMotion.PressScale,
            interactionSource = viewAllInteraction
          )
          .testTag("manage_expenses_view_all_button")
      ) {
        Text(
          text = "View All",
          style = MaterialTheme.typography.labelMedium,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.primary
        )
      }
    }

    Spacer(modifier = Modifier.height(8.dp))

    val expenseItems = items.filter { it.type == UnifiedTransactionType.EXPENSE }.take(4)
    if (expenseItems.isEmpty()) {
      Card(
        shape = PlutoShapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          Text(
            text = "No recorded expenses yet",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          Spacer(modifier = Modifier.height(10.dp))
          OutlinedButton(
            onClick = onAddExpenseClick,
            modifier = Modifier.minimumInteractiveComponentSize()
          ) {
            Text("Log an Expense")
          }
        }
      }
    } else {
      Card(
        shape = PlutoShapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(modifier = Modifier.padding(vertical = 8.dp)) {
          val dateFormatter = remember { SimpleDateFormat("hh:mm a • dd MMM", Locale.US) }
          expenseItems.forEachIndexed { index, item ->
            val expense = item.originalExpense
            val category = expense?.category ?: Category.OTHER
            val formattedDate = dateFormatter.format(Date(item.timestamp))

            Row(
              modifier = Modifier
                .fillMaxWidth()
                .minimumInteractiveComponentSize()
                .clickable { if (expense != null) onExpenseClick(expense) }
                .padding(horizontal = 16.dp, vertical = 12.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.size(42.dp)
              ) {
                Box(contentAlignment = Alignment.Center) {
                  Icon(
                    imageVector = when (category) {
                      Category.FOOD -> Icons.Rounded.Paid
                      Category.TRANSPORT -> Icons.Rounded.FlightTakeoff
                      else -> Icons.AutoMirrored.Rounded.ReceiptLong
                    },
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                  )
                }
              }

              Spacer(modifier = Modifier.width(14.dp))

              Column(modifier = Modifier.weight(1f)) {
                Text(
                  text = item.title,
                  style = MaterialTheme.typography.bodyMedium,
                  fontWeight = FontWeight.SemiBold,
                  color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                  text = formattedDate,
                  style = MaterialTheme.typography.labelSmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }

              Text(
                text = item.primaryAmountFormatted,
                style = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
              )
            }

            if (index < expenseItems.lastIndex) {
              HorizontalDivider(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                modifier = Modifier.padding(horizontal = 16.dp)
              )
            }
          }
        }
      }
    }
  }
}

/**
 * Cash Flow Summary Bar (+Income | -Expenses | =Net)
 * Dual-Currency: Primary current country, Secondary home country.
 */
@Composable
fun CashFlowSummaryBar(
  summary: DashboardSummary,
  modifier: Modifier = Modifier
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 18.dp, vertical = 16.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column {
        Text(
          text = "INCOME",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        val incomePrimary = "+${summary.totalIncomeDest?.format() ?: summary.totalIncomeHome.format()}"
        val incomeSecondary = "+${summary.totalIncomeHome.format()}"
        Text(
          text = incomePrimary,
          style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.secondary
        )
        Text(
          text = incomeSecondary,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      Column {
        Text(
          text = "EXPENSES",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        val expensePrimary = "-${summary.totalDestSpending?.format() ?: summary.totalHomeSpending.format()}"
        val expenseSecondary = "-${summary.totalHomeSpending.format()}"
        Text(
          text = expensePrimary,
          style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.error
        )
        Text(
          text = expenseSecondary,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      Column(horizontalAlignment = Alignment.End) {
        Text(
          text = "NET FLOW",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        val isNetPositive = summary.netCashFlowHome.amount >= BigDecimal.ZERO
        val netPrimary = (if (isNetPositive) "+" else "") + (summary.netCashFlowDest?.format() ?: summary.netCashFlowHome.format())
        val netSecondary = (if (isNetPositive) "+" else "") + summary.netCashFlowHome.format()
        Text(
          text = netPrimary,
          style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = if (isNetPositive) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
        )
        Text(
          text = netSecondary,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

/**
 * Collapsible Category Budget Breakdown rendered as a borderless card.
 */
@Composable
fun CollapsibleCategoryBudgets(
  categories: List<CategorySpendingSummary>,
  isExpanded: Boolean,
  onToggle: () -> Unit,
  onManageBudgetsClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Column(modifier = Modifier.padding(18.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(
          modifier = Modifier
            .weight(1f)
            .clickable(onClick = onToggle)
        ) {
          Text(
            text = "CATEGORY BUDGETS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
          Text(
            text = "${categories.size} categories active",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
          TextButton(
            onClick = onManageBudgetsClick,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("manage_category_budgets_button")
          ) {
            Text(
              text = "Set Budgets",
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold
            )
          }

          IconButton(
            onClick = onToggle,
            modifier = Modifier.minimumInteractiveComponentSize()
          ) {
            Icon(
              imageVector = if (isExpanded) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
              contentDescription = if (isExpanded) "Collapse" else "Expand"
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      val displayedCategories = if (isExpanded) categories else categories.take(2)
      displayedCategories.forEachIndexed { index, item ->
        CategoryBudgetRow(item = item)
        if (index < displayedCategories.lastIndex) {
          Spacer(modifier = Modifier.height(12.dp))
        }
      }
    }
  }
}

@Composable
private fun CategoryBudgetRow(item: CategorySpendingSummary) {
  val hasBudget = item.budgetHome != null
  val progressFraction = item.budgetProgress?.coerceIn(0f, 1f)
    ?: (item.percentageOfTotal.toFloat() / 100f).coerceIn(0f, 1f)

  val barColor = when {
    item.isOverBudget -> MaterialTheme.colorScheme.error
    (item.budgetProgress ?: 0f) >= 0.75f -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.primary
  }

  Column {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
          text = item.category.name,
          style = MaterialTheme.typography.bodyMedium,
          fontWeight = FontWeight.SemiBold
        )
        if (item.isOverBudget) {
          Spacer(modifier = Modifier.width(6.dp))
          Surface(
            shape = PlutoShapes.small,
            color = MaterialTheme.colorScheme.errorContainer
          ) {
            Text(
              text = "OVER",
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onErrorContainer,
              fontSize = 9.sp,
              modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )
          }
        }
      }

      Column(horizontalAlignment = Alignment.End) {
        val destAmount = item.totalDestAmount?.format() ?: item.totalHomeAmount.format()
        if (hasBudget) {
          val budgetDest = item.budgetDest?.format() ?: item.budgetHome?.format() ?: ""
          Text(
            text = "$destAmount / $budgetDest",
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = if (item.isOverBudget) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
          )
          Text(
            text = "${((item.budgetProgress ?: 0f) * 100).toInt()}% of budget",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        } else {
          Text(
            text = destAmount,
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "≈ ${item.totalHomeAmount.format()}",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(4.dp))

    LinearProgressIndicator(
      progress = { progressFraction },
      modifier = Modifier
        .fillMaxWidth()
        .height(7.dp)
        .clip(PlutoShapes.extraSmall),
      color = barColor,
      trackColor = MaterialTheme.colorScheme.surfaceVariant,
      strokeCap = StrokeCap.Round
    )
  }
}

/**
 * Quick Income / Deposit Bottom Sheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickIncomeDialog(
  wallets: List<CurrencyWallet>,
  defaultCurrency: Currency? = null,
  onDismiss: () -> Unit,
  onConfirm: (walletId: String, amount: BigDecimal, note: String) -> Unit
) {
  val initialWallet = remember(wallets, defaultCurrency) {
    if (defaultCurrency != null) {
      wallets.firstOrNull { it.currency.code.equals(defaultCurrency.code, ignoreCase = true) }
        ?: wallets.firstOrNull()
    } else {
      wallets.firstOrNull()
    }
  }
  var selectedWallet by remember { mutableStateOf(initialWallet) }
  var amountText by remember { mutableStateOf("") }
  var noteText by remember { mutableStateOf("") }
  var expanded by remember { mutableStateOf(false) }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("quick_income_bottom_sheet")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp)
        .verticalScroll(rememberScrollState())
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "Add Income / Deposit",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "Credit funds into your travel wallet",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        IconButton(onClick = onDismiss) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }

      Spacer(modifier = Modifier.height(16.dp))

      if (wallets.isEmpty()) {
        Text("No accounts found. Please create a wallet in Accounts first.")
      } else {
        ExposedDropdownMenuBox(
          expanded = expanded,
          onExpandedChange = { expanded = it }
        ) {
          OutlinedTextField(
            value = selectedWallet?.let { "${it.currency.flagEmoji} ${it.currency.name} (${it.currency.code})" } ?: "Select Account",
            onValueChange = {},
            readOnly = true,
            label = { Text("Target Wallet (Default: Local)") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
          )
          ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
          ) {
            wallets.forEach { w ->
              val isDefault = defaultCurrency != null && w.currency.code.equals(defaultCurrency.code, ignoreCase = true)
              DropdownMenuItem(
                text = {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${w.currency.flagEmoji} ${w.currency.name} (${w.currency.code}) - ${w.balance.format()}")
                    if (isDefault) {
                      Spacer(modifier = Modifier.width(6.dp))
                      Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(4.dp)
                      ) {
                        Text(
                          "Local Default",
                          modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                          style = MaterialTheme.typography.labelSmall,
                          color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                      }
                    }
                  }
                },
                onClick = {
                  selectedWallet = w
                  expanded = false
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = amountText,
          onValueChange = { amountText = it.filter { ch -> ch.isDigit() || ch == '.' } },
          label = { Text("Income Amount (${selectedWallet?.currency?.symbol ?: ""})") },
          placeholder = { Text("0.00") },
          singleLine = true,
          shape = RoundedCornerShape(12.dp),
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_income_amount_input")
        )

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = noteText,
          onValueChange = { noteText = it },
          label = { Text("Source / Note (Optional)") },
          placeholder = { Text("e.g. Scholarship, Salary, ATM Cash In") },
          singleLine = true,
          shape = RoundedCornerShape(12.dp),
          modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          OutlinedButton(
            onClick = onDismiss,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(12.dp)
          ) {
            Text("Cancel")
          }
          Button(
            onClick = {
              val wallet = selectedWallet ?: return@Button
              val amt = amountText.toBigDecimalOrNull() ?: return@Button
              if (amt > BigDecimal.ZERO) {
                onConfirm(wallet.id, amt, noteText)
              }
            },
            enabled = selectedWallet != null && (amountText.toBigDecimalOrNull() ?: BigDecimal.ZERO) > BigDecimal.ZERO,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(12.dp)
          ) {
            Text("Save Income")
          }
        }
      }
    }
  }
}

/**
 * Quick Transfer Between Accounts Bottom Sheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickTransferDialog(
  wallets: List<CurrencyWallet>,
  defaultSourceCurrency: Currency? = null,
  defaultTargetCurrency: Currency? = null,
  onDismiss: () -> Unit,
  onConfirm: (srcWalletId: String, dstWalletId: String, amount: BigDecimal, note: String) -> Unit
) {
  val initialSrc = remember(wallets, defaultSourceCurrency) {
    if (defaultSourceCurrency != null) {
      wallets.firstOrNull { it.currency.code.equals(defaultSourceCurrency.code, ignoreCase = true) }
        ?: wallets.firstOrNull()
    } else {
      wallets.firstOrNull()
    }
  }
  val initialDst = remember(wallets, defaultTargetCurrency, initialSrc) {
    if (defaultTargetCurrency != null) {
      wallets.firstOrNull { it.currency.code.equals(defaultTargetCurrency.code, ignoreCase = true) && it.id != initialSrc?.id }
        ?: wallets.firstOrNull { it.id != initialSrc?.id }
        ?: wallets.getOrNull(1)
        ?: wallets.firstOrNull()
    } else {
      wallets.firstOrNull { it.id != initialSrc?.id } ?: wallets.firstOrNull()
    }
  }

  var srcWallet by remember { mutableStateOf(initialSrc) }
  var dstWallet by remember { mutableStateOf(initialDst) }
  var amountText by remember { mutableStateOf("") }
  var noteText by remember { mutableStateOf("") }
  var srcExpanded by remember { mutableStateOf(false) }
  var dstExpanded by remember { mutableStateOf(false) }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("quick_transfer_bottom_sheet")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp)
        .verticalScroll(rememberScrollState())
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "Transfer Between Wallets",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "Move funds between your multi-currency travel accounts",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        IconButton(onClick = onDismiss) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }

      Spacer(modifier = Modifier.height(16.dp))

      if (wallets.size < 2) {
        Text("At least 2 accounts are required to make transfers. Create another wallet in Wallets first.")
        Spacer(modifier = Modifier.height(16.dp))
        Button(
          onClick = onDismiss,
          modifier = Modifier.fillMaxWidth().height(48.dp),
          shape = RoundedCornerShape(12.dp)
        ) {
          Text("Got it")
        }
      } else {
        ExposedDropdownMenuBox(expanded = srcExpanded, onExpandedChange = { srcExpanded = it }) {
          OutlinedTextField(
            value = srcWallet?.let { "From: ${it.currency.flagEmoji} ${it.currency.code} (${it.balance.format()})" } ?: "Select From",
            onValueChange = {},
            readOnly = true,
            label = { Text("Transfer From") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = srcExpanded) },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
          )
          ExposedDropdownMenu(expanded = srcExpanded, onDismissRequest = { srcExpanded = false }) {
            wallets.forEach { w ->
              DropdownMenuItem(
                text = { Text("${w.currency.flagEmoji} ${w.currency.code} (${w.currency.name}) - ${w.balance.format()}") },
                onClick = {
                  srcWallet = w
                  if (dstWallet?.id == w.id) {
                    dstWallet = wallets.firstOrNull { it.id != w.id }
                  }
                  srcExpanded = false
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(12.dp))

        ExposedDropdownMenuBox(expanded = dstExpanded, onExpandedChange = { dstExpanded = it }) {
          OutlinedTextField(
            value = dstWallet?.let { "To: ${it.currency.flagEmoji} ${it.currency.code} (${it.currency.name})" } ?: "Select To",
            onValueChange = {},
            readOnly = true,
            label = { Text("Destination Wallet") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dstExpanded) },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
          )
          ExposedDropdownMenu(expanded = dstExpanded, onDismissRequest = { dstExpanded = false }) {
            wallets.filter { it.id != srcWallet?.id }.forEach { w ->
              val isTargetDefault = defaultTargetCurrency != null && w.currency.code.equals(defaultTargetCurrency.code, ignoreCase = true)
              DropdownMenuItem(
                text = {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${w.currency.flagEmoji} ${w.currency.code} (${w.currency.name}) - ${w.balance.format()}")
                    if (isTargetDefault) {
                      Spacer(modifier = Modifier.width(6.dp))
                      Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(4.dp)
                      ) {
                        Text(
                          "Local Default",
                          modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                          style = MaterialTheme.typography.labelSmall,
                          color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                      }
                    }
                  }
                },
                onClick = {
                  dstWallet = w
                  dstExpanded = false
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = amountText,
          onValueChange = { amountText = it.filter { ch -> ch.isDigit() || ch == '.' } },
          label = { Text("Amount to Send (${srcWallet?.currency?.symbol ?: ""})") },
          placeholder = { Text("0.00") },
          singleLine = true,
          shape = RoundedCornerShape(12.dp),
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
          modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = noteText,
          onValueChange = { noteText = it },
          label = { Text("Transfer Note (Optional)") },
          placeholder = { Text("e.g. Travel card funding, Local FX conversion") },
          singleLine = true,
          shape = RoundedCornerShape(12.dp),
          modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          OutlinedButton(
            onClick = onDismiss,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(12.dp)
          ) {
            Text("Cancel")
          }
          Button(
            onClick = {
              val src = srcWallet ?: return@Button
              val dst = dstWallet ?: return@Button
              val amt = amountText.toBigDecimalOrNull() ?: return@Button
              if (amt > BigDecimal.ZERO && src.id != dst.id) {
                onConfirm(src.id, dst.id, amt, noteText)
              }
            },
            enabled = wallets.size >= 2 && srcWallet?.id != dstWallet?.id && (amountText.toBigDecimalOrNull() ?: BigDecimal.ZERO) > BigDecimal.ZERO,
            modifier = Modifier.weight(1f).height(48.dp),
            shape = RoundedCornerShape(12.dp)
          ) {
            Text("Execute Transfer")
          }
        }
      }
    }
  }
}

/**
 * Spending Caps Configuration Dialog with currency selection
 * and real-time conversion to base (home) currency.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpendingCapsDialog(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel? = null,
  onDismiss: () -> Unit,
  onSave: (Double?, Double?) -> Unit
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency

  var selectedBudgetCurrency by remember { mutableStateOf(destCurrency) }
  var currencyDropdownExpanded by remember { mutableStateOf(false) }
  var currentRateToBase by remember { mutableStateOf<BigDecimal?>(null) }

  LaunchedEffect(selectedBudgetCurrency, homeCurrency) {
    if (selectedBudgetCurrency == homeCurrency) {
      currentRateToBase = BigDecimal.ONE
    } else {
      currentRateToBase = dashboardViewModel?.getConversionRate(selectedBudgetCurrency, homeCurrency)
        ?: when {
          selectedBudgetCurrency.code == "JPY" && homeCurrency.code == "USD" -> BigDecimal("0.0067")
          selectedBudgetCurrency.code == "USD" && homeCurrency.code == "JPY" -> BigDecimal("150.0")
          selectedBudgetCurrency.code == "EUR" && homeCurrency.code == "USD" -> BigDecimal("1.08")
          selectedBudgetCurrency.code == "USD" && homeCurrency.code == "EUR" -> BigDecimal("0.92")
          else -> BigDecimal.ONE
        }
    }
  }

  val initialDailyInSelected = remember(userSettings.dailySpendingCap, selectedBudgetCurrency) {
    val homeVal = userSettings.dailySpendingCap
    if (homeVal != null && homeVal > 0.0) {
      if (selectedBudgetCurrency == homeCurrency) {
        String.format(Locale.US, "%.2f", homeVal)
      } else {
        val rateToDest = when {
          selectedBudgetCurrency.code == "JPY" && homeCurrency.code == "USD" -> 150.0
          selectedBudgetCurrency.code == "EUR" && homeCurrency.code == "USD" -> 0.92
          else -> 1.0
        }
        String.format(Locale.US, "%.2f", homeVal * rateToDest)
      }
    } else ""
  }

  val initialMonthlyInSelected = remember(userSettings.monthlySpendingCap, selectedBudgetCurrency) {
    val homeVal = userSettings.monthlySpendingCap
    if (homeVal != null && homeVal > 0.0) {
      if (selectedBudgetCurrency == homeCurrency) {
        String.format(Locale.US, "%.2f", homeVal)
      } else {
        val rateToDest = when {
          selectedBudgetCurrency.code == "JPY" && homeCurrency.code == "USD" -> 150.0
          selectedBudgetCurrency.code == "EUR" && homeCurrency.code == "USD" -> 0.92
          else -> 1.0
        }
        String.format(Locale.US, "%.2f", homeVal * rateToDest)
      }
    } else ""
  }

  var dailyText by remember(initialDailyInSelected) { mutableStateOf(initialDailyInSelected) }
  var monthlyText by remember(initialMonthlyInSelected) { mutableStateOf(initialMonthlyInSelected) }

  val parsedDailyEntered = dailyText.toDoubleOrNull()?.takeIf { it > 0.0 }
  val parsedMonthlyEntered = monthlyText.toDoubleOrNull()?.takeIf { it > 0.0 }

  val rate = currentRateToBase ?: BigDecimal.ONE

  val dailyInHome: Double? = parsedDailyEntered?.let {
    if (selectedBudgetCurrency == homeCurrency) it else it * rate.toDouble()
  }

  val monthlyInHome: Double? = parsedMonthlyEntered?.let {
    if (selectedBudgetCurrency == homeCurrency) it else it * rate.toDouble()
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("spending_caps_dialog")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp)
        .verticalScroll(rememberScrollState()),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "Set Budget & Allowances",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "Values converted to base currency (${homeCurrency.code})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        IconButton(onClick = onDismiss) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }

      Text(
        text = "Enter spending allowances in your chosen currency. Values set in other currencies are automatically converted and saved in your base currency (${homeCurrency.code}).",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      ExposedDropdownMenuBox(
        expanded = currencyDropdownExpanded,
        onExpandedChange = { currencyDropdownExpanded = it }
      ) {
        OutlinedTextField(
          value = "${selectedBudgetCurrency.flagEmoji} ${selectedBudgetCurrency.code} - ${selectedBudgetCurrency.name}${if (selectedBudgetCurrency == destCurrency) " (Local Default)" else ""}",
          onValueChange = {},
          readOnly = true,
          label = { Text("Budget Currency") },
          trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = currencyDropdownExpanded) },
          shape = RoundedCornerShape(12.dp),
          modifier = Modifier
            .fillMaxWidth()
            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
            .testTag("budget_currency_selector")
        )
        ExposedDropdownMenu(
          expanded = currencyDropdownExpanded,
          onDismissRequest = { currencyDropdownExpanded = false }
        ) {
          DropdownMenuItem(
            text = {
              Text(
                text = "${destCurrency.flagEmoji} ${destCurrency.code} - Local Currency (Default)",
                fontWeight = FontWeight.Bold
              )
            },
            onClick = {
              selectedBudgetCurrency = destCurrency
              currencyDropdownExpanded = false
            },
            modifier = Modifier.testTag("budget_currency_option_${destCurrency.code}")
          )

          if (homeCurrency.code != destCurrency.code) {
            DropdownMenuItem(
              text = {
                Text(text = "${homeCurrency.flagEmoji} ${homeCurrency.code} - Home Currency")
              },
              onClick = {
                selectedBudgetCurrency = homeCurrency
                currencyDropdownExpanded = false
              },
              modifier = Modifier.testTag("budget_currency_option_${homeCurrency.code}")
            )
          }

          Currency.DEFAULT_CURRENCIES
            .filter { it.code != destCurrency.code && it.code != homeCurrency.code }
            .forEach { curr ->
              DropdownMenuItem(
                text = { Text("${curr.flagEmoji} ${curr.code} - ${curr.name}") },
                onClick = {
                  selectedBudgetCurrency = curr
                  currencyDropdownExpanded = false
                },
                modifier = Modifier.testTag("budget_currency_option_${curr.code}")
              )
            }
        }
      }

      OutlinedTextField(
        value = dailyText,
        onValueChange = { dailyText = it.filter { ch -> ch.isDigit() || ch == '.' } },
        label = { Text("Daily Safe-to-Spend Cap (${selectedBudgetCurrency.symbol})") },
        placeholder = { Text("e.g. 5000") },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
          .fillMaxWidth()
          .testTag("dialog_daily_cap_input")
      )

      if (selectedBudgetCurrency != homeCurrency && dailyInHome != null) {
        Surface(
          shape = RoundedCornerShape(8.dp),
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "≈ ${homeCurrency.symbol}${String.format(Locale.US, "%.2f", dailyInHome)} ${homeCurrency.code} (Base equivalent)",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onPrimaryContainer
            )
          }
        }
      }

      OutlinedTextField(
        value = monthlyText,
        onValueChange = { monthlyText = it.filter { ch -> ch.isDigit() || ch == '.' } },
        label = { Text("Monthly Budget Cap (${selectedBudgetCurrency.symbol})") },
        placeholder = { Text("e.g. 150000") },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
          .fillMaxWidth()
          .testTag("dialog_monthly_cap_input")
      )

      if (selectedBudgetCurrency != homeCurrency && monthlyInHome != null) {
        Surface(
          shape = RoundedCornerShape(8.dp),
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "≈ ${homeCurrency.symbol}${String.format(Locale.US, "%.2f", monthlyInHome)} ${homeCurrency.code} (Base equivalent)",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onPrimaryContainer
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        TextButton(
          onClick = { onSave(null, null) },
          modifier = Modifier.testTag("dialog_clear_caps_button")
        ) {
          Text("Clear", color = MaterialTheme.colorScheme.error)
        }

        Spacer(modifier = Modifier.weight(1f))

        OutlinedButton(
          onClick = onDismiss,
          shape = RoundedCornerShape(12.dp)
        ) {
          Text("Cancel")
        }

        Button(
          onClick = {
            onSave(dailyInHome, monthlyInHome)
          },
          shape = RoundedCornerShape(12.dp),
          modifier = Modifier.testTag("dialog_save_caps_button")
        ) {
          Text("Save Caps")
        }
      }
    }
  }
}
