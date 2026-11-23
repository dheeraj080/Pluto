package com.pluto.app.ui.settings

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.AutoFixHigh
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.CloudSync
import androidx.compose.material.icons.rounded.CloudUpload
import androidx.compose.material.icons.rounded.CurrencyExchange
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Paid
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.pluto.app.R
import com.pluto.app.data.remote.cloud.CloudSyncState
import com.pluto.app.data.remote.cloud.GoogleSignInButton
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.home.SpendingCapsDialog
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
  userSettings: UserSettings,
  onChangeHomeCurrencyClick: () -> Unit,
  onChangeDestinationClick: () -> Unit,
  onUpdateSpendingCaps: (Double?, Double?) -> Unit,
  onUpdateCategoryBudgets: (Map<String, Double>) -> Unit = {},
  onUpdateThemeMode: (com.pluto.app.domain.model.ThemeMode) -> Unit = {},
  onUpdatePersona: (com.pluto.app.domain.model.UserPersona) -> Unit = {},
  onUpdateAcademicTermSettings: (com.pluto.app.domain.model.AcademicTermSettings) -> Unit = {},
  onUpdateBiometricLock: (Boolean, Int) -> Unit = { _, _ -> },
  onUpdatePrivacyMode: (Boolean) -> Unit = {},
  onUpdateWarningThreshold: (Double?, Boolean) -> Unit = { _, _ -> },
  onOpenCustomRates: () -> Unit = {},
  onOpenBackupRestore: () -> Unit = {},
  onResetOnboardingClick: () -> Unit,
  onSeedDummyDataClick: () -> Unit = {},
  onNavigateToConverter: () -> Unit = {},
  onNavigateBack: (() -> Unit)? = null,
  cloudSyncState: CloudSyncState = CloudSyncState.Idle,
  signedInEmail: String? = null,
  signedInDisplayName: String? = null,
  isOfflineMode: Boolean = false,
  onGoogleSignInSuccess: () -> Unit = {},
  onSyncNowClick: () -> Unit = {},
  onSignOutClick: () -> Unit = {},
  isDevMode: Boolean = false,
  modifier: Modifier = Modifier
) {
  val context = LocalContext.current
  val homeCurrency = userSettings.homeCurrency
  val destinationCurrency = userSettings.destinationCurrency
  var showCapsDialog by remember { mutableStateOf(false) }
  var showCategoryBudgetsDialog by remember { mutableStateOf(false) }
  var showPersonaDialog by remember { mutableStateOf(false) }
  var showTermDialog by remember { mutableStateOf(false) }
  var showThemeDialog by remember { mutableStateOf(false) }
  var showTimeoutDialog by remember { mutableStateOf(false) }
  var signInErrorMessage by remember { mutableStateOf<String?>(null) }

  val notificationPermissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { granted ->
    onUpdateWarningThreshold(userSettings.safeToSpendWarningThreshold, granted)
  }

  if (showPersonaDialog) {
    com.pluto.app.ui.home.PersonaSwitcherDialog(
      currentPersona = userSettings.persona,
      onDismiss = { showPersonaDialog = false },
      onPersonaSelected = { persona ->
        onUpdatePersona(persona)
        showPersonaDialog = false
      }
    )
  }

  if (showTermDialog) {
    com.pluto.app.ui.home.TermSettingsDialog(
      userSettings = userSettings,
      onDismiss = { showTermDialog = false },
      onSave = { updated ->
        onUpdateAcademicTermSettings(updated)
        showTermDialog = false
      }
    )
  }

  if (showCapsDialog) {
    SpendingCapsDialog(
      userSettings = userSettings,
      onDismiss = { showCapsDialog = false },
      onSave = { daily, monthly ->
        onUpdateSpendingCaps(daily, monthly)
        showCapsDialog = false
      }
    )
  }

  if (showCategoryBudgetsDialog) {
    com.pluto.app.ui.home.CategoryBudgetsDialog(
      userSettings = userSettings,
      onDismiss = { showCategoryBudgetsDialog = false },
      onSave = { budgets ->
        onUpdateCategoryBudgets(budgets)
        showCategoryBudgetsDialog = false
      }
    )
  }

  Scaffold(
    modifier = modifier.fillMaxSize().testTag("profile_settings_screen"),
    topBar = {
      TopAppBar(
        title = {
          Text(
            text = "Profile & Settings",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
        },
        navigationIcon = {
          if (onNavigateBack != null) {
            IconButton(
              onClick = onNavigateBack,
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("settings_back_button")
            ) {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = "Back"
              )
            }
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.background
        )
      )
    }
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding),
      contentAlignment = Alignment.TopCenter
    ) {
      Column(
        modifier = Modifier
          .widthIn(max = 720.dp)
          .fillMaxSize()
          .verticalScroll(rememberScrollState())
          .padding(horizontal = 20.dp, vertical = 12.dp)
      ) {
      // 1. Account & Cloud Sync Card (20dp outer = 14dp padding + 6dp inner pill)
      Card(
        modifier = Modifier
          .fillMaxWidth()
          .testTag("profile_header_card"),
        shape = PlutoShapes.extraLarge,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column(modifier = Modifier.padding(14.dp)) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
              shape = CircleShape,
              color = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(54.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.AccountCircle,
                  contentDescription = "Google account",
                  tint = MaterialTheme.colorScheme.onPrimary,
                  modifier = Modifier.size(36.dp)
                )
              }
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
              val isAuthenticated = signedInEmail != null
              val headerTitle = when {
                !signedInDisplayName.isNullOrBlank() -> signedInDisplayName
                isAuthenticated -> "Pluto Cloud Account"
                else -> stringResource(R.string.settings_local_vault_title)
              }
              Text(
                text = headerTitle,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
              )
              if (!signedInEmail.isNullOrBlank()) {
                Text(
                  text = signedInEmail,
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
              Spacer(modifier = Modifier.height(2.dp))
              Text(
                text = "Home: ${homeCurrency.code} • Local: ${destinationCurrency.code}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              Spacer(modifier = Modifier.height(6.dp))

              val syncTimeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
              val (syncLabel, syncIcon) = if (!isAuthenticated || isOfflineMode) {
                stringResource(R.string.settings_offline_status) to Icons.Rounded.CloudOff
              } else {
                when (cloudSyncState) {
                  is CloudSyncState.Syncing -> "Syncing to Cloud Firestore..." to Icons.Rounded.CloudSync
                  is CloudSyncState.Synced -> {
                    val timeStr = syncTimeFormat.format(Date(cloudSyncState.lastSyncedMillis))
                    "Synced (${cloudSyncState.syncedRecordsCount} items · $timeStr)" to Icons.Rounded.CloudDone
                  }
                  is CloudSyncState.Error -> "Offline / Sync Paused" to Icons.Rounded.CloudOff
                  CloudSyncState.Idle -> "Offline-First Cloud Ready" to Icons.Rounded.CloudDone
                }
              }
              Surface(
                shape = PlutoShapes.small,
                color = MaterialTheme.colorScheme.surface
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  if (isAuthenticated && !isOfflineMode && cloudSyncState is CloudSyncState.Syncing) {
                    CircularProgressIndicator(
                      modifier = Modifier.size(12.dp),
                      strokeWidth = 2.dp
                    )
                  } else {
                    Icon(
                      imageVector = syncIcon,
                      contentDescription = null,
                      tint = MaterialTheme.colorScheme.primary,
                      modifier = Modifier.size(14.dp)
                    )
                  }
                  Spacer(modifier = Modifier.width(6.dp))
                  Text(
                    text = syncLabel,
                    style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.testTag("settings_cloud_sync_status")
                  )
                }
              }
            }
          }

          if (signedInEmail != null) {
            Spacer(modifier = Modifier.height(14.dp))
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
              val syncInteraction = remember { MutableInteractionSource() }
              val syncEnabled = cloudSyncState !is CloudSyncState.Syncing
              FilledTonalButton(
                onClick = onSyncNowClick,
                enabled = syncEnabled,
                interactionSource = syncInteraction,
                modifier = Modifier
                  .weight(1f)
                  .minimumInteractiveComponentSize()
                  .plutoPressableScale(
                    enabled = syncEnabled,
                    pressedScale = PlutoMotion.PressScale,
                    interactionSource = syncInteraction
                  )
                  .testTag("settings_sync_now_button")
              ) {
                Icon(Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Sync Now", fontWeight = FontWeight.SemiBold)
              }

              val signOutInteraction = remember { MutableInteractionSource() }
              OutlinedButton(
                onClick = onSignOutClick,
                interactionSource = signOutInteraction,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                modifier = Modifier
                  .weight(1f)
                  .minimumInteractiveComponentSize()
                  .plutoPressableScale(
                    enabled = true,
                    pressedScale = PlutoMotion.PressScale,
                    interactionSource = signOutInteraction
                  )
                  .testTag("settings_sign_out_button")
              ) {
                Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Sign Out", fontWeight = FontWeight.SemiBold)
              }
            }
          } else {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
              text = stringResource(R.string.settings_offline_merge_description),
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.testTag("settings_offline_merge_hint")
            )
            if (signInErrorMessage != null) {
              Spacer(modifier = Modifier.height(8.dp))
              Surface(
                shape = RoundedCornerShape(10.dp),
                color = MaterialTheme.colorScheme.errorContainer,
                modifier = Modifier
                  .fillMaxWidth()
                  .testTag("settings_sign_in_error_banner")
              ) {
                Text(
                  text = signInErrorMessage ?: "",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onErrorContainer,
                  modifier = Modifier.padding(10.dp)
                )
              }
            }
            Spacer(modifier = Modifier.height(12.dp))
            GoogleSignInButton(
              onAuthSuccess = {
                signInErrorMessage = null
                onGoogleSignInSuccess()
              },
              onAuthError = { error ->
                signInErrorMessage = error
              },
              onAuthCancelled = {
                signInErrorMessage = null
              },
              buttonTestTag = "settings_google_sign_in_button",
              buttonLabel = stringResource(R.string.settings_sign_in_to_merge)
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(20.dp))

      // 2. Travel Tools Section (houses Currency Converter)
      SettingsSectionHeader(title = "Travel Tools")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        SettingsRowItem(
          icon = Icons.Rounded.CurrencyExchange,
          title = "Currency Converter",
          subtitle = "Instant live multi-currency calculator & rates matrix",
          onClick = onNavigateToConverter,
          testTag = "settings_row_currency_converter",
          trailingContent = {
            Surface(
              shape = RoundedCornerShape(8.dp),
              color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
            ) {
              Text(
                text = "${homeCurrency.code} ⇄ ${destinationCurrency.code}",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
              )
            }
            Spacer(modifier = Modifier.width(6.dp))
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        )
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 3. Preferences Section
      SettingsSectionHeader(title = "Currency & Destination")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.Paid,
            title = "Home Currency",
            subtitle = "Reference currency for all reports & totals",
            onClick = onChangeHomeCurrencyClick,
            testTag = "settings_row_home_currency",
            trailingContent = {
              CurrencyBadge(currency = homeCurrency)
              Spacer(modifier = Modifier.width(4.dp))
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )

          HorizontalDivider(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp)
          )

          SettingsRowItem(
            icon = Icons.Rounded.FlightTakeoff,
            title = "Visiting Destination Currency",
            subtitle = "Preselected currency when logging travel expenses",
            onClick = onChangeDestinationClick,
            testTag = "settings_row_destination_currency",
            trailingContent = {
              CurrencyBadge(currency = destinationCurrency)
              Spacer(modifier = Modifier.width(4.dp))
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )

          HorizontalDivider(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp)
          )

          SettingsRowItem(
            icon = Icons.Rounded.Tune,
            title = "Custom Rate Overrides",
            subtitle = "Set custom street, kiosk, or cash exchange rates",
            onClick = onOpenCustomRates,
            testTag = "settings_row_custom_rates"
          )
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 4. Budgeting Caps Section
      SettingsSectionHeader(title = "Budgeting & Spending Caps")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.Speed,
            title = "Daily Spending Cap",
            subtitle = userSettings.dailySpendingCap?.let {
              "${homeCurrency.symbol}${String.format(Locale.US, "%.2f", it)} per day"
            } ?: "Not set (Tap to configure)",
            onClick = { showCapsDialog = true },
            testTag = "settings_row_daily_cap",
            trailingContent = {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )

          HorizontalDivider(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp)
          )

          SettingsRowItem(
            icon = Icons.Rounded.CalendarToday,
            title = "Monthly Spending Cap",
            subtitle = userSettings.monthlySpendingCap?.let {
              "${homeCurrency.symbol}${String.format(Locale.US, "%.2f", it)} per month"
            } ?: "Not set (Tap to configure)",
            onClick = { showCapsDialog = true },
            testTag = "settings_row_monthly_cap",
            trailingContent = {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )

          HorizontalDivider(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp)
          )

          SettingsRowItem(
            icon = Icons.Rounded.Paid,
            title = "Category Budgets",
            subtitle = if (userSettings.categoryMonthlyBudgets.isNotEmpty()) {
              "${userSettings.categoryMonthlyBudgets.size} category budgets configured"
            } else {
              "Set spending limits for Food, Transport, etc."
            },
            onClick = { showCategoryBudgetsDialog = true },
            testTag = "settings_row_category_budgets",
            trailingContent = {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

  if (showThemeDialog) {
    ThemeSelectionDialog(
      currentMode = userSettings.themeMode,
      onDismiss = { showThemeDialog = false },
      onSelectMode = { mode ->
        onUpdateThemeMode(mode)
        showThemeDialog = false
      }
    )
  }

      // 5. Appearance Section
      SettingsSectionHeader(title = "Appearance")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column {
          val themeSubtitle = when (userSettings.themeMode) {
            com.pluto.app.domain.model.ThemeMode.SYSTEM -> "Follow system default"
            com.pluto.app.domain.model.ThemeMode.LIGHT -> "Light mode (Warm Alabaster)"
            com.pluto.app.domain.model.ThemeMode.DARK -> "Dark mode (Deep Espresso)"
          }

          SettingsRowItem(
            icon = Icons.Rounded.DarkMode,
            title = "Theme Mode",
            subtitle = themeSubtitle,
            onClick = { showThemeDialog = true },
            testTag = "settings_row_theme",
            trailingContent = {
              Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
              ) {
                Text(
                  text = when (userSettings.themeMode) {
                    com.pluto.app.domain.model.ThemeMode.SYSTEM -> "System"
                    com.pluto.app.domain.model.ThemeMode.LIGHT -> "Light"
                    com.pluto.app.domain.model.ThemeMode.DARK -> "Dark"
                  },
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.Bold,
                  color = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
              }
              Spacer(modifier = Modifier.width(6.dp))
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )
        }
      }

      if (showTimeoutDialog) {
        AutoLockTimeoutDialog(
          currentMinutes = userSettings.autoLockTimeoutMinutes,
          onDismiss = { showTimeoutDialog = false },
          onSelectMinutes = { mins ->
            onUpdateBiometricLock(userSettings.isBiometricLockEnabled, mins)
            showTimeoutDialog = false
          }
        )
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 6. Security & Privacy Section
      SettingsSectionHeader(title = "Security & Privacy")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column {
          SettingsSwitchRowItem(
            icon = Icons.Rounded.Fingerprint,
            title = "Biometric App Lock",
            subtitle = if (userSettings.isBiometricLockEnabled) {
              "Enabled • Require biometric or PIN to unlock"
            } else {
              "Disabled • Instant access without lock"
            },
            checked = userSettings.isBiometricLockEnabled,
            onCheckedChange = { checked ->
              onUpdateBiometricLock(checked, userSettings.autoLockTimeoutMinutes)
            },
            testTag = "settings_switch_biometric"
          )

          if (userSettings.isBiometricLockEnabled) {
            HorizontalDivider(
              color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
              modifier = Modifier.padding(horizontal = 16.dp)
            )

            val timeoutLabel = when (userSettings.autoLockTimeoutMinutes) {
              0 -> "Immediately when closed"
              1 -> "After 1 minute in background"
              5 -> "After 5 minutes in background"
              15 -> "After 15 minutes in background"
              else -> "After ${userSettings.autoLockTimeoutMinutes} minutes"
            }

            SettingsRowItem(
              icon = Icons.Rounded.Timer,
              title = "Auto-Lock Timeout",
              subtitle = timeoutLabel,
              onClick = { showTimeoutDialog = true },
              testTag = "settings_row_timeout",
              trailingContent = {
                Surface(
                  shape = RoundedCornerShape(8.dp),
                  color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
                ) {
                  Text(
                    text = "${userSettings.autoLockTimeoutMinutes}m",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                  )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Icon(
                  imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            )
          }

          HorizontalDivider(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp)
          )

          SettingsSwitchRowItem(
            icon = Icons.Rounded.Security,
            title = "Privacy Shield",
            subtitle = "Block screenshots and conceal app in task switcher (FLAG_SECURE)",
            checked = userSettings.isPrivacyModeEnabled,
            onCheckedChange = onUpdatePrivacyMode,
            testTag = "settings_switch_privacy_shield"
          )

          HorizontalDivider(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.padding(horizontal = 16.dp)
          )

          SettingsSwitchRowItem(
            icon = Icons.Rounded.Notifications,
            title = "Safe-to-Spend Alerts",
            subtitle = "Receive proactive threshold notifications when approaching daily limits",
            checked = userSettings.warningNotificationsEnabled,
            onCheckedChange = { enabled ->
              if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(
                  context,
                  Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
              ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
              } else {
                onUpdateWarningThreshold(userSettings.safeToSpendWarningThreshold, enabled)
              }
            },
            testTag = "settings_switch_notifications"
          )
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 7. Data & Cloud Backup Section
      SettingsSectionHeader(title = "Data & Cloud Backup")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.CloudUpload,
            title = "Backup & Restore",
            subtitle = "Save encrypted archive to Google Drive or restore from file",
            onClick = onOpenBackupRestore,
            testTag = "settings_row_backup_restore",
            trailingContent = {
              Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
              ) {
                Text(
                  text = "JSON / SAF",
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.Bold,
                  color = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
              }
              Spacer(modifier = Modifier.width(6.dp))
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          )
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 6. Developer & Onboarding reset (Rendered only when DEV_MODE=true in .env)
      if (isDevMode) {
        Spacer(modifier = Modifier.height(24.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          SettingsSectionHeader(title = "Developer & Debug Tools")
          Surface(
            color = MaterialTheme.colorScheme.tertiaryContainer,
            shape = RoundedCornerShape(6.dp),
            modifier = Modifier.padding(bottom = 8.dp)
          ) {
            Text(
              text = "DEV MODE",
              style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
              color = MaterialTheme.colorScheme.onTertiaryContainer,
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
            )
          }
        }

        Card(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.large,
          colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
          ),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
          Column {
            SettingsRowItem(
              icon = Icons.Rounded.AutoFixHigh,
              title = "Load Sample Data",
              subtitle = "Seed realistic 30-day expenses, travel wallets, and category budgets",
              onClick = onSeedDummyDataClick,
              testTag = "settings_row_seed_dummy_data"
            )

            HorizontalDivider(
              color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
              modifier = Modifier.padding(horizontal = 16.dp)
            )

            SettingsRowItem(
              icon = Icons.Rounded.RestartAlt,
              title = "Replay Onboarding",
              subtitle = "Test first-time setup flow and reset initial preferences",
              onClick = onResetOnboardingClick,
              testTag = "settings_row_reset_onboarding"
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 7. About Section
      SettingsSectionHeader(title = "About")

      Card(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.Info,
            title = "Pluto",
            subtitle = "Version 1.0 • Offline-First Travel Companion",
            onClick = {},
            testTag = "settings_row_about"
          )
        }
      }

      Spacer(modifier = Modifier.height(32.dp))
      }
    }
  }
}

@Composable
private fun SettingsSectionHeader(title: String) {
  Text(
    text = title,
    style = MaterialTheme.typography.labelLarge,
    fontWeight = FontWeight.Bold,
    color = MaterialTheme.colorScheme.primary,
    modifier = Modifier
      .padding(bottom = 8.dp, start = 4.dp)
      .plutoHeading()
  )
}

@Composable
private fun SettingsRowItem(
  icon: ImageVector,
  title: String,
  subtitle: String,
  onClick: () -> Unit,
  testTag: String,
  modifier: Modifier = Modifier,
  trailingContent: @Composable (() -> Unit)? = null
) {
  val rowInteraction = remember { MutableInteractionSource() }
  Row(
    modifier = modifier
      .fillMaxWidth()
      .minimumInteractiveComponentSize()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.CardPressScale,
        interactionSource = rowInteraction
      )
      .clip(PlutoShapes.large)
      .clickable(
        interactionSource = rowInteraction,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onClick
      )
      .testTag(testTag)
      .padding(14.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Surface(
      shape = PlutoShapes.small,
      color = MaterialTheme.colorScheme.surfaceVariant,
      modifier = Modifier.size(40.dp)
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(22.dp)
        )
      }
    }

    Spacer(modifier = Modifier.width(16.dp))

    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = title,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }

    if (trailingContent != null) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        trailingContent()
      }
    } else {
      Icon(
        imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}

@Composable
fun ThemeSelectionDialog(
  currentMode: com.pluto.app.domain.model.ThemeMode,
  onDismiss: () -> Unit,
  onSelectMode: (com.pluto.app.domain.model.ThemeMode) -> Unit
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Text(
        text = "Choose Theme",
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold
      )
    },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ThemeOptionRow(
          title = "System Default",
          description = "Automatically match your Android device appearance",
          isSelected = currentMode == com.pluto.app.domain.model.ThemeMode.SYSTEM,
          onClick = { onSelectMode(com.pluto.app.domain.model.ThemeMode.SYSTEM) },
          testTag = "theme_option_system"
        )
        ThemeOptionRow(
          title = "Light Mode",
          description = "Warm alabaster canvas (#F7F8F5) with ivory cards and deep forest green accents",
          isSelected = currentMode == com.pluto.app.domain.model.ThemeMode.LIGHT,
          onClick = { onSelectMode(com.pluto.app.domain.model.ThemeMode.LIGHT) },
          testTag = "theme_option_light"
        )
        ThemeOptionRow(
          title = "Dark Mode",
          description = "Deep espresso forest canvas (#0E1412) with charcoal pine surfaces and mint accents",
          isSelected = currentMode == com.pluto.app.domain.model.ThemeMode.DARK,
          onClick = { onSelectMode(com.pluto.app.domain.model.ThemeMode.DARK) },
          testTag = "theme_option_dark"
        )
      }
    },
    confirmButton = {
      TextButton(onClick = onDismiss) {
        Text("Done")
      }
    }
  )
}

