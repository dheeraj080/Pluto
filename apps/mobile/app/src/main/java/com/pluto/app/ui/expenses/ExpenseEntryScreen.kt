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
import androidx.compose.material3.SelectableChipColors
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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

  val photoPickerLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.PickVisualMedia(),
    onResult = { uri -> uri?.let { viewModel.onReceiptSelected(it.toString()) } }
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
    ExpenseEntryHeader(
      isEditing = isEditing,
      onClose = onNavigateBack
    )

    AmountAndCurrencySection(
      formState = formState,
      visitingCurrency = visitingCurrency,
      homeCurrency = homeCurrency,
      isEditing = isEditing,
      showAmountError = amountTouched && !formState.isValidAmount,
      onAmountChanged = {
        amountTouched = true
        viewModel.onAmountChanged(it)
      },
      onLocalCurrencyChanged = viewModel::onLocalCurrencyChanged,
      onOpenLocalCurrencyPicker = onOpenLocalCurrencyPicker
    )

    ExpenseDateRow(
      transactionDateMillis = formState.transactionDateMillis,
      onDateChanged = viewModel::onDateChanged
    )

    ExpenseRateControlSection(
      formState = formState,
      currencyChangeNotice = formState.currencyChangeNotice,
      onOpenHomeCurrencyPicker = onOpenHomeCurrencyPicker,
      onSwapCurrencies = viewModel::onSwapCurrencies,
      onRefreshLiveRate = viewModel::refreshLiveExchangeRate,
      onRefreshRateForDate = viewModel::onRefreshRateForTransactionDate,
      onRestoreOriginalRate = viewModel::onRestoreOriginalRate
    )

    CategorySelectorSection(
      selectedCategory = formState.category,
      onCategorySelected = viewModel::onCategoryChanged
    )

    OptionalDetailsSection(
      merchant = formState.merchant,
      note = formState.note,
      receiptUri = formState.receiptUri,
      onMerchantChanged = viewModel::onMerchantChanged,
      onNoteChanged = viewModel::onNoteChanged,
      onPickReceipt = {
        photoPickerLauncher.launch(
          PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
        )
      },
      onClearReceipt = viewModel::onClearReceipt
    )

    RecurringTransactionSection(
      isRecurring = formState.isRecurring,
      frequency = formState.recurrenceFrequency,
      onRecurringToggled = viewModel::onRecurringToggled,
      onFrequencyChanged = viewModel::onRecurrenceFrequencyChanged
    )

    SaveFooterSection(
      formState = formState,
      isEditing = isEditing,
      onSave = {
        amountTouched = true
        viewModel.saveExpense(onSuccess = onExpenseSaved)
      }
    )
  }
}

