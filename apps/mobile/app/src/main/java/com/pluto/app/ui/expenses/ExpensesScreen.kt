package com.pluto.app.ui.expenses

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.FileDownload
import androidx.compose.material.icons.rounded.FilterAltOff
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.TableChart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.R
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DateRangeFilter
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.EmptyState
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.util.ExpenseExportService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.math.BigDecimal
import java.math.RoundingMode
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

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class, ExperimentalLayoutApi::class)
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
  var selectedInlineExpenseId by remember { mutableStateOf<String?>(null) }

  val currentExpenses = (listState as? ExpenseListUiState.Success)?.filteredExpenses ?: emptyList()

  if (showExportDialog) {
    AlertDialog(
      onDismissRequest = { showExportDialog = false },
      title = { Text("Export Transactions", fontWeight = FontWeight.Bold) },
      text = {
        Text("Export ${currentExpenses.size} transactions as a CSV spreadsheet for accounting or as a formatted PDF statement.")
      },
      confirmButton = {
        Button(
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
          modifier = Modifier.testTag("dialog_export_csv_button")
        ) {
          Icon(Icons.Rounded.TableChart, contentDescription = null, modifier = Modifier.size(16.dp))
          Spacer(modifier = Modifier.width(6.dp))
          Text("CSV (Excel)")
        }
      },
      dismissButton = {
        TextButton(onClick = { showExportDialog = false }) {
          Text("Cancel")
        }
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
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        },
        actions = {
          if (filter.isActive) {
            IconButton(
              onClick = { viewModel.clearFilters() },
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("expenses_clear_filters_button")
            ) {
              Icon(
                imageVector = Icons.Rounded.FilterAltOff,
                contentDescription = "Clear Filters",
                tint = MaterialTheme.colorScheme.primary
              )
            }
          }
          IconButton(
            onClick = { showExportDialog = true },
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("expenses_export_button")
          ) {
            Icon(
              imageVector = Icons.Rounded.FileDownload,
              contentDescription = "Export Transactions",
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
      // Unified Single Row: Search Input + Filter Dropdown Pills
      var isDateDropdownExpanded by remember { mutableStateOf(false) }
      var isCategoryDropdownExpanded by remember { mutableStateOf(false) }
      var showCustomDateRangeDialog by remember { mutableStateOf(false) }

      val customStart = filter.customStartDateMillis
      val customEnd = filter.customEndDateMillis
      val isDateFiltered = filter.dateRange != DateRangeFilter.ALL
      val isCategoryFiltered = filter.selectedCategoryId != null
      val activeCategory = Category.DEFAULT_CATEGORIES.find { it.id == filter.selectedCategoryId }
      val categoryLabel = if (isCategoryFiltered) (activeCategory?.name ?: "Category") else "Category"
      val dateLabel = when {
        !isDateFiltered -> "Date"
        filter.dateRange == DateRangeFilter.CUSTOM && customStart != null -> {
          formatCustomDateRangeLabel(customStart, customEnd)
        }
        else -> filter.dateRange.label
      }

      if (showCustomDateRangeDialog) {
        CustomDateRangePickerDialog(
          initialStartDateMillis = customStart?.let { localDayToUtcMidnight(it) },
          initialEndDateMillis = customEnd?.let { localDayToUtcMidnight(it) },
          onDismiss = { showCustomDateRangeDialog = false },
          onConfirm = { startMillis, endMillis ->
            viewModel.onCustomDateRangeSelected(startMillis, endMillis)
            showCustomDateRangeDialog = false
          }
        )
      }

      BoxWithConstraints(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 16.dp, vertical = 6.dp)
      ) {
        val useSingleRowFilterBar = maxWidth >= 420.dp

        val searchInput: @Composable (Modifier) -> Unit = { fieldModifier ->
          OutlinedTextField(
            value = filter.searchQuery,
            onValueChange = viewModel::onSearchQueryChanged,
            placeholder = { Text("Search...", style = MaterialTheme.typography.bodyMedium) },
            leadingIcon = {
              Icon(Icons.Rounded.Search, contentDescription = "Search", modifier = Modifier.size(18.dp))
            },
            trailingIcon = {
              if (filter.searchQuery.isNotBlank()) {
                IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                  Icon(Icons.Rounded.Clear, contentDescription = "Clear search", modifier = Modifier.size(16.dp))
                }
              }
            },
            singleLine = true,
            shape = PlutoShapes.medium,
            modifier = fieldModifier.testTag("expenses_search_input")
          )
        }

        val dateFilterControl: @Composable () -> Unit = {
          Box {
            Surface(
              shape = PlutoShapes.medium,
              color = if (isDateFiltered) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.85f)
              } else {
                MaterialTheme.colorScheme.surface
              },
              border = BorderStroke(
                1.dp,
                if (isDateFiltered) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                else MaterialTheme.colorScheme.outline
              ),
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .height(52.dp)
                .clip(PlutoShapes.medium)
                .clickable(role = Role.Button) { isDateDropdownExpanded = true }
                .testTag("filter_dropdown_date")
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Rounded.CalendarToday,
                  contentDescription = null,
                  modifier = Modifier.size(14.dp),
                  tint = if (isDateFiltered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                  text = dateLabel,
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.SemiBold,
                  color = if (isDateFiltered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                )
                Icon(
                  imageVector = Icons.Rounded.ArrowDropDown,
                  contentDescription = null,
                  modifier = Modifier.size(16.dp),
                  tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }

            DropdownMenu(
              expanded = isDateDropdownExpanded,
              onDismissRequest = { isDateDropdownExpanded = false }
            ) {
              DateRangeFilter.entries.forEach { range ->
                val isSelected = filter.dateRange == range
                DropdownMenuItem(
                  text = {
                    Row(
                      modifier = Modifier.fillMaxWidth(),
                      horizontalArrangement = Arrangement.SpaceBetween,
                      verticalAlignment = Alignment.CenterVertically
                    ) {
                      Text(
                        text = if (range == DateRangeFilter.CUSTOM && isSelected && customStart != null) {
                          "Custom (${formatCustomDateRangeLabel(customStart, customEnd)})"
                        } else {
                          range.label
                        },
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                      )
                      if (isSelected) {
                        Spacer(modifier = Modifier.width(12.dp))
                        Icon(
                          imageVector = Icons.Rounded.Check,
                          contentDescription = "Selected",
                          tint = MaterialTheme.colorScheme.primary,
                          modifier = Modifier.size(16.dp)
                        )
                      }
                    }
                  },
                  onClick = {
                    isDateDropdownExpanded = false
                    if (range == DateRangeFilter.CUSTOM) {
                      showCustomDateRangeDialog = true
                    } else {
                      viewModel.onDateRangeFilterSelected(range)
                    }
                  },
                  modifier = Modifier.testTag("filter_date_${range.name.lowercase()}")
                )
              }
            }
          }
        }

        val categoryFilterControl: @Composable () -> Unit = {
          Box {
            Surface(
              shape = PlutoShapes.medium,
              color = if (isCategoryFiltered) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.85f)
              } else {
                MaterialTheme.colorScheme.surface
              },
              border = BorderStroke(
                1.dp,
                if (isCategoryFiltered) MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                else MaterialTheme.colorScheme.outline
              ),
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .height(52.dp)
                .clip(PlutoShapes.medium)
                .clickable(role = Role.Button) { isCategoryDropdownExpanded = true }
                .testTag("filter_dropdown_category")
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Rounded.Category,
                  contentDescription = null,
                  modifier = Modifier.size(14.dp),
                  tint = if (isCategoryFiltered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                  text = categoryLabel,
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.SemiBold,
                  color = if (isCategoryFiltered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis
                )
                Icon(
                  imageVector = Icons.Rounded.ArrowDropDown,
                  contentDescription = null,
                  modifier = Modifier.size(16.dp),
                  tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }

            DropdownMenu(
              expanded = isCategoryDropdownExpanded,
              onDismissRequest = { isCategoryDropdownExpanded = false }
            ) {
              val isAllSelected = filter.selectedCategoryId == null
              DropdownMenuItem(
                text = {
                  Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                  ) {
                    Text(
                      text = "All Categories",
                      fontWeight = if (isAllSelected) FontWeight.Bold else FontWeight.Normal,
                      color = if (isAllSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                    )
                    if (isAllSelected) {
                      Spacer(modifier = Modifier.width(12.dp))
                      Icon(
                        imageVector = Icons.Rounded.Check,
                        contentDescription = "Selected",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(16.dp)
                      )
                    }
                  }
                },
                onClick = {
                  viewModel.onCategoryFilterSelected(null)
                  isCategoryDropdownExpanded = false
                },
                modifier = Modifier.testTag("filter_cat_all")
              )

              Category.DEFAULT_CATEGORIES.forEach { cat ->
                val isSelected = filter.selectedCategoryId == cat.id
                DropdownMenuItem(
                  text = {
                    Row(
                      modifier = Modifier.fillMaxWidth(),
                      horizontalArrangement = Arrangement.SpaceBetween,
                      verticalAlignment = Alignment.CenterVertically
                    ) {
                      Text(
                        text = cat.name,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                      )
                      if (isSelected) {
                        Spacer(modifier = Modifier.width(12.dp))
                        Icon(
                          imageVector = Icons.Rounded.Check,
                          contentDescription = "Selected",
                          tint = MaterialTheme.colorScheme.primary,
                          modifier = Modifier.size(16.dp)
                        )
                      }
                    }
                  },
                  onClick = {
                    viewModel.onCategoryFilterSelected(cat.id)
                    isCategoryDropdownExpanded = false
                  },
                  modifier = Modifier.testTag("filter_cat_${cat.id}")
                )
              }
            }
          }
        }

        val clearFiltersControl: @Composable () -> Unit = {
          if (filter.isActive) {
            IconButton(
              onClick = { viewModel.clearFilters() },
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("expenses_clear_filters_pill")
            ) {
              Icon(
                imageVector = Icons.Rounded.FilterAltOff,
                contentDescription = "Reset Filters",
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.primary
              )
            }
          }
        }

        if (useSingleRowFilterBar) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            searchInput(Modifier.weight(1f))
            dateFilterControl()
            categoryFilterControl()
            clearFiltersControl()
          }
        } else {
          Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            searchInput(Modifier.fillMaxWidth())
            FlowRow(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
              dateFilterControl()
              categoryFilterControl()
              clearFiltersControl()
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(4.dp))

      // 3. List Content Grouped by Day (with tablet List-Detail split pane on >= 600.dp)
      BoxWithConstraints(
        modifier = Modifier
          .fillMaxSize()
          .weight(1f)
      ) {
        val isWideLayout = maxWidth >= 600.dp

        when (val state = listState) {
          is ExpenseListUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
              CircularProgressIndicator(modifier = Modifier.testTag("expenses_loading"))
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
              val groupedByDay = remember(state.filteredExpenses, state.destinationCurrency, state.destinationExchangeRate) {
                groupExpensesByDay(
                  expenses = state.filteredExpenses,
                  destCurrency = state.destinationCurrency,
                  homeCurrency = state.homeCurrency,
                  exchangeRate = state.destinationExchangeRate
                )
              }

              val activeExpense = state.filteredExpenses.find { it.id == selectedInlineExpenseId }
                ?: state.filteredExpenses.firstOrNull()

              if (isWideLayout && onEditExpense != null && onDeleteExpense != null) {
                Row(modifier = Modifier.fillMaxSize()) {
                  LazyColumn(
                    modifier = Modifier
                      .weight(0.55f)
                      .fillMaxHeight()
                      .testTag("expenses_list"),
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
                                onClick = { selectedInlineExpenseId = expense.id }
                              )
                            }
                          }
                        }
                      }
                    }
                  }

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
                      Card(
                        modifier = Modifier
                          .fillMaxWidth()
                          .testTag("expense_tablet_detail_pane"),
                        shape = PlutoShapes.extraLarge,
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                      ) {
                        ExpenseDetailSheetContent(
                          expense = activeExpense,
                          userSettings = userSettings,
                          onDismiss = { selectedInlineExpenseId = null },
                          onEditExpense = onEditExpense,
                          onDeleteExpense = { id ->
                            onDeleteExpense(id)
                            selectedInlineExpenseId = null
                          },
                          modifier = Modifier.padding(top = 12.dp)
                        )
                      }
                    }
                  }
                }
              } else {
                LazyColumn(
                  modifier = Modifier
                    .fillMaxSize()
                    .testTag("expenses_list"),
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
                              onClick = { onExpenseClick(expense) }
                            )
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Group expenses by calendar day into structured [DayExpenseGroup]s.
 */
private fun groupExpensesByDay(
  expenses: List<Expense>,
  destCurrency: Currency,
  homeCurrency: Currency,
  exchangeRate: BigDecimal?
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

      var sumHome = BigDecimal.ZERO
      var sumDest = BigDecimal.ZERO

      dayExpenses.forEach { exp ->
        sumHome += exp.homeAmount.amount
        val destAmt = when {
          exp.originalCurrency == destCurrency -> exp.originalAmount.amount
          exchangeRate != null && exchangeRate > BigDecimal.ZERO ->
            exp.homeAmount.amount.multiply(exchangeRate).setScale(destCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
          destCurrency == homeCurrency -> exp.homeAmount.amount
          else -> exp.originalAmount.amount
        }
        sumDest += destAmt
      }

      DayExpenseGroup(
        dateKey = dateKey,
        dayTitle = dayTitle,
        totalDest = Money.of(sumDest, destCurrency),
        totalHome = Money.of(sumHome, homeCurrency),
        expenses = dayExpenses
      )
    }
}

/**
 * Sticky header marking the beginning of a calendar day's transactions.
 */
@Composable
private fun DayGroupHeader(
  dayTitle: String,
  totalDest: Money,
  totalHome: Money,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.background.copy(alpha = 0.96f)
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 4.dp, vertical = 6.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        text = dayTitle,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onBackground
      )

      Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
          text = totalDest.format(),
          style = MaterialTheme.typography.labelMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurface
        )
        if (totalDest.currency != totalHome.currency) {
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = "≈ ${totalHome.format()}",
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
@Composable
fun TransactionRowItem(
  expense: Expense,
  destinationCurrency: Currency,
  destinationExchangeRate: BigDecimal?,
  homeCurrency: Currency,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

  val primaryAmountStr = when {
    expense.originalCurrency == destinationCurrency -> expense.originalAmount.format()
    destinationExchangeRate != null && destinationExchangeRate > BigDecimal.ZERO -> {
      val converted = expense.homeAmount.amount.multiply(destinationExchangeRate)
        .setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency).format()
    }
    destinationCurrency == homeCurrency -> expense.homeAmount.format()
    else -> expense.originalAmount.format()
  }

  val secondaryAmountStr = "≈ ${expense.homeAmount.format()}"

  Row(
    modifier = modifier
      .fillMaxWidth()
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
    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = if (expense.merchant.isNotBlank()) expense.merchant else expense.category.name,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
      Spacer(modifier = Modifier.height(2.dp))
      Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
          text = timeFormat.format(Date(expense.timestamp)),
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
          text = " · ${expense.category.name}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (expense.isRecurring) {
          Spacer(modifier = Modifier.width(4.dp))
          Icon(
            imageVector = Icons.Rounded.Repeat,
            contentDescription = "Recurring",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(12.dp)
          )
          Text(
            text = " ${expense.recurrenceFrequency?.label ?: "Recurring"}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold
          )
        }
        if (expense.originalCurrency != destinationCurrency && expense.originalCurrency != homeCurrency) {
          Text(
            text = " · Paid ${expense.originalAmount.format()}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary
          )
        }
      }
    }

    // Amounts
    Column(horizontalAlignment = Alignment.End) {
      Text(
        text = primaryAmountStr,
        style = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = secondaryAmountStr,
        style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Medium
      )
    }
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
private fun FilteredSpendingSummaryCard(
  state: ExpenseListUiState.Success,
  modifier: Modifier = Modifier
) {
  val primaryTotal = state.totalDestSpending?.format() ?: state.totalHomeSpending.format()
  val secondaryTotal = state.totalHomeSpending.format()

  Card(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.large,
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
    ),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column {
        Text(
          text = "PERIOD TOTAL SPENDING",
          style = MaterialTheme.typography.labelSmall,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.primary,
          letterSpacing = 0.5.sp
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
          text = primaryTotal,
          style = MaterialTheme.typography.headlineSmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.ExtraBold,
          color = MaterialTheme.colorScheme.onSurface
        )
        Text(
          text = "≈ $secondaryTotal in ${state.homeCurrency.code}",
          style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.primary,
          fontWeight = FontWeight.Medium
        )
      }

      Surface(
        shape = PlutoShapes.medium,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
      ) {
        Text(
          text = "${state.filteredExpenses.size} items",
          style = MaterialTheme.typography.labelSmall,
          fontWeight = FontWeight.SemiBold,
          modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomDateRangePickerDialog(
  initialStartDateMillis: Long?,
  initialEndDateMillis: Long?,
  onDismiss: () -> Unit,
  onConfirm: (startMillis: Long, endMillis: Long) -> Unit
) {
  val dateRangePickerState = rememberDateRangePickerState(
    initialSelectedStartDateMillis = initialStartDateMillis,
    initialSelectedEndDateMillis = initialEndDateMillis
  )

  DatePickerDialog(
    onDismissRequest = onDismiss,
    confirmButton = {
      TextButton(
        onClick = {
          val start = dateRangePickerState.selectedStartDateMillis
          val end = dateRangePickerState.selectedEndDateMillis ?: start
          if (start != null && end != null) {
            val localStart = utcMillisToLocalDayStart(start)
            val localEnd = utcMillisToLocalDayEnd(end)
            onConfirm(localStart, localEnd)
          }
        },
        enabled = dateRangePickerState.selectedStartDateMillis != null,
        modifier = Modifier.testTag("date_range_picker_apply")
      ) {
        Text("Apply")
      }
    },
    dismissButton = {
      TextButton(
        onClick = onDismiss,
        modifier = Modifier.testTag("date_range_picker_cancel")
      ) {
        Text("Cancel")
      }
    },
    modifier = Modifier.testTag("custom_date_range_dialog")
  ) {
    DateRangePicker(
      state = dateRangePickerState,
      modifier = Modifier
        .fillMaxWidth()
        .weight(1f, fill = false),
      title = {
        Text(
          text = "Select Date Range",
          modifier = Modifier.padding(start = 24.dp, top = 16.dp, end = 24.dp),
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold
        )
      }
    )
  }
}

private fun utcMillisToLocalDayStart(utcMillis: Long): Long {
  val utcCal = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
    timeInMillis = utcMillis
  }
  return Calendar.getInstance().apply {
    set(Calendar.YEAR, utcCal.get(Calendar.YEAR))
    set(Calendar.MONTH, utcCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, utcCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis
}

private fun utcMillisToLocalDayEnd(utcMillis: Long): Long {
  val utcCal = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
    timeInMillis = utcMillis
  }
  return Calendar.getInstance().apply {
    set(Calendar.YEAR, utcCal.get(Calendar.YEAR))
    set(Calendar.MONTH, utcCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, utcCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, 23)
    set(Calendar.MINUTE, 59)
    set(Calendar.SECOND, 59)
    set(Calendar.MILLISECOND, 999)
  }.timeInMillis
}

private fun localDayToUtcMidnight(localMillis: Long): Long {
  val localCal = Calendar.getInstance().apply {
    timeInMillis = localMillis
  }
  return Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
    set(Calendar.YEAR, localCal.get(Calendar.YEAR))
    set(Calendar.MONTH, localCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, localCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis
}

private fun formatCustomDateRangeLabel(startMillis: Long, endMillis: Long?): String {
  val startCal = Calendar.getInstance().apply { timeInMillis = startMillis }
  val endCal = Calendar.getInstance().apply { timeInMillis = endMillis ?: startMillis }

  val startDay = startCal.get(Calendar.DAY_OF_MONTH)
  val endDay = endCal.get(Calendar.DAY_OF_MONTH)
  val startMonth = SimpleDateFormat("MMM", Locale.getDefault()).format(startCal.time)
  val endMonth = SimpleDateFormat("MMM", Locale.getDefault()).format(endCal.time)

  return if (startCal.get(Calendar.YEAR) == endCal.get(Calendar.YEAR)) {
    if (startCal.get(Calendar.DAY_OF_YEAR) == endCal.get(Calendar.DAY_OF_YEAR)) {
      "$startDay $startMonth"
    } else if (startCal.get(Calendar.MONTH) == endCal.get(Calendar.MONTH)) {
      "$startDay–$endDay $startMonth"
    } else {
      "$startDay $startMonth–$endDay $endMonth"
    }
  } else {
    val startYr = startCal.get(Calendar.YEAR) % 100
    val endYr = endCal.get(Calendar.YEAR) % 100
    "$startDay $startMonth '$startYr–$endDay $endMonth '$endYr"
  }
}
