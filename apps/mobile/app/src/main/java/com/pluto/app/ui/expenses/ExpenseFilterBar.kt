package com.pluto.app.ui.expenses

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.FilterAltOff
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.DateRangeFilter
import com.pluto.app.domain.model.ExpenseFilter
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ExpenseFilterBar(
  filter: ExpenseFilter,
  onSearchQueryChanged: (String) -> Unit,
  onDateRangeFilterSelected: (DateRangeFilter) -> Unit,
  onCustomDateRangeSelected: (startMillis: Long, endMillis: Long) -> Unit,
  onCategoryFilterSelected: (String?) -> Unit,
  onClearFilters: () -> Unit,
  modifier: Modifier = Modifier
) {
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
        onCustomDateRangeSelected(startMillis, endMillis)
        showCustomDateRangeDialog = false
      }
    )
  }

  BoxWithConstraints(
    modifier = modifier
      .fillMaxWidth()
      .padding(horizontal = PlutoSpacing.lg, vertical = 6.dp)
  ) {
    val useSingleRowFilterBar = maxWidth >= 500.dp

    val searchInput: @Composable (Modifier) -> Unit = { fieldModifier ->
      OutlinedTextField(
        value = filter.searchQuery,
        onValueChange = onSearchQueryChanged,
        placeholder = { Text("Search...", style = MaterialTheme.typography.bodyMedium) },
        leadingIcon = {
          Icon(Icons.Rounded.Search, contentDescription = "Search", modifier = Modifier.size(18.dp))
        },
        trailingIcon = {
          if (filter.searchQuery.isNotBlank()) {
            IconButton(onClick = { onSearchQueryChanged("") }) {
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
            .heightIn(min = 48.dp)
            .clip(PlutoShapes.medium)
            .clickable(role = Role.Button) { isDateDropdownExpanded = true }
            .testTag("filter_dropdown_date")
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
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
              color = if (isDateFiltered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
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
                  onDateRangeFilterSelected(range)
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
            .heightIn(min = 48.dp)
            .clip(PlutoShapes.medium)
            .clickable(role = Role.Button) { isCategoryDropdownExpanded = true }
            .testTag("filter_dropdown_category")
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
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
              onCategoryFilterSelected(null)
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
                onCategoryFilterSelected(cat.id)
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
        Surface(
          shape = PlutoShapes.medium,
          color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f),
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .heightIn(min = 48.dp)
            .clip(PlutoShapes.medium)
            .clickable(role = Role.Button, onClick = onClearFilters)
            .testTag("expenses_clear_filters_button")
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = Icons.Rounded.FilterAltOff,
              contentDescription = null,
              modifier = Modifier.size(16.dp),
              tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
              text = "Clear",
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onSecondaryContainer
            )
          }
        }
      }
    }

    if (useSingleRowFilterBar) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm),
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
        verticalArrangement = Arrangement.spacedBy(PlutoSpacing.sm)
      ) {
        searchInput(Modifier.fillMaxWidth())
        FlowRow(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm),
          verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          dateFilterControl()
          categoryFilterControl()
          clearFiltersControl()
        }
      }
    }
  }
}