@Composable
private fun ExpenseEntryHeader(
  isEditing: Boolean,
  onClose: () -> Unit
) {
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
    }

    IconButton(
      onClick = onClose,
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
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AmountAndCurrencySection(
  formState: ExpenseFormState,
  visitingCurrency: Currency,
  homeCurrency: Currency,
  isEditing: Boolean,
  showAmountError: Boolean,
  onAmountChanged: (String) -> Unit,
  onLocalCurrencyChanged: (Currency) -> Unit,
  onOpenLocalCurrencyPicker: () -> Unit
) {
  val primaryChipCurrency = if (isEditing) formState.localCurrency else visitingCurrency
  val referenceChipCurrency = if (isEditing) formState.homeCurrency else homeCurrency

  Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      CurrencySelectorPill(
        currency = formState.localCurrency,
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        showDropdown = true,
        onClick = onOpenLocalCurrencyPicker,
        modifier = Modifier.testTag("expense_currency_selector")
      )

      OutlinedTextField(
        value = formState.amount,
        onValueChange = onAmountChanged,
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
          keyboardType = if (formState.localCurrency.decimalPlaces == 0) {
            KeyboardType.Number
          } else {
            KeyboardType.Decimal
          }
        ),
        textStyle = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle)
          .copy(fontWeight = FontWeight.Bold),
        shape = PlutoShapes.large
      )
    }

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

      PlutoFilterChip(
        selected = formState.localCurrency == primaryChipCurrency,
        onClick = { onLocalCurrencyChanged(primaryChipCurrency) },
        label = "${primaryChipCurrency.flagEmoji} ${primaryChipCurrency.code} (Primary)",
        testTag = "currency_chip_visiting"
      )

      PlutoFilterChip(
        selected = formState.localCurrency == referenceChipCurrency,
        onClick = { onLocalCurrencyChanged(referenceChipCurrency) },
        label = "${referenceChipCurrency.flagEmoji} ${referenceChipCurrency.code} (Reference)",
        testTag = "currency_chip_home"
      )
    }

    if (isEditing) {
      Text(
        text = "Editing uses the recorded currency pair. New entries use your defaults.",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CategorySelectorSection(
  selectedCategory: Category,
  onCategorySelected: (Category) -> Unit
) {
  var showAllCategories by remember { mutableStateOf(false) }
  val commonCategories = listOf(
    Category.FOOD,
    Category.GROCERIES,
    Category.TRANSPORT,
    Category.ACCOMMODATION,
    Category.SHOPPING,
    Category.HEALTH,
    Category.BILLS,
    Category.OTHER
  )
  val visibleCategories = if (showAllCategories) {
    Category.DEFAULT_CATEGORIES
  } else {
    (listOf(selectedCategory) + commonCategories).distinctBy { it.id }
  }

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
      visibleCategories.forEach { category ->
        PlutoFilterChip(
          selected = selectedCategory == category,
          onClick = { onCategorySelected(category) },
          label = category.name,
          testTag = "category_chip_${category.id}"
        )
      }
    }

    TextButton(
      onClick = { showAllCategories = !showAllCategories },
      modifier = Modifier.minimumInteractiveComponentSize()
    ) {
      Text(
        text = if (showAllCategories) "Fewer categories" else "More categories",
        style = MaterialTheme.typography.labelSmall
      )
    }
  }
}

@Composable
private fun OptionalDetailsSection(
  merchant: String,
  note: String,
  receiptUri: String?,
  onMerchantChanged: (String) -> Unit,
  onNoteChanged: (String) -> Unit,
  onPickReceipt: () -> Unit,
  onClearReceipt: () -> Unit
) {
  var showTextFields by remember { mutableStateOf(false) }

  Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
    TextButton(
      onClick = { showTextFields = !showTextFields },
      modifier = Modifier.minimumInteractiveComponentSize()
    ) {
      Text(
        text = if (showTextFields) "Hide merchant and note" else "Add merchant or note",
        style = MaterialTheme.typography.labelSmall
      )
    }

    if (showTextFields) {
      OutlinedTextField(
        value = merchant,
        onValueChange = onMerchantChanged,
        modifier = Modifier
          .fillMaxWidth()
          .testTag("expense_entry_merchant_input"),
        label = { Text("Merchant / Store") },
        placeholder = { Text("e.g. Convenience store, Café") },
        singleLine = true,
        shape = PlutoShapes.large
      )

      OutlinedTextField(
        value = note,
        onValueChange = onNoteChanged,
        modifier = Modifier
          .fillMaxWidth()
          .testTag("expense_entry_note_input"),
        label = { Text("Note") },
        placeholder = { Text("Item details, split info, etc.") },
        singleLine = true,
        shape = PlutoShapes.large
      )
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = PlutoShapes.large,
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          modifier = Modifier
            .weight(1f)
            .minimumInteractiveComponentSize()
            .clip(PlutoShapes.medium)
            .clickable(role = Role.Button, onClick = onPickReceipt)
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .testTag("expense_receipt_picker_button"),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Icon(
            imageVector = if (receiptUri != null) {
              Icons.AutoMirrored.Rounded.ReceiptLong
            } else {
              Icons.Rounded.AddPhotoAlternate
            },
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(22.dp)
          )

          Spacer(Modifier.width(12.dp))

          Text(
            text = if (receiptUri != null) {
              "Receipt attached (tap to replace)"
            } else {
              "Attach receipt photo"
            },
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (receiptUri != null) FontWeight.Medium else FontWeight.Normal,
            color = MaterialTheme.colorScheme.onSurface
          )

          if (receiptUri == null) {
            Icon(
              Icons.AutoMirrored.Rounded.KeyboardArrowRight,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.size(20.dp)
            )
          }
        }

        if (receiptUri != null) {
          IconButton(
            onClick = onClearReceipt,
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
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecurringTransactionSection(
  isRecurring: Boolean,
  frequency: RecurrenceFrequency,
  onRecurringToggled: (Boolean) -> Unit,
  onFrequencyChanged: (RecurrenceFrequency) -> Unit
) {
  Surface(
    modifier = Modifier
      .fillMaxWidth()
      .clip(PlutoShapes.large)
      .testTag("expense_recurring_container"),
    shape = PlutoShapes.large,
    color = if (isRecurring) {
      MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
    } else {
      MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
    },
    border = BorderStroke(
      1.dp,
      if (isRecurring) {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
      } else {
        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f)
      }
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
            tint = if (isRecurring) {
              MaterialTheme.colorScheme.primary
            } else {
              MaterialTheme.colorScheme.onSurfaceVariant
            },
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
              text = "Repeat this expense on a schedule",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        Switch(
          checked = isRecurring,
          onCheckedChange = onRecurringToggled,
          modifier = Modifier.testTag("expense_recurring_toggle")
        )
      }

      if (isRecurring) {
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
              PlutoFilterChip(
                selected = frequency == freq,
                onClick = { onFrequencyChanged(freq) },
                label = freq.label,
                testTag = "recurrence_freq_${freq.name.lowercase()}",
                colors = FilterChipDefaults.filterChipColors(
                  selectedContainerColor = MaterialTheme.colorScheme.primary,
                  selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                )
              )
            }
          }

          Text(
            text = when (frequency) {
              RecurrenceFrequency.MONTHLY -> "Repeats monthly on this day"
              RecurrenceFrequency.WEEKLY -> "Repeats weekly"
              RecurrenceFrequency.YEARLY -> "Repeats yearly"
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Medium
          )
        }
      }
    }
  }
}

