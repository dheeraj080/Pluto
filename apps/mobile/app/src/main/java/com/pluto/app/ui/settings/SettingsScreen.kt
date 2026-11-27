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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.pluto.app.R
import com.pluto.app.data.remote.cloud.CloudSyncState
import com.pluto.app.data.remote.cloud.GoogleSignInButton
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.PlutoTopBar
import com.pluto.app.ui.home.SpendingCapsDialog
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.util.BiometricSecurityManager
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
  userSettings: UserSettings,
  onChangeHomeCurrencyClick: () -> Unit,
  onChangeDestinationClick: () -> Unit,
  onUpdateSpendingCaps: (BigDecimal?, BigDecimal?) -> Unit,
  onUpdateCategoryBudgets: (Map<String, BigDecimal>) -> Unit = {},
  onGetConversionRate: (suspend (Currency, Currency) -> BigDecimal?)? = null,
  onUpdateThemeMode: (com.pluto.app.domain.model.ThemeMode) -> Unit = {},
  onUpdatePersona: (com.pluto.app.domain.model.UserPersona) -> Unit = {},
  onUpdateAcademicTermSettings: (com.pluto.app.domain.model.AcademicTermSettings) -> Unit = {},
  onUpdateBiometricLock: (Boolean, Int) -> Unit = { _, _ -> },
  onUpdatePrivacyMode: (Boolean) -> Unit = {},
  onUpdateWarningThreshold: (BigDecimal?, Boolean) -> Unit = { _, _ -> },
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
  val lifecycleOwner = LocalLifecycleOwner.current
  var canUseBiometricLock by remember { mutableStateOf(BiometricSecurityManager.canAuthenticate(context)) }
  LaunchedEffect(lifecycleOwner, context) {
    lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      // Refresh when returning from Android Settings after enrolling/removing a screen lock.
      canUseBiometricLock = BiometricSecurityManager.canAuthenticate(context)
    }
  }
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
      onGetConversionRate = onGetConversionRate,
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
      onGetConversionRate = onGetConversionRate,
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
      PlutoTopBar(
        title = "Profile & Settings",
        onNavigateBack = onNavigateBack,
        titleStyle = MaterialTheme.typography.titleLarge,
        backButtonTestTag = "settings_back_button"
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
      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.extraLarge,
        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
        testTag = "profile_header_card"
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
                text = "Reference: ${homeCurrency.code} • Primary: ${destinationCurrency.code}",
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
              val syncEnabled = cloudSyncState !is CloudSyncState.Syncing
              PlutoButton(
                text = "Sync Now",
                onClick = onSyncNowClick,
                variant = PlutoButtonVariant.SECONDARY,
                enabled = syncEnabled,
                leadingIcon = Icons.Rounded.Sync,
                testTag = "settings_sync_now_button",
                modifier = Modifier.weight(1f)
              )

              PlutoButton(
                text = "Sign Out",
                onClick = onSignOutClick,
                variant = PlutoButtonVariant.OUTLINED,
                testTag = "settings_sign_out_button",
                modifier = Modifier.weight(1f)
              )
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
              Spacer(modifier = Modifier.height(PlutoSpacing.sm))
              Surface(
                shape = PlutoShapes.medium,
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

      // 2. Currency Tools Section (houses Currency Converter)
      SettingsSectionHeader(title = "Currency Tools")

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
      ) {
        SettingsRowItem(
          icon = Icons.Rounded.CurrencyExchange,
          title = "Currency Converter",
          subtitle = "Instant live multi-currency calculator & rates matrix",
          onClick = onNavigateToConverter,
          testTag = "settings_row_currency_converter",
          trailingContent = {
            Surface(
              shape = PlutoShapes.small,
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
      SettingsSectionHeader(title = "Currency Preferences")

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.Paid,
            title = "Reference Currency",
            subtitle = "Currency used for all reports & totals",
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
            title = "Primary Spending Currency",
            subtitle = "Preselected currency when logging expenses",
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
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // 4. Budgeting Caps Section
      SettingsSectionHeader(title = "Budgeting & Spending Caps")

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.Speed,
            title = "Daily Spending Cap",
            subtitle = userSettings.dailySpendingCap?.let {
              "${Money.of(it, homeCurrency).format()} per day"
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
              "${Money.of(it, homeCurrency).format()} per month"
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

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
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
                shape = PlutoShapes.small,
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

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
      ) {
        Column {
          SettingsSwitchRowItem(
            icon = Icons.Rounded.Fingerprint,
            title = "Biometric App Lock",
            subtitle = when {
              !canUseBiometricLock && userSettings.isBiometricLockEnabled ->
                "Device security unavailable • turn off to continue"
              !canUseBiometricLock ->
                "Unavailable • add a PIN, pattern, or biometric in Android Settings"
              userSettings.isBiometricLockEnabled ->
                "Enabled • Require biometric or PIN to unlock"
              else -> "Disabled • Instant access without lock"
            },
            checked = userSettings.isBiometricLockEnabled,
            enabled = canUseBiometricLock || userSettings.isBiometricLockEnabled,
            onCheckedChange = { checked ->
              if (!checked || canUseBiometricLock) {
                onUpdateBiometricLock(checked, userSettings.autoLockTimeoutMinutes)
              }
            },
            testTag = "settings_switch_biometric"
          )

          if (!canUseBiometricLock) {
            Text(
              text = "App Lock needs a screen lock enrolled on this device (PIN, pattern, or biometrics).",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
          }

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
                  shape = PlutoShapes.small,
                  color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f)
                ) {
                  Text(
                    text = "${userSettings.autoLockTimeoutMinutes}m",
                    style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = PlutoSpacing.sm, vertical = PlutoSpacing.xs)
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

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
      ) {
        Column {
          SettingsRowItem(
            icon = Icons.Rounded.CloudUpload,
            title = "Backup & Restore",
            subtitle = "Plain JSON archive (not encrypted) • contains sensitive data",
            onClick = onOpenBackupRestore,
            testTag = "settings_row_backup_restore",
            trailingContent = {
              Surface(
                shape = PlutoShapes.small,
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
            shape = PlutoShapes.small,
            modifier = Modifier.padding(bottom = PlutoSpacing.sm)
          ) {
            Text(
              text = "DEV MODE",
              style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
              color = MaterialTheme.colorScheme.onTertiaryContainer,
              modifier = Modifier.padding(horizontal = PlutoSpacing.sm, vertical = PlutoSpacing.xxs)
            )
          }
        }

        PlutoCard(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.large
        ) {
          Column {
            SettingsRowItem(
              icon = Icons.Rounded.AutoFixHigh,
              title = "Load Sample Data",
              subtitle = "Seed realistic 30-day expenses, currency wallets, and category budgets",
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

      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.large
      ) {
        Column {
          SettingsInfoRowItem(
            icon = Icons.Rounded.Info,
            title = "Pluto",
            subtitle = "Version 0.0.2 • Offline-First Multi-Currency Finance App",
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
private fun SettingsInfoRowItem(
  icon: ImageVector,
  title: String,
  subtitle: String,
  testTag: String,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
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

    Column {
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
      PlutoButton(
        text = "Done",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST
      )
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
    shape = PlutoShapes.medium,
    color = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
    modifier = Modifier
      .fillMaxWidth()
      .clip(PlutoShapes.medium)
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
  enabled: Boolean = true,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .padding(16.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Surface(
      shape = PlutoShapes.medium,
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
      enabled = enabled,
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
            shape = PlutoShapes.medium,
            color = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
            modifier = Modifier
              .fillMaxWidth()
              .clip(PlutoShapes.medium)
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
      PlutoButton(
        text = "Cancel",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST
      )
    }
  )
}

