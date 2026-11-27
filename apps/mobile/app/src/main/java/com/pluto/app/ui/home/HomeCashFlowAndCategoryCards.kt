package com.pluto.app.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal

/**
 * Cash Flow Summary Bar (+Income | -Expenses | =Net)
 * Dual-Currency: Primary local/destination total, Secondary home snapshot total.
 */
@Composable
fun CashFlowSummaryBar(
  summary: DashboardSummary,
  modifier: Modifier = Modifier
) {
  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 18.dp, vertical = PlutoSpacing.lg)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm),
        verticalAlignment = Alignment.Top
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "INCOME",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          val hasIncomeDest = summary.totalIncomeDest != null
          val incomePrimary = if (hasIncomeDest) {
            "+LOCAL · ${summary.totalIncomeDest!!.formatWithCode()}"
          } else {
            "+HOME · ${summary.totalIncomeHome.formatWithCode()}"
          }
          Text(
            text = incomePrimary,
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.secondary
          )
          if (hasIncomeDest) {
            Text(
              text = "+HOME · ${summary.totalIncomeHome.formatWithCode()}",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "EXPENSES",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          val expensePrimary = "-${if (summary.totalDestSpending != null) "LOCAL · " else "HOME · "}${
            (summary.totalDestSpending ?: summary.totalHomeSpending).formatWithCode()
          }"
          val expenseSecondary = if (summary.totalDestSpending != null) {
            "-HOME · ${summary.totalHomeSpending.formatWithCode()}"
          } else null
          Text(
            text = expensePrimary,
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.error
          )
          expenseSecondary?.let { secondary ->
            Text(
              text = secondary,
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        Column(
          modifier = Modifier.weight(1f),
          horizontalAlignment = Alignment.End
        ) {
          Text(
            text = "NET FLOW",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          val isNetPositive = summary.netCashFlowHome.amount >= BigDecimal.ZERO
          val signPrefix = if (isNetPositive) "+" else ""
          val netPrimary = signPrefix + (if (summary.netCashFlowDest != null) "LOCAL · " else "HOME · ") +
            (summary.netCashFlowDest ?: summary.netCashFlowHome).formatWithCode()
          val netSecondary = if (summary.netCashFlowDest != null) {
            "${signPrefix}HOME · ${summary.netCashFlowHome.formatWithCode()}"
          } else null
          Text(
            text = netPrimary,
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = if (isNetPositive) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
          )
          netSecondary?.let { secondary ->
            Text(
              text = secondary,
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }

      if (summary.unvaluedIncomeCurrencies.isNotEmpty()) {
        Spacer(modifier = Modifier.height(10.dp))
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier
            .fillMaxWidth()
            .testTag("cash_flow_unvalued_income_notice")
        ) {
          Icon(
            imageVector = Icons.Rounded.Warning,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.tertiary,
            modifier = Modifier.size(14.dp)
          )
          Spacer(modifier = Modifier.width(6.dp))
          Text(
            text = "Excludes ${summary.unvaluedIncomeCurrencies.joinToString(", ") { it.code }} deposits (rate unavailable)",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
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
  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge
  ) {
    Column(modifier = Modifier.padding(18.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "CATEGORY BUDGETS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
          Text(
            text = "${categories.size} categories active",
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
          PlutoButton(
            text = "Set Budgets",
            onClick = onManageBudgetsClick,
            variant = PlutoButtonVariant.GHOST,
            testTag = "manage_category_budgets_button"
          )

          IconButton(
            onClick = onToggle,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("category_budgets_toggle_button")
          ) {
            Icon(
              imageVector = if (isExpanded) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
              contentDescription = if (isExpanded) "Collapse category budgets" else "Expand category budgets"
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
        val hasDestAmount = item.totalDestAmount != null
        val amountLabel = if (hasDestAmount) {
          "LOCAL · ${item.totalDestAmount!!.formatWithCode()}"
        } else {
          "HOME · ${item.totalHomeAmount.formatWithCode()}"
        }
        if (hasBudget) {
          val budgetLabel = item.budgetDest?.formatWithCode() ?: item.budgetHome?.formatWithCode() ?: "—"
          Text(
            text = "$amountLabel / $budgetLabel",
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
            text = amountLabel,
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold
          )
          if (hasDestAmount) {
            Text(
              text = "HOME · ${item.totalHomeAmount.formatWithCode()}",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
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
