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
import androidx.compose.foundation.layout.width
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
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal

/**
 * Quick Income / Deposit Bottom Sheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickIncomeDialog(
  wallets: List<CurrencyWallet>,
  defaultCurrency: Currency? = null,
  isSubmitting: Boolean = false,
  errorMessage: String? = null,
  onClearError: () -> Unit = {},
  onDismiss: () -> Unit,
  onConfirm: (walletId: String, amount: BigDecimal, note: String) -> Unit
) {
  val initialWallet = remember(wallets, defaultCurrency) {
    if (defaultCurrency != null) {
      wallets.firstOrNull { it.currency.code.equals(defaultCurrency.code, ignoreCase = true) }
        ?: wallets.firstOrNull()
    } else {
      wallets.firstOrNull()
    }
  }
  var selectedWallet by remember { mutableStateOf(initialWallet) }
  var amountText by remember { mutableStateOf("") }
  var noteText by remember { mutableStateOf("") }
  var expanded by remember { mutableStateOf(false) }

  ModalBottomSheet(
    onDismissRequest = { if (!isSubmitting) onDismiss() },
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("quick_income_bottom_sheet")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp)
        .verticalScroll(rememberScrollState())
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "Add Income / Deposit",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "Credit funds into your travel wallet",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        IconButton(onClick = onDismiss, enabled = !isSubmitting) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }

      Spacer(modifier = Modifier.height(16.dp))

      if (wallets.isEmpty()) {
        Text("No wallets found. Please create a wallet in Wallets first.")
      } else {
        ExposedDropdownMenuBox(
          expanded = expanded,
          onExpandedChange = { expanded = it }
        ) {
          OutlinedTextField(
            value = selectedWallet?.let { "${it.currency.flagEmoji} ${it.currency.name} (${it.currency.code})" } ?: "Select Wallet",
            onValueChange = {},
            readOnly = true,
            label = { Text("Target Wallet (Default: Local)") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            shape = PlutoShapes.medium,
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
          )
          ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
          ) {
            wallets.forEach { w ->
              val isDefault = defaultCurrency != null && w.currency.code.equals(defaultCurrency.code, ignoreCase = true)
              DropdownMenuItem(
                text = {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${w.currency.flagEmoji} ${w.currency.name} (${w.currency.code}) - ${w.balance.format()}")
                    if (isDefault) {
                      Spacer(modifier = Modifier.width(6.dp))
                      Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = PlutoShapes.extraSmall
                      ) {
                        Text(
                          "Local Default",
                          modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                          style = MaterialTheme.typography.labelSmall,
                          color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                      }
                    }
                  }
                },
                onClick = {
                  selectedWallet = w
                  amountText = w.currency.normalizeForScale(amountText)
                  expanded = false
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = amountText,
          onValueChange = {
            val curr = selectedWallet?.currency ?: Currency.USD
            val sanitized = curr.sanitizeAmountInput(it) ?: return@OutlinedTextField
            amountText = sanitized
            onClearError()
          },
          label = { Text("Income Amount (${selectedWallet?.currency?.symbol ?: ""})") },
          placeholder = { Text(selectedWallet?.currency?.zeroPlaceholder() ?: "0.00") },
          singleLine = true,
          shape = PlutoShapes.medium,
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(
            keyboardType = if (selectedWallet?.currency?.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
          ),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_income_amount_input")
        )

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = noteText,
          onValueChange = { noteText = it },
          label = { Text("Source / Note (Optional)") },
          placeholder = { Text("e.g. Scholarship, Salary, ATM Cash In") },
          singleLine = true,
          shape = PlutoShapes.medium,
          modifier = Modifier.fillMaxWidth()
        )

        if (!errorMessage.isNullOrBlank()) {
          Spacer(modifier = Modifier.height(10.dp))
          Text(
            text = errorMessage,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("quick_income_error_text")
          )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.md)
        ) {
          PlutoButton(
            text = "Cancel",
            onClick = onDismiss,
            variant = PlutoButtonVariant.OUTLINED,
            enabled = !isSubmitting,
            modifier = Modifier.weight(1f)
          )
          PlutoButton(
            text = if (isSubmitting) "Saving..." else "Save Income",
            onClick = {
              val wallet = selectedWallet ?: return@PlutoButton
              val amt = amountText.toBigDecimalOrNull() ?: return@PlutoButton
              if (amt > BigDecimal.ZERO) {
                onConfirm(wallet.id, amt, noteText)
              }
            },
            variant = PlutoButtonVariant.PRIMARY,
            enabled = !isSubmitting &&
              selectedWallet != null &&
              (amountText.toBigDecimalOrNull() ?: BigDecimal.ZERO) > BigDecimal.ZERO,
            modifier = Modifier.weight(1f)
          )
        }
      }
    }
  }
}

/**
 * Quick Transfer Between Wallets Bottom Sheet
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickTransferDialog(
  wallets: List<CurrencyWallet>,
  defaultSourceCurrency: Currency? = null,
  defaultTargetCurrency: Currency? = null,
  isSubmitting: Boolean = false,
  errorMessage: String? = null,
  onClearError: () -> Unit = {},
  onDismiss: () -> Unit,
  onConfirm: (srcWalletId: String, dstWalletId: String, amount: BigDecimal, note: String) -> Unit
) {
  val initialSrc = remember(wallets, defaultSourceCurrency) {
    if (defaultSourceCurrency != null) {
      wallets.firstOrNull { it.currency.code.equals(defaultSourceCurrency.code, ignoreCase = true) }
        ?: wallets.firstOrNull()
    } else {
      wallets.firstOrNull()
    }
  }
  val initialDst = remember(wallets, defaultTargetCurrency, initialSrc) {
    if (defaultTargetCurrency != null) {
      wallets.firstOrNull { it.currency.code.equals(defaultTargetCurrency.code, ignoreCase = true) && it.id != initialSrc?.id }
        ?: wallets.firstOrNull { it.id != initialSrc?.id }
        ?: wallets.getOrNull(1)
        ?: wallets.firstOrNull()
    } else {
      wallets.firstOrNull { it.id != initialSrc?.id } ?: wallets.firstOrNull()
    }
  }

  var srcWallet by remember { mutableStateOf(initialSrc) }
  var dstWallet by remember { mutableStateOf(initialDst) }
  var amountText by remember { mutableStateOf("") }
  var noteText by remember { mutableStateOf("") }
  var srcExpanded by remember { mutableStateOf(false) }
  var dstExpanded by remember { mutableStateOf(false) }

  ModalBottomSheet(
    onDismissRequest = { if (!isSubmitting) onDismiss() },
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("quick_transfer_bottom_sheet")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 24.dp)
        .padding(bottom = 24.dp)
        .verticalScroll(rememberScrollState())
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "Transfer Between Wallets",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
          Text(
            text = "Move funds between your multi-currency travel wallets",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        IconButton(onClick = onDismiss, enabled = !isSubmitting) {
          Icon(Icons.Rounded.Close, contentDescription = "Close")
        }
      }

      Spacer(modifier = Modifier.height(16.dp))

      if (wallets.size < 2) {
        Text("At least 2 wallets are required to make transfers. Create another wallet in Wallets first.")
        Spacer(modifier = Modifier.height(16.dp))
        PlutoButton(
          text = "Got it",
          onClick = onDismiss,
          variant = PlutoButtonVariant.PRIMARY,
          modifier = Modifier.fillMaxWidth()
        )
      } else {
        ExposedDropdownMenuBox(expanded = srcExpanded, onExpandedChange = { srcExpanded = it }) {
          OutlinedTextField(
            value = srcWallet?.let { "From: ${it.currency.flagEmoji} ${it.currency.code} (${it.balance.format()})" } ?: "Select From",
            onValueChange = {},
            readOnly = true,
            label = { Text("Transfer From") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = srcExpanded) },
            shape = PlutoShapes.medium,
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
          )
          ExposedDropdownMenu(expanded = srcExpanded, onDismissRequest = { srcExpanded = false }) {
            wallets.forEach { w ->
              DropdownMenuItem(
                text = { Text("${w.currency.flagEmoji} ${w.currency.code} (${w.currency.name}) - ${w.balance.format()}") },
                onClick = {
                  srcWallet = w
                  amountText = w.currency.normalizeForScale(amountText)
                  if (dstWallet?.id == w.id) {
                    dstWallet = wallets.firstOrNull { it.id != w.id }
                  }
                  srcExpanded = false
                  onClearError()
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(12.dp))

        ExposedDropdownMenuBox(expanded = dstExpanded, onExpandedChange = { dstExpanded = it }) {
          OutlinedTextField(
            value = dstWallet?.let { "To: ${it.currency.flagEmoji} ${it.currency.code} (${it.currency.name})" } ?: "Select To",
            onValueChange = {},
            readOnly = true,
            label = { Text("Destination Wallet") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dstExpanded) },
            shape = PlutoShapes.medium,
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
          )
          ExposedDropdownMenu(expanded = dstExpanded, onDismissRequest = { dstExpanded = false }) {
            wallets.filter { it.id != srcWallet?.id }.forEach { w ->
              val isTargetDefault = defaultTargetCurrency != null && w.currency.code.equals(defaultTargetCurrency.code, ignoreCase = true)
              DropdownMenuItem(
                text = {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${w.currency.flagEmoji} ${w.currency.code} (${w.currency.name}) - ${w.balance.format()}")
                    if (isTargetDefault) {
                      Spacer(modifier = Modifier.width(6.dp))
                      Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = PlutoShapes.extraSmall
                      ) {
                        Text(
                          "Local Default",
                          modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                          style = MaterialTheme.typography.labelSmall,
                          color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                      }
                    }
                  }
                },
                onClick = {
                  dstWallet = w
                  dstExpanded = false
                  onClearError()
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = amountText,
          onValueChange = {
            val curr = srcWallet?.currency ?: Currency.USD
            val sanitized = curr.sanitizeAmountInput(it) ?: return@OutlinedTextField
            amountText = sanitized
            onClearError()
          },
          label = { Text("Amount to Send (${srcWallet?.currency?.symbol ?: ""})") },
          placeholder = { Text(srcWallet?.currency?.zeroPlaceholder() ?: "0.00") },
          singleLine = true,
          shape = PlutoShapes.medium,
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(
            keyboardType = if (srcWallet?.currency?.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
          ),
          modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
          value = noteText,
          onValueChange = { noteText = it },
          label = { Text("Transfer Note (Optional)") },
          placeholder = { Text("e.g. Travel card funding, Local FX conversion") },
          singleLine = true,
          shape = PlutoShapes.medium,
          modifier = Modifier.fillMaxWidth()
        )

        if (!errorMessage.isNullOrBlank()) {
          Spacer(modifier = Modifier.height(10.dp))
          Text(
            text = errorMessage,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("quick_transfer_error_text")
          )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.md)
        ) {
          PlutoButton(
            text = "Cancel",
            onClick = onDismiss,
            variant = PlutoButtonVariant.OUTLINED,
            enabled = !isSubmitting,
            modifier = Modifier.weight(1f)
          )
          PlutoButton(
            text = if (isSubmitting) "Transferring..." else "Execute Transfer",
            onClick = {
              val src = srcWallet ?: return@PlutoButton
              val dst = dstWallet ?: return@PlutoButton
              val amt = amountText.toBigDecimalOrNull() ?: return@PlutoButton
              if (amt > BigDecimal.ZERO && src.id != dst.id) {
                onConfirm(src.id, dst.id, amt, noteText)
              }
            },
            variant = PlutoButtonVariant.PRIMARY,
            enabled = !isSubmitting &&
              wallets.size >= 2 &&
              srcWallet?.id != dstWallet?.id &&
              (amountText.toBigDecimalOrNull() ?: BigDecimal.ZERO) > BigDecimal.ZERO,
            modifier = Modifier.weight(1f)
          )
        }
      }
    }
  }
}
