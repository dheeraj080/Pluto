package com.pluto.app.ui.insights

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.CurrencyExchange
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.FileDownload
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.TableChart
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.CurrencySpendingSummary
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CategoryBreakdownChart
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.DualCurrencyAmountView
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.PlutoMetricTile
import com.pluto.app.ui.expenses.ExpenseListUiState
import com.pluto.app.ui.expenses.ExpenseViewModel
import com.pluto.app.ui.home.DashboardUiState
import com.pluto.app.ui.home.DashboardViewModel
import com.pluto.app.domain.model.Money
import com.pluto.app.ui.home.SpendingTrendCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.parseCategoryColor
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.util.ExpenseExportService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class ExportFormat(val label: String, val extension: String, val mimeType: String) {
  PDF("PDF Statement (Formatted Document)", ".pdf", "application/pdf"),
  CSV("CSV Spreadsheet (Excel / Accounting)", ".csv", "text/csv"),
  CLIPBOARD("Text Summary (Clipboard)", ".txt", "text/plain")
}

private fun DashboardPeriod.toReportPeriodLabel(nowMillis: Long = System.currentTimeMillis()): String {
  return if (this == DashboardPeriod.THIS_MONTH) {
    SimpleDateFormat("MM-yyyy", Locale.getDefault()).format(Date(nowMillis))
  } else {
    label
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsightsScreen(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel,
  expenseViewModel: ExpenseViewModel,
  onNavigateToProfile: () -> Unit,
  onExpenseClick: (Expense) -> Unit,
  onShowSnackbar: (String) -> Unit = {},
  modifier: Modifier = Modifier
) {
  val uiState by dashboardViewModel.uiState.collectAsStateWithLifecycle()
  val selectedPeriod by dashboardViewModel.selectedPeriod.collectAsStateWithLifecycle()
  val expenseListUiState by expenseViewModel.expenseListState.collectAsStateWithLifecycle()

  Scaffold(
    modifier = modifier
      .fillMaxSize()
      .testTag("insights_screen"),
    topBar = {
      TopAppBar(
        title = {
          Column {
            Text(
              text = "Spending Intelligence",
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
              text = "Reports & Insights",
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
              .testTag("insights_profile_button")
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
          CircularProgressIndicator(modifier = Modifier.testTag("insights_loading"))
        }
      }

      is DashboardUiState.Content -> {
        val allExpenses = (expenseListUiState as? ExpenseListUiState.Success)?.allExpenses ?: emptyList()
        InsightsContent(
          summary = state.summary,
          userSettings = userSettings,
          selectedPeriod = selectedPeriod,
          onPeriodSelected = dashboardViewModel::onPeriodSelected,
          allExpenses = allExpenses,
          onExpenseClick = onExpenseClick,
          onShowSnackbar = onShowSnackbar,
          modifier = Modifier.padding(innerPadding)
        )
      }

      is DashboardUiState.Empty -> {
        val allExpenses = (expenseListUiState as? ExpenseListUiState.Success)?.allExpenses ?: emptyList()
        InsightsContent(
          summary = state.summary,
          userSettings = userSettings,
          selectedPeriod = selectedPeriod,
          onPeriodSelected = dashboardViewModel::onPeriodSelected,
          allExpenses = allExpenses,
          onExpenseClick = onExpenseClick,
          onShowSnackbar = onShowSnackbar,
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
            title = "Couldn't load insights",
            description = state.message,
            actionText = "Retry",
            onActionClick = dashboardViewModel::retry,
            actionTestTag = "insights_retry_button"
          )
        }
      }
    }
  }
}

@Composable
internal fun InsightsContent(
  summary: DashboardSummary,
  userSettings: UserSettings,
  selectedPeriod: DashboardPeriod,
  onPeriodSelected: (DashboardPeriod) -> Unit,
  allExpenses: List<Expense>,
  onExpenseClick: (Expense) -> Unit,
  onShowSnackbar: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  val context = LocalContext.current
  val coroutineScope = rememberCoroutineScope()
  val reportPeriodLabel = remember(selectedPeriod) { selectedPeriod.toReportPeriodLabel() }

  val totalSpentPrimary = "${if (summary.totalDestSpending != null) "PRIMARY · " else "REFERENCE · "}${
    (summary.totalDestSpending ?: summary.totalHomeSpending).format()
  } (${if (summary.totalDestSpending != null) userSettings.destinationCurrency.code else userSettings.homeCurrency.code})"
  val totalSpentSecondary = if (summary.totalDestSpending != null) {
    "REFERENCE · ${summary.totalHomeSpending.format()} (${userSettings.homeCurrency.code})"
  } else null

  val dailyBurnPrimary = "${if (summary.thirtyDayDailyAvgDest != null) "PRIMARY · " else "REFERENCE · "}${
    (summary.thirtyDayDailyAvgDest ?: summary.thirtyDayDailyAvgHome).format()
  } (${if (summary.thirtyDayDailyAvgDest != null) userSettings.destinationCurrency.code else userSettings.homeCurrency.code})"
  val dailyBurnSecondary = if (summary.thirtyDayDailyAvgDest != null) {
    "REFERENCE · ${summary.thirtyDayDailyAvgHome.format()} (${userSettings.homeCurrency.code})"
  } else null

  // Period-filtered expenses for accurate statement export
  val periodExpenses = remember(allExpenses, selectedPeriod) {
    val bounds = selectedPeriod.getBounds()
    allExpenses.filter { it.timestamp in bounds.first..bounds.second }
  }

  var showExportDialog by remember { mutableStateOf(false) }
  var selectedExportFormat by remember { mutableStateOf(ExportFormat.PDF) }
  var isExporting by remember { mutableStateOf(false) }

  // Quick Export Handlers
  fun exportAndShare(format: ExportFormat) {
    if (periodExpenses.isEmpty()) {
      onShowSnackbar("No expenses found for $reportPeriodLabel to export.")
      return
    }

    isExporting = true
    coroutineScope.launch {
      try {
        when (format) {
          ExportFormat.PDF -> {
            val pdfFile = withContext(Dispatchers.IO) {
              ExpenseExportService.generatePdf(
                context = context,
                expenses = periodExpenses,
                categorySummaries = summary.categoryBreakdowns,
                homeCurrency = userSettings.homeCurrency,
                periodTitle = reportPeriodLabel,
                totalHomeSpentStr = summary.totalHomeSpending.formatWithCode()
              )
            }
            ExpenseExportService.shareFile(
              context = context,
              file = pdfFile,
              mimeType = "application/pdf",
              title = "Pluto Expense Report ($reportPeriodLabel)"
            )
            onShowSnackbar("PDF Statement generated and ready to share!")
          }

          ExportFormat.CSV -> {
            val csvContent = withContext(Dispatchers.Default) {
              ExpenseExportService.generateCsv(
                expenses = periodExpenses,
                homeCurrency = userSettings.homeCurrency,
                periodTitle = reportPeriodLabel
              )
            }
            val csvFile = withContext(Dispatchers.IO) {
              ExpenseExportService.saveCsvToCache(
                context = context,
                csvContent = csvContent,
                periodTitle = reportPeriodLabel
              )
            }
            ExpenseExportService.shareFile(
              context = context,
              file = csvFile,
              mimeType = "text/csv",
              title = "Pluto Expenses Export ($reportPeriodLabel)"
            )
            onShowSnackbar("CSV Spreadsheet generated and ready to share!")
          }

          ExportFormat.CLIPBOARD -> {
            val reportText = buildString {
              appendLine("Pluto Financial Report")
              appendLine("Period: $reportPeriodLabel")
              append("Total Spent: $totalSpentPrimary")
              totalSpentSecondary?.let { append(" ($it)") }
              appendLine()
              append("Daily Burn Rate: $dailyBurnPrimary")
              dailyBurnSecondary?.let { append(" ($it)") }
              appendLine()
              appendLine("Categories Breakdown:")
              summary.categoryBreakdowns.forEach { cat ->
                val destText = cat.totalDestAmount?.formatWithCode()
                appendLine("- ${cat.category.name}: ${destText?.let { "$it / " }.orEmpty()}${cat.totalHomeAmount.formatWithCode()} (${cat.percentageOfTotal}%)")
              }
              appendLine("\nGenerated via Pluto Cross-Currency Tracker")
            }
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipboard?.setPrimaryClip(ClipData.newPlainText("Expense Report", reportText))
            onShowSnackbar("Expense report copied to clipboard!")
          }
        }
      } catch (e: Exception) {
        onShowSnackbar("Export failed: ${e.message}")
      } finally {
        isExporting = false
      }
    }
  }

  // Export Format Dialog
  if (showExportDialog) {
    AlertDialog(
      onDismissRequest = { showExportDialog = false },
      title = {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.Description,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
          )
          Spacer(modifier = Modifier.width(8.dp))
          Text("Export Expense Report", fontWeight = FontWeight.Bold)
        }
      },
      text = {
        Column {
          Text(
            text = "Choose format to export ${periodExpenses.size} expenses for $reportPeriodLabel:",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          Spacer(modifier = Modifier.height(14.dp))

          ExportFormat.entries.forEach { format ->
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .clip(PlutoShapes.small)
                .clickable { selectedExportFormat = format }
                .padding(vertical = 6.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              RadioButton(
                selected = selectedExportFormat == format,
                onClick = { selectedExportFormat = format }
              )
              Spacer(modifier = Modifier.width(PlutoSpacing.sm))
              Column {
                Text(
                  text = format.label,
                  style = MaterialTheme.typography.bodyMedium,
                  fontWeight = if (selectedExportFormat == format) FontWeight.Bold else FontWeight.Normal
                )
              }
            }
          }
        }
      },
      confirmButton = {
        PlutoButton(
          text = "Export & Share",
          onClick = {
            showExportDialog = false
            exportAndShare(selectedExportFormat)
          },
          testTag = "dialog_confirm_export_button"
        )
      },
      dismissButton = {
        PlutoButton(
          text = "Cancel",
          onClick = { showExportDialog = false },
          variant = PlutoButtonVariant.GHOST
        )
      }
    )
  }

  Box(
    modifier = modifier.fillMaxSize(),
    contentAlignment = Alignment.TopCenter
  ) {
    Column(
      modifier = Modifier
        .widthIn(max = 840.dp)
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 96.dp)
    ) {
    // 1. Period Selector Filter Chips
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .horizontalScroll(rememberScrollState())
        .testTag("insights_period_selector"),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      DashboardPeriod.entries.forEach { period ->
        val isSelected = selectedPeriod == period
        FilterChip(
          selected = isSelected,
          onClick = { onPeriodSelected(period) },
          label = {
            Text(
              text = period.label,
              fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
          },
          colors = FilterChipDefaults.filterChipColors(
            containerColor = MaterialTheme.colorScheme.surface,
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.primary
          ),
          border = FilterChipDefaults.filterChipBorder(
            enabled = true,
            selected = isSelected,
            borderColor = MaterialTheme.colorScheme.outline,
            selectedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
          ),
          modifier = Modifier
            .testTag("insights_period_${period.name.lowercase(Locale.ROOT)}")
            .minimumInteractiveComponentSize()
        )
      }
    }

    Spacer(modifier = Modifier.height(14.dp))

    if (summary.unconvertibleHomeCurrencies.isNotEmpty()) {
      Text(
        text = "Some totals exclude ${summary.unconvertibleHomeCurrencies.joinToString(", ") { it.code }} reference snapshots (rate unavailable).",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier
          .fillMaxWidth()
          .testTag("insights_unconvertible_home_currencies_warning")
      )
      Spacer(modifier = Modifier.height(8.dp))
    }

    // 2. Chapter 1: Spend Pulse Bento (Full-width Total Spend Banner + 2-tile Velocity Split)
    val txCount = periodExpenses.size
    val avgPerExpenseHome = remember(periodExpenses, summary.totalHomeSpending, userSettings.homeCurrency) {
      if (periodExpenses.isNotEmpty()) {
        val avg = summary.totalHomeSpending.amount.divide(
          BigDecimal(periodExpenses.size),
          2,
          java.math.RoundingMode.HALF_UP
        )
        Money.of(avg, userSettings.homeCurrency).formatWithCode()
      } else {
        Money.zero(userSettings.homeCurrency).formatWithCode()
      }
    }

    PlutoCard(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.extraLarge,
      containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
      testTag = "insights_total_spent_card"
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
              color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f),
              modifier = Modifier.size(30.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.AutoMirrored.Rounded.ReceiptLong,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(16.dp)
                )
              }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = "Total Spent · $reportPeriodLabel",
              style = MaterialTheme.typography.labelMedium,
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }

          Surface(
            shape = PlutoShapes.small,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
          ) {
            Text(
              text = "$txCount tx",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary,
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
          text = totalSpentPrimary,
          style = MaterialTheme.typography.displaySmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.primary
        )
        if (totalSpentSecondary != null) {
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = totalSpentSecondary,
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(10.dp))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      // Tile A: Daily Burn Rate
      PlutoMetricTile(
        label = "Daily Burn Rate",
        primaryValue = dailyBurnPrimary,
        secondaryValue = dailyBurnSecondary,
        leadingIcon = Icons.Rounded.Speed,
        iconTint = MaterialTheme.colorScheme.secondary,
        shape = PlutoShapes.large,
        testTag = "insights_burn_rate_card",
        modifier = Modifier.weight(1f)
      )

      // Tile B: Avg Per Transaction
      PlutoMetricTile(
        label = "Avg / Expense",
        primaryValue = avgPerExpenseHome,
        secondaryValue = "${summary.categoryBreakdowns.size} active categories",
        leadingIcon = Icons.AutoMirrored.Rounded.TrendingUp,
        iconTint = MaterialTheme.colorScheme.primary,
        shape = PlutoShapes.large,
        testTag = "insights_avg_expense_card",
        modifier = Modifier.weight(1f)
      )
    }

    Spacer(modifier = Modifier.height(16.dp))

    // 3. 30-Day Spending Trend (Bézier Chart)
    SpendingTrendCard(summary = summary)

    Spacer(modifier = Modifier.height(20.dp))

    // 4. Interactive Compose Category Breakdown Chart (Donut + High-Cost Area Alert + Ranked Bars)
    CategoryBreakdownChart(
      categorySummaries = summary.categoryBreakdowns,
      homeCurrency = userSettings.homeCurrency,
      totalHomeSpending = summary.totalHomeSpending
    )

    Spacer(modifier = Modifier.height(20.dp))

    // 5. Multi-Currency Exposure Distribution
    if (summary.currencyBreakdowns.isNotEmpty()) {
      val maxCurrencyHome = summary.currencyBreakdowns.maxOfOrNull { it.totalHomeEquivalent.amount } ?: BigDecimal.ONE
      val totalHomeForShare = summary.totalHomeSpending.amount.takeIf { it > BigDecimal.ZERO } ?: BigDecimal.ONE
      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.extraLarge,
        testTag = "insights_currency_breakdown_card"
      ) {
        Column(modifier = Modifier.padding(18.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.CurrencyExchange,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = "Currency Distribution",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              modifier = Modifier.plutoHeading()
            )
          }

          Spacer(modifier = Modifier.height(14.dp))

          summary.currencyBreakdowns.forEach { curSummary ->
            val ratio = if (maxCurrencyHome > BigDecimal.ZERO) {
              (curSummary.totalHomeEquivalent.amount.toDouble() / maxCurrencyHome.toDouble()).toFloat().coerceIn(0.05f, 1f)
            } else 0f
            val sharePct = ((curSummary.totalHomeEquivalent.amount.toDouble() / totalHomeForShare.toDouble()) * 100.0).toInt().coerceIn(0, 100)
            CurrencyDistributionRow(
              curSummary = curSummary,
              barProgress = ratio,
              sharePercent = sharePct
            )
            Spacer(modifier = Modifier.height(12.dp))
          }
        }
      }

      Spacer(modifier = Modifier.height(20.dp))
    }

    // 6. Top Spending Highlights (ranked by the recorded home snapshot shown on each row)
    val topExpenses = remember(periodExpenses) {
      periodExpenses
        .sortedByDescending { it.homeAmount.amount }
        .take(5)
    }

    if (topExpenses.isNotEmpty()) {
      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.extraLarge,
        testTag = "insights_top_expenses_card"
      ) {
        Column(modifier = Modifier.padding(18.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.TrendingUp,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = "Highest Recorded Expenses ($reportPeriodLabel)",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              modifier = Modifier.plutoHeading()
            )
          }

          Spacer(modifier = Modifier.height(12.dp))

          val dateFormat = remember { SimpleDateFormat("MMM d, yyyy", Locale.US) }

          topExpenses.forEach { exp ->
            val title = if (exp.note.isNotBlank()) exp.note else if (exp.merchant.isNotBlank()) exp.merchant else exp.category.name
            val homeLabel = if (exp.homeCurrency == userSettings.homeCurrency) "REFERENCE · " else "RECORDED REFERENCE · "
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .minimumInteractiveComponentSize()
                .clip(PlutoShapes.medium)
                .clickable { onExpenseClick(exp) }
                .padding(vertical = 8.dp, horizontal = 4.dp),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Surface(
                  shape = CircleShape,
                  color = parseCategoryColor(exp.category.colorHex).copy(alpha = 0.15f),
                  modifier = Modifier.size(36.dp)
                ) {
                  Box(contentAlignment = Alignment.Center) {
                    Text(
                      text = exp.category.name.take(1).uppercase(Locale.US),
                      fontWeight = FontWeight.Bold,
                      color = parseCategoryColor(exp.category.colorHex)
                    )
                  }
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                  Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                  )
                  Text(
                    text = dateFormat.format(Date(exp.timestamp)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                }
              }

              DualCurrencyAmountView(
                primaryAmount = "SPENT · ${exp.originalAmount.formatWithCode()}",
                secondaryAmount = "$homeLabel${exp.homeAmount.formatWithCode()}",
                primaryStyle = MaterialTheme.typography.titleSmall,
                secondaryStyle = MaterialTheme.typography.bodySmall,
                secondaryFontWeight = FontWeight.Normal,
                horizontalAlignment = Alignment.End
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(20.dp))
    }

    // 7. Monthly Expense Report & Accountant Export Card
    PlutoCard(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.extraLarge,
      testTag = "insights_export_summary_card"
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
              modifier = Modifier.size(36.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.FileDownload,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(20.dp)
                )
              }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
              Text(
                text = "Export Expense Reports",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.plutoHeading()
              )
              Text(
                text = "Monthly statement for accountant & taxes",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }

          if (isExporting) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
          }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
          text = "Export ${periodExpenses.size} expenses recorded during $reportPeriodLabel. Share formatted PDF statements with your accountant or export CSV spreadsheets for Excel.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          lineHeight = 18.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Action Buttons Row: PDF & CSV
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
          // Export PDF Button
          PlutoButton(
            text = "PDF Statement",
            onClick = { exportAndShare(ExportFormat.PDF) },
            enabled = !isExporting && periodExpenses.isNotEmpty(),
            leadingIcon = Icons.Rounded.PictureAsPdf,
            modifier = Modifier.weight(1f),
            testTag = "btn_export_pdf"
          )

          // Export CSV Button
          PlutoButton(
            text = "CSV (Excel)",
            onClick = { exportAndShare(ExportFormat.CSV) },
            variant = PlutoButtonVariant.OUTLINED,
            enabled = !isExporting && periodExpenses.isNotEmpty(),
            leadingIcon = Icons.Rounded.TableChart,
            modifier = Modifier.weight(1f),
            testTag = "btn_export_csv"
          )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Secondary Options: Share Dialog & Clipboard
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
          PlutoButton(
            text = "Share Dialog",
            onClick = { showExportDialog = true },
            variant = PlutoButtonVariant.OUTLINED,
            enabled = !isExporting && periodExpenses.isNotEmpty(),
            leadingIcon = Icons.Rounded.Share,
            modifier = Modifier.weight(1f),
            testTag = "btn_share_report"
          )

          PlutoButton(
            text = "Copy Text",
            onClick = { exportAndShare(ExportFormat.CLIPBOARD) },
            variant = PlutoButtonVariant.OUTLINED,
            enabled = !isExporting && periodExpenses.isNotEmpty(),
            leadingIcon = Icons.Rounded.ContentCopy,
            modifier = Modifier.weight(1f),
            testTag = "btn_copy_summary"
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(28.dp))
    }
  }
}

