package com.pluto.app.ui.expenses

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
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

@OptIn(ExperimentalMaterial3Api::class)
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

  // Ensure default currency is set to visiting local currency if uninitialized or default USD
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

  Column(
    modifier = modifier
      .fillMaxWidth()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = 24.dp)
      .padding(top = 4.dp, bottom = 24.dp)
      .navigationBarsPadding()
      .imePadding(),
    verticalArrangement = Arrangement.spacedBy(14.dp)
  ) {
    // 1. Bottom Sheet Header Row
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column {
        Text(
          text = if (isEditing) "Edit Expense" else "Log Expense",
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurface
        )
        Text(
          text = "Default currency: ${visitingCurrency.name} (${visitingCurrency.code})",
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

    // 2. Amount Input with Integrated Currency Selector Pill
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      // Currency Selector Pill (Clickable to change currency)
      Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier
          .minimumInteractiveComponentSize()
          .clickable { onOpenLocalCurrencyPicker() }
          .testTag("expense_currency_selector")
      ) {
        Row(
          modifier = Modifier.padding(horizontal = 14.dp, vertical = 14.dp),
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
        onValueChange = viewModel::onAmountChanged,
        modifier = Modifier
          .weight(1f)
          .testTag("expense_entry_amount_input"),
        placeholder = { Text("0.00") },
        label = { Text("Amount (${formState.localCurrency.symbol})") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        textStyle = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle).copy(fontWeight = FontWeight.Bold),
        shape = RoundedCornerShape(16.dp)
      )
    }

    // 3. Quick Currency Suggestions (Instant One-Tap Switcher)
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        text = "Currency:",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      FilterChip(
        selected = formState.localCurrency.code.equals(visitingCurrency.code, ignoreCase = true),
        onClick = { viewModel.onLocalCurrencyChanged(visitingCurrency) },
        label = {
          Text(
            "${visitingCurrency.flagEmoji} ${visitingCurrency.code} (Visiting)",
            style = MaterialTheme.typography.labelSmall
          )
        },
        shape = RoundedCornerShape(10.dp),
        colors = FilterChipDefaults.filterChipColors(
          selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
          selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
        ),
        modifier = Modifier.testTag("currency_chip_visiting")
      )

      FilterChip(
        selected = formState.localCurrency.code.equals(homeCurrency.code, ignoreCase = true),
        onClick = { viewModel.onLocalCurrencyChanged(homeCurrency) },
        label = {
          Text(
            "${homeCurrency.flagEmoji} ${homeCurrency.code} (Home)",
            style = MaterialTheme.typography.labelSmall
          )
        },
        shape = RoundedCornerShape(10.dp),
        colors = FilterChipDefaults.filterChipColors(
          selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
          selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
        ),
        modifier = Modifier.testTag("currency_chip_home")
      )

      TextButton(
        onClick = onOpenLocalCurrencyPicker,
        modifier = Modifier.testTag("currency_picker_more_button")
      ) {
        Text("More…", style = MaterialTheme.typography.labelSmall)
      }
    }

    // 4. Category Selector Chips
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text(
        text = "Category",
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
          .fillMaxWidth()
          .testTag("expense_entry_category_list")
      ) {
        items(
          Category.DEFAULT_CATEGORIES,
          key = { it.id }
        ) { category ->
          FilterChip(
            selected = formState.category == category,
            onClick = { viewModel.onCategoryChanged(category) },
            label = {
              Text(
                category.name,
                fontWeight = if (formState.category == category) FontWeight.Bold else FontWeight.Normal
              )
            },
            shape = RoundedCornerShape(12.dp),
            colors = FilterChipDefaults.filterChipColors(
              selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
              selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
            ),
            modifier = Modifier.testTag("category_chip_${category.id}")
          )
        }
      }
    }

    // 5. Merchant / Store
    OutlinedTextField(
      value = formState.merchant,
      onValueChange = viewModel::onMerchantChanged,
      modifier = Modifier
        .fillMaxWidth()
        .testTag("expense_entry_merchant_input"),
      label = { Text("Merchant / Store (optional)") },
      placeholder = { Text("e.g. Convenience store, Café") },
      singleLine = true,
      shape = RoundedCornerShape(14.dp)
    )

    // 6. Note
    OutlinedTextField(
      value = formState.note,
      onValueChange = viewModel::onNoteChanged,
      modifier = Modifier
        .fillMaxWidth()
        .testTag("expense_entry_note_input"),
      label = { Text("Note (optional)") },
      placeholder = { Text("Item details, split info, etc.") },
      singleLine = true,
      shape = RoundedCornerShape(14.dp)
    )

    // 7. Compact Receipt Attachment
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(14.dp))
        .clickable {
          photoPickerLauncher.launch(
            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
          )
        },
      shape = RoundedCornerShape(14.dp),
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
      Row(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
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
          text = if (formState.receiptUri != null) "Receipt attached" else "Attach receipt photo (optional)",
          modifier = Modifier.weight(1f),
          style = MaterialTheme.typography.bodyMedium,
          fontWeight = if (formState.receiptUri != null) FontWeight.Medium else FontWeight.Normal,
          color = MaterialTheme.colorScheme.onSurface
        )

        if (formState.receiptUri != null) {
          IconButton(
            onClick = viewModel::onClearReceipt,
            modifier = Modifier.size(28.dp)
          ) {
            Icon(
              Icons.Rounded.Close,
              contentDescription = "Remove receipt",
              tint = MaterialTheme.colorScheme.error,
              modifier = Modifier.size(18.dp)
            )
          }
        } else {
          Icon(
            Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
          )
        }
      }
    }

    // 8. Recurring Transaction Automation Toggle
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(16.dp))
        .testTag("expense_recurring_container"),
      shape = RoundedCornerShape(16.dp),
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
          .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
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

            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp)
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
                  shape = RoundedCornerShape(10.dp),
                  colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                  ),
                  modifier = Modifier.testTag("recurrence_freq_${freq.name.lowercase()}")
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
      Text(
        text = error,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.padding(horizontal = 4.dp)
      )
    }

    Spacer(modifier = Modifier.height(4.dp))

    // 9. Primary Action Button
    PrimaryActionButton(
      text = if (formState.isSubmitting) "Saving..."
      else if (isEditing) "Save Changes"
      else "Save Expense",
      enabled = formState.isValidAmount && !formState.isSubmitting,
      onClick = {
        viewModel.saveExpense(onSuccess = onExpenseSaved)
      },
      testTag = "expense_entry_save_button"
    )
  }
}
