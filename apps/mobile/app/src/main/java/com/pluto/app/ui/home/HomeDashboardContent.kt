package com.pluto.app.ui.home

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Paid
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.PortfolioValuationSummary
import com.pluto.app.domain.model.UnifiedTransactionItem
import com.pluto.app.domain.model.UnifiedTransactionType
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.DualCurrencyAmountView
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.SectionHeader
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
internal fun HomeDashboardContent(
  summary: DashboardSummary,
  userSettings: UserSettings,
  onOpenCapsDialog: () -> Unit,
  onOpenCategoryBudgetsDialog: () -> Unit,
  onOpenTermDialog: () -> Unit = {},
  onOpenTimeZonePicker: () -> Unit = {},
  onOpenCustomizeSheet: () -> Unit = {},
  onUpdateWarningThreshold: (BigDecimal?, Boolean) -> Unit = { _, _ -> },
  onTestNotification: () -> Boolean = { false },
  onAddExpenseClick: () -> Unit,
  onExpenseClick: (Expense) -> Unit,
  portfolioValuation: PortfolioValuationSummary? = null,
  wallets: List<CurrencyWallet> = emptyList(),
  fxStatus: DashboardFxStatus? = null,
  isEmptyState: Boolean = false,
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
        .padding(horizontal = PlutoSpacing.xl, vertical = PlutoSpacing.sm)
        .animateContentSize(),
      verticalArrangement = Arrangement.spacedBy(PlutoSpacing.lg)
    ) {
      // 1. Stacked Dual Wallet Hero Cards with inline Dual-Zone Clock (primary focal point)
      StackedCardsHero(
        portfolioValuation = portfolioValuation,
        userSettings = userSettings,
        wallets = wallets,
        fxStatus = fxStatus,
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

      if (isEmptyState) {
        PlutoCard(
          shape = PlutoShapes.extraLarge,
          containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("home_empty_welcome_banner")
        ) {
          Column(
            modifier = Modifier
              .fillMaxWidth()
              .padding(PlutoSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(PlutoSpacing.sm)
          ) {
            Text(
              text = "Start tracking your finances",
              style = MaterialTheme.typography.titleSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onSurface
            )
            Text(
              text = "Log your first expense in ${userSettings.destinationCurrency.code} or fund a primary wallet above to unlock daily pace and cash flow tracking.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }

      // 3. Customizable Modular Feed
      activeModules.forEach { module ->
        when (module.id) {
          HomeModuleId.STACKED_WALLETS -> {
            PortfolioOverviewModuleCard(
              portfolioValuation = portfolioValuation,
              wallets = wallets,
              userSettings = userSettings,
              fxStatus = fxStatus,
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

      if (summary.unconvertibleHomeCurrencies.isNotEmpty()) {
        Text(
          text = "Some totals exclude ${summary.unconvertibleHomeCurrencies.joinToString(", ") { it.code }} reference snapshots (rate unavailable).",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.error,
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp)
            .testTag("dashboard_unconvertible_home_currencies_warning")
        )
      }

      // 4. Customize Home Trigger
      Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
      ) {
        PlutoButton(
          text = "Customize Home",
          onClick = onOpenCustomizeSheet,
          variant = PlutoButtonVariant.OUTLINED,
          leadingIcon = Icons.Rounded.Tune,
          testTag = "customize_home_button"
        )
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
    SectionHeader(
      title = "Recent Activity",
      actionText = "View All",
      onActionClick = onViewAllClick,
      actionTestTag = "manage_expenses_view_all_button"
    )

    Spacer(modifier = Modifier.height(PlutoSpacing.xs))

    val expenseItems = items.filter { it.type == UnifiedTransactionType.EXPENSE }.take(4)
    if (expenseItems.isEmpty()) {
      PlutoCard(
        shape = PlutoShapes.extraLarge,
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(PlutoSpacing.xxl),
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          Text(
            text = "No recorded expenses yet",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          Spacer(modifier = Modifier.height(PlutoSpacing.md))
          PlutoButton(
            text = "Log an Expense",
            onClick = onAddExpenseClick,
            variant = PlutoButtonVariant.OUTLINED
          )
        }
      }
    } else {
      PlutoCard(
        shape = PlutoShapes.extraLarge,
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(modifier = Modifier.padding(vertical = PlutoSpacing.sm)) {
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
                  color = MaterialTheme.colorScheme.onSurface,
                  maxLines = 2,
                  overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                  text = formattedDate,
                  style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis
                )
              }

              DualCurrencyAmountView(
                primaryAmount = item.primaryAmountFormatted,
                secondaryAmount = item.secondaryAmountFormatted,
                primaryStyle = MaterialTheme.typography.bodyLarge,
                primaryFontWeight = FontWeight.Bold,
                secondaryStyle = MaterialTheme.typography.labelSmall,
                secondaryColor = MaterialTheme.colorScheme.primary
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