@Composable
private fun CurrencyDistributionRow(
  curSummary: CurrencySpendingSummary,
  barProgress: Float,
  sharePercent: Int,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier.fillMaxWidth()
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(vertical = 2.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Row(
        modifier = Modifier.weight(1f, fill = false),
        verticalAlignment = Alignment.CenterVertically
      ) {
        CurrencyBadge(currency = curSummary.currency)
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = curSummary.currency.name,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
          Text(
            text = "${curSummary.transactionCount} transactions · $sharePercent% share",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }

      DualCurrencyAmountView(
        primaryAmount = curSummary.totalOriginalAmount.formatWithCode(),
        secondaryAmount = "REFERENCE · ${curSummary.totalHomeEquivalent.formatWithCode()}",
        primaryStyle = MaterialTheme.typography.titleSmall,
        secondaryStyle = MaterialTheme.typography.bodySmall,
        secondaryFontWeight = FontWeight.Normal,
        horizontalAlignment = Alignment.End
      )
    }
    Spacer(modifier = Modifier.height(6.dp))
    LinearProgressIndicator(
      progress = { barProgress },
      modifier = Modifier
        .fillMaxWidth()
        .height(6.dp)
        .clip(PlutoShapes.extraSmall),
      color = MaterialTheme.colorScheme.primary,
      trackColor = MaterialTheme.colorScheme.surfaceVariant,
      strokeCap = StrokeCap.Round
    )
  }
}
