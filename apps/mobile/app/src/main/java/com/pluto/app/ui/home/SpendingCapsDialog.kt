package com.pluto.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.math.RoundingMode

private fun sanitizeCapDecimalInput(input: String, currency: Currency): String? =
  currency.sanitizeAmountInput(input)

private fun formatCapDecimalInput(amount: BigDecimal, currency: Currency): String {
  val scaled = amount.setScale(currency.decimalPlaces, RoundingMode.HALF_EVEN)
  val stripped = scaled.stripTrailingZeros()
  return if (stripped.scale() <= 0) stripped.toPlainString() else scaled.toPlainString()
}

/**
 * Spending Caps Configuration Dialog with currency selection
 * and real-time conversion to base (home) currency.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpendingCapsDialog(
  userSettings: UserSettings,
  dashboardViewModel: DashboardViewModel? = null,
  onGetConversionRate: (suspend (Currency, Currency) -> BigDecimal?)? = dashboardViewModel?.let { vm ->
    { from, to -> vm.getConversionRate(from, to) }
  },
  onDismiss: () -> Unit,
  onSave: (BigDecimal?, BigDecimal?) -> Unit
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency

  var selectedBudgetCurrency by remember { mutableStateOf(destCurrency) }
  var currencyDropdownExpanded by remember { mutableStateOf(false) }
  var currentRateToBase by remember {
    mutableStateOf<BigDecimal?>(if (selectedBudgetCurrency == homeCurrency) BigDecimal.ONE else null)
  }
  var isRateUnavailable by remember { mutableStateOf(false) }

  var dailyText by remember {
    mutableStateOf(
      if (selectedBudgetCurrency == homeCurrency) {
        userSettings.dailySpendingCap?.takeIf { it > BigDecimal.ZERO }?.let { formatCapDecimalInput(it, homeCurrency) } ?: ""
      } else {
        ""
      }
    )
  }
  var monthlyText by remember {
    mutableStateOf(
      if (selectedBudgetCurrency == homeCurrency) {
        userSettings.monthlySpendingCap?.takeIf { it > BigDecimal.ZERO }?.let { formatCapDecimalInput(it, homeCurrency) } ?: ""
      } else {
        ""
      }
    )
  }
  var hasEditedDaily by remember { mutableStateOf(false) }
  var hasEditedMonthly by remember { mutableStateOf(false) }

  LaunchedEffect(selectedBudgetCurrency, homeCurrency, onGetConversionRate) {
    val resolvedRate = if (selectedBudgetCurrency == homeCurrency) {
      BigDecimal.ONE
    } else {
      onGetConversionRate?.invoke(selectedBudgetCurrency, homeCurrency)?.takeIf { it > BigDecimal.ZERO }
    }
    currentRateToBase = resolvedRate
    isRateUnavailable = selectedBudgetCurrency != homeCurrency && resolvedRate == null

    if (resolvedRate != null && resolvedRate > BigDecimal.ZERO) {
      if (!hasEditedDaily) {
        val homeDaily = userSettings.dailySpendingCap?.takeIf { it > BigDecimal.ZERO }
        dailyText = if (homeDaily != null) {
          val converted = if (selectedBudgetCurrency == homeCurrency) {
            homeDaily
          } else {
            homeDaily.divide(resolvedRate, selectedBudgetCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
          }
          formatCapDecimalInput(converted, selectedBudgetCurrency)
        } else {
          ""
        }
      }
      if (!hasEditedMonthly) {
        val homeMonthly = userSettings.monthlySpendingCap?.takeIf { it > BigDecimal.ZERO }
        monthlyText = if (homeMonthly != null) {
          val converted = if (selectedBudgetCurrency == homeCurrency) {
            homeMonthly
          } else {
            homeMonthly.divide(resolvedRate, selectedBudgetCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
          }
          formatCapDecimalInput(converted, selectedBudgetCurrency)
        } else {
          ""
        }
      }
    }
  }

  val parsedDailyEntered = dailyText.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }
  val parsedMonthlyEntered = monthlyText.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO }

  val rate = currentRateToBase

  val dailyInHome: BigDecimal? = parsedDailyEntered?.let {
    when {
      selectedBudgetCurrency == homeCurrency -> it.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      rate != null && rate > BigDecimal.ZERO -> it.multiply(rate).setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      else -> null
    }
  }

  val monthlyInHome: BigDecimal? = parsedMonthlyEntered?.let {
    when {
      selectedBudgetCurrency == homeCurrency -> it.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      rate != null && rate > BigDecimal.ZERO -> it.multiply(rate).setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      else -> null
    }
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("spending_caps_dialog")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "Set Budget & Allowances",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "Values converted to base currency (${homeCurrency.code})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
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
        text = "Enter spending allowances in your chosen currency. Values set in other currencies are automatically converted and saved in your base currency (${homeCurrency.code}).",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      ExposedDropdownMenuBox(
        expanded = currencyDropdownExpanded,
        onExpandedChange = { currencyDropdownExpanded = it }
      ) {
        OutlinedTextField(
          value = "${selectedBudgetCurrency.flagEmoji} ${selectedBudgetCurrency.code} - ${selectedBudgetCurrency.name}${if (selectedBudgetCurrency == destCurrency) " (Local Default)" else ""}",
          onValueChange = {},
          readOnly = true,
          label = { Text("Budget Currency") },
          trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = currencyDropdownExpanded) },
          shape = PlutoShapes.medium,
          modifier = Modifier
            .fillMaxWidth()
            .menuAnchor(MenuAnchorType.PrimaryNotEditable)
            .testTag("budget_currency_selector")
        )
        ExposedDropdownMenu(
          expanded = currencyDropdownExpanded,
          onDismissRequest = { currencyDropdownExpanded = false }
        ) {
          DropdownMenuItem(
            text = {
              Text(
                text = "${destCurrency.flagEmoji} ${destCurrency.code} - Local Currency (Default)",
                fontWeight = FontWeight.Bold
              )
            },
            onClick = {
              selectedBudgetCurrency = destCurrency
              currencyDropdownExpanded = false
            },
            modifier = Modifier.testTag("budget_currency_option_${destCurrency.code}")
          )

          if (homeCurrency.code != destCurrency.code) {
            DropdownMenuItem(
              text = {
                Text(text = "${homeCurrency.flagEmoji} ${homeCurrency.code} - Home Currency")
              },
              onClick = {
                selectedBudgetCurrency = homeCurrency
                currencyDropdownExpanded = false
              },
              modifier = Modifier.testTag("budget_currency_option_${homeCurrency.code}")
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
                },
                modifier = Modifier.testTag("budget_currency_option_${curr.code}")
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
            text = "Exchange rate unavailable for ${selectedBudgetCurrency.code} → ${homeCurrency.code}. Switch to ${homeCurrency.code} to edit caps offline.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer,
            modifier = Modifier.padding(10.dp)
          )
        }
      }

      OutlinedTextField(
        value = dailyText,
        onValueChange = {
          val sanitized = sanitizeCapDecimalInput(it, selectedBudgetCurrency) ?: return@OutlinedTextField
          hasEditedDaily = true
          dailyText = sanitized
        },
        label = { Text("Daily Safe-to-Spend Cap (${selectedBudgetCurrency.symbol})") },
        placeholder = { Text("e.g. ${selectedBudgetCurrency.zeroPlaceholder()}") },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
        keyboardOptions = KeyboardOptions(
          keyboardType = if (selectedBudgetCurrency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
        ),
        shape = PlutoShapes.medium,
        modifier = Modifier
          .fillMaxWidth()
          .testTag("dialog_daily_cap_input")
      )

      if (selectedBudgetCurrency != homeCurrency && dailyInHome != null) {
        Surface(
          shape = PlutoShapes.small,
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "≈ ${Money.of(dailyInHome, homeCurrency).format()} ${homeCurrency.code} (Base equivalent)",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onPrimaryContainer
            )
          }
        }
      }

      OutlinedTextField(
        value = monthlyText,
        onValueChange = {
          val sanitized = sanitizeCapDecimalInput(it, selectedBudgetCurrency) ?: return@OutlinedTextField
          hasEditedMonthly = true
          monthlyText = sanitized
        },
        label = { Text("Monthly Budget Cap (${selectedBudgetCurrency.symbol})") },
        placeholder = { Text("e.g. ${selectedBudgetCurrency.zeroPlaceholder()}") },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
        keyboardOptions = KeyboardOptions(
          keyboardType = if (selectedBudgetCurrency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
        ),
        shape = PlutoShapes.medium,
        modifier = Modifier
          .fillMaxWidth()
          .testTag("dialog_monthly_cap_input")
      )

      if (selectedBudgetCurrency != homeCurrency && monthlyInHome != null) {
        Surface(
          shape = PlutoShapes.small,
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "≈ ${Money.of(monthlyInHome, homeCurrency).format()} ${homeCurrency.code} (Base equivalent)",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onPrimaryContainer
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.md),
        verticalAlignment = Alignment.CenterVertically
      ) {
        TextButton(
          onClick = { onSave(null, null) },
          modifier = Modifier.testTag("dialog_clear_caps_button")
        ) {
          Text("Clear", color = MaterialTheme.colorScheme.error)
        }

        Spacer(modifier = Modifier.weight(1f))

        PlutoButton(
          text = "Cancel",
          onClick = onDismiss,
          variant = PlutoButtonVariant.OUTLINED
        )

        val canSave = !isRateUnavailable || (parsedDailyEntered == null && parsedMonthlyEntered == null)
        PlutoButton(
          text = "Save Caps",
          onClick = {
            if (isRateUnavailable && (parsedDailyEntered != null || parsedMonthlyEntered != null)) {
              return@PlutoButton
            }
            onSave(dailyInHome, monthlyInHome)
          },
          variant = PlutoButtonVariant.PRIMARY,
          enabled = canSave,
          testTag = "dialog_save_caps_button"
        )
      }
    }
  }
}
