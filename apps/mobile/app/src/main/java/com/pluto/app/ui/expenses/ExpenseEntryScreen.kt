package com.pluto.app.ui.expenses

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.RecurrenceFrequency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.PrimaryActionButton
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ExpenseEntryScreen(
  viewModel: ExpenseViewModel,
  userSettings: UserSettings,
  onNavigateBack: () -> Unit,
  onOpenLocalCurrencyPicker: () -> Unit = {},
  onOpenHomeCurrencyPicker: () -> Unit = {},
  onExpenseSaved: (Expense) -> Unit,
  modifier: Modifier = Modifier
) {
  val formState by viewModel.formState.collectAsStateWithLifecycle()
  val isEditing = formState.isEditing
  val visitingCurrency = userSettings.destinationCurrency
  val homeCurrency = userSettings.homeCurrency

  // Ensure default currency is set to the primary spending currency if uninitialized or default USD
  LaunchedEffect(isEditing, visitingCurrency) {
    if (!isEditing && formState.amount.isBlank() && formState.localCurrency != visitingCurrency) {
      viewModel.onLocalCurrencyChanged(visitingCurrency)
    }
  }

  val photoPickerLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.PickVisualMedia(),
    onResult = { uri ->
      if (uri != null) {
        viewModel.onReceiptSelected(uri.toString())
      }
    }
  )

  var amountTouched by remember(formState.editingExpenseId) { mutableStateOf(false) }

  Column(
    modifier = modifier
      .fillMaxWidth()
      .heightIn(max = 560.dp)
      .imePadding()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 16.dp)
      .padding(top = 2.dp, bottom = 16.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp)
  ) {
    // 1. Bottom Sheet Header Row
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = if (isEditing) "Edit Expense" else "Log Expense",
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurface
        )
        Text(
          text = "Default spending currency: ${visitingCurrency.name} (${visitingCurrency.code})",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      IconButton(
        onClick = onNavigateBack,
        modifier = Modifier
          .minimumInteractiveComponentSize()
          .testTag("expense_entry_close_button")
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
      text = "REQUIRED · AMOUNT & CATEGORY",
      style = MaterialTheme.typography.labelSmall,
      fontWeight = FontWeight.Bold,
      color = MaterialTheme.colorScheme.primary
    )

    // 2. Amount Input with Integrated Currency Selector Pill
    val showAmountError = amountTouched && !formState.isValidAmount
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      // Currency Selector Pill (Clickable to change currency)
      Surface(
        shape = PlutoShapes.large,
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier
          .minimumInteractiveComponentSize()
          .clickable(role = Role.Button) { onOpenLocalCurrencyPicker() }
          .testTag("expense_currency_selector")
      ) {
        Row(
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          if (formState.localCurrency.flagEmoji.isNotBlank()) {
            Text(text = formState.localCurrency.flagEmoji, fontSize = 20.sp)
            Spacer(modifier = Modifier.width(6.dp))
          }
          Text(
            text = formState.localCurrency.code,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
          )
          Spacer(modifier = Modifier.width(4.dp))
          Icon(
            imageVector = Icons.Rounded.ArrowDropDown,
            contentDescription = "Select Currency",
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.size(20.dp)
          )
        }
      }

      // Amount Input Field
      OutlinedTextField(
        value = formState.amount,
        onValueChange = {
          amountTouched = true
          viewModel.onAmountChanged(it)
        },
        modifier = Modifier
          .weight(1f)
          .testTag("expense_entry_amount_input"),
        placeholder = { Text(formState.localCurrency.zeroPlaceholder()) },
        label = { Text("Amount (${formState.localCurrency.symbol}) *") },
        isError = showAmountError,
        supportingText = if (showAmountError) {
          { Text("Enter an amount greater than 0") }
        } else null,
        singleLine = true,
        keyboardOptions = KeyboardOptions(
          keyboardType = if (formState.localCurrency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
        ),
        textStyle = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle).copy(fontWeight = FontWeight.Bold),
        shape = PlutoShapes.large
      )
    }

    // 3. Quick Currency Suggestions (Instant One-Tap Switcher)
    FlowRow(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
      Text(
        text = "Currency:",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.align(Alignment.CenterVertically)
      )

      FilterChip(
        selected = formState.localCurrency.code.equals(visitingCurrency.code, ignoreCase = true),
        onClick = { viewModel.onLocalCurrencyChanged(visitingCurrency) },
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
          .testTag("currency_chip_visiting")
      )

      FilterChip(
        selected = formState.localCurrency.code.equals(homeCurrency.code, ignoreCase = true),
        onClick = { viewModel.onLocalCurrencyChanged(homeCurrency) },
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
          .testTag("currency_chip_home")
      )

      TextButton(
        onClick = onOpenLocalCurrencyPicker,
        modifier = Modifier
          .minimumInteractiveComponentSize()
          .testTag("currency_picker_more_button")
      ) {
        Text("More…", style = MaterialTheme.typography.labelSmall)
      }
    }

    // 3b. Transaction Date & Exchange Rate Controls
    ExpenseDateRow(
      transactionDateMillis = formState.transactionDateMillis,
      onDateChanged = viewModel::onDateChanged
    )

    ExpenseRateControlSection(
      formState = formState,
      onOpenHomeCurrencyPicker = onOpenHomeCurrencyPicker,
      onSwapCurrencies = viewModel::onSwapCurrencies,
      onRefreshLiveRate = viewModel::refreshLiveExchangeRate,
      onRefreshRateForDate = viewModel::onRefreshRateForTransactionDate,
      onRestoreOriginalRate = viewModel::onRestoreOriginalRate
    )

    formState.currencyChangeNotice?.let { notice ->
      Text(
        text = notice,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.tertiary,
        modifier = Modifier.testTag("expense_currency_change_notice")
      )
    }

    // 4. Category Selector Chips (FlowRow wraps cleanly on narrow screens)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text(
        text = "Category *",
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
          .fillMaxWidth()
          .testTag("expense_entry_category_list")
      ) {
        Category.DEFAULT_CATEGORIES.forEach { category ->
          FilterChip(
            selected = formState.category == category,
            onClick = { viewModel.onCategoryChanged(category) },
            label = {
              Text(
                category.name,
                fontWeight = if (formState.category == category) FontWeight.Bold else FontWeight.Normal
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
              .testTag("category_chip_${category.id}")
          )
        }
      }
    }

    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))

    Text(
      text = "DETAILS (OPTIONAL)",
      style = MaterialTheme.typography.labelSmall,
      fontWeight = FontWeight.Bold,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )

    // 5. Merchant / Store
    OutlinedTextField(
      value = formState.merchant,
      onValueChange = viewModel::onMerchantChanged,
      modifier = Modifier
        .fillMaxWidth()
        .testTag("expense_entry_merchant_input"),
      label = { Text("Merchant / Store") },
      placeholder = { Text("e.g. Convenience store, Café") },
      singleLine = true,
      shape = PlutoShapes.large
    )

    // 6. Note
    OutlinedTextField(
      value = formState.note,
      onValueChange = viewModel::onNoteChanged,
      modifier = Modifier
        .fillMaxWidth()
        .testTag("expense_entry_note_input"),
      label = { Text("Note") },
      placeholder = { Text("Item details, split info, etc.") },
      singleLine = true,
      shape = PlutoShapes.large
    )

    // 7. Compact Receipt Attachment (Non-nested click targets, >=48dp remove button)
    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.large,
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(start = 4.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          modifier = Modifier
            .weight(1f)
            .minimumInteractiveComponentSize()
            .clip(PlutoShapes.medium)
            .clickable(role = Role.Button) {
              photoPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
              )
            }
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .testTag("expense_receipt_picker_button"),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Icon(
            imageVector = if (formState.receiptUri != null) Icons.AutoMirrored.Rounded.ReceiptLong else Icons.Rounded.AddPhotoAlternate,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(22.dp)
          )

          Spacer(Modifier.width(12.dp))

          Text(
            text = if (formState.receiptUri != null) "Receipt attached (tap to replace)" else "Attach receipt photo",
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (formState.receiptUri != null) FontWeight.Medium else FontWeight.Normal,
            color = MaterialTheme.colorScheme.onSurface
          )

          if (formState.receiptUri == null) {
            Icon(
              Icons.AutoMirrored.Rounded.KeyboardArrowRight,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.size(20.dp)
            )
          }
        }

        if (formState.receiptUri != null) {
          IconButton(
            onClick = viewModel::onClearReceipt,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .size(48.dp)
              .testTag("expense_receipt_clear_button")
          ) {
            Icon(
              Icons.Rounded.Close,
              contentDescription = "Remove receipt",
              tint = MaterialTheme.colorScheme.error,
              modifier = Modifier.size(20.dp)
            )
          }
        }
      }
    }

    // 8. Recurring Transaction Automation Toggle
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .clip(PlutoShapes.large)
        .testTag("expense_recurring_container"),
      shape = PlutoShapes.large,
      color = if (formState.isRecurring) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
      } else {
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
      },
      border = BorderStroke(
        1.dp,
        if (formState.isRecurring) MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
        else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
      )
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.weight(1f)
          ) {
            Icon(
              imageVector = Icons.Rounded.Repeat,
              contentDescription = null,
              tint = if (formState.isRecurring) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.size(22.dp)
            )
            Column {
              Text(
                text = "Recurring Transaction",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
              )
              Text(
                text = "Automate subscriptions or fixed costs",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }

          Switch(
            checked = formState.isRecurring,
            onCheckedChange = viewModel::onRecurringToggled,
            modifier = Modifier.testTag("expense_recurring_toggle")
          )
        }

        if (formState.isRecurring) {
          HorizontalDivider(
            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
            thickness = 1.dp
          )

          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
              text = "Frequency",
              style = MaterialTheme.typography.labelMedium,
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            FlowRow(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
              RecurrenceFrequency.entries.forEach { freq ->
                val isSelected = formState.recurrenceFrequency == freq
                FilterChip(
                  selected = isSelected,
                  onClick = { viewModel.onRecurrenceFrequencyChanged(freq) },
                  label = {
                    Text(
                      text = freq.label,
                      fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                  },
                  shape = PlutoShapes.medium,
                  colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                  ),
                  modifier = Modifier
                    .heightIn(min = 48.dp)
                    .minimumInteractiveComponentSize()
                    .testTag("recurrence_freq_${freq.name.lowercase()}")
                )
              }
            }

            Text(
              text = when (formState.recurrenceFrequency) {
                RecurrenceFrequency.MONTHLY -> "Automatically logs this fixed expense on this day every month"
                RecurrenceFrequency.WEEKLY -> "Automatically logs this fixed expense every week"
                RecurrenceFrequency.YEARLY -> "Automatically logs this fixed expense once a year"
              },
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.primary,
              fontWeight = FontWeight.Medium
            )
          }
        }
      }
    }

    // 9. Validation Error Display
    formState.errorMessage?.let { error ->
      Surface(
        shape = PlutoShapes.medium,
        color = MaterialTheme.colorScheme.errorContainer,
        modifier = Modifier
          .fillMaxWidth()
          .semantics { liveRegion = LiveRegionMode.Polite }
          .testTag("expense_entry_error_banner")
      ) {
        Text(
          text = error,
          color = MaterialTheme.colorScheme.onErrorContainer,
          style = MaterialTheme.typography.bodySmall,
          fontWeight = FontWeight.Medium,
          modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
        )
      }
    }

    val canSave = formState.isValidAmount &&
      !formState.requiresExplicitRateChoice &&
      !formState.isSubmitting

    if (!canSave && !formState.isSubmitting && formState.errorMessage == null) {
      val disabledReason = when {
        !formState.isValidAmount -> "Enter a positive amount to enable saving."
        formState.requiresExplicitRateChoice -> "Choose another date or use today's live rate above to continue."
        else -> null
      }
      disabledReason?.let { reason ->
        Text(
          text = reason,
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier
            .padding(horizontal = 4.dp)
            .testTag("expense_entry_disabled_hint")
        )
      }
    }

    Spacer(modifier = Modifier.height(4.dp))

    // 10. Primary Action Button (inside verticalScroll for performScrollTo & keyboard scrollability)
    PrimaryActionButton(
      text = if (formState.isSubmitting) "Saving..."
      else if (isEditing) "Save Changes"
      else "Save Expense",
      enabled = canSave,
      isLoading = formState.isSubmitting,
      onClick = {
        amountTouched = true
        viewModel.saveExpense(onSuccess = onExpenseSaved)
      },
      testTag = "expense_entry_save_button"
    )
  }
}
