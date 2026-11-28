package com.pluto.app.ui.expenses

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.FileDownload
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.TableChart
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.R
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.EmptyState
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.util.ExpenseExportService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ExpensesScreen(
  userSettings: UserSettings,
  viewModel: ExpenseViewModel,
  onAddExpenseClick: () -> Unit,
  onExpenseClick: (Expense) -> Unit,
  onNavigateToProfile: () -> Unit = {},
  onEditExpense: ((Expense) -> Unit)? = null,
  onDeleteExpense: ((String) -> Unit)? = null,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val listState by viewModel.expenseListState.collectAsStateWithLifecycle()
  val filter by viewModel.filter.collectAsStateWithLifecycle()
  val context = LocalContext.current
  val coroutineScope = rememberCoroutineScope()

  var showExportDialog by remember { mutableStateOf(false) }
  var selectedInlineExpenseId by rememberSaveable { mutableStateOf<String?>(null) }
  var isInlineDetailDismissed by rememberSaveable { mutableStateOf(false) }

  val currentExpenses = (listState as? ExpenseListUiState.Success)?.filteredExpenses ?: emptyList()

  if (showExportDialog) {
    AlertDialog(
      onDismissRequest = { showExportDialog = false },
      title = { Text("Export Transactions (CSV)", fontWeight = FontWeight.Bold) },
      text = {
        Text(
          if (currentExpenses.isEmpty()) {
            "No transactions match your current view. Clear or adjust filters before exporting a CSV spreadsheet."
          } else {
            "Export ${currentExpenses.size} filtered ${if (currentExpenses.size == 1) "transaction" else "transactions"} as a CSV spreadsheet (.csv) for Excel or accounting."
          }
        )
      },
      confirmButton = {
        PlutoButton(
          text = "Export CSV",
          enabled = currentExpenses.isNotEmpty(),
          onClick = {
            showExportDialog = false
            coroutineScope.launch {
              val csvContent = withContext(Dispatchers.Default) {
                ExpenseExportService.generateCsv(
                  expenses = currentExpenses,
                  homeCurrency = homeCurrency,
                  periodTitle = "Transactions_Report"
                )
              }
              val csvFile = withContext(Dispatchers.IO) {
                ExpenseExportService.saveCsvToCache(
                  context = context,
                  csvContent = csvContent,
                  periodTitle = "Transactions_Report"
                )
              }
              ExpenseExportService.shareFile(
                context = context,
                file = csvFile,
                mimeType = "text/csv",
                title = "Export Transactions CSV"
              )
            }
          },
          leadingIcon = Icons.Rounded.TableChart,
          testTag = "dialog_export_csv_button"
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

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        title = {
          Column {
            Text(
              text = "Transactions",
              style = MaterialTheme.typography.titleLarge,
              fontWeight = FontWeight.Bold,
              modifier = Modifier
                .plutoHeading()
                .testTag("transactions_screen_title")
            )
            val countText = if (currentExpenses.isNotEmpty()) {
              "${currentExpenses.size} records"
            } else {
              "No transactions"
            }
            Text(
              text = countText,
              style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        },
        actions = {
          IconButton(
            onClick = { showExportDialog = true },
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("expenses_export_button")
          ) {
            Icon(
              imageVector = Icons.Rounded.FileDownload,
              contentDescription = "Export Transactions as CSV",
              tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
          CurrencyBadge(
            currency = homeCurrency,
            modifier = Modifier
              .padding(end = 6.dp)
              .testTag("expenses_currency_badge")
          )
          IconButton(
            onClick = onNavigateToProfile,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("expenses_profile_button")
              .padding(end = 8.dp)
          ) {
            Surface(
              shape = CircleShape,
              color = MaterialTheme.colorScheme.primaryContainer,
              modifier = Modifier.size(36.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.AccountCircle,
                  contentDescription = "Profile and Settings",
                  tint = MaterialTheme.colorScheme.onPrimaryContainer,
                  modifier = Modifier.size(22.dp)
                )
              }
            }
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.background
        )
      )
    },
    floatingActionButton = {
      FloatingActionButton(
        onClick = onAddExpenseClick,
        containerColor = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary,
        modifier = Modifier.testTag("expenses_fab_add")
      ) {
        Icon(imageVector = Icons.Rounded.Add, contentDescription = "Add Transaction")
      }
    }
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
    ) {
      ExpenseFilterBar(
        filter = filter,
        onSearchQueryChanged = viewModel::onSearchQueryChanged,
        onDateRangeFilterSelected = viewModel::onDateRangeFilterSelected,
        onCustomDateRangeSelected = viewModel::onCustomDateRangeSelected,
        onCategoryFilterSelected = viewModel::onCategoryFilterSelected,
        onClearFilters = viewModel::clearFilters
      )

      Spacer(modifier = Modifier.height(4.dp))

      // List Content Grouped by Day (inner split threshold accounts for the shell navigation rail)
      BoxWithConstraints(
        modifier = Modifier
          .fillMaxSize()
          .weight(1f)
      ) {
        val isWideLayout = maxWidth >= 520.dp

        when (val state = listState) {
          is ExpenseListUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
              CircularProgressIndicator(modifier = Modifier.testTag("expenses_loading"))
            }
          }

          is ExpenseListUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
              EmptyState(
                icon = Icons.Rounded.Warning,
                title = "Couldn't load transactions",
                description = state.message,
                actionText = "Retry",
                onActionClick = viewModel::retryExpensesList,
                actionTestTag = "expenses_retry_button"
              )
            }
          }

          is ExpenseListUiState.Success -> {
            if (state.allExpenses.isEmpty()) {
              Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                EmptyState(
                  icon = Icons.AutoMirrored.Rounded.ReceiptLong,
                  illustrationRes = R.drawable.img_empty_expenses,
                  title = "Nothing here yet",
                  description = "Start logging transactions to see your spending ledger here.",
                  actionText = "Add Transaction",
                  onActionClick = onAddExpenseClick,
                  actionTestTag = "expenses_empty_state_action"
                )
              }
            } else if (state.filteredExpenses.isEmpty()) {
              Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                EmptyState(
                  icon = Icons.Rounded.Search,
                  title = "No matching transactions",
                  description = "Try adjusting your search query or reset active filters.",
                  actionText = "Clear Filters",
                  onActionClick = { viewModel.clearFilters() },
                  actionTestTag = "expenses_clear_filters_empty_action"
                )
              }
            } else {
              val groupedByDay = remember(
                state.filteredExpenses,
                state.destinationCurrency,
                state.homeCurrency,
                state.destinationExchangeRate,
                state.homeAmountById,
                state.destinationAmountById
              ) {
                groupExpensesByDay(
                  expenses = state.filteredExpenses,
                  destCurrency = state.destinationCurrency,
                  homeCurrency = state.homeCurrency,
                  exchangeRate = state.destinationExchangeRate,
                  homeAmountById = state.homeAmountById,
                  destinationAmountById = state.destinationAmountById
                )
              }

              val activeExpense = if (isInlineDetailDismissed) {
                null
              } else {
                state.filteredExpenses.find { it.id == selectedInlineExpenseId }
                  ?: state.filteredExpenses.firstOrNull()
              }

              if (isWideLayout && onEditExpense != null && onDeleteExpense != null) {
                Row(modifier = Modifier.fillMaxSize()) {
                  ExpensesGroupedList(
                    state = state,
                    groupedByDay = groupedByDay,
                    selectedExpenseId = activeExpense?.id,
                    onExpenseClick = {
                      selectedInlineExpenseId = it.id
                      isInlineDetailDismissed = false
                    },
                    modifier = Modifier
                      .weight(0.55f)
                      .fillMaxHeight()
                  )

                  VerticalDivider(
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                  )

                  Box(
                    modifier = Modifier
                      .weight(0.45f)
                      .fillMaxHeight()
                      .padding(16.dp)
                  ) {
                    if (activeExpense != null) {
                      PlutoCard(
                        modifier = Modifier.fillMaxWidth(),
                        shape = PlutoShapes.extraLarge,
                        testTag = "expense_tablet_detail_pane"
                      ) {
                        ExpenseDetailSheetContent(
                          expense = activeExpense,
                          userSettings = userSettings,
                          onDismiss = {
                            selectedInlineExpenseId = null
                            isInlineDetailDismissed = true
                          },
                          onEditExpense = onEditExpense,
                          onDeleteExpense = { id ->
                            onDeleteExpense(id)
                            selectedInlineExpenseId = null
                          },
                          modifier = Modifier.padding(top = 12.dp)
                        )
                      }
                    } else {
                      PlutoCard(
                        modifier = Modifier
                          .fillMaxWidth()
                          .testTag("expense_tablet_detail_empty"),
                        shape = PlutoShapes.extraLarge
                      ) {
                        Column(
                          modifier = Modifier
                            .fillMaxWidth()
                            .padding(PlutoSpacing.xxl),
                          horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                          Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ReceiptLong,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(36.dp)
                          )
                          Spacer(modifier = Modifier.height(PlutoSpacing.md))
                          Text(
                            text = "Select a transaction",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                          )
                          Spacer(modifier = Modifier.height(PlutoSpacing.xs))
                          Text(
                            text = "Choose any item on the left to view exchange-rate provenance, receipt photo, or edit.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                          )
                        }
                      }
                    }
                  }
                }
              } else {
                ExpensesGroupedList(
                  state = state,
                  groupedByDay = groupedByDay,
                  selectedExpenseId = null,
                  onExpenseClick = onExpenseClick,
                  modifier = Modifier.fillMaxSize()
                )
              }
            }
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ExpensesGroupedList(
  state: ExpenseListUiState.Success,
  groupedByDay: List<DayExpenseGroup>,
  selectedExpenseId: String?,
  onExpenseClick: (Expense) -> Unit,
  modifier: Modifier = Modifier
) {
  LazyColumn(
    modifier = modifier.testTag("expenses_list"),
    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 96.dp)
  ) {
    item(key = "spending_summary_card") {
      FilteredSpendingSummaryCard(state = state)
      Spacer(modifier = Modifier.height(10.dp))
    }

    groupedByDay.forEach { dayGroup ->
      stickyHeader(key = "header_${dayGroup.dateKey}") {
        DayGroupHeader(
          dayTitle = dayGroup.dayTitle,
          totalDest = dayGroup.totalDest,
          totalHome = dayGroup.totalHome
        )
      }

      item(key = "day_card_${dayGroup.dateKey}") {
        Surface(
          modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp),
          shape = PlutoShapes.large,
          color = MaterialTheme.colorScheme.surface
        ) {
          Column(modifier = Modifier.fillMaxWidth()) {
            dayGroup.expenses.forEachIndexed { index, expense ->
              if (index > 0) {
                HorizontalDivider(
                  modifier = Modifier.padding(horizontal = 16.dp),
                  thickness = 0.8.dp,
                  color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)
                )
              }
              TransactionRowItem(
                expense = expense,
                destinationCurrency = state.destinationCurrency,
                destinationExchangeRate = state.destinationExchangeRate,
                homeCurrency = state.homeCurrency,
                isSelected = selectedExpenseId == expense.id,
                onClick = { onExpenseClick(expense) }
              )
            }
          }
        }
      }
    }
  }
}
