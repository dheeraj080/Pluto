package com.pluto.app.ui.budgets

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Lightbulb
import androidx.compose.material.icons.rounded.Savings
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.DualCurrencyAmountView
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.home.CategoryBudgetsDialog
import com.pluto.app.ui.home.DashboardUiState
import com.pluto.app.ui.home.DashboardViewModel
import com.pluto.app.ui.home.SpendingCapsDialog
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.parseCategoryColor
import com.pluto.app.ui.theme.plutoHeading
import java.math.BigDecimal
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetsScreen(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel,
  onNavigateToProfile: () -> Unit,
  onUpdateSpendingCaps: (BigDecimal?, BigDecimal?) -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destinationCurrency = userSettings.destinationCurrency
  val uiState by dashboardViewModel.uiState.collectAsStateWithLifecycle()

  var showCapsDialog by remember { mutableStateOf(false) }
  var showCategoryBudgetsDialog by remember { mutableStateOf(false) }

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

  Scaffold(
    modifier = modifier
      .fillMaxSize()
      .testTag("budgets_screen"),
    topBar = {
      TopAppBar(
        title = {
          Column {
            Text(
              text = "Travel Budgeting",
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
              text = "Budgets & Limits",
              style = MaterialTheme.typography.titleLarge,
              fontWeight = FontWeight.Bold,
              modifier = Modifier.plutoHeading()
            )
          }
        },
        actions = {
          IconButton(
            onClick = onNavigateToProfile,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("budgets_profile_button")
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
    when (val state = uiState) {
      is DashboardUiState.Loading -> {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding),
          contentAlignment = Alignment.Center
        ) {
          CircularProgressIndicator(modifier = Modifier.testTag("budgets_loading"))
        }
      }

      is DashboardUiState.Content -> {
        BudgetsContent(
          summary = state.summary,
          userSettings = userSettings,
          onOpenCapsDialog = { showCapsDialog = true },
          onOpenCategoryDialog = { showCategoryBudgetsDialog = true },
          modifier = Modifier.padding(innerPadding)
        )
      }

      is DashboardUiState.Empty -> {
        BudgetsContent(
          summary = state.summary,
          userSettings = userSettings,
          onOpenCapsDialog = { showCapsDialog = true },
          onOpenCategoryDialog = { showCategoryBudgetsDialog = true },
          modifier = Modifier.padding(innerPadding)
        )
      }

      is DashboardUiState.Error -> {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding),
          contentAlignment = Alignment.Center
        ) {
          com.pluto.app.ui.components.EmptyState(
            icon = androidx.compose.material.icons.Icons.Rounded.Warning,
            title = "Couldn't load budgets",
            description = state.message,
            actionText = "Retry",
            onActionClick = dashboardViewModel::retry,
            actionTestTag = "budgets_retry_button"
          )
        }
      }
    }
  }
}

