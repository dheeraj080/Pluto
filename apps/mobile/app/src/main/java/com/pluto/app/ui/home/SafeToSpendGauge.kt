package com.pluto.app.ui.home

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Dialog enabling the user to configure their custom minimum Safe-to-Spend warning threshold
 * and manage threshold warning push notifications.
 *
 * Displays values in both:
 * 1. Primary: Trip Currency (Current country)
 * 2. Secondary: Home Currency
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SafeToSpendThresholdDialog(
  userSettings: UserSettings,
  summary: DashboardSummary,
  onDismiss: () -> Unit,
  onSave: (BigDecimal?, Boolean) -> Unit,
  onTestNotification: () -> Boolean,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency

  var thresholdInput by remember {
    mutableStateOf(
      userSettings.safeToSpendWarningThreshold?.let { threshold ->
        val stripped = threshold.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN).stripTrailingZeros()
        if (stripped.scale() <= 0) stripped.toPlainString() else threshold.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN).toPlainString()
      } ?: "20"
    )
  }
  var notificationsEnabled by remember {
    mutableStateOf(userSettings.warningNotificationsEnabled)
  }
  var testNotificationMessage by remember { mutableStateOf<String?>(null) }

  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { isGranted ->
    notificationsEnabled = isGranted
    if (!isGranted) {
      testNotificationMessage = "Permission denied in system settings"
    }
  }

  val parsedHomeAmount = thresholdInput.toBigDecimalOrNull()
  val convertedTripAmountText = remember(parsedHomeAmount, summary.destinationCurrency, summary.warningThresholdDest, summary.dailySpendingCapDest, userSettings.dailySpendingCap) {
    if (parsedHomeAmount != null && parsedHomeAmount > BigDecimal.ZERO) {
      val rate = summary.dailySpendingCapDest?.let { capDest ->
        val capHome = userSettings.dailySpendingCap
        if (capHome != null && capHome > BigDecimal.ZERO) {
          capDest.amount.divide(capHome, 6, RoundingMode.HALF_EVEN)
        } else null
      }
      if (rate != null) {
        val destAmount = parsedHomeAmount.multiply(rate).setScale(destCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
        "${Money.of(destAmount, destCurrency).format()} ${destCurrency.code}"
      } else {
        null
      }
    } else null
  }

  AlertDialog(
    onDismissRequest = onDismiss,
    modifier = modifier.testTag("threshold_config_dialog"),
    icon = {
      Icon(
        imageVector = Icons.Rounded.NotificationsActive,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.tertiary,
        modifier = Modifier.size(28.dp)
      )
    },
    title = {
      Text(
        text = "Safe-to-Spend Threshold",
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center
      )
    },
    text = {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .verticalScroll(rememberScrollState())
          .imePadding(),
        verticalArrangement = Arrangement.spacedBy(PlutoSpacing.md)
      ) {
        Text(
          text = "Set a minimum daily safety buffer. If your remaining safe-to-spend allowance drops below this limit, the gauge turns warning amber and sends you a heads-up alert.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Dual-currency preview badge
        Surface(
          shape = PlutoShapes.medium,
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(
            modifier = Modifier.padding(PlutoSpacing.md),
            verticalArrangement = Arrangement.spacedBy(PlutoSpacing.xs)
          ) {
            Text(
              text = "Threshold Dual-Currency Preview:",
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            val homePreview = "${homeCurrency.symbol}${thresholdInput.ifBlank { "0" }} ${homeCurrency.code} (Home)"
            val tripPreview = convertedTripAmountText?.let { "≈ $it (Trip Currency)" } ?: "≈ in ${destCurrency.code}"
            Text(
              text = "1. Trip: $tripPreview",
              style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
              text = "2. Home: $homePreview",
              style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
            )
          }
        }

        // Custom threshold input
        OutlinedTextField(
          value = thresholdInput,
          onValueChange = { input ->
            val filtered = input.filter { it.isDigit() || it == '.' }
            val dotIndex = filtered.indexOf('.')
            thresholdInput = if (dotIndex == -1) {
              filtered
            } else {
              filtered.substring(0, dotIndex + 1) + filtered.substring(dotIndex + 1).replace(".", "")
            }
          },
          label = { Text("Minimum buffer in ${homeCurrency.code} (${homeCurrency.symbol})") },
          leadingIcon = { Text(text = homeCurrency.symbol, fontWeight = FontWeight.Bold) },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
          singleLine = true,
          shape = PlutoShapes.medium,
          modifier = Modifier
            .fillMaxWidth()
            .imePadding()
            .testTag("threshold_input_field")
        )

        // Quick presets
        FlowRow(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm),
          verticalArrangement = Arrangement.spacedBy(PlutoSpacing.xs)
        ) {
          listOf(10, 20, 50, 100).forEach { presetInt ->
            val preset = BigDecimal(presetInt)
            val isSelected = parsedHomeAmount != null && parsedHomeAmount.compareTo(preset) == 0
            FilterChip(
              selected = isSelected,
              onClick = { thresholdInput = presetInt.toString() },
              label = { Text("${homeCurrency.symbol}$presetInt") },
              modifier = Modifier
                .heightIn(min = 48.dp)
                .minimumInteractiveComponentSize()
                .testTag("threshold_preset_$presetInt")
            )
          }
        }

        // Notification Switch Row
        Surface(
          shape = PlutoShapes.medium,
          color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = PlutoSpacing.md, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Column(modifier = Modifier.weight(1f)) {
              Text(
                text = "Alert Notifications",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
              )
              Text(
                text = "Push alert when daily safe spend drops below threshold",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
            Switch(
              checked = notificationsEnabled,
              onCheckedChange = { checked ->
                if (checked && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                  notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                  notificationsEnabled = checked
                }
              },
              modifier = Modifier.testTag("threshold_notification_switch")
            )
          }
        }

        // Test Notification Action
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          TextButton(
            onClick = {
              if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
              }
              val sent = onTestNotification()
              testNotificationMessage = if (sent) "Test alert posted successfully" else "Permission needed"
            },
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("test_notification_button")
          ) {
            Icon(imageVector = Icons.Rounded.Notifications, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(PlutoSpacing.xs))
            Text("Test Alert", fontSize = 12.sp)
          }

          testNotificationMessage?.let { msg ->
            Text(
              text = msg,
              style = MaterialTheme.typography.labelSmall,
              color = if (msg.contains("successfully")) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.tertiary,
              fontWeight = FontWeight.Medium
            )
          }
        }
      }
    },
    confirmButton = {
      Button(
        onClick = {
          val newThreshold = thresholdInput.toBigDecimalOrNull()
            ?.takeIf { it >= BigDecimal.ZERO }
            ?.setScale(homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
          onSave(newThreshold, notificationsEnabled)
        },
        modifier = Modifier.testTag("save_threshold_button")
      ) {
        Text("Save Threshold")
      }
    },
    dismissButton = {
      OutlinedButton(
        onClick = onDismiss,
        modifier = Modifier.testTag("cancel_threshold_button")
      ) {
        Text("Cancel")
      }
    }
  )
}
