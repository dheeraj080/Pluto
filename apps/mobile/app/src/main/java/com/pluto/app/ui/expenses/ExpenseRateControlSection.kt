package com.pluto.app.ui.expenses

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Restore
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.usecase.RateUpdatePolicy
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Combines a UTC-midnight date returned by Material 3 [DatePicker] with the time-of-day from
 * [existingLocalMillis] in the device's local time zone, clamped to [nowMillis] so today's date
 * cannot accidentally drift into the future.
 */
internal fun mergeSelectedUtcDateWithLocalTime(
  selectedUtcDateMillis: Long,
  existingLocalMillis: Long,
  nowMillis: Long = System.currentTimeMillis()
): Long {
  val utcCal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
    timeInMillis = selectedUtcDateMillis
  }
  val existingLocalCal = Calendar.getInstance().apply {
    timeInMillis = existingLocalMillis
  }
  val merged = Calendar.getInstance().apply {
    set(Calendar.YEAR, utcCal.get(Calendar.YEAR))
    set(Calendar.MONTH, utcCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, utcCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, existingLocalCal.get(Calendar.HOUR_OF_DAY))
    set(Calendar.MINUTE, existingLocalCal.get(Calendar.MINUTE))
    set(Calendar.SECOND, existingLocalCal.get(Calendar.SECOND))
    set(Calendar.MILLISECOND, existingLocalCal.get(Calendar.MILLISECOND))
  }
  return minOf(merged.timeInMillis, nowMillis)
}

internal fun localMillisToUtcPickerDate(localMillis: Long): Long {
  val localCal = Calendar.getInstance().apply { timeInMillis = localMillis }
  return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
    clear()
    set(
      localCal.get(Calendar.YEAR),
      localCal.get(Calendar.MONTH),
      localCal.get(Calendar.DAY_OF_MONTH),
      0,
      0,
      0
    )
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis
}

internal fun mergeSelectedTimeWithLocalDate(
  selectedHour: Int,
  selectedMinute: Int,
  existingLocalMillis: Long,
  nowMillis: Long = System.currentTimeMillis()
): Long {
  val existingLocalCal = Calendar.getInstance().apply { timeInMillis = existingLocalMillis }
  val merged = Calendar.getInstance().apply {
    set(Calendar.YEAR, existingLocalCal.get(Calendar.YEAR))
    set(Calendar.MONTH, existingLocalCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, existingLocalCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, selectedHour)
    set(Calendar.MINUTE, selectedMinute)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }
  return minOf(merged.timeInMillis, nowMillis)
}

internal fun formatRateNumber(rate: BigDecimal, targetCurrency: Currency): String {
  val minScale = targetCurrency.decimalPlaces.coerceAtLeast(2)
  val maxScale = if (rate < BigDecimal("0.01")) 8 else 6
  val normalizedScale = rate.stripTrailingZeros().scale().coerceIn(minScale, maxScale)
  return rate.setScale(normalizedScale, RoundingMode.HALF_EVEN).toPlainString()
}

