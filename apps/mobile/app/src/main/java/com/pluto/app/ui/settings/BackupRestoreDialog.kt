package com.pluto.app.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudUpload
import androidx.compose.material.icons.rounded.FileDownload
import androidx.compose.material.icons.rounded.FileUpload
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.util.BackupSummary
import com.pluto.app.util.RestoreMode
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Dialog enabling offline-first backup creation, Google Drive / local SAF exports,
 * and conflict-free restore validation.
 */
@Composable
fun BackupRestoreDialog(
  onDismiss: () -> Unit,
  onCreateBackupClick: () -> Unit,
  onRestoreBackupClick: () -> Unit,
  onShareBackupClick: () -> Unit,
  pendingRestoreSummary: BackupSummary? = null,
  isProcessing: Boolean = false,
  statusMessage: String? = null,
  onConfirmRestore: (RestoreMode) -> Unit = {}
) {
  val dateFormat = remember { SimpleDateFormat("MMM d, yyyy 'at' HH:mm", Locale.US) }

  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
          imageVector = Icons.Rounded.CloudUpload,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(28.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
          text = if (pendingRestoreSummary != null) "Restore Data" else "Backup & Restore",
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold
        )
      }
    },
    text = {
      Column(modifier = Modifier.fillMaxWidth()) {
        if (pendingRestoreSummary != null) {
          // Summary preview of archive pending restore
          Text(
            text = "Backup Archive Verified",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
          Spacer(modifier = Modifier.height(4.dp))
          Text(
            text = "Archive created on ${dateFormat.format(Date(pendingRestoreSummary.exportedAt))}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )

          Spacer(modifier = Modifier.height(14.dp))

          PlutoCard(
            shape = PlutoShapes.medium,
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.fillMaxWidth()
          ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Expenses:", style = MaterialTheme.typography.bodyMedium)
                Text(
                  text = "${pendingRestoreSummary.expenseCount} records",
                  style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
                  fontWeight = FontWeight.Bold
                )
              }
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Wallets:", style = MaterialTheme.typography.bodyMedium)
                Text(
                  text = "${pendingRestoreSummary.walletCount} accounts",
                  style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
                  fontWeight = FontWeight.Bold
                )
              }
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Ledger Transactions:", style = MaterialTheme.typography.bodyMedium)
                Text(
                  text = "${pendingRestoreSummary.transactionCount} entries",
                  style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
                  fontWeight = FontWeight.Bold
                )
              }
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Home Currency:", style = MaterialTheme.typography.bodyMedium)
                Text(pendingRestoreSummary.homeCurrency, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
              }
            }
          }

          Spacer(modifier = Modifier.height(16.dp))

          Text(
            text = "Choose how to apply this backup:",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold
          )

          Spacer(modifier = Modifier.height(8.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm)
          ) {
            PlutoButton(
              text = "Merge Data",
              onClick = { onConfirmRestore(RestoreMode.MERGE) },
              variant = PlutoButtonVariant.OUTLINED,
              testTag = "restore_merge_button",
              modifier = Modifier.weight(1f)
            )
            PlutoButton(
              text = "Replace All",
              onClick = { onConfirmRestore(RestoreMode.REPLACE) },
              variant = PlutoButtonVariant.PRIMARY,
              testTag = "restore_replace_button",
              modifier = Modifier.weight(1f)
            )
          }
        } else {
          // Standard Backup & Export actions
          Text(
            text = "Pluto stores your financial records securely on this device. You can create a portable JSON archive to back up to Google Drive, SD Card, or another phone anytime.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )

          if (!statusMessage.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(12.dp))
            Surface(
              shape = PlutoShapes.small,
              color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f),
              modifier = Modifier.fillMaxWidth()
            ) {
              Text(
                text = statusMessage,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(10.dp)
              )
            }
          }

          Spacer(modifier = Modifier.height(18.dp))

          // Action 1: Create Backup via SAF
          PlutoButton(
            text = "Save Backup (Google Drive / Files)",
            onClick = onCreateBackupClick,
            variant = PlutoButtonVariant.PRIMARY,
            leadingIcon = Icons.Rounded.FileUpload,
            testTag = "create_backup_file_button",
            modifier = Modifier.fillMaxWidth()
          )

          Spacer(modifier = Modifier.height(10.dp))

          // Action 2: Share Backup File
          PlutoButton(
            text = "Share Backup Archive",
            onClick = onShareBackupClick,
            variant = PlutoButtonVariant.OUTLINED,
            leadingIcon = Icons.Rounded.Share,
            testTag = "share_backup_button",
            modifier = Modifier.fillMaxWidth()
          )

          Spacer(modifier = Modifier.height(10.dp))

          // Action 3: Restore Backup via SAF
          PlutoButton(
            text = "Restore from Backup File",
            onClick = onRestoreBackupClick,
            variant = PlutoButtonVariant.OUTLINED,
            leadingIcon = Icons.Rounded.FileDownload,
            testTag = "open_restore_file_button",
            modifier = Modifier.fillMaxWidth()
          )
        }

        if (isProcessing) {
          Spacer(modifier = Modifier.height(16.dp))
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
          ) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
            Spacer(modifier = Modifier.width(10.dp))
            Text("Processing backup...", style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    },
    confirmButton = {
      PlutoButton(
        text = "Done",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST,
        testTag = "close_backup_dialog_button"
      )
    }
  )
}