@Composable
private fun ThemeOptionRow(
  title: String,
  description: String,
  isSelected: Boolean,
  onClick: () -> Unit,
  testTag: String
) {
  Surface(
    shape = RoundedCornerShape(12.dp),
    color = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(12.dp))
      .clickable(onClick = onClick)
      .testTag(testTag)
  ) {
    Row(
      modifier = Modifier.padding(14.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = title,
          style = MaterialTheme.typography.bodyLarge,
          fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
          color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
          text = description,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
      if (isSelected) {
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
          imageVector = Icons.Rounded.CheckCircle,
          contentDescription = "Selected",
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(20.dp)
        )
      }
    }
  }
}

@Composable
private fun SettingsSwitchRowItem(
  icon: ImageVector,
  title: String,
  subtitle: String,
  checked: Boolean,
  onCheckedChange: (Boolean) -> Unit,
  testTag: String,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .padding(16.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Surface(
      shape = RoundedCornerShape(10.dp),
      color = MaterialTheme.colorScheme.surfaceVariant,
      modifier = Modifier.size(40.dp)
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(22.dp)
        )
      }
    }

    Spacer(modifier = Modifier.width(16.dp))

    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = title,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }

    Switch(
      checked = checked,
      onCheckedChange = onCheckedChange,
      modifier = Modifier.testTag(testTag)
    )
  }
}

@Composable
fun AutoLockTimeoutDialog(
  currentMinutes: Int,
  onDismiss: () -> Unit,
  onSelectMinutes: (Int) -> Unit
) {
  val options = listOf(
    0 to "Immediately when closed",
    1 to "After 1 minute in background",
    5 to "After 5 minutes in background",
    15 to "After 15 minutes in background"
  )

  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Text(
        text = "Auto-Lock Timeout",
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold
      )
    },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (mins, label) ->
          val isSelected = currentMinutes == mins
          Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(12.dp))
              .clickable { onSelectMinutes(mins) }
              .testTag("autolock_option_$mins")
          ) {
            Row(
              modifier = Modifier.padding(14.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f)
              )
              if (isSelected) {
                Icon(
                  imageVector = Icons.Rounded.CheckCircle,
                  contentDescription = "Selected",
                  tint = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(20.dp)
                )
              }
            }
          }
        }
      }
    },
    confirmButton = {
      TextButton(onClick = onDismiss) {
        Text("Cancel")
      }
    }
  )
}

