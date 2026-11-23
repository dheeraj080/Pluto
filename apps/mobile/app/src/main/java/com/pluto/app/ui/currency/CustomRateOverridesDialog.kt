package com.pluto.app.ui.currency

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.ui.theme.PlutoNumericStyle
import java.math.BigDecimal

/**
 * Dialog allowing travelers to view, create, and remove custom manual exchange rate overrides
 * (e.g., cash kiosk rates, ATM conversion fees, street rates).
 */
@Composable
fun CustomRateOverridesDialog(
  activeOverrides: List<ExchangeRate>,
  defaultFromCurrency: Currency,
  defaultToCurrency: Currency,
  onDismiss: () -> Unit,
  onSaveOverride: (Currency, Currency, BigDecimal) -> Unit,
  onClearOverride: (Currency, Currency) -> Unit
) {
  var fromCurrency by remember { mutableStateOf(defaultFromCurrency) }
  var toCurrency by remember { mutableStateOf(defaultToCurrency) }
  var rateInput by remember { mutableStateOf("") }
  var errorMessage by remember { mutableStateOf<String?>(null) }
  var isAddingNew by remember { mutableStateOf(activeOverrides.isEmpty()) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(
          text = "Custom Rate Overrides",
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold
        )
        if (!isAddingNew) {
          IconButton(
            onClick = { isAddingNew = true },
            modifier = Modifier.testTag("add_custom_rate_button")
          ) {
            Icon(imageVector = Icons.Rounded.Add, contentDescription = "Add Override")
          }
        }
      }
    },
    text = {
      Column(
        modifier = Modifier.fillMaxWidth()
      ) {
        Text(
          text = "Override market API rates with your actual cash exchange or ATM kiosk rates. Takes priority across all wallet & expense conversions.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(14.dp))

        if (isAddingNew) {
          Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
              containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
            ),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(14.dp)) {
              Text(
                text = "Add Custom Rate",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
              )

              Spacer(modifier = Modifier.height(10.dp))

              Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                Surface(
                  shape = RoundedCornerShape(8.dp),
                  color = MaterialTheme.colorScheme.surfaceVariant,
                  modifier = Modifier
                    .weight(1f)
                    .clickable {
                      // Toggle through primary travel currencies
                      val primary = listOf(Currency.USD, Currency.EUR, Currency.GBP, Currency.JPY, Currency.CAD, Currency.AUD)
                      val nextIdx = (primary.indexOf(fromCurrency) + 1).let { if (it in primary.indices) it else 0 }
                      fromCurrency = primary[nextIdx]
                    }
                    .padding(vertical = 10.dp),
                ) {
                  Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("From", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(fromCurrency.code, fontWeight = FontWeight.Bold)
                  }
                }

                Text("➔", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

                Surface(
                  shape = RoundedCornerShape(8.dp),
                  color = MaterialTheme.colorScheme.surfaceVariant,
                  modifier = Modifier
                    .weight(1f)
                    .clickable {
                      val primary = listOf(Currency.EUR, Currency.USD, Currency.JPY, Currency.GBP, Currency.CAD, Currency.CHF)
                      val nextIdx = (primary.indexOf(toCurrency) + 1).let { if (it in primary.indices) it else 0 }
                      toCurrency = primary[nextIdx]
                    }
                    .padding(vertical = 10.dp),
                ) {
                  Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("To", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(toCurrency.code, fontWeight = FontWeight.Bold)
                  }
                }
              }

              Spacer(modifier = Modifier.height(10.dp))

              OutlinedTextField(
                value = rateInput,
                onValueChange = {
                  rateInput = it
                  errorMessage = null
                },
                label = { Text("1 ${fromCurrency.code} = ? ${toCurrency.code}") },
                placeholder = { Text("e.g. 0.9250") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
                singleLine = true,
                modifier = Modifier
                  .fillMaxWidth()
                  .testTag("custom_rate_input_field")
              )

              if (errorMessage != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                  text = errorMessage!!,
                  style = MaterialTheme.typography.labelSmall,
                  color = MaterialTheme.colorScheme.error
                )
              }

              Spacer(modifier = Modifier.height(12.dp))

              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
              ) {
                if (activeOverrides.isNotEmpty()) {
                  TextButton(onClick = { isAddingNew = false }) {
                    Text("Cancel")
                  }
                  Spacer(modifier = Modifier.width(8.dp))
                }
                Button(
                  onClick = {
                    val parsed = rateInput.toBigDecimalOrNull()
                    if (parsed == null || parsed <= BigDecimal.ZERO) {
                      errorMessage = "Please enter a valid rate greater than 0"
                    } else if (fromCurrency == toCurrency) {
                      errorMessage = "Currencies must be different"
                    } else {
                      onSaveOverride(fromCurrency, toCurrency, parsed)
                      rateInput = ""
                      isAddingNew = false
                    }
                  },
                  modifier = Modifier.testTag("save_custom_rate_button")
                ) {
                  Text("Save Rate")
                }
              }
            }
          }

          Spacer(modifier = Modifier.height(12.dp))
        }

        if (activeOverrides.isNotEmpty()) {
          Text(
            text = "Active Overrides (${activeOverrides.size})",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )

          Spacer(modifier = Modifier.height(6.dp))

          LazyColumn(
            modifier = Modifier
              .fillMaxWidth()
              .height((activeOverrides.size * 54).coerceAtMost(180).dp)
          ) {
            items(activeOverrides, key = { "${it.fromCurrency.code}_${it.toCurrency.code}" }) { overrideRate ->
              Row(
                modifier = Modifier
                  .fillMaxWidth()
                  .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
              ) {
                Column {
                  Text(
                    text = "${overrideRate.fromCurrency.code} ➔ ${overrideRate.toCurrency.code}",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyMedium
                  )
                  Text(
                    text = "1 ${overrideRate.fromCurrency.code} = ${overrideRate.rate.stripTrailingZeros().toPlainString()} ${overrideRate.toCurrency.code}",
                    style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                  )
                }
                IconButton(
                  onClick = {
                    onClearOverride(overrideRate.fromCurrency, overrideRate.toCurrency)
                  },
                  modifier = Modifier.testTag("delete_override_${overrideRate.fromCurrency.code}_${overrideRate.toCurrency.code}")
                ) {
                  Icon(
                    imageVector = Icons.Rounded.Delete,
                    contentDescription = "Delete Override",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(20.dp)
                  )
                }
              }
              HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            }
          }
        } else if (!isAddingNew) {
          Text(
            text = "No custom rates currently active. Standard market exchange rates are applied.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 12.dp)
          )
        }
      }
    },
    confirmButton = {
      TextButton(
        onClick = onDismiss,
        modifier = Modifier.testTag("close_custom_rates_dialog")
      ) {
        Text("Done")
      }
    }
  )
}
