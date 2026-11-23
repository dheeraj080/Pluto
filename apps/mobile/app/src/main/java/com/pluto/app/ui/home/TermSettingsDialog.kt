package com.pluto.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.UserSettings
import java.util.Locale

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
  var totalAllowance by remember { mutableDoubleStateOf(currentTerm.totalAllowanceHome) }
  var committedTuition by remember { mutableDoubleStateOf(currentTerm.tuitionAndFixedCommittedHome) }

  val daysRemaining = ((currentTerm.termEndDate - System.currentTimeMillis()) / 86400000L).coerceAtLeast(1L).toInt()
  var daysInput by remember { mutableIntStateOf(daysRemaining) }

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
          value = if (totalAllowance > 0) totalAllowance.toInt().toString() else "",
          onValueChange = { str -> totalAllowance = str.toDoubleOrNull() ?: 0.0 },
          label = { Text("Total Semester Allowance (${homeCurrency.code})") },
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_allowance_input"),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          singleLine = true
        )

        OutlinedTextField(
          value = if (committedTuition > 0) committedTuition.toInt().toString() else "",
          onValueChange = { str -> committedTuition = str.toDoubleOrNull() ?: 0.0 },
          label = { Text("Committed Tuition & Housing (${homeCurrency.code})") },
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_tuition_input"),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          singleLine = true
        )

        OutlinedTextField(
          value = daysInput.toString(),
          onValueChange = { str -> daysInput = str.toIntOrNull()?.coerceAtLeast(1) ?: 1 },
          label = { Text("Days Remaining in Term") },
          modifier = Modifier
            .fillMaxWidth()
            .testTag("dialog_term_days_input"),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
          singleLine = true
        )

        val discretionary = (totalAllowance - committedTuition).coerceAtLeast(0.0)
        val safeDaily = if (daysInput > 0) discretionary / daysInput else 0.0

        Surface(
          shape = RoundedCornerShape(12.dp),
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
              text = "${homeCurrency.symbol}${String.format(Locale.US, "%.2f", safeDaily)} / day",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )
          }
        }
      }
    },
    confirmButton = {
      Button(
        onClick = {
          val newEnd = System.currentTimeMillis() + (daysInput.toLong() * 86400000L)
          val updated = currentTerm.copy(
            termName = termName.trim().ifEmpty { "Current Semester" },
            totalAllowanceHome = totalAllowance,
            tuitionAndFixedCommittedHome = committedTuition,
            termEndDate = newEnd
          )
          onSave(updated)
        },
        modifier = Modifier.testTag("dialog_term_save_button")
      ) {
        Text("Save Term")
      }
    },
    dismissButton = {
      OutlinedButton(
        onClick = onDismiss,
        modifier = Modifier.testTag("dialog_term_cancel_button")
      ) {
        Text("Cancel")
      }
    }
  )
}