@Composable
private fun BudgetsContent(
  summary: DashboardSummary,
  userSettings: UserSettings,
  onOpenCapsDialog: () -> Unit,
  onOpenCategoryDialog: () -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency
  val hasTripBudget = (summary.monthlySpendingCap != null && summary.monthlySpendingCap > BigDecimal.ZERO)
  val hasDailyCap = (summary.dailySpendingCap != null && summary.dailySpendingCap > BigDecimal.ZERO)

  val totalSpentPrimary = summary.totalDestSpending?.format() ?: summary.totalHomeSpending.format()
  val totalSpentSecondary = if (summary.totalDestSpending != null) summary.totalHomeSpending.format() else null

  val safeToSpendPrimary = if (summary.safeToSpendTodayDest != null) {
    if (summary.safeToSpendTodayDest.amount < BigDecimal.ZERO) {
      "-${destCurrency.symbol}${summary.safeToSpendTodayDest.amount.abs().toPlainString()}"
    } else {
      summary.safeToSpendTodayDest.format()
    }
  } else {
    summary.safeToSpendTodayHome.format()
  }
  val safeToSpendSecondary = if (summary.safeToSpendTodayDest != null) summary.safeToSpendTodayHome.format() else null

  Box(
    modifier = modifier.fillMaxSize(),
    contentAlignment = Alignment.TopCenter
  ) {
    val categoryBreakdowns = summary.categoryBreakdowns
    val configuredBudgets = remember(categoryBreakdowns) {
      categoryBreakdowns.filter { it.budgetHome != null && it.budgetHome.amount > BigDecimal.ZERO }
    }

    LazyColumn(
      modifier = Modifier
        .widthIn(max = 840.dp)
        .fillMaxSize(),
      contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp)
    ) {
      item(key = "overall_budget_card") {
    // 1. Overall Trip / Monthly Budget Card
    PlutoCard(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.extraLarge,
      testTag = "card_overall_budget"
    ) {
      Column(modifier = Modifier.padding(20.dp)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
              shape = CircleShape,
              color = MaterialTheme.colorScheme.primaryContainer,
              modifier = Modifier.size(40.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.Savings,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.onPrimaryContainer,
                  modifier = Modifier.size(22.dp)
                )
              }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
              Text(
                text = "Overall Trip Budget",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
              )
              Text(
                text = "Monthly / Full Period Allowance",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
          IconButton(
            onClick = onOpenCapsDialog,
            modifier = Modifier.testTag("btn_edit_overall_budget")
          ) {
            Icon(
              imageVector = Icons.Rounded.Edit,
              contentDescription = "Edit Overall Budget",
              tint = MaterialTheme.colorScheme.primary
            )
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (hasTripBudget) {
          val progress = summary.monthlyCapProgress?.coerceIn(0f, 1f) ?: 0f
          val isOver = summary.monthlyCapProgress != null && summary.monthlyCapProgress >= 1f
          val progressColor = when {
            isOver -> MaterialTheme.colorScheme.error
            progress >= 0.8f -> MaterialTheme.colorScheme.tertiary
            else -> MaterialTheme.colorScheme.primary
          }

          // Spent vs Total
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
          ) {
            Column {
              Text(
                text = "Spent",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              DualCurrencyAmountView(
                primaryAmount = totalSpentPrimary,
                secondaryAmount = totalSpentSecondary,
                primaryStyle = MaterialTheme.typography.titleLarge,
                primaryColor = if (isOver) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                primaryFontWeight = FontWeight.ExtraBold,
                secondaryStyle = MaterialTheme.typography.bodySmall,
                secondaryFontWeight = FontWeight.Normal,
                horizontalAlignment = Alignment.Start
              )
            }

            Column(horizontalAlignment = Alignment.End) {
              Text(
                text = "Target Cap",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              val capMoney = Money.of(summary.monthlySpendingCap ?: BigDecimal.ZERO, homeCurrency)
              Text(
                text = capMoney.format(),
                style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
                fontWeight = FontWeight.SemiBold
              )
            }
          }

          Spacer(modifier = Modifier.height(14.dp))

          // Progress Bar
          LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
              .fillMaxWidth()
              .height(10.dp)
              .clip(PlutoShapes.small)
              .testTag("overall_budget_progress"),
            color = progressColor,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
            strokeCap = StrokeCap.Round
          )

          Spacer(modifier = Modifier.height(10.dp))

          // Progress & Status pill
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "${(progress * 100).toInt()}% utilized",
              style = MaterialTheme.typography.labelMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = progressColor
            )

            Surface(
              shape = PlutoShapes.medium,
              color = if (isOver) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer,
              modifier = Modifier.padding(vertical = 2.dp)
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = if (isOver) Icons.Rounded.Warning else Icons.Rounded.CheckCircle,
                  contentDescription = null,
                  tint = if (isOver) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSecondaryContainer,
                  modifier = Modifier.size(14.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                  text = if (isOver) "Cap Exceeded" else "On Track",
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.Bold,
                  color = if (isOver) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSecondaryContainer
                )
              }
            }
          }
        } else {
          // Empty State for overall budget
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(
              modifier = Modifier.padding(16.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Text(
                text = "No overall spending cap configured",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              Spacer(modifier = Modifier.height(PlutoSpacing.sm))
              PlutoButton(
                text = "Set Trip Budget",
                onClick = onOpenCapsDialog,
                leadingIcon = Icons.Rounded.Add,
                testTag = "btn_set_trip_budget"
              )
            }
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(PlutoSpacing.lg))
      }

      item(key = "daily_pace_card") {
    // 2. Daily Safe-to-Spend & Pace Card
    PlutoCard(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.extraLarge,
      testTag = "card_daily_pace"
    ) {
      Column(modifier = Modifier.padding(18.dp)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
              shape = CircleShape,
              color = MaterialTheme.colorScheme.secondaryContainer,
              modifier = Modifier.size(36.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.Speed,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.onSecondaryContainer,
                  modifier = Modifier.size(20.dp)
                )
              }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
              Text(
                text = "Daily Safe-to-Spend",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
              )
              Text(
                text = "Pacing allowance to avoid overspending",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
          IconButton(onClick = onOpenCapsDialog) {
            Icon(
              imageVector = Icons.Rounded.Edit,
              contentDescription = "Edit Daily Cap",
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = "Safe Allowance (Today)",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
              text = safeToSpendPrimary,
              style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = if (summary.isWarningActive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
            )
            if (safeToSpendSecondary != null) {
              Text(
                text = safeToSpendSecondary,
                style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }

          Column(horizontalAlignment = Alignment.End) {
            Text(
              text = "Daily Target",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (hasDailyCap) {
              val dailyCapMoney = Money.of(summary.dailySpendingCap ?: BigDecimal.ZERO, homeCurrency)
              Text(
                text = dailyCapMoney.format(),
                style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
                fontWeight = FontWeight.SemiBold
              )
            } else {
              Text(
                text = "Unconstrained",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(20.dp))
      }

      item(key = "category_limits_header") {
    // 3. Category Budgets Header
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column {
        Text(
          text = "Category Limits",
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold,
          modifier = Modifier.plutoHeading()
        )
        Text(
          text = "Manage envelopes per category",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
      PlutoButton(
        text = "Manage Caps",
        onClick = onOpenCategoryDialog,
        variant = PlutoButtonVariant.OUTLINED,
        leadingIcon = Icons.Rounded.Edit,
        testTag = "btn_manage_category_budgets"
      )
    }

    Spacer(modifier = Modifier.height(12.dp))
      }

    if (configuredBudgets.isNotEmpty()) {
      items(configuredBudgets, key = { it.category.id }) { item ->
        CategoryBudgetRow(item = item, homeCurrency = homeCurrency)
        Spacer(modifier = Modifier.height(10.dp))
      }
    } else {
      item(key = "category_limits_empty") {
      // Prompt user to configure category budgets
      Surface(
        shape = PlutoShapes.large,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(
          modifier = Modifier.padding(20.dp),
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          Icon(
            imageVector = Icons.Rounded.Savings,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(36.dp)
          )
          Spacer(modifier = Modifier.height(8.dp))
          Text(
            text = "No category budgets set",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
          )
          Text(
            text = "Set individual limits for Food, Transport, Accommodation, Entertainment, and more to stay within your trip budget.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 4.dp),
            lineHeight = 18.sp
          )
          Spacer(modifier = Modifier.height(PlutoSpacing.md))
          PlutoButton(
            text = "Set Category Limits",
            onClick = onOpenCategoryDialog,
            testTag = "btn_setup_category_budgets"
          )
        }
      }
      }
    }

      item(key = "budget_smart_tip_card") {
    Spacer(modifier = Modifier.height(PlutoSpacing.xl))

    // 4. Helpful Budgeting Tips / Advisory
    PlutoCard(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.large,
      containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.35f)
    ) {
      Row(
        modifier = Modifier.padding(16.dp),
        verticalAlignment = Alignment.Top
      ) {
        Icon(
          imageVector = Icons.Rounded.Lightbulb,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.tertiary,
          modifier = Modifier
            .size(24.dp)
            .padding(top = 2.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
          Text(
            text = "Travel Smart Tip",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onTertiaryContainer
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = "All category and trip budgets are automatically converted to your home currency (${homeCurrency.code}) for consistent ledger accuracy, while accepting inputs in local currency (${destCurrency.code}).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onTertiaryContainer,
            lineHeight = 18.sp
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(24.dp))
      }
    }
  }
}

@Composable
private fun CategoryBudgetRow(
  item: CategorySpendingSummary,
  homeCurrency: com.pluto.app.domain.model.Currency,
  modifier: Modifier = Modifier
) {
  val progress = item.budgetProgress?.coerceIn(0f, 1f) ?: 0f
  val isOver = item.isOverBudget
  val progressColor = when {
    isOver -> MaterialTheme.colorScheme.error
    progress >= 0.8f -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.primary
  }

  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.large
  ) {
    Column(modifier = Modifier.padding(16.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Surface(
            shape = CircleShape,
            color = parseCategoryColor(item.category.colorHex).copy(alpha = 0.15f),
            modifier = Modifier.size(36.dp)
          ) {
            Box(contentAlignment = Alignment.Center) {
              Text(
                text = item.category.name.take(1).uppercase(Locale.US),
                fontWeight = FontWeight.Bold,
                color = parseCategoryColor(item.category.colorHex)
              )
            }
          }
          Spacer(modifier = Modifier.width(10.dp))
          Column {
            Text(
              text = item.category.name,
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.SemiBold
            )
            Text(
              text = "${item.transactionCount} transactions",
              style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        DualCurrencyAmountView(
          primaryAmount = item.totalHomeAmount.format(),
          secondaryAmount = item.budgetHome?.let { "of ${it.format()}" },
          primaryStyle = MaterialTheme.typography.titleMedium,
          primaryColor = if (isOver) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
          secondaryStyle = MaterialTheme.typography.bodySmall,
          secondaryFontWeight = FontWeight.Normal,
          horizontalAlignment = Alignment.End
        )
      }

      Spacer(modifier = Modifier.height(10.dp))

      LinearProgressIndicator(
        progress = { progress },
        modifier = Modifier
          .fillMaxWidth()
          .height(8.dp)
          .clip(PlutoShapes.extraSmall),
        color = progressColor,
        trackColor = MaterialTheme.colorScheme.surfaceVariant,
        strokeCap = StrokeCap.Round
      )

      Spacer(modifier = Modifier.height(6.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        val pct = (progress * 100).toInt()
        Text(
          text = if (isOver) "Exceeded by ${(pct - 100)}%" else "$pct% of limit spent",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = progressColor,
          fontWeight = FontWeight.SemiBold
        )

        item.budgetHome?.let { budget ->
          val remaining = (budget.amount - item.totalHomeAmount.amount).coerceAtLeast(BigDecimal.ZERO)
          val remainingMoney = Money(remaining, homeCurrency)
          Text(
            text = if (isOver) "0 remaining" else "${remainingMoney.format()} left",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }
    }
  }
}
