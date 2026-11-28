package com.pluto.app.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberModalBottomSheetState
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
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoResponsive
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.math.RoundingMode

private fun sanitizeCategoryDecimalInput(input: String, currency: Currency): String? =
  currency.sanitizeAmountInput(input)

private fun formatConvertedCap(amount: BigDecimal, currency: Currency): String {
  val scaled = amount.setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN)
  val stripped = scaled.stripTrailingZeros()
  return if (stripped.scale() <= 0) stripped.toPlainString() else scaled.toPlainString()
}

/**
 * Dialog enabling creation and configuration of multiple category-specific budgets
 * (e.g., Food, Transport, Accommodation, Entertainment, Groceries).
 *
 * Supports input in the user's chosen currency (defaulting to the primary spending currency)
 * and automatically converts and saves each budget cap in the reference currency.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryBudgetsDialog(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel? = null,
  onGetConversionRate: (suspend (Currency, Currency) -> BigDecimal?)? = dashboardViewModel?.let { vm ->
    { from, to -> vm.getConversionRate(from, to) }
  },
  onDismiss: () -> Unit,
  onSave: (Map<String, BigDecimal>) -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency

  var selectedBudgetCurrency by remember { mutableStateOf(destCurrency) }
  var currencyDropdownExpanded by remember { mutableStateOf(false) }
  var currentRateToBase by remember { mutableStateOf<BigDecimal?>(if (selectedBudgetCurrency == homeCurrency) BigDecimal.ONE else null) }
  var isRateUnavailable by remember { mutableStateOf(false) }

  // Local state map holding input string for each category and tracking whether user edited it
  val budgetInputs = remember {
    mutableStateMapOf<String, String>().apply {
      if (selectedBudgetCurrency == homeCurrency) {
        Category.DEFAULT_CATEGORIES.forEach { category ->
          val homeCap = userSettings.categoryMonthlyBudgets[category.id]
          if (homeCap != null && homeCap > BigDecimal.ZERO) {
            put(category.id, formatConvertedCap(homeCap, homeCurrency))
          }
        }
      }
    }
  }
  val editedCategories = remember { mutableStateMapOf<String, Boolean>() }

  // Query conversion rate from selectedBudgetCurrency -> homeCurrency
  LaunchedEffect(selectedBudgetCurrency, homeCurrency, onGetConversionRate) {
    val resolvedRate = if (selectedBudgetCurrency == homeCurrency) {
      BigDecimal.ONE
    } else {
      onGetConversionRate?.invoke(selectedBudgetCurrency, homeCurrency)?.takeIf { it > BigDecimal.ZERO }
    }
    currentRateToBase = resolvedRate
    isRateUnavailable = selectedBudgetCurrency != homeCurrency && resolvedRate == null
    if (resolvedRate != null && resolvedRate > BigDecimal.ZERO) {
      Category.DEFAULT_CATEGORIES.forEach { category ->
        if (editedCategories[category.id] != true) {
          val homeCap = userSettings.categoryMonthlyBudgets[category.id]
          if (homeCap != null && homeCap > BigDecimal.ZERO) {
            val converted = if (selectedBudgetCurrency == homeCurrency) {
              homeCap
            } else {
              homeCap.divide(resolvedRate, selectedBudgetCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
            }
            budgetInputs[category.id] = formatConvertedCap(converted, selectedBudgetCurrency)
          } else {
            budgetInputs.remove(category.id)
          }
        }
      }
    }
  }

  val rate = currentRateToBase
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = modifier.testTag("category_budgets_dialog")
  ) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
      val isShortHeight = maxHeight < PlutoResponsive.ShortHeight
      val listMaxHeight = if (isShortHeight) 160.dp else 320.dp
      val bodyMaxHeight = PlutoResponsive.sheetBodyMaxHeight(maxHeight)
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .navigationBarsPadding()
          .imePadding()
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = bodyMaxHeight)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(bottom = 12.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f)
        ) {
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
        IconButton(
          onClick = onDismiss,
          modifier = Modifier.minimumInteractiveComponentSize()
        ) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }
        Text(
          text = "Set individual monthly spending limits for each category. Values set in other currencies are converted and tracked in your reference currency (${homeCurrency.code}).",
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
            shape = PlutoShapes.medium,
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
                text = { Text(text = "${homeCurrency.flagEmoji} ${homeCurrency.code} - Reference Currency") },
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

        if (isRateUnavailable) {
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.errorContainer,
            modifier = Modifier.fillMaxWidth()
          ) {
            Text(
              text = "Exchange rate unavailable for ${selectedBudgetCurrency.code} → ${homeCurrency.code}. Switch to ${homeCurrency.code} to edit budgets offline.",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onErrorContainer,
              modifier = Modifier.padding(10.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(2.dp))

        // Scrollable list of categories
        LazyColumn(
          modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = listMaxHeight),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          items(Category.DEFAULT_CATEGORIES, key = { it.id }) { cat ->
            val currentValue = budgetInputs[cat.id] ?: ""
            val parsed = currentValue.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }
            val inHome = parsed?.let {
              when {
                selectedBudgetCurrency == homeCurrency -> it.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
                rate != null && rate > BigDecimal.ZERO -> it.multiply(rate).setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
                else -> null
              }
            }

            Surface(
              shape = PlutoShapes.medium,
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
                      text = "≈ ${Money.of(inHome, homeCurrency).format()} ${homeCurrency.code}",
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
                      val filtered = sanitizeCategoryDecimalInput(newVal, selectedBudgetCurrency) ?: return@OutlinedTextField
                      editedCategories[cat.id] = true
                      if (filtered.isEmpty()) {
                        budgetInputs.remove(cat.id)
                      } else {
                        budgetInputs[cat.id] = filtered
                      }
                    },
                    textStyle = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
                    placeholder = { Text(selectedBudgetCurrency.zeroPlaceholder()) },
                    leadingIcon = {
                      Text(
                        text = selectedBudgetCurrency.symbol,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                      )
                    },
                    trailingIcon = {
                      if (currentValue.isNotEmpty()) {
                        IconButton(onClick = {
                          editedCategories[cat.id] = true
                          budgetInputs.remove(cat.id)
                        }) {
                          Icon(
                            imageVector = Icons.Rounded.Clear,
                            contentDescription = "Clear",
                            modifier = Modifier.size(16.dp)
                          )
                        }
                      }
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                      keyboardType = if (selectedBudgetCurrency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
                    ),
                    shape = PlutoShapes.small,
                    modifier = Modifier
                      .width(130.dp)
                      .testTag("category_budget_input_${cat.id}")
                  )
                }
              }
            }
          }
        }
        }

        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(bottom = 12.dp),
          horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.md),
          verticalAlignment = Alignment.CenterVertically
        ) {
          TextButton(
            onClick = { onSave(emptyMap()) },
            modifier = Modifier.testTag("dialog_clear_all_category_budgets")
          ) {
            Text("Clear All", color = MaterialTheme.colorScheme.error)
          }

          Spacer(modifier = Modifier.weight(1f))

          PlutoButton(
            text = "Cancel",
            onClick = onDismiss,
            variant = PlutoButtonVariant.OUTLINED
          )

          val canSave = !isRateUnavailable || budgetInputs.isEmpty()
          PlutoButton(
            text = "Save Budgets",
            onClick = {
              val activeRate = rate
              if (selectedBudgetCurrency != homeCurrency && activeRate == null) {
                if (budgetInputs.isEmpty()) {
                  onSave(emptyMap())
                }
                return@PlutoButton
              }
              val resultBudgets = mutableMapOf<String, BigDecimal>()
              budgetInputs.forEach { (catId, text) ->
                val entered = text.toBigDecimalOrNull()
                if (entered != null && entered > BigDecimal.ZERO) {
                  val homeAmount = if (selectedBudgetCurrency == homeCurrency) {
                    entered.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
                  } else {
                    entered.multiply(activeRate!!).setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
                  }
                  resultBudgets[catId] = homeAmount
                }
              }
              onSave(resultBudgets)
            },
            variant = PlutoButtonVariant.PRIMARY,
            enabled = canSave,
            testTag = "dialog_save_category_budgets_button"
          )
        }
      }
    }
  }
}