@Composable
private fun SaveFooterSection(
  formState: ExpenseFormState,
  isEditing: Boolean,
  onSave: () -> Unit
) {
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
      formState.requiresExplicitRateChoice -> "Choose another date or use today's market rate to save."
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

  PrimaryActionButton(
    text = when {
      formState.isSubmitting -> "Saving..."
      isEditing -> "Save Changes"
      else -> "Save Expense"
    },
    enabled = canSave,
    isLoading = formState.isSubmitting,
    onClick = onSave,
    testTag = "expense_entry_save_button"
  )
}

@Composable
internal fun CurrencySelectorPill(
  currency: Currency,
  containerColor: Color,
  contentColor: Color,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  showDropdown: Boolean = false
) {
  Surface(
    shape = PlutoShapes.large,
    color = containerColor,
    modifier = modifier
      .minimumInteractiveComponentSize()
      .clickable(role = Role.Button, onClick = onClick)
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (currency.flagEmoji.isNotBlank()) {
        Text(text = currency.flagEmoji, fontSize = 20.sp)
        Spacer(modifier = Modifier.width(6.dp))
      }
      Text(
        text = currency.code,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = contentColor
      )
      if (showDropdown) {
        Spacer(modifier = Modifier.width(4.dp))
        Icon(
          imageVector = Icons.Rounded.ArrowDropDown,
          contentDescription = "Select Currency",
          tint = contentColor,
          modifier = Modifier.size(20.dp)
        )
      }
    }
  }
}

@Composable
private fun PlutoFilterChip(
  selected: Boolean,
  onClick: () -> Unit,
  label: String,
  testTag: String,
  colors: SelectableChipColors = FilterChipDefaults.filterChipColors(
    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
  )
) {
  FilterChip(
    selected = selected,
    onClick = onClick,
    label = {
      Text(
        text = label,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
      )
    },
    shape = PlutoShapes.medium,
    colors = colors,
    modifier = Modifier
      .heightIn(min = 48.dp)
      .minimumInteractiveComponentSize()
      .testTag(testTag)
  )
}