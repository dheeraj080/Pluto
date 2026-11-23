package com.pluto.app.ui.expenses

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.ZoomIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.math.RoundingMode
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Compact Bottom Sheet displaying financial transaction details.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseDetailBottomSheet(
  expense: Expense,
  userSettings: UserSettings? = null,
  onDismiss: () -> Unit,
  onEditExpense: (Expense) -> Unit,
  onDeleteExpense: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
    containerColor = MaterialTheme.colorScheme.surface,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    modifier = modifier.testTag("expense_detail_bottom_sheet")
  ) {
    ExpenseDetailSheetContent(
      expense = expense,
      userSettings = userSettings,
      onDismiss = onDismiss,
      onEditExpense = onEditExpense,
      onDeleteExpense = onDeleteExpense
    )
  }
}

/**
 * Backward-compatible wrapper for existing callers.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseDetailScreen(
  expense: Expense,
  userSettings: UserSettings? = null,
  onNavigateBack: () -> Unit,
  onEditExpense: (Expense) -> Unit,
  onDeleteExpense: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  ExpenseDetailBottomSheet(
    expense = expense,
    userSettings = userSettings,
    onDismiss = onNavigateBack,
    onEditExpense = onEditExpense,
    onDeleteExpense = onDeleteExpense,
    modifier = modifier
  )
}

@Composable
fun ExpenseDetailSheetContent(
  expense: Expense,
  userSettings: UserSettings? = null,
  onDismiss: () -> Unit,
  onEditExpense: (Expense) -> Unit,
  onDeleteExpense: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  var showDeleteDialog by remember { mutableStateOf(false) }
  var showReceiptViewerDialog by remember { mutableStateOf(false) }

  val dateFormat = remember { SimpleDateFormat("EEEE, d MMMM yyyy · HH:mm", Locale.getDefault()) }
  val homeCurrency = userSettings?.homeCurrency ?: expense.homeCurrency

  val primaryAmountStr = expense.originalAmount.format()
  val secondaryAmountStr = expense.homeAmount.format()

  // Delete Confirmation Dialog
  if (showDeleteDialog) {
    AlertDialog(
      onDismissRequest = { showDeleteDialog = false },
      title = { Text("Delete Expense", fontWeight = FontWeight.Bold) },
      text = { Text("Are you sure you want to delete this expense? Deleted expenses cannot be recovered.") },
      confirmButton = {
        TextButton(
          onClick = {
            showDeleteDialog = false
            onDeleteExpense(expense.id)
          },
          colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
          modifier = Modifier.testTag("confirm_delete_button")
        ) {
          Text("Delete", fontWeight = FontWeight.Bold)
        }
      },
      dismissButton = {
        TextButton(onClick = { showDeleteDialog = false }) {
          Text("Cancel")
        }
      }
    )
  }

  // Full-size Receipt Photo Dialog
  if (showReceiptViewerDialog && expense.receiptUri != null) {
    val receiptLoadState by rememberSampledReceiptState(
      uriString = expense.receiptUri,
      maxWidthPx = 1440,
      maxHeightPx = 1440
    )

    Dialog(onDismissRequest = { showReceiptViewerDialog = false }) {
      Surface(
        shape = PlutoShapes.large,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier
          .fillMaxWidth()
          .padding(8.dp)
      ) {
        Column(modifier = Modifier.padding(16.dp)) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "Receipt Photo",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold
            )
            IconButton(onClick = { showReceiptViewerDialog = false }) {
              Icon(Icons.Rounded.Close, contentDescription = "Close preview")
            }
          }

          Spacer(modifier = Modifier.height(12.dp))

          when (val loadState = receiptLoadState) {
            is ReceiptDecodeState.Loading -> {
              Box(
                modifier = Modifier
                  .fillMaxWidth()
                  .height(260.dp)
                  .clip(PlutoShapes.medium)
                  .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
              ) {
                CircularProgressIndicator(modifier = Modifier.size(32.dp))
              }
            }

            is ReceiptDecodeState.Loaded -> {
              Image(
                bitmap = loadState.bitmap,
                contentDescription = "Full receipt photo",
                contentScale = ContentScale.Fit,
                modifier = Modifier
                  .fillMaxWidth()
                  .height(380.dp)
                  .clip(PlutoShapes.medium)
              )
            }

            is ReceiptDecodeState.Failed -> {
              Box(
                modifier = Modifier
                  .fillMaxWidth()
                  .height(200.dp)
                  .clip(PlutoShapes.medium)
                  .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
              ) {
                Text(
                  text = "Unable to load receipt image",
                  style = MaterialTheme.typography.bodyMedium,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
          }
        }
      }
    }
  }

  Column(
    modifier = modifier
      .fillMaxWidth()
      .verticalScroll(rememberScrollState())
      .padding(bottom = 20.dp)
  ) {
    // 1. Header Row: Category Badge + Title & Quick Actions (Edit, Delete, Close)
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 2.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.weight(1f)
      ) {
        Surface(
          shape = CircleShape,
          color = MaterialTheme.colorScheme.primaryContainer,
          modifier = Modifier.size(38.dp)
        ) {
          Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
            Text(
              text = expense.category.name.firstOrNull()?.uppercase() ?: "E",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )
          }
        }

        Column {
          Text(
            text = expense.merchant.ifBlank { expense.category.name },
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Text(
              text = expense.category.name,
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (expense.isRecurring) {
              Surface(
                shape = PlutoShapes.small,
                color = MaterialTheme.colorScheme.primaryContainer,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
              ) {
                Text(
                  text = "Recurring · ${expense.recurrenceFrequency?.label ?: "Monthly"}",
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.Bold,
                  color = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
              }
            }
          }
        }
      }

      Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(
          onClick = { onEditExpense(expense) },
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("expense_detail_edit_button")
        ) {
          Icon(
            imageVector = Icons.Rounded.Edit,
            contentDescription = "Edit expense",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
          )
        }

        IconButton(
          onClick = { showDeleteDialog = true },
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("expense_detail_delete_button")
        ) {
          Icon(
            imageVector = Icons.Rounded.Delete,
            contentDescription = "Delete expense",
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(20.dp)
          )
        }

        IconButton(
          onClick = onDismiss,
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("expense_detail_back_button")
        ) {
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = "Close",
            modifier = Modifier.size(20.dp)
          )
        }
      }
    }

    // 2. Amount Hero Card (Compact dual-currency presentation)
    Card(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      shape = PlutoShapes.large,
      colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
      ),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "AMOUNT SPENT",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            letterSpacing = 0.5.sp
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = primaryAmountStr,
            style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.ExtraBold,
            color = MaterialTheme.colorScheme.onSurface
          )
          if (expense.originalCurrency != expense.homeCurrency) {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
              text = "≈ $secondaryAmountStr in ${homeCurrency.code}",
              style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.primary
            )
          }
        }

        CurrencyBadge(currency = expense.originalCurrency)
      }
    }

    // 3. Compact Transaction Details Card
    Card(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 4.dp),
      shape = PlutoShapes.large,
      colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
      )
    ) {
      Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
        DetailRow(label = "Date & Time", value = dateFormat.format(Date(expense.timestamp)))

        if (expense.merchant.isNotBlank() && expense.merchant != expense.category.name) {
          Spacer(modifier = Modifier.height(8.dp))
          DetailRow(label = "Merchant", value = expense.merchant)
        }

        if (expense.note.isNotBlank()) {
          Spacer(modifier = Modifier.height(8.dp))
          DetailRow(label = "Note", value = expense.note)
        }

        if (expense.originalCurrency != expense.homeCurrency) {
          Spacer(modifier = Modifier.height(8.dp))
          val formattedRate = expense.exchangeRate.rate.setScale(
            expense.homeCurrency.decimalPlaces.coerceAtLeast(2),
            RoundingMode.HALF_EVEN
          ).toPlainString()
          DetailRow(
            label = "Exchange Rate",
            value = "1 ${expense.originalCurrency.code} = ${expense.homeCurrency.symbol}$formattedRate ${expense.homeCurrency.code}"
          )
        }

        if (expense.isRecurring) {
          Spacer(modifier = Modifier.height(8.dp))
          DetailRow(
            label = "Subscription / Recurrence",
            value = "${expense.recurrenceFrequency?.label ?: "Monthly"} (Auto-logged)"
          )
        }
      }
    }

    // 4. Receipt Attachment Card (if present)
    if (expense.receiptUri != null) {
      Card(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 20.dp, vertical = 6.dp)
          .clip(PlutoShapes.large)
          .clickable(role = Role.Button) { showReceiptViewerDialog = true }
          .testTag("detail_receipt_card"),
        shape = PlutoShapes.large,
        colors = CardDefaults.cardColors(
          containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
        )
      ) {
        Row(
          modifier = Modifier.padding(10.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          ReceiptThumbnail(
            uriString = expense.receiptUri,
            modifier = Modifier
              .size(44.dp)
              .clip(PlutoShapes.small)
              .border(1.dp, MaterialTheme.colorScheme.outlineVariant, PlutoShapes.small)
          )

          Spacer(modifier = Modifier.width(12.dp))

          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = "Receipt Attached",
              style = MaterialTheme.typography.labelMedium,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onSurface
            )
            Text(
              text = "Tap to enlarge photo",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.primary
            )
          }

          Icon(
            imageVector = Icons.Rounded.ZoomIn,
            contentDescription = "Enlarge receipt",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
          )
        }
      }
    }

    // 5. Bottom Action Buttons (Delete & Edit)
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      OutlinedButton(
        onClick = { showDeleteDialog = true },
        modifier = Modifier
          .weight(1f)
          .height(48.dp)
          .testTag("expense_detail_delete_bottom_button"),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
        shape = PlutoShapes.medium
      ) {
        Icon(
          imageVector = Icons.Rounded.Delete,
          contentDescription = null,
          modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text("Delete", fontWeight = FontWeight.SemiBold)
      }

      Button(
        onClick = { onEditExpense(expense) },
        modifier = Modifier
          .weight(1f)
          .height(48.dp)
          .testTag("expense_detail_edit_bottom_button"),
        shape = PlutoShapes.medium
      ) {
        Icon(
          imageVector = Icons.Rounded.Edit,
          contentDescription = null,
          modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text("Edit", fontWeight = FontWeight.SemiBold)
      }
    }
  }
}

@Composable
private fun DetailRow(label: String, value: String) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(
      text = label,
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Text(
      text = value,
      style = MaterialTheme.typography.bodySmall,
      fontWeight = FontWeight.SemiBold,
      color = MaterialTheme.colorScheme.onSurface
    )
  }
}

@Composable
private fun ReceiptThumbnail(
  uriString: String?,
  modifier: Modifier = Modifier
) {
  val thumbnailTargetPx = with(LocalDensity.current) { 44.dp.roundToPx().coerceAtLeast(128) }
  val loadState by rememberSampledReceiptState(
    uriString = uriString,
    maxWidthPx = thumbnailTargetPx,
    maxHeightPx = thumbnailTargetPx
  )
  val bitmap = (loadState as? ReceiptDecodeState.Loaded)?.bitmap

  Surface(
    modifier = modifier,
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = PlutoShapes.medium
  ) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
      if (bitmap != null) {
        Image(
          bitmap = bitmap,
          contentDescription = "Receipt thumbnail",
          contentScale = ContentScale.Crop,
          modifier = Modifier.fillMaxSize()
        )
      } else {
        Icon(
          imageVector = Icons.AutoMirrored.Rounded.ReceiptLong,
          contentDescription = "Receipt",
          tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

private sealed interface ReceiptDecodeState {
  data object Loading : ReceiptDecodeState
  data class Loaded(val bitmap: ImageBitmap) : ReceiptDecodeState
  data object Failed : ReceiptDecodeState
}

@Composable
private fun rememberSampledReceiptState(
  uriString: String?,
  maxWidthPx: Int,
  maxHeightPx: Int
): androidx.compose.runtime.State<ReceiptDecodeState> {
  val context = LocalContext.current
  return produceState<ReceiptDecodeState>(
    initialValue = if (uriString == null) ReceiptDecodeState.Failed else ReceiptDecodeState.Loading,
    key1 = uriString,
    key2 = maxWidthPx,
    key3 = maxHeightPx
  ) {
    if (uriString.isNullOrBlank()) {
      value = ReceiptDecodeState.Failed
      return@produceState
    }
    value = ReceiptDecodeState.Loading
    val decoded = withContext(Dispatchers.IO) {
      decodeSampledReceiptBitmap(
        context = context,
        uriString = uriString,
        reqWidthPx = maxWidthPx,
        reqHeightPx = maxHeightPx
      )
    }
    value = if (decoded != null) {
      ReceiptDecodeState.Loaded(decoded)
    } else {
      ReceiptDecodeState.Failed
    }
  }
}

private fun decodeSampledReceiptBitmap(
  context: android.content.Context,
  uriString: String,
  reqWidthPx: Int,
  reqHeightPx: Int
): ImageBitmap? {
  return try {
    val uri = Uri.parse(uriString)
    val boundsOptions = BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }
    context.contentResolver.openInputStream(uri)?.use { stream ->
      BitmapFactory.decodeStream(stream, null, boundsOptions)
    }

    val sampleSize = calculateReceiptSampleSize(
      rawWidth = boundsOptions.outWidth,
      rawHeight = boundsOptions.outHeight,
      reqWidth = reqWidthPx,
      reqHeight = reqHeightPx
    )

    val decodeOptions = BitmapFactory.Options().apply {
      inSampleSize = sampleSize
    }
    context.contentResolver.openInputStream(uri)?.use { stream ->
      BitmapFactory.decodeStream(stream, null, decodeOptions)
    }?.asImageBitmap()
  } catch (_: Exception) {
    null
  }
}

internal fun calculateReceiptSampleSize(
  rawWidth: Int,
  rawHeight: Int,
  reqWidth: Int,
  reqHeight: Int
): Int {
  if (rawWidth <= 0 || rawHeight <= 0 || reqWidth <= 0 || reqHeight <= 0) {
    return 1
  }
  var inSampleSize = 1
  if (rawHeight > reqHeight || rawWidth > reqWidth) {
    val halfHeight = rawHeight / 2
    val halfWidth = rawWidth / 2
    while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
      inSampleSize *= 2
    }
  }
  return inSampleSize
}
