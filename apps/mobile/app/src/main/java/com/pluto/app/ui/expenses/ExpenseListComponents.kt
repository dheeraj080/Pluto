package com.pluto.app.ui.expenses

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.ui.components.DualCurrencyAmountView
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Group of transactions belonging to a single calendar day.
 */
data class DayExpenseGroup(
  val dateKey: String,
  val dayTitle: String,
  val totalDest: Money,
  val totalHome: Money,
  val expenses: List<Expense>
)

/**
 * Group expenses by calendar day into structured [DayExpenseGroup]s.
 */
internal fun groupExpensesByDay(
  expenses: List<Expense>,
  destCurrency: Currency,
  homeCurrency: Currency,
  exchangeRate: BigDecimal?,
  homeAmountById: Map<String, Money> = emptyMap(),
  destinationAmountById: Map<String, Money> = emptyMap()
): List<DayExpenseGroup> {
  if (expenses.isEmpty()) return emptyList()

  val cal = Calendar.getInstance()
  val todayYear = cal.get(Calendar.YEAR)
  val todayDay = cal.get(Calendar.DAY_OF_YEAR)

  cal.add(Calendar.DAY_OF_YEAR, -1)
  val yesterdayYear = cal.get(Calendar.YEAR)
  val yesterdayDay = cal.get(Calendar.DAY_OF_YEAR)

  val keyFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
  val fullDateFormat = SimpleDateFormat("EEE · d MMM yyyy", Locale.US)
  val shortDateFormat = SimpleDateFormat("d MMM yyyy", Locale.US)

  return expenses
    .groupBy { keyFormat.format(Date(it.timestamp)) }
    .map { (dateKey, dayExpenses) ->
      val firstExp = dayExpenses.first()
      val expCal = Calendar.getInstance().apply { timeInMillis = firstExp.timestamp }
      val expYear = expCal.get(Calendar.YEAR)
      val expDay = expCal.get(Calendar.DAY_OF_YEAR)

      val dayTitle = when {
        expYear == todayYear && expDay == todayDay -> "Today · ${shortDateFormat.format(Date(firstExp.timestamp))}"
        expYear == yesterdayYear && expDay == yesterdayDay -> "Yesterday · ${shortDateFormat.format(Date(firstExp.timestamp))}"
        else -> fullDateFormat.format(Date(firstExp.timestamp))
      }

      var totalHome = Money.zero(homeCurrency)
      var totalDest = Money.zero(destCurrency)

      dayExpenses.forEach { exp ->
        val homeForTotals = homeAmountById[exp.id] ?: exp.homeAmount.takeIf { it.currency == homeCurrency }
        if (homeForTotals != null) {
          totalHome += homeForTotals
        }

        val destForTotals = destinationAmountById[exp.id] ?: when {
          exchangeRate != null && exchangeRate > BigDecimal.ZERO && homeForTotals != null ->
            Money.of(homeForTotals.amount.multiply(exchangeRate), destCurrency)
          destCurrency == homeCurrency -> homeForTotals
          exp.originalCurrency == destCurrency -> exp.originalAmount
          else -> null
        }
        if (destForTotals != null) {
          totalDest += destForTotals
        }
      }

      DayExpenseGroup(
        dateKey = dateKey,
        dayTitle = dayTitle,
        totalDest = totalDest,
        totalHome = totalHome,
        expenses = dayExpenses
      )
    }
}

