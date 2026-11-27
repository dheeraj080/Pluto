package com.pluto.app.ui.wallet

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.PrimaryActionButton
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun WalletEntryScreen(
  viewModel: WalletViewModel,
  userSettings: UserSettings? = null,
  onNavigateBack: () -> Unit,
  onOpenCurrencyPicker: (Currency) -> Unit,
  modifier: Modifier = Modifier
) {
  val formState by viewModel.formState.collectAsStateWithLifecycle()
  val isEditing = formState.isEditing

  Column(
    modifier = modifier
      .fillMaxWidth()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 24.dp)
      .padding(top = 4.dp, bottom = 24.dp)
      .navigationBarsPadding()
      .imePadding(),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    // 1. Bottom Sheet Header Row
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = if (isEditing) "Edit ${formState.currency.code} Wallet" else "Add Currency Wallet",
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurface
        )
        Text(
          text = "Holdings & Currency Accounts",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      IconButton(
        onClick = onNavigateBack,
        modifier = Modifier
          .minimumInteractiveComponentSize()
          .testTag("wallet_entry_back_button")
      ) {
        Surface(
          shape = CircleShape,
          color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
          modifier = Modifier.size(32.dp)
        ) {
          Box(contentAlignment = Alignment.Center) {
            Icon(
              imageVector = Icons.Rounded.Close,
              contentDescription = "Close",
              tint = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.size(18.dp)
            )
          }
        }
      }
    }

    Text(
      text = "Enter current funds held in this currency. Total portfolio valuation updates automatically with exchange rates.",
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )

    // 2. Card with Currency Selector and Balance Input
    PlutoCard(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.extraLarge,
      containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    ) {
      Column(modifier = Modifier.padding(18.dp)) {
        Text(
          text = "HOLDING BALANCE",
          style = MaterialTheme.typography.labelSmall,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(10.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          // Currency selector pill
          Surface(
            shape = PlutoShapes.large,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier
              .clickable(enabled = !isEditing) { onOpenCurrencyPicker(formState.currency) }
              .testTag("wallet_currency_selector")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              if (formState.currency.flagEmoji.isNotBlank()) {
                Text(text = formState.currency.flagEmoji, fontSize = 20.sp)
                Spacer(modifier = Modifier.width(6.dp))
              }
              Text(
                text = formState.currency.code,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
              )
              if (!isEditing) {
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                  imageVector = Icons.Rounded.ArrowDropDown,
                  contentDescription = "Select Currency",
                  tint = MaterialTheme.colorScheme.onPrimaryContainer,
                  modifier = Modifier.size(20.dp)
                )
              }
            }
          }

          OutlinedTextField(
            value = formState.balance,
            onValueChange = viewModel::onBalanceChanged,
            modifier = Modifier
              .weight(1f)
              .testTag("wallet_balance_input"),
            placeholder = { Text(formState.currency.zeroPlaceholder()) },
            label = { Text("Balance (${formState.currency.symbol})") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
              keyboardType = if (formState.currency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
            ),
            textStyle = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle).copy(fontWeight = FontWeight.Bold),
            shape = PlutoShapes.large
          )
        }
      }
    }

    // Quick Currency Switcher Chips (Default: Primary Spending Currency)
    val visitingCurrency = userSettings?.destinationCurrency
    val homeCurrency = userSettings?.homeCurrency

    if (!isEditing && visitingCurrency != null && homeCurrency != null) {
      FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        Text(
          text = "Currency:",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.align(Alignment.CenterVertically)
        )

        FilterChip(
          selected = formState.currency.code.equals(visitingCurrency.code, ignoreCase = true),
          onClick = { viewModel.onCurrencyChanged(visitingCurrency) },
          label = {
            Text(
              "${visitingCurrency.flagEmoji} ${visitingCurrency.code} (Primary)",
              style = MaterialTheme.typography.labelSmall
            )
          },
          shape = PlutoShapes.medium,
          colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
          ),
          modifier = Modifier
            .heightIn(min = 48.dp)
            .minimumInteractiveComponentSize()
            .testTag("wallet_currency_chip_visiting")
        )

        FilterChip(
          selected = formState.currency.code.equals(homeCurrency.code, ignoreCase = true),
          onClick = { viewModel.onCurrencyChanged(homeCurrency) },
          label = {
            Text(
              "${homeCurrency.flagEmoji} ${homeCurrency.code} (Reference)",
              style = MaterialTheme.typography.labelSmall
            )
          },
          shape = PlutoShapes.medium,
          colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
          ),
          modifier = Modifier
            .heightIn(min = 48.dp)
            .minimumInteractiveComponentSize()
            .testTag("wallet_currency_chip_home")
        )
      }
    }

    if (formState.errorMessage != null) {
      Surface(
        shape = PlutoShapes.medium,
        color = MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier.fillMaxWidth()
      ) {
        Row(
          modifier = Modifier.padding(12.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Icon(Icons.Rounded.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error)
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = formState.errorMessage ?: "",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(4.dp))

    PrimaryActionButton(
      text = when {
        formState.isSubmitting -> "Saving..."
        isEditing -> "Save Changes"
        else -> "Add Wallet"
      },
      enabled = formState.isValidBalance && !formState.isSubmitting,
      onClick = {
        viewModel.saveWallet(onSuccess = onNavigateBack)
      },
      testTag = "wallet_save_button"
    )
  }
}