internal fun rateSourceLabel(
  source: String,
  isPreservedOriginal: Boolean = false,
  isPriorDay: Boolean = false,
  isExplicitLiveForPastDate: Boolean = false
): String {
  if (isPreservedOriginal) return "Recorded Rate"
  return when {
    source.startsWith("manual") || source == "expense_custom_rate" -> "Recorded Rate"
    isPriorDay && isExplicitLiveForPastDate && source == "open_er_api" -> "Live Rate (Past Date)"
    isPriorDay && !isExplicitLiveForPastDate && source == "open_er_api" -> "Historical Rate"
    isPriorDay && !isExplicitLiveForPastDate && source == "open_er_api_inverse" -> "Historical Inverse"
    source == "open_er_api" -> "Live Rate"
    source.endsWith("_stale") -> "Stale Cache"
    source.startsWith("derived_inverse") -> "Inverse Cached"
    source == "identity" -> "Same Currency"
    else -> "Cached Rate"
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseDateRow(
  transactionDateMillis: Long,
  onDateChanged: (Long) -> Unit,
  modifier: Modifier = Modifier
) {
  var showDatePicker by remember { mutableStateOf(false) }
  var showTimePicker by remember { mutableStateOf(false) }

  val dateLabel = remember(transactionDateMillis) {
    SimpleDateFormat("EEE, d MMM yyyy", Locale.getDefault()).format(Date(transactionDateMillis))
  }
  val timeLabel = remember(transactionDateMillis) {
    SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(transactionDateMillis))
  }
  val initialCalendar = remember(transactionDateMillis) {
    Calendar.getInstance().apply { timeInMillis = transactionDateMillis }
  }

  if (showDatePicker) {
    val todayUtcMillis = remember { localMillisToUtcPickerDate(System.currentTimeMillis()) }
    val initialSelectedUtc = remember(transactionDateMillis) {
      localMillisToUtcPickerDate(transactionDateMillis)
    }
    val datePickerState = rememberDatePickerState(
      initialSelectedDateMillis = initialSelectedUtc,
      selectableDates = object : SelectableDates {
        override fun isSelectableDate(utcTimeMillis: Long): Boolean {
          return utcTimeMillis <= todayUtcMillis
        }

        override fun isSelectableYear(year: Int): Boolean {
          val currentYear = Calendar.getInstance().get(Calendar.YEAR)
          return year <= currentYear
        }
      }
    )

    DatePickerDialog(
      onDismissRequest = { showDatePicker = false },
      confirmButton = {
        PlutoButton(
          text = "Done",
          onClick = {
            datePickerState.selectedDateMillis?.let { selectedUtc ->
              onDateChanged(
                mergeSelectedUtcDateWithLocalTime(
                  selectedUtcDateMillis = selectedUtc,
                  existingLocalMillis = transactionDateMillis
                )
              )
            }
            showDatePicker = false
          },
          variant = PlutoButtonVariant.GHOST,
          testTag = "expense_date_picker_confirm"
        )
      },
      dismissButton = {
        PlutoButton(
          text = "Cancel",
          onClick = { showDatePicker = false },
          variant = PlutoButtonVariant.GHOST
        )
      }
    ) {
      DatePicker(state = datePickerState)
    }
  }

  if (showTimePicker) {
    val timePickerState = rememberTimePickerState(
      initialHour = initialCalendar.get(Calendar.HOUR_OF_DAY),
      initialMinute = initialCalendar.get(Calendar.MINUTE),
      is24Hour = true
    )
    AlertDialog(
      onDismissRequest = { showTimePicker = false },
      confirmButton = {
        PlutoButton(
          text = "Done",
          onClick = {
            onDateChanged(
              mergeSelectedTimeWithLocalDate(
                selectedHour = timePickerState.hour,
                selectedMinute = timePickerState.minute,
                existingLocalMillis = transactionDateMillis
              )
            )
            showTimePicker = false
          },
          variant = PlutoButtonVariant.GHOST,
          testTag = "expense_time_picker_confirm"
        )
      },
      dismissButton = {
        PlutoButton(
          text = "Cancel",
          onClick = { showTimePicker = false },
          variant = PlutoButtonVariant.GHOST
        )
      }
    ) {
      TimePicker(state = timePickerState)
    }
  }

  Column(modifier = modifier.fillMaxWidth()) {
    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .minimumInteractiveComponentSize()
        .clip(PlutoShapes.large)
        .clickable { showDatePicker = true }
        .testTag("expense_date_selector"),
      shape = PlutoShapes.large,
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f))
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          modifier = Modifier.weight(1f)
        ) {
          Icon(
            imageVector = Icons.Rounded.CalendarToday,
            contentDescription = "Transaction date",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp)
          )
          Column {
            Text(
              text = "Transaction Date",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
              text = dateLabel,
              style = MaterialTheme.typography.bodyMedium,
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSurface
            )
          }
        }
        Text(
          text = "Change",
          style = MaterialTheme.typography.labelMedium,
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary
        )
      }
    }

    Spacer(modifier = Modifier.size(8.dp))

    Surface(
      modifier = Modifier
        .fillMaxWidth()
        .minimumInteractiveComponentSize()
        .clip(PlutoShapes.large)
        .clickable { showTimePicker = true }
        .testTag("expense_time_selector"),
      shape = PlutoShapes.large,
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f))
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          modifier = Modifier.weight(1f)
        ) {
          Icon(
            imageVector = Icons.Rounded.Timer,
            contentDescription = "Transaction time",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp)
          )
          Column {
            Text(
              text = "Transaction Time",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
              text = timeLabel,
              style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSurface
            )
          }
        }
        Text(
          text = "Change",
          style = MaterialTheme.typography.labelMedium,
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary
        )
      }
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ExpenseRateControlSection(
  formState: ExpenseEntryFormState,
  onOpenHomeCurrencyPicker: () -> Unit,
  onSwapCurrencies: () -> Unit,
  onRefreshLiveRate: () -> Unit,
  onRefreshRateForDate: () -> Unit,
  onRestoreOriginalRate: () -> Unit,
  modifier: Modifier = Modifier
) {
  val isForeign = formState.localCurrency != formState.homeCurrency
  val preview = formState.conversionPreview
  val pairMatchesPreserved = formState.isEditing &&
    formState.preservedOriginalRate != null &&
    formState.preservedOriginalRate.fromCurrency == formState.localCurrency &&
    formState.preservedOriginalRate.toCurrency == formState.homeCurrency
  val isPreservingSnapshot = pairMatchesPreserved &&
    formState.rateUpdatePolicy == RateUpdatePolicy.PRESERVE_EXISTING

  val isPriorDay = formState.isPriorDayTransaction
  val isExplicitLiveForPastDate = isPriorDay &&
    formState.rateUpdatePolicy == RateUpdatePolicy.REFRESH_LIVE &&
    !isPreservingSnapshot

  if (!isForeign) {
    Surface(
      modifier = modifier.fillMaxWidth(),
      shape = PlutoShapes.large,
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = "No conversion needed (1:1 ${formState.homeCurrency.code})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
          )
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f),
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .clip(PlutoShapes.medium)
              .clickable { onOpenHomeCurrencyPicker() }
              .testTag("expense_home_currency_selector")
          ) {
            Text(
              text = "Home: ${formState.homeCurrency.code}",
              style = MaterialTheme.typography.labelMedium,
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSecondaryContainer,
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
            )
          }
        }
        if (formState.isEditing &&
          formState.preservedOriginalRate != null &&
          formState.preservedOriginalRate.fromCurrency != formState.preservedOriginalRate.toCurrency
        ) {
          FilterChip(
            selected = false,
            onClick = onRestoreOriginalRate,
            leadingIcon = {
              Icon(
                imageVector = Icons.Rounded.Restore,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
              )
            },
            label = { Text("Keep Original", style = MaterialTheme.typography.labelSmall) },
            shape = PlutoShapes.medium,
            modifier = Modifier
              .heightIn(min = 48.dp)
              .minimumInteractiveComponentSize()
              .testTag("expense_restore_original_rate_button")
          )
        }
      }
    }
    return
  }

  Surface(
    modifier = modifier
      .fillMaxWidth()
      .testTag("expense_rate_control_card"),
    shape = PlutoShapes.large,
    color = if (preview.isRateUnavailable) {
      MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.35f)
    } else {
      MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.35f)
    },
    border = BorderStroke(
      1.dp,
      if (preview.isRateUnavailable) {
        MaterialTheme.colorScheme.error.copy(alpha = 0.45f)
      } else {
        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
      }
    )
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      // 1. Converted Home Total + Currency Swap / Home Picker
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "Converted in ${formState.homeCurrency.code}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          if (preview.isLoading) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              modifier = Modifier.padding(top = 2.dp)
            ) {
              CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
              Text(
                text = "Looking up exchange rate...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          } else {
            val amountText = preview.convertedMoney?.format()?.let { "≈ $it" }
              ?: if (preview.isRateUnavailable) {
                "Rate required"
              } else {
                "Enter amount to convert"
              }
            Text(
              text = amountText,
              style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = if (preview.isRateUnavailable) {
                MaterialTheme.colorScheme.error
              } else {
                MaterialTheme.colorScheme.onSurface
              },
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.testTag("expense_converted_amount_text")
            )
          }
        }

        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
          IconButton(
            onClick = onSwapCurrencies,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("expense_swap_currencies_button")
          ) {
            Icon(
              imageVector = Icons.Rounded.SwapHoriz,
              contentDescription = "Swap local and home currencies",
              tint = MaterialTheme.colorScheme.primary
            )
          }

          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .clip(PlutoShapes.medium)
              .clickable { onOpenHomeCurrencyPicker() }
              .testTag("expense_home_currency_selector")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
              if (formState.homeCurrency.flagEmoji.isNotBlank()) {
                Text(text = formState.homeCurrency.flagEmoji)
              }
              Text(
                text = formState.homeCurrency.code,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
              )
            }
          }
        }
      }

      // 2. Rate Line + Source Provenance Badge
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "Exchange Rate",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          Text(
            text = preview.rateFormatted ?: "1 ${formState.localCurrency.code} = — ${formState.homeCurrency.code}",
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("expense_rate_display_text")
          )
        }

        val badgeSource = preview.exchangeRate?.source
        if (badgeSource != null) {
          val label = rateSourceLabel(
            source = badgeSource,
            isPreservedOriginal = isPreservingSnapshot,
            isPriorDay = isPriorDay,
            isExplicitLiveForPastDate = isExplicitLiveForPastDate
          )
          val isStale = badgeSource?.endsWith("_stale") == true && !isPreservingSnapshot
          Surface(
            shape = PlutoShapes.small,
            color = when {
              isPreservingSnapshot -> MaterialTheme.colorScheme.primaryContainer
              isStale || isExplicitLiveForPastDate -> MaterialTheme.colorScheme.tertiaryContainer
              else -> MaterialTheme.colorScheme.surface
            },
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
            modifier = Modifier.testTag("expense_rate_source_badge")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
              if (isPreservingSnapshot) {
                Icon(
                  imageVector = Icons.Rounded.Lock,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.onPrimaryContainer,
                  modifier = Modifier.size(12.dp)
                )
              }
              Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = when {
                  isPreservingSnapshot -> MaterialTheme.colorScheme.onPrimaryContainer
                  isStale || isExplicitLiveForPastDate -> MaterialTheme.colorScheme.onTertiaryContainer
                  else -> MaterialTheme.colorScheme.onSurface
                }
              )
            }
          }
        }
      }

      if (isPreservingSnapshot) {
        Text(
          text = "Preserving this expense's original exchange rate when editing amount or date.",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.primary
        )
      } else if (isExplicitLiveForPastDate && preview.exchangeRate != null && !preview.isRateUnavailable) {
        Text(
          text = "Using today's live rate for an earlier date by your explicit choice.",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.tertiary
        )
      }

      // 3. Rate Controls (Refresh Live, Date Lookup, Keep Original)
      FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
      ) {
        FilterChip(
          selected = formState.rateUpdatePolicy == RateUpdatePolicy.REFRESH_LIVE,
          onClick = onRefreshLiveRate,
          enabled = !formState.isRefreshingRate,
          leadingIcon = {
            if (formState.isRefreshingRate) {
              CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
            } else {
              Icon(
                imageVector = Icons.Rounded.Refresh,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
              )
            }
          },
          label = {
            Text(
              text = when {
                formState.isRefreshingRate -> "Updating…"
                isPriorDay -> "Use Live Rate"
                else -> "Refresh Live"
              },
              style = MaterialTheme.typography.labelSmall
            )
          },
          shape = PlutoShapes.medium,
          modifier = Modifier
            .heightIn(min = 48.dp)
            .minimumInteractiveComponentSize()
            .testTag("expense_refresh_rate_button")
        )

        if (formState.isEditing && !isPreservingSnapshot && formState.preservedOriginalRate != null) {
          FilterChip(
            selected = false,
            onClick = onRestoreOriginalRate,
            leadingIcon = {
              Icon(
                imageVector = Icons.Rounded.Restore,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
              )
            },
            label = { Text("Keep Original", style = MaterialTheme.typography.labelSmall) },
            shape = PlutoShapes.medium,
            modifier = Modifier
              .heightIn(min = 48.dp)
              .minimumInteractiveComponentSize()
              .testTag("expense_restore_original_rate_button")
          )
        } else if (formState.isEditing && isPreservingSnapshot) {
          FilterChip(
            selected = false,
            onClick = onRefreshRateForDate,
            leadingIcon = {
              Icon(
                imageVector = Icons.Rounded.History,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
              )
            },
            label = { Text("Use Date Rate", style = MaterialTheme.typography.labelSmall) },
            shape = PlutoShapes.medium,
            modifier = Modifier
              .heightIn(min = 48.dp)
              .minimumInteractiveComponentSize()
              .testTag("expense_lookup_date_rate_button")
          )
        }
      }

      // 4. Rate Unavailable Fallback Actions
      if (preview.isRateUnavailable && !preview.isLoading) {
        val isHistoricalMiss = isPriorDay && formState.rateUpdatePolicy != RateUpdatePolicy.REFRESH_LIVE
        Column(
          modifier = Modifier.fillMaxWidth(),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            Icon(
              imageVector = Icons.Rounded.WarningAmber,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.error,
              modifier = Modifier.size(18.dp)
            )
            Text(
              text = if (isHistoricalMiss) {
                "No historical rate available for this date. Choose another date or explicitly use today's live rate."
              } else {
                "Rate unavailable offline. Retry or use today's live rate."
              },
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.error,
              modifier = Modifier
                .weight(1f)
                .testTag("expense_rate_unavailable_message")
            )
          }

          FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm),
            verticalArrangement = Arrangement.spacedBy(PlutoSpacing.sm)
          ) {
            PlutoButton(
              text = if (isHistoricalMiss) "Use Live Rate" else "Retry",
              onClick = onRefreshLiveRate,
              enabled = !formState.isRefreshingRate,
              variant = PlutoButtonVariant.OUTLINED,
              testTag = if (isHistoricalMiss) "expense_use_live_rate_button" else "expense_retry_rate_button"
            )
          }
        }
      }
    }
  }
}
