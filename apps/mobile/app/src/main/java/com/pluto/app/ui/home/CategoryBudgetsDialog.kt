package com.pluto.app.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoNumericStyle
import java.math.BigDecimal
import java.util.Locale

/**
 * Dialog enabling creation and configuration of multiple category-specific budgets
 * (e.g., Food, Transport, Accommodation, Entertainment, Groceries).
 *
 * Supports input in the user's chosen currency (defaulting to the Local/Destination currency)
 * and automatically converts and saves each budget cap in the base home currency.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryBudgetsDialog(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel? = null,
  onDismiss: () -> Unit,
  onSave: (Map<String, Double>) -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency

  var selectedBudgetCurrency by remember { mutableStateOf(destCurrency) }
  var currencyDropdownExpanded by remember { mutableStateOf(false) }
  var currentRateToBase by remember { mutableStateOf<BigDecimal?>(null) }

  // Query conversion rate from selectedBudgetCurrency -> homeCurrency
  LaunchedEffect(selectedBudgetCurrency, homeCurrency) {
    if (selectedBudgetCurrency == homeCurrency) {
      currentRateToBase = BigDecimal.ONE
    } else {
      currentRateToBase = dashboardViewModel?.getConversionRate(selectedBudgetCurrency, homeCurrency)
        ?: run {
          when {
            selectedBudgetCurrency.code == "JPY" && homeCurrency.code == "USD" -> BigDecimal("0.0067")
            selectedBudgetCurrency.code == "USD" && homeCurrency.code == "JPY" -> BigDecimal("150.0")
            selectedBudgetCurrency.code == "EUR" && homeCurrency.code == "USD" -> BigDecimal("1.08")
            selectedBudgetCurrency.code == "USD" && homeCurrency.code == "EUR" -> BigDecimal("0.92")
            else -> BigDecimal.ONE
          }
        }
    }
  }

  val rate = currentRateToBase ?: BigDecimal.ONE

  // Local state map holding input string for each category
  val budgetInputs = remember {
    mutableStateMapOf<String, String>().apply {
      Category.DEFAULT_CATEGORIES.forEach { category ->
        val homeCap = userSettings.categoryMonthlyBudgets[category.id]
        if (homeCap != null && homeCap > 0.0) {
          // If in destination currency initially, convert home amount to dest
          val displayedValue = if (selectedBudgetCurrency == homeCurrency) {
            String.format(Locale.US, "%.0f", homeCap)
          } else {
            val rateToDest = when {
              selectedBudgetCurrency.code == "JPY" && homeCurrency.code == "USD" -> 150.0
              selectedBudgetCurrency.code == "EUR" && homeCurrency.code == "USD" -> 0.92
              else -> 1.0
            }
            String.format(Locale.US, "%.0f", homeCap * rateToDest)
          }
          put(category.id, displayedValue)
        }
      }
    }
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = modifier.testTag("category_budgets_dialog")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.Category,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
          )
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = "Category Budgets",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
        }
        IconButton(onClick = onDismiss) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }
        Text(
          text = "Set individual monthly spending limits for each category. Values set in other currencies are converted and tracked in your home currency (${homeCurrency.code}).",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Currency Selector for Category Budgets
        ExposedDropdownMenuBox(
          expanded = currencyDropdownExpanded,
          onExpandedChange = { currencyDropdownExpanded = it }
        ) {
          OutlinedTextField(
            value = "${selectedBudgetCurrency.flagEmoji} ${selectedBudgetCurrency.code} - ${selectedBudgetCurrency.name}${if (selectedBudgetCurrency == destCurrency) " (Local Default)" else ""}",
            onValueChange = {},
            readOnly = true,
            label = { Text("Budget Input Currency") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = currencyDropdownExpanded) },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
              .testTag("category_budget_currency_selector")
          )
          ExposedDropdownMenu(
            expanded = currencyDropdownExpanded,
            onDismissRequest = { currencyDropdownExpanded = false }
          ) {
            DropdownMenuItem(
              text = {
                Text(
                  text = "${destCurrency.flagEmoji} ${destCurrency.code} - Local (Default)",
                  fontWeight = FontWeight.Bold
                )
              },
              onClick = {
                selectedBudgetCurrency = destCurrency
                currencyDropdownExpanded = false
              }
            )

            if (homeCurrency.code != destCurrency.code) {
              DropdownMenuItem(
                text = { Text(text = "${homeCurrency.flagEmoji} ${homeCurrency.code} - Home Currency") },
                onClick = {
                  selectedBudgetCurrency = homeCurrency
                  currencyDropdownExpanded = false
                }
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
                  }
                )
              }
          }
        }

        Spacer(modifier = Modifier.height(2.dp))

        // Scrollable list of categories
        LazyColumn(
          modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 320.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          items(Category.DEFAULT_CATEGORIES, key = { it.id }) { cat ->
            val currentValue = budgetInputs[cat.id] ?: ""
            val parsed = currentValue.toDoubleOrNull()?.takeIf { it > 0.0 }
            val inHome = parsed?.let {
              if (selectedBudgetCurrency == homeCurrency) it else it * rate.toDouble()
            }

            Surface(
              shape = RoundedCornerShape(12.dp),
              color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
              modifier = Modifier.fillMaxWidth()
            ) {
              Row(
                modifier = Modifier
                  .fillMaxWidth()
                  .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
              ) {
                Column(modifier = Modifier.weight(1f)) {
                  Text(
                    text = cat.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                  )
                  if (selectedBudgetCurrency != homeCurrency && inHome != null) {
                    Text(
                      text = "≈ ${homeCurrency.symbol}${String.format(Locale.US, "%.1f", inHome)} ${homeCurrency.code}",
                      style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                      color = MaterialTheme.colorScheme.primary,
                      fontSize = 10.sp
                    )
                  }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                  OutlinedTextField(
                    value = currentValue,
                    onValueChange = { newVal ->
                      val filtered = newVal.filter { it.isDigit() || it == '.' }
                      if (filtered.isEmpty()) {
                        budgetInputs.remove(cat.id)
                      } else {
                        budgetInputs[cat.id] = filtered
                      }
                    },
                    textStyle = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
                    placeholder = { Text("0") },
                    leadingIcon = {
                      Text(
                        text = selectedBudgetCurrency.symbol,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                      )
                    },
                    trailingIcon = {
                      if (currentValue.isNotEmpty()) {
                        IconButton(onClick = { budgetInputs.remove(cat.id) }) {
                          Icon(
                            imageVector = Icons.Rounded.Clear,
                            contentDescription = "Clear",
                            modifier = Modifier.size(16.dp)
                          )
                        }
                      }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                      .width(130.dp)
                      .testTag("category_budget_input_${cat.id}")
                  )
                }
              }
            }
          }
        }
      Spacer(modifier = Modifier.height(6.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        TextButton(
          onClick = { onSave(emptyMap()) },
          modifier = Modifier.testTag("dialog_clear_all_category_budgets")
        ) {
          Text("Clear All", color = MaterialTheme.colorScheme.error)
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
            val resultBudgets = mutableMapOf<String, Double>()
            budgetInputs.forEach { (catId, text) ->
              val entered = text.toDoubleOrNull()
              if (entered != null && entered > 0.0) {
                val homeAmount = if (selectedBudgetCurrency == homeCurrency) entered else entered * rate.toDouble()
                resultBudgets[catId] = homeAmount
              }
            }
            onSave(resultBudgets)
          },
          shape = RoundedCornerShape(12.dp),
          modifier = Modifier.testTag("dialog_save_category_budgets_button")
        ) {
          Text("Save Budgets")
        }
      }
    }
  }
}