/**
 * Sticky header marking the beginning of a calendar day's transactions.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun DayGroupHeader(
  dayTitle: String,
  totalDest: Money,
  totalHome: Money,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.background.copy(alpha = 0.96f)
  ) {
    FlowRow(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 4.dp, vertical = 6.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
      Text(
        text = dayTitle,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onBackground
      )

      Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
          text = totalDest.formatWithCode(),
          style = MaterialTheme.typography.labelMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurface
        )
        if (totalDest.currency != totalHome.currency) {
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = totalHome.formatWithCode(),
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Medium
          )
        }
      }
    }
  }
}

/**
 * Continuous transaction row item with 0dp vertical gaps inside the daily card.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TransactionRowItem(
  expense: Expense,
  destinationCurrency: Currency,
  destinationExchangeRate: BigDecimal?,
  homeCurrency: Currency,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  isSelected: Boolean = false
) {
  val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

  val primaryAmountStr = expense.originalAmount.formatWithCode()
  val secondaryAmountStr = expense.homeAmount.formatWithCode()

  Row(
    modifier = modifier
      .fillMaxWidth()
      .background(
        if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.28f)
        else MaterialTheme.colorScheme.surface.copy(alpha = 0f)
      )
      .minimumInteractiveComponentSize()
      .clickable(role = Role.Button, onClick = onClick)
      .padding(horizontal = 16.dp, vertical = 12.dp)
      .testTag("expense_item_${expense.id}"),
    verticalAlignment = Alignment.CenterVertically
  ) {
    // Category Initial Icon Box
    Surface(
      shape = CircleShape,
      color = MaterialTheme.colorScheme.primaryContainer,
      modifier = Modifier.size(40.dp)
    ) {
      Box(contentAlignment = Alignment.Center) {
        Text(
          text = expense.category.name.take(1).uppercase(),
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onPrimaryContainer
        )
      }
    }

    Spacer(modifier = Modifier.width(12.dp))

    // Description & Category / Time
    Column(
      modifier = Modifier
        .weight(1f)
        .padding(end = PlutoSpacing.sm)
    ) {
      Text(
        text = if (expense.merchant.isNotBlank()) expense.merchant else expense.category.name,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis
      )
      Spacer(modifier = Modifier.height(2.dp))
      FlowRow(
        verticalArrangement = Arrangement.spacedBy(2.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
      ) {
        Text(
          text = timeFormat.format(Date(expense.timestamp)),
          style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        Text(
          text = "· ${expense.category.name}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        if (expense.isRecurring) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.Repeat,
              contentDescription = "Recurring",
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(12.dp)
            )
            Spacer(modifier = Modifier.width(2.dp))
            Text(
              text = expense.recurrenceFrequency?.label ?: "Recurring",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.primary,
              fontWeight = FontWeight.SemiBold
            )
          }
        }
      }
    }

    // Amounts
    DualCurrencyAmountView(
      primaryAmount = primaryAmountStr,
      secondaryAmount = secondaryAmountStr,
      primaryStyle = MaterialTheme.typography.bodyLarge,
      secondaryStyle = MaterialTheme.typography.bodySmall,
      secondaryColor = MaterialTheme.colorScheme.primary,
      secondaryFontWeight = FontWeight.Medium,
      horizontalAlignment = Alignment.End
    )
  }
}

/**
 * Backwards-compatible alias for existing callers.
 */
@Composable
fun ExpenseListItem(
  expense: Expense,
  destinationCurrency: Currency = expense.originalCurrency,
  destinationExchangeRate: BigDecimal? = null,
  homeCurrency: Currency = expense.homeCurrency,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  TransactionRowItem(
    expense = expense,
    destinationCurrency = destinationCurrency,
    destinationExchangeRate = destinationExchangeRate,
    homeCurrency = homeCurrency,
    onClick = onClick,
    modifier = modifier
  )
}

@Composable
internal fun FilteredSpendingSummaryCard(
  state: ExpenseListUiState.Success,
  modifier: Modifier = Modifier
) {
  val hasDestinationTotal = state.totalDestSpending != null
  val primaryMoney = state.totalDestSpending ?: state.totalHomeSpending
  val primaryTotal = primaryMoney.formatWithCode()
  val secondaryTotal = if (hasDestinationTotal) state.totalHomeSpending.formatWithCode() else null

  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.large,
    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(PlutoSpacing.lg),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(
        modifier = Modifier
          .weight(1f)
          .padding(end = PlutoSpacing.sm)
      ) {
        Text(
          text = "PERIOD TOTAL SPENDING",
          style = MaterialTheme.typography.labelSmall,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.primary,
          letterSpacing = 0.5.sp
        )
        Spacer(modifier = Modifier.height(PlutoSpacing.xxs))
        Text(
          text = primaryTotal,
          style = MaterialTheme.typography.headlineSmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.ExtraBold,
          color = MaterialTheme.colorScheme.onSurface
        )
        if (secondaryTotal != null) {
          Text(
            text = secondaryTotal,
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Medium
          )
        }
        if (state.hasUnconvertedAmounts) {
          Text(
            text = "Some older currencies could not be converted with current rates; totals may be incomplete.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.error
          )
        }
      }

      Surface(
        shape = PlutoShapes.medium,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
      ) {
        Text(
          text = "${state.filteredExpenses.size} items",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.SemiBold,
          modifier = Modifier.padding(horizontal = PlutoSpacing.sm, vertical = PlutoSpacing.xs),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}
