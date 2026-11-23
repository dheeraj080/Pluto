package com.pluto.app.ui.home

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CurrencyExchange
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.rememberPrefersReducedMotion
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

/**
 * Visual Safe-to-Spend radial gauge component for the Cashew & Ivy-inspired dashboard.
 *
 * Calculates and visualizes the remaining daily budget based on income and expenses:
 *   Safe Daily Spend = (Daily Spending Cap + Today's Inflow/Income) - Today's Outflow/Expenses
 *
 * Strictly adheres to dual-currency presentation rules:
 * 1. Primary: Current Country (Destination / Active Trip Currency)
 * 2. Secondary: Home Country (Home Currency Equivalent)
 *
 * Includes integrated interactive Currency Selection directly within the gauge:
 * - Quick currency selector button in the header
 * - Interactive destination currency pill in the arch
 * - Quick horizontal travel presets carousel
 * - Comprehensive dual-currency modal bottom sheet (Trip Currency & Home Currency)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafeToSpendGaugeCard(
  summary: DashboardSummary,
  userSettings: UserSettings,
  onOpenCapsDialog: () -> Unit,
  onUpdateWarningThreshold: (Double?, Boolean) -> Unit = { _, _ -> },
  onTestNotification: () -> Boolean = { false },
  onChangeDestinationClick: () -> Unit = {},
  onSelectDestinationCurrency: (Currency) -> Unit = {},
  onSelectHomeCurrency: (Currency) -> Unit = {},
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency
  val dailyCap = userSettings.dailySpendingCap
  val progress = summary.dailyCapProgress ?: 0f

  val isExceeded = summary.isDailyBudgetExceeded
  val isBelowWarning = summary.isBelowWarningThreshold
  val isCaution = summary.isDailyBudgetCautious

  // In-gauge Threshold state
  var showThresholdDialog by remember { mutableStateOf(false) }

  // Visual status colors backed by theme & semantic tokens
  val emeraldGreen = MaterialTheme.colorScheme.secondary
  val amberWarning = MaterialTheme.colorScheme.tertiary
  val warningOrange = MaterialTheme.colorScheme.tertiary
  val errorRed = MaterialTheme.colorScheme.error

  val statusColor = when {
    isExceeded -> errorRed
    isBelowWarning -> warningOrange
    isCaution -> amberWarning
    else -> emeraldGreen
  }

  val statusContainerColor = when {
    isExceeded -> MaterialTheme.colorScheme.errorContainer
    isBelowWarning || isCaution -> MaterialTheme.colorScheme.tertiaryContainer
    else -> MaterialTheme.colorScheme.secondaryContainer
  }

  val statusOnContainerColor = when {
    isExceeded -> MaterialTheme.colorScheme.onErrorContainer
    isBelowWarning || isCaution -> MaterialTheme.colorScheme.onTertiaryContainer
    else -> MaterialTheme.colorScheme.onSecondaryContainer
  }

  val statusLabel = when {
    isExceeded -> "BUDGET EXCEEDED"
    isBelowWarning -> "BELOW SAFETY MINIMUM"
    isCaution -> "CAUTION · HIGH SPEND"
    dailyCap != null -> "SAFE TO SPEND TODAY"
    summary.todayIncomeHome.amount > BigDecimal.ZERO -> "TODAY'S CASH SURPLUS"
    else -> "DAILY SPENDING FLOW"
  }

  val statusIcon = when {
    isExceeded -> Icons.Rounded.Warning
    isBelowWarning -> Icons.Rounded.NotificationsActive
    isCaution -> Icons.Rounded.Warning
    dailyCap != null -> Icons.Rounded.CheckCircle
    else -> Icons.Rounded.Info
  }

  // Dual Currency Calculations
  val hasBudgetBase = dailyCap != null || summary.todayIncomeHome.amount > BigDecimal.ZERO
  val remainingHome = summary.safeToSpendTodayHome.amount
  val isRemainingNegative = remainingHome < BigDecimal.ZERO

  // Primary: Active Trip Currency (Destination)
  val primaryAmountFormatted: String = if (summary.safeToSpendTodayDest != null) {
    if (isRemainingNegative) {
      "-${destCurrency.symbol}${summary.safeToSpendTodayDest.amount.abs().toPlainString()}"
    } else {
      summary.safeToSpendTodayDest.format()
    }
  } else if (hasBudgetBase) {
    summary.safeToSpendTodayHome.format()
  } else {
    // If no cap is set, show total spent today in trip currency
    summary.todayDestSpending?.format() ?: summary.todayHomeSpending.format()
  }

  // Secondary: Home Currency Equivalent
  val secondaryAmountFormatted: String = if (hasBudgetBase) {
    summary.safeToSpendTodayHome.format()
  } else {
    summary.todayHomeSpending.format()
  }

  // Animated Gauge Fill (Clamped 0f..1f for visual arc) respecting Reduced Motion
  val prefersReducedMotion = rememberPrefersReducedMotion()
  val targetArcProgress = progress.coerceIn(0f, 1f)
  val animatedProgress by animateFloatAsState(
    targetValue = targetArcProgress,
    animationSpec = tween(
      durationMillis = if (prefersReducedMotion) 0 else 850,
      easing = FastOutSlowInEasing
    ),
    label = "safe_to_spend_gauge_progress"
  )

  Card(
    modifier = modifier
      .fillMaxWidth()
      .heightIn(min = 245.dp)
      .testTag("dashboard_safe_to_spend_hero")
      .testTag("safe_to_spend_gauge"),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surface
    ),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 18.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.SpaceBetween
    ) {
      // 1. Header: Status Tag & Quick Action Controls
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        // Status Badge Pill
        Surface(
          shape = PlutoShapes.large,
          color = statusContainerColor,
          modifier = Modifier.testTag("gauge_status_badge")
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = statusIcon,
              contentDescription = null,
              tint = statusColor,
              modifier = Modifier.size(13.dp)
            )
            Spacer(modifier = Modifier.width(5.dp))
            Text(
              text = statusLabel,
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = statusOnContainerColor,
              letterSpacing = 0.5.sp,
              fontSize = 10.sp
            )
          }
        }

        // Header Action Controls: Alert Buffer & Adjust Caps
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          // Threshold Warning / Safety Alert button
          val currentThresholdText = summary.warningThresholdDest?.format()
            ?: summary.warningThresholdHome?.format()
            ?: userSettings.safeToSpendWarningThreshold?.let { "${homeCurrency.symbol}${String.format(Locale.US, "%.0f", it)}" }
            ?: "Alert"

          Box(
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .clip(PlutoShapes.medium)
              .clickable(role = Role.Button) { showThresholdDialog = true }
              .semantics(mergeDescendants = true) {}
              .testTag("gauge_threshold_button"),
            contentAlignment = Alignment.Center
          ) {
            Surface(
              shape = PlutoShapes.medium,
              color = if (isBelowWarning) {
                MaterialTheme.colorScheme.tertiaryContainer
              } else {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
              }
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = if (isBelowWarning) Icons.Rounded.NotificationsActive else Icons.Rounded.Notifications,
                  contentDescription = "Alert Threshold",
                  tint = if (isBelowWarning) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(13.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                  text = if (userSettings.safeToSpendWarningThreshold != null) "Alert: $currentThresholdText" else "Alert",
                  style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                  fontWeight = FontWeight.Bold,
                  color = if (isBelowWarning) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
          }

          // Adjust Caps pill button
          Box(
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .clip(PlutoShapes.medium)
              .clickable(role = Role.Button, onClick = onOpenCapsDialog)
              .semantics(mergeDescendants = true) {}
              .testTag("dashboard_hero_edit_caps_button"),
            contentAlignment = Alignment.Center
          ) {
            Surface(
              shape = PlutoShapes.medium,
              color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Rounded.Tune,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(13.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                  text = if (dailyCap != null) "Cap" else "Set Cap",
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.Bold,
                  color = MaterialTheme.colorScheme.primary
                )
              }
            }
          }
        }
      }

      // 2. Central Section: Radial Pacing Dial + Dual-Currency Typography
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
      ) {
        // Compact Modern Radial Dial
        Box(
          modifier = Modifier.size(96.dp),
          contentAlignment = Alignment.Center
        ) {
          val trackBgColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
          val primaryBrushStart = MaterialTheme.colorScheme.primary
          val primaryBrushEnd = MaterialTheme.colorScheme.secondary
          Canvas(modifier = Modifier.size(96.dp)) {
            val canvasSize = size.minDimension
            val strokeWidthPx = 9.dp.toPx()
            val radius = (canvasSize - strokeWidthPx) / 2f
            val arcTopLeft = Offset((size.width - radius * 2f) / 2f, (size.height - radius * 2f) / 2f)
            val arcSize = Size(radius * 2f, radius * 2f)

            // Background circular track
            drawArc(
              color = trackBgColor,
              startAngle = 135f,
              sweepAngle = 270f,
              useCenter = false,
              topLeft = arcTopLeft,
              size = arcSize,
              style = Stroke(width = strokeWidthPx, cap = StrokeCap.Round)
            )

            // Active sweep
            if (animatedProgress > 0.01f) {
              val sweepCurrent = 270f * animatedProgress
              val activeBrush = when {
                isExceeded -> Brush.linearGradient(listOf(errorRed, errorRed.copy(alpha = 0.7f)))
                isBelowWarning -> Brush.linearGradient(listOf(warningOrange, errorRed))
                isCaution -> Brush.linearGradient(listOf(primaryBrushStart, amberWarning))
                else -> Brush.linearGradient(listOf(primaryBrushStart, primaryBrushEnd))
              }

              drawArc(
                brush = activeBrush,
                startAngle = 135f,
                sweepAngle = sweepCurrent,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = strokeWidthPx, cap = StrokeCap.Round)
              )

              // Glowing Tip Indicator
              val tipAngleDeg = 135f + sweepCurrent
              val tipAngleRad = Math.toRadians(tipAngleDeg.toDouble())
              val centerOffset = Offset(size.width / 2f, size.height / 2f)
              val tipCenter = Offset(
                x = centerOffset.x + (radius * cos(tipAngleRad)).toFloat(),
                y = centerOffset.y + (radius * sin(tipAngleRad)).toFloat()
              )
              drawCircle(
                color = statusColor.copy(alpha = 0.35f),
                radius = 6.dp.toPx(),
                center = tipCenter
              )
              drawCircle(
                color = Color.White,
                radius = 3.dp.toPx(),
                center = tipCenter
              )
            }
          }

          // Center badge: Trip currency flag and code
          Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f),
            modifier = Modifier.testTag("gauge_destination_tag")
          ) {
            Column(
              modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Text(text = destCurrency.flagEmoji, fontSize = 14.sp)
              Text(
                text = destCurrency.code,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 9.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }

        // Dual Currency Metrics
        Column(
          modifier = Modifier.weight(1f),
          verticalArrangement = Arrangement.Center
        ) {
          Text(
            text = "SAFE TO SPEND TODAY",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            letterSpacing = 0.5.sp,
            fontSize = 10.sp
          )

          Spacer(modifier = Modifier.height(2.dp))

          Text(
            text = primaryAmountFormatted,
            style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.ExtraBold,
            color = when {
              isExceeded -> errorRed
              isBelowWarning -> warningOrange
              else -> MaterialTheme.colorScheme.onSurface
            },
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.testTag("gauge_primary_amount")
          )

          val homeSecondaryText = "≈ $secondaryAmountFormatted in ${homeCurrency.code}"
          Text(
            text = homeSecondaryText,
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.testTag("gauge_secondary_amount")
          )

          val percentageRemaining = ((1f - progress.coerceIn(0f, 1f)) * 100).toInt()
          Text(
            text = if (isExceeded) "100% budget used" else if (hasBudgetBase) "$percentageRemaining% remaining today" else "Tap 'Set Cap' to track limits",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Medium,
            color = if (isExceeded) errorRed else MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }

      // 3. Bottom Strip: Daily Financial Engine Breakdown
      Surface(
        shape = PlutoShapes.large,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        modifier = Modifier.fillMaxWidth()
      ) {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 7.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          val capDestText = summary.dailySpendingCapDest?.format()
            ?: "${destCurrency.symbol}${String.format(Locale.US, "%.0f", dailyCap ?: 0.0)}"
          val capHomeText = "${homeCurrency.symbol}${String.format(Locale.US, "%.0f", dailyCap ?: 0.0)}"
          DailyTelemetryColumn(
            label = "Cap",
            primaryText = if (dailyCap != null) capDestText else "—",
            secondaryText = if (dailyCap != null) capHomeText else "Not set",
            tint = MaterialTheme.colorScheme.onSurface
          )

          val hasIncomeToday = summary.todayIncomeHome.amount > BigDecimal.ZERO
          val incomeDestText = summary.todayIncomeDest?.format() ?: summary.todayIncomeHome.format()
          DailyTelemetryColumn(
            label = "+ Income",
            primaryText = if (hasIncomeToday) "+$incomeDestText" else "0",
            secondaryText = if (hasIncomeToday) "+${summary.todayIncomeHome.format()}" else "0",
            tint = emeraldGreen
          )

          val spentDestText = summary.todayDestSpending?.format() ?: summary.todayHomeSpending.format()
          DailyTelemetryColumn(
            label = "- Spent",
            primaryText = "-$spentDestText",
            secondaryText = "-${summary.todayHomeSpending.format()}",
            tint = if (isExceeded) errorRed else MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }
    }
  }

  // Threshold Warning Configuration Dialog
  if (showThresholdDialog) {
    SafeToSpendThresholdDialog(
      userSettings = userSettings,
      summary = summary,
      onDismiss = { showThresholdDialog = false },
      onSave = { newThreshold, notifyEnabled ->
        onUpdateWarningThreshold(newThreshold, notifyEnabled)
        showThresholdDialog = false
      },
      onTestNotification = onTestNotification
    )
  }
}

@Composable
private fun DailyTelemetryColumn(
  label: String,
  primaryText: String,
  secondaryText: String,
  tint: Color,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier,
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(
      text = label,
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      fontSize = 11.sp
    )
    Spacer(modifier = Modifier.height(2.dp))
    Text(
      text = primaryText,
      style = MaterialTheme.typography.bodyMedium,
      fontWeight = FontWeight.Bold,
      color = tint
    )
    Text(
      text = secondaryText,
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
      fontSize = 10.sp
    )
  }
}

/**
 * Dialog enabling the user to configure their custom minimum Safe-to-Spend warning threshold
 * and manage threshold warning push notifications.
 *
 * Displays values in both:
 * 1. Primary: Trip Currency (Current country)
 * 2. Secondary: Home Currency
 */
