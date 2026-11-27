package com.pluto.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import java.math.BigDecimal
import java.math.RoundingMode

private fun sanitizeDecimalInput(input: String): String {
  val filtered = input.filter { it.isDigit() || it == '.' }
  val dotIndex = filtered.indexOf('.')
  return if (dotIndex == -1) {
    filtered
  } else {
    filtered.substring(0, dotIndex + 1) + filtered.substring(dotIndex + 1).replace(".", "")
  }
}

private fun formatInitialDecimalInput(amount: BigDecimal): String {
  if (amount <= BigDecimal.ZERO) return ""
  val stripped = amount.stripTrailingZeros()
  return if (stripped.scale() <= 0) stripped.toPlainString() else amount.toPlainString()
}

/**
 * Modal dialog for International Students to adjust academic term parameters,
 * allowance disbursements, and committed tuition/housing deductions.
 */
@Composable
fun TermSettingsDialog(
  userSettings: UserSettings,
  onDismiss: () -> Unit,
  onSave: (AcademicTermSettings) -> Unit
) {
  val currentTerm = userSettings.academicTermSettings
  val homeCurrency = userSettings.homeCurrency

  var termName by remember { mutableStateOf(currentTerm.termName) }
  var totalAllowanceInput by remember {
    mutableStateOf(formatInitialDecimalInput(currentTerm.totalAllowanceHome))
  }
  var committedTuitionInput by remember {
    mutableStateOf(formatInitialDecimalInput(currentTerm.tuitionAndFixedCommittedHome))
  }

  val daysRemaining = ((currentTerm.termEndDate - System.currentTimeMillis()) / 86400000L).coerceAtLeast(1L).toInt()
  var daysInput by remember { mutableIntStateOf(daysRemaining) }

  val totalAllowance = totalAllowanceInput.toBigDecimalOrNull()?.coerceAtLeast(BigDecimal.ZERO) ?: BigDecimal.ZERO
  val committedTuition = committedTuitionInput.toBigDecimalOrNull()?.coerceAtLeast(BigDecimal.ZERO) ?: BigDecimal.ZERO

  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Text(
        text = "Academic Term & Runway",
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold
      )
    },
    text = {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .verticalScroll(rememberScrollState())
          .imePadding()
          .padding(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
      ) {
        Text(
          text = "Configure your semester allowance so your daily safe-to-spend limit dynamically adapts.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        OutlinedTextField(
          value = termName,
          onValueChange = { termName = it },
          label = { Text("Semester / Term Name") },
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_name_input"),
          singleLine = true
        )

        OutlinedTextField(
          value = totalAllowanceInput,
          onValueChange = { str -> totalAllowanceInput = sanitizeDecimalInput(str) },
          label = { Text("Total Semester Allowance (${homeCurrency.code})") },
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_allowance_input"),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
          singleLine = true
        )

        OutlinedTextField(
          value = committedTuitionInput,
          onValueChange = { str -> committedTuitionInput = sanitizeDecimalInput(str) },
          label = { Text("Committed Tuition & Housing (${homeCurrency.code})") },
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_tuition_input"),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
          singleLine = true
        )

        OutlinedTextField(
          value = daysInput.toString(),
          onValueChange = { str -> daysInput = str.toIntOrNull()?.coerceAtLeast(1) ?: 1 },
          label = { Text("Days Remaining in Term") },
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_days_input"),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          singleLine = true
        )

        val discretionary = (totalAllowance - committedTuition).coerceAtLeast(BigDecimal.ZERO)
        val safeDaily = if (daysInput > 0) {
          discretionary.divide(BigDecimal(daysInput), homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
        } else {
          BigDecimal.ZERO
        }

        Surface(
          shape = PlutoShapes.medium,
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(modifier = Modifier.padding(12.dp)) {
            Text(
              text = "Projected Daily Safe-to-Spend",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
              text = "${Money.of(safeDaily, homeCurrency).format()} / day",
              style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )
          }
        }
      }
    },
    confirmButton = {
      PlutoButton(
        text = "Save Term",
        onClick = {
          val newEnd = System.currentTimeMillis() + (daysInput.toLong() * 86400000L)
          val updated = currentTerm.copy(
            termName = termName.trim().ifEmpty { "Current Semester" },
            totalAllowanceHome = totalAllowance.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN),
            tuitionAndFixedCommittedHome = committedTuition.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN),
            termEndDate = newEnd
          )
          onSave(updated)
        },
        variant = PlutoButtonVariant.PRIMARY,
        testTag = "dialog_term_save_button"
      )
    },
    dismissButton = {
      PlutoButton(
        text = "Cancel",
        onClick = onDismiss,
        variant = PlutoButtonVariant.OUTLINED,
        testTag = "dialog_term_cancel_button"
      )
    }
  )
}
