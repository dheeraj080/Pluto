package com.pluto.app.ui.settings

import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.pluto.app.data.local.AppDatabase
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.ExchangeRateRepository
import com.pluto.app.domain.repository.UserSettingsRepository
import com.pluto.app.ui.currency.CustomRateOverridesDialog
import com.pluto.app.util.BackupSummary
import com.pluto.app.util.DatabaseBackupService
import com.pluto.app.util.ExpenseExportService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@Composable
fun SettingsDialogsHost(
  userSettings: UserSettings,
  showCustomRatesDialog: Boolean,
  onDismissCustomRates: () -> Unit,
  showBackupRestoreDialog: Boolean,
  onDismissBackupRestore: () -> Unit,
  database: AppDatabase?,
  exchangeRateRepository: ExchangeRateRepository?,
  userSettingsRepository: UserSettingsRepository?,
  snackbarHostState: SnackbarHostState,
  coroutineScope: CoroutineScope,
  context: Context
) {
  var activeOverrides by remember { mutableStateOf<List<ExchangeRate>>(emptyList()) }
  var pendingRestoreSummary by remember { mutableStateOf<BackupSummary?>(null) }
  var pendingRestoreJson by remember { mutableStateOf<String?>(null) }
  var isBackupProcessing by remember { mutableStateOf(false) }
  var backupStatusMessage by remember { mutableStateOf<String?>(null) }

  LaunchedEffect(showCustomRatesDialog) {
    if (showCustomRatesDialog && exchangeRateRepository != null) {
      activeOverrides = exchangeRateRepository.getManualOverrides()
    }
  }

  val createBackupLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.CreateDocument("application/json")
  ) { uri ->
    if (uri != null && database != null && userSettingsRepository != null) {
      coroutineScope.launch {
        isBackupProcessing = true
        backupStatusMessage = "Exporting encrypted database archive..."
        val success = withContext(Dispatchers.IO) {
          val json = DatabaseBackupService.generateBackupJson(database, userSettingsRepository)
          DatabaseBackupService.writeBackupToUri(context, uri, json)
        }
        isBackupProcessing = false
        if (success) {
          backupStatusMessage = "Backup archive saved successfully!"
          snackbarHostState.showSnackbar("Backup archive saved to Google Drive / Files!")
        } else {
          backupStatusMessage = "Failed to save backup file."
          snackbarHostState.showSnackbar("Failed to write backup archive")
        }
      }
    }
  }

  val openRestoreLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenDocument()
  ) { uri ->
    if (uri != null) {
      coroutineScope.launch {
        isBackupProcessing = true
        val json = withContext(Dispatchers.IO) {
          DatabaseBackupService.readBackupFromUri(context, uri)
        }
        if (json != null) {
          try {
            val summary = withContext(Dispatchers.IO) {
              DatabaseBackupService.parseBackupSummary(json)
            }
            pendingRestoreSummary = summary
            pendingRestoreJson = json
          } catch (e: Exception) {
            backupStatusMessage = "Corrupted or invalid backup file: ${e.message}"
            snackbarHostState.showSnackbar("Invalid Pluto backup archive")
          }
        } else {
          backupStatusMessage = "Could not read selected file."
        }
        isBackupProcessing = false
      }
    }
  }

  if (showCustomRatesDialog && exchangeRateRepository != null) {
    CustomRateOverridesDialog(
      activeOverrides = activeOverrides,
      defaultFromCurrency = userSettings.destinationCurrency,
      defaultToCurrency = userSettings.homeCurrency,
      onDismiss = onDismissCustomRates,
      onSaveOverride = { from, to, rate ->
        coroutineScope.launch {
          exchangeRateRepository.setManualOverride(from, to, rate)
          activeOverrides = exchangeRateRepository.getManualOverrides()
          snackbarHostState.showSnackbar("Custom rate 1 ${from.code} = $rate ${to.code} active")
        }
      },
      onClearOverride = { from, to ->
        coroutineScope.launch {
          exchangeRateRepository.clearManualOverride(from, to)
          activeOverrides = exchangeRateRepository.getManualOverrides()
          snackbarHostState.showSnackbar("Custom rate cleared. Market rates restored.")
        }
      }
    )
  }

  if (showBackupRestoreDialog) {
    BackupRestoreDialog(
      onDismiss = {
        onDismissBackupRestore()
        pendingRestoreSummary = null
        pendingRestoreJson = null
        backupStatusMessage = null
      },
      onCreateBackupClick = {
        createBackupLauncher.launch("pluto_backup_${System.currentTimeMillis()}.json")
      },
      onRestoreBackupClick = {
        openRestoreLauncher.launch(arrayOf("application/json", "*/*"))
      },
      onShareBackupClick = {
        if (database != null && userSettingsRepository != null) {
          coroutineScope.launch {
            val backupFile = withContext(Dispatchers.IO) {
              val json = DatabaseBackupService.generateBackupJson(database, userSettingsRepository)
              val cacheDir = File(context.cacheDir, "backups").apply { mkdirs() }
              File(cacheDir, "pluto_backup_${System.currentTimeMillis()}.json").apply {
                writeText(json, Charsets.UTF_8)
              }
            }
            ExpenseExportService.shareFile(context, backupFile, "application/json", "Pluto Backup Archive")
          }
        }
      },
      pendingRestoreSummary = pendingRestoreSummary,
      isProcessing = isBackupProcessing,
      statusMessage = backupStatusMessage,
      onConfirmRestore = { mode ->
        if (database != null && userSettingsRepository != null && pendingRestoreJson != null) {
          val restorePayload = pendingRestoreJson!!
          coroutineScope.launch {
            isBackupProcessing = true
            val result = withContext(Dispatchers.IO) {
              DatabaseBackupService.restoreBackup(
                database = database,
                userSettingsRepository = userSettingsRepository,
                jsonString = restorePayload,
                mode = mode
              )
            }
            isBackupProcessing = false
            if (result.success) {
              onDismissBackupRestore()
              pendingRestoreSummary = null
              pendingRestoreJson = null
              snackbarHostState.showSnackbar(result.message)
            } else {
              backupStatusMessage = result.message
              snackbarHostState.showSnackbar("Restore failed: ${result.message}")
            }
          }
        }
      }
    )
  }
}
