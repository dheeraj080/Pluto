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
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoResponsive
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
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
  val rateTimestampFormat = remember { SimpleDateFormat("d MMM yyyy · HH:mm", Locale.getDefault()) }
  val homeCurrency = expense.homeCurrency
  val displayTitle = expense.merchant.ifBlank { expense.category.name }

  val primaryAmountStr = expense.originalAmount.formatWithCode()
  val secondaryAmountStr = expense.homeAmount.formatWithCode()

  // Delete Confirmation Dialog
  if (showDeleteDialog) {
    AlertDialog(
      onDismissRequest = { showDeleteDialog = false },
      title = { Text("Delete Expense?", fontWeight = FontWeight.Bold) },
      text = {
        Text(
          "Delete $displayTitle ($primaryAmountStr)? You can undo this immediately from the confirmation banner."
        )
      },
      confirmButton = {
        TextButton(
          onClick = {
            showDeleteDialog = false
            onDeleteExpense(expense.id)
          },
          colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("confirm_delete_button")
        ) {
          Text("Delete", fontWeight = FontWeight.Bold)
        }
      },
      dismissButton = {
        TextButton(
          onClick = { showDeleteDialog = false },
          modifier = Modifier.minimumInteractiveComponentSize()
        ) {
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
      BoxWithConstraints {
        val isShortHeight = maxHeight < PlutoResponsive.ShortHeight
        val previewMaxHeight = if (isShortHeight) 280.dp else 520.dp
        val imageMaxHeight = if (isShortHeight) 160.dp else 380.dp
        Surface(
          shape = PlutoShapes.large,
          color = MaterialTheme.colorScheme.surface,
          modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = previewMaxHeight)
            .padding(8.dp)
        ) {
          Column(
            modifier = Modifier
              .verticalScroll(rememberScrollState())
              .padding(16.dp)
          ) {
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
              IconButton(
                onClick = { showReceiptViewerDialog = false },
                modifier = Modifier.minimumInteractiveComponentSize()
              ) {
                Icon(Icons.Rounded.Close, contentDescription = "Close preview")
              }
            }

            Spacer(modifier = Modifier.height(12.dp))

            when (val loadState = receiptLoadState) {
              is ReceiptDecodeState.Loading -> {
                Box(
                  modifier = Modifier
                    .fillMaxWidth()
                    .height(if (isShortHeight) 140.dp else 260.dp)
                    .clip(PlutoShapes.medium)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                  contentAlignment = Alignment.Center
                ) {
                  CircularProgressIndicator(modifier = Modifier.size(32.dp))
                }
              }

              is ReceiptDecodeState.Loaded -> {
                Box(
                  modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = imageMaxHeight)
                    .clip(PlutoShapes.medium),
                  contentAlignment = Alignment.Center
                ) {
                  Image(
                    bitmap = loadState.bitmap,
                    contentDescription = "Full receipt photo",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                  )
                }
              }

              is ReceiptDecodeState.Failed -> {
                Box(
                  modifier = Modifier
                    .fillMaxWidth()
                    .height(if (isShortHeight) 120.dp else 200.dp)
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
  }

  Column(
    modifier = modifier
      .fillMaxWidth()
      .navigationBarsPadding()
      .verticalScroll(rememberScrollState())
      .padding(bottom = 20.dp)
  ) {
    // 1. Header Row: Category Badge + Title & Single Close Button
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

        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = displayTitle,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
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

    // 2. Amount Hero Card (Dual-currency hierarchy)
    PlutoCard(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      shape = PlutoShapes.large,
      containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(
          modifier = Modifier
            .weight(1f)
            .padding(end = PlutoSpacing.sm)
        ) {
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
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = secondaryAmountStr,
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary
          )
        }

        CurrencyBadge(currency = expense.originalCurrency)
      }
    }

    // 3. Transaction Details & FX Provenance Card
    PlutoCard(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 4.dp),
      shape = PlutoShapes.large,
      containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
    ) {
      Column(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        DetailRow(label = "Date & Time", value = dateFormat.format(Date(expense.timestamp)), isNumeric = true)

        if (expense.merchant.isNotBlank() && expense.merchant != expense.category.name) {
          DetailRow(label = "Merchant", value = expense.merchant)
        }

        if (expense.note.isNotBlank()) {
          DetailRow(label = "Note", value = expense.note)
        }

        DetailRow(
          label = "Spent Amount",
          value = "${expense.originalAmount.format()} (${expense.originalCurrency.code})",
          isNumeric = true
        )
        DetailRow(
          label = "Reference Amount",
          value = "${expense.homeAmount.format()} (${homeCurrency.code})",
          isNumeric = true
        )
        if (expense.originalCurrency != expense.homeCurrency) {
          val formattedRate = formatRateNumber(expense.exchangeRate.rate, expense.homeCurrency)
          DetailRow(
            label = "Exchange Rate",
            value = "1 ${expense.originalCurrency.code} = ${expense.homeCurrency.symbol}$formattedRate ${expense.homeCurrency.code}",
            isNumeric = true
          )
          DetailRow(
            label = "Rate Source",
            value = rateSourceLabel(expense.exchangeRate.source)
          )
          if (expense.exchangeRate.timestamp > 0L) {
            DetailRow(
              label = "Rate Recorded",
              value = rateTimestampFormat.format(Date(expense.exchangeRate.timestamp)),
              isNumeric = true
            )
          }
        }

        if (expense.isRecurring) {
          DetailRow(
            label = "Recurrence",
            value = "${expense.recurrenceFrequency?.label ?: "Monthly"} (Auto-logged)"
          )
        }
      }
    }

    // 4. Receipt Attachment Card (if present)
    if (expense.receiptUri != null) {
      val thumbPx = with(LocalDensity.current) { 44.dp.roundToPx().coerceAtLeast(128) }
      val thumbLoadState by rememberSampledReceiptState(
        uriString = expense.receiptUri,
        maxWidthPx = thumbPx,
        maxHeightPx = thumbPx
      )
      val canEnlarge = thumbLoadState is ReceiptDecodeState.Loaded

      PlutoCard(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 20.dp, vertical = 6.dp),
        onClick = if (canEnlarge) {
          { showReceiptViewerDialog = true }
        } else null,
        shape = PlutoShapes.large,
        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        testTag = "detail_receipt_card"
      ) {
        Row(
          modifier = Modifier.padding(10.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          ReceiptThumbnail(
            loadState = thumbLoadState,
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
              text = when (thumbLoadState) {
                is ReceiptDecodeState.Loaded -> "Tap to enlarge photo"
                is ReceiptDecodeState.Loading -> "Loading receipt preview..."
                is ReceiptDecodeState.Failed -> "Receipt file unavailable on this device"
              },
              style = MaterialTheme.typography.bodySmall,
              color = when (thumbLoadState) {
                is ReceiptDecodeState.Loaded -> MaterialTheme.colorScheme.primary
                is ReceiptDecodeState.Loading -> MaterialTheme.colorScheme.onSurfaceVariant
                is ReceiptDecodeState.Failed -> MaterialTheme.colorScheme.error
              }
            )
          }

          if (canEnlarge) {
            Icon(
              imageVector = Icons.Rounded.ZoomIn,
              contentDescription = "Enlarge receipt",
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
          }
        }
      }
    }

    // 5. Single Primary Action Bar (Delete & Edit)
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = PlutoSpacing.md),
      horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.md)
    ) {
      PlutoButton(
        text = "Delete",
        onClick = { showDeleteDialog = true },
        variant = PlutoButtonVariant.DESTRUCTIVE,
        leadingIcon = Icons.Rounded.Delete,
        modifier = Modifier.weight(1f),
        testTag = "expense_detail_delete_button"
      )

      PlutoButton(
        text = "Edit",
        onClick = { onEditExpense(expense) },
        leadingIcon = Icons.Rounded.Edit,
        modifier = Modifier.weight(1f),
        testTag = "expense_detail_edit_button"
      )
    }
  }
}

@Composable
private fun DetailRow(label: String, value: String, isNumeric: Boolean = false) {
  val valueStyle = if (isNumeric) {
    MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle)
  } else {
    MaterialTheme.typography.bodySmall
  }
  val isLargeFontScale = LocalDensity.current.fontScale >= 1.35f

  if (isLargeFontScale) {
    Column(
      modifier = Modifier.fillMaxWidth(),
      verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
      Text(
        text = value,
        style = valueStyle,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface
      )
    }
  } else {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.Top
    ) {
      Text(
        text = label,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
          .weight(0.42f)
          .padding(end = PlutoSpacing.sm)
      )
      Text(
        text = value,
        style = valueStyle,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurface,
        textAlign = TextAlign.End,
        modifier = Modifier.weight(0.58f)
      )
    }
  }
}

@Composable
private fun ReceiptThumbnail(
  loadState: ReceiptDecodeState,
  modifier: Modifier = Modifier
) {
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
