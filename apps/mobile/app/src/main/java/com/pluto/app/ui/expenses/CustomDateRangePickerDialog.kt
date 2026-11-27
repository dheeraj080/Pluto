package com.pluto.app.ui.expenses

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomDateRangePickerDialog(
  initialStartDateMillis: Long?,
  initialEndDateMillis: Long?,
  onDismiss: () -> Unit,
  onConfirm: (startMillis: Long, endMillis: Long) -> Unit
) {
  val dateRangePickerState = rememberDateRangePickerState(
    initialSelectedStartDateMillis = initialStartDateMillis,
    initialSelectedEndDateMillis = initialEndDateMillis
  )

  DatePickerDialog(
    onDismissRequest = onDismiss,
    confirmButton = {
      TextButton(
        onClick = {
          val start = dateRangePickerState.selectedStartDateMillis
          val end = dateRangePickerState.selectedEndDateMillis ?: start
          if (start != null && end != null) {
            val localStart = utcMillisToLocalDayStart(start)
            val localEnd = utcMillisToLocalDayEnd(end)
            onConfirm(localStart, localEnd)
          }
        },
        enabled = dateRangePickerState.selectedStartDateMillis != null,
        modifier = Modifier.testTag("date_range_picker_apply")
      ) {
        Text("Apply")
      }
    },
    dismissButton = {
      TextButton(
        onClick = onDismiss,
        modifier = Modifier.testTag("date_range_picker_cancel")
      ) {
        Text("Cancel")
      }
    },
    modifier = Modifier.testTag("custom_date_range_dialog")
  ) {
    DateRangePicker(
      state = dateRangePickerState,
      modifier = Modifier
        .fillMaxWidth()
        .weight(1f, fill = false),
      title = {
        Text(
          text = "Select Date Range",
          modifier = Modifier.padding(start = 24.dp, top = 16.dp, end = 24.dp),
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold
        )
      }
    )
  }
}

internal fun utcMillisToLocalDayStart(utcMillis: Long): Long {
  val utcCal = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
    timeInMillis = utcMillis
  }
  return Calendar.getInstance().apply {
    set(Calendar.YEAR, utcCal.get(Calendar.YEAR))
    set(Calendar.MONTH, utcCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, utcCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis
}

internal fun utcMillisToLocalDayEnd(utcMillis: Long): Long {
  val utcCal = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
    timeInMillis = utcMillis
  }
  return Calendar.getInstance().apply {
    set(Calendar.YEAR, utcCal.get(Calendar.YEAR))
    set(Calendar.MONTH, utcCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, utcCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, 23)
    set(Calendar.MINUTE, 59)
    set(Calendar.SECOND, 59)
    set(Calendar.MILLISECOND, 999)
  }.timeInMillis
}

internal fun localDayToUtcMidnight(localMillis: Long): Long {
  val localCal = Calendar.getInstance().apply {
    timeInMillis = localMillis
  }
  return Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC")).apply {
    set(Calendar.YEAR, localCal.get(Calendar.YEAR))
    set(Calendar.MONTH, localCal.get(Calendar.MONTH))
    set(Calendar.DAY_OF_MONTH, localCal.get(Calendar.DAY_OF_MONTH))
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis
}

internal fun formatCustomDateRangeLabel(startMillis: Long, endMillis: Long?): String {
  val startCal = Calendar.getInstance().apply { timeInMillis = startMillis }
  val endCal = Calendar.getInstance().apply { timeInMillis = endMillis ?: startMillis }

  val startDay = startCal.get(Calendar.DAY_OF_MONTH)
  val endDay = endCal.get(Calendar.DAY_OF_MONTH)
  val startMonth = SimpleDateFormat("MMM", Locale.getDefault()).format(startCal.time)
  val endMonth = SimpleDateFormat("MMM", Locale.getDefault()).format(endCal.time)

  return if (startCal.get(Calendar.YEAR) == endCal.get(Calendar.YEAR)) {
    if (startCal.get(Calendar.DAY_OF_YEAR) == endCal.get(Calendar.DAY_OF_YEAR)) {
      "$startDay $startMonth"
    } else if (startCal.get(Calendar.MONTH) == endCal.get(Calendar.MONTH)) {
      "$startDay–$endDay $startMonth"
    } else {
      "$startDay $startMonth–$endDay $endMonth"
    }
  } else {
    val startYr = startCal.get(Calendar.YEAR) % 100
    val endYr = endCal.get(Calendar.YEAR) % 100
    "$startDay $startMonth '$startYr–$endDay $endMonth '$endYr"
  }
}