@Composable
fun SafeToSpendThresholdDialog(
  userSettings: UserSettings,
  summary: DashboardSummary,
  onDismiss: () -> Unit,
  onSave: (Double?, Boolean) -> Unit,
  onTestNotification: () -> Boolean,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency

  var thresholdInput by remember {
    mutableStateOf(
      userSettings.safeToSpendWarningThreshold?.let { String.format(Locale.US, "%.0f", it) } ?: "20"
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

  val parsedHomeAmount = thresholdInput.toDoubleOrNull()
  val convertedTripAmountText = remember(parsedHomeAmount, summary.destinationCurrency, summary.warningThresholdDest) {
    if (parsedHomeAmount != null && parsedHomeAmount > 0.0) {
      val rate = summary.dailySpendingCapDest?.let { capDest ->
        val capHome = userSettings.dailySpendingCap
        if (capHome != null && capHome > 0.0) {
          capDest.amount.toDouble() / capHome
        } else null
      }
      if (rate != null) {
        val destAmount = parsedHomeAmount * rate
        "${destCurrency.symbol}${String.format(Locale.US, "%.2f", destAmount)} ${destCurrency.code}"
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
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
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
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
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
            if (input.all { it.isDigit() || it == '.' }) {
              thresholdInput = input
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
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          listOf(10.0, 20.0, 50.0, 100.0).forEach { preset ->
            val isSelected = parsedHomeAmount == preset
            FilterChip(
              selected = isSelected,
              onClick = { thresholdInput = String.format(Locale.US, "%.0f", preset) },
              label = { Text("${homeCurrency.symbol}${preset.toInt()}") },
              modifier = Modifier.testTag("threshold_preset_${preset.toInt()}")
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
              .padding(horizontal = 12.dp, vertical = 10.dp),
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
            modifier = Modifier.testTag("test_notification_button")
          ) {
            Icon(imageVector = Icons.Rounded.Notifications, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
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
          val newThreshold = thresholdInput.toDoubleOrNull()
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
