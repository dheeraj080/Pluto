package com.pluto.app.ui.wallet

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.WalletTransaction
import com.pluto.app.domain.model.WalletTransactionType
import com.pluto.app.domain.model.WalletValuation
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.EmptyState
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.PlutoTopBar
import com.pluto.app.ui.components.SectionHeader
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoResponsive
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletDetailScreen(
  wallet: CurrencyWallet,
  viewModel: WalletViewModel,
  onNavigateBack: () -> Unit,
  modifier: Modifier = Modifier
) {
  LaunchedEffect(wallet.id) {
    viewModel.setSelectedWalletId(wallet.id)
  }

  val allWallets by viewModel.allWallets.collectAsStateWithLifecycle()
  val currentWallet = allWallets.find { it.id == wallet.id } ?: wallet
  var showDeleteDialog by remember { mutableStateOf(false) }

  if (showDeleteDialog) {
    AlertDialog(
      onDismissRequest = { showDeleteDialog = false },
      title = { Text("Delete ${currentWallet.currency.code} Wallet") },
      text = { Text("Are you sure you want to delete this wallet and its ledger history? Recorded expenses in this currency will NOT be affected.") },
      confirmButton = {
        TextButton(
          onClick = {
            viewModel.deleteWallet(currentWallet.id) {
              showDeleteDialog = false
              onNavigateBack()
            }
          },
          colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
          modifier = Modifier.testTag("confirm_delete_wallet_button")
        ) {
          Text("Delete")
        }
      },
      dismissButton = {
        TextButton(onClick = { showDeleteDialog = false }) {
          Text("Cancel")
        }
      }
    )
  }

  Box(
    modifier = modifier.fillMaxSize(),
    contentAlignment = Alignment.TopCenter
  ) {
    Scaffold(
      modifier = Modifier
        .widthIn(max = PlutoResponsive.ExpandedWidth)
        .fillMaxSize(),
      topBar = {
        PlutoTopBar(
          title = "${currentWallet.currency.code} Ledger",
          onNavigateBack = onNavigateBack,
          titleStyle = MaterialTheme.typography.titleLarge,
          backButtonTestTag = "wallet_detail_back_button",
          actions = {
            IconButton(
              onClick = { showDeleteDialog = true },
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("wallet_detail_delete_button")
            ) {
              Icon(
                Icons.Rounded.Delete,
                contentDescription = "Delete wallet",
                tint = MaterialTheme.colorScheme.error
              )
            }
          }
        )
      }
    ) { innerPadding ->
      WalletDetailPaneContent(
        wallet = currentWallet,
        viewModel = viewModel,
        modifier = Modifier.padding(innerPadding)
      )
    }
  }
}

@Composable
fun WalletDetailPaneContent(
  wallet: CurrencyWallet,
  viewModel: WalletViewModel,
  modifier: Modifier = Modifier
) {
  LaunchedEffect(wallet.id) {
    viewModel.setSelectedWalletId(wallet.id)
  }

  val allWallets by viewModel.allWallets.collectAsStateWithLifecycle()
  val currentWallet = allWallets.find { it.id == wallet.id } ?: wallet
  val transactions by viewModel.selectedWalletTransactions.collectAsStateWithLifecycle()
  val valuationSummary by viewModel.portfolioValuation.collectAsStateWithLifecycle()
  val isTransactionSubmitting by viewModel.isTransactionSubmitting.collectAsStateWithLifecycle()

  val walletValuation = valuationSummary?.walletValuations?.find { it.wallet.id == currentWallet.id }

  var showDepositDialog by remember { mutableStateOf(false) }
  var showWithdrawDialog by remember { mutableStateOf(false) }
  var showTransferDialog by remember { mutableStateOf(false) }
  var depositError by remember { mutableStateOf<String?>(null) }
  var withdrawError by remember { mutableStateOf<String?>(null) }
  var transferError by remember { mutableStateOf<String?>(null) }

  if (showDepositDialog) {
    DepositDialog(
      wallet = currentWallet,
      isSubmitting = isTransactionSubmitting,
      externalErrorMessage = depositError,
      onClearExternalError = { depositError = null },
      onDismiss = {
        depositError = null
        showDepositDialog = false
      },
      onConfirm = { amount, note ->
        depositError = null
        viewModel.deposit(
          walletId = currentWallet.id,
          amount = amount,
          note = note,
          onSuccess = {
            depositError = null
            showDepositDialog = false
          },
          onError = { msg -> depositError = msg }
        )
      }
    )
  }

  if (showWithdrawDialog) {
    WithdrawDialog(
      wallet = currentWallet,
      isSubmitting = isTransactionSubmitting,
      externalErrorMessage = withdrawError,
      onClearExternalError = { withdrawError = null },
      onDismiss = {
        withdrawError = null
        showWithdrawDialog = false
      },
      onConfirm = { amount, note ->
        withdrawError = null
        viewModel.withdraw(
          walletId = currentWallet.id,
          amount = amount,
          note = note,
          onSuccess = {
            withdrawError = null
            showWithdrawDialog = false
          },
          onError = { msg -> withdrawError = msg }
        )
      }
    )
  }

  if (showTransferDialog) {
    val otherWallets = allWallets.filter { it.id != currentWallet.id }
    TransferDialog(
      sourceWallet = currentWallet,
      availableWallets = otherWallets,
      isSubmitting = isTransactionSubmitting,
      externalErrorMessage = transferError,
      onClearExternalError = { transferError = null },
      onDismiss = {
        transferError = null
        showTransferDialog = false
      },
      onConfirm = { destWalletId, amount, note ->
        transferError = null
        viewModel.transfer(
          sourceWalletId = currentWallet.id,
          destinationWalletId = destWalletId,
          amount = amount,
          note = note,
          onSuccess = {
            transferError = null
            showTransferDialog = false
          },
          onError = { msg -> transferError = msg }
        )
      }
    )
  }

  LazyColumn(
    modifier = modifier
      .fillMaxSize()
      .testTag("wallet_detail_content"),
    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    // Header holding balance card
    item {
      WalletHeroCard(
        wallet = currentWallet,
        valuation = walletValuation
      )
    }

    // Actions: Deposit, Withdraw, Transfer
    item {
      WalletActionsRow(
        hasOtherWallets = allWallets.size > 1,
        onDepositClick = { showDepositDialog = true },
        onWithdrawClick = { showWithdrawDialog = true },
        onTransferClick = { showTransferDialog = true }
      )
    }

    // Section header
    item {
      SectionHeader(
        title = "Ledger History",
        badgeText = "${transactions.size} entries",
        modifier = Modifier.padding(top = PlutoSpacing.sm)
      )
    }

    if (transactions.isEmpty()) {
      item {
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
          contentAlignment = Alignment.Center
        ) {
          EmptyState(
            icon = Icons.AutoMirrored.Rounded.ReceiptLong,
            title = "No Ledger Transactions",
            description = "This wallet was opened with ${currentWallet.initialBalance.format()}. Record deposits, withdrawals, or transfers to track movements.",
            actionText = "Deposit Funds",
            onActionClick = { showDepositDialog = true },
            actionTestTag = "empty_deposit_action_button"
          )
        }
      }
    } else {
      items(transactions, key = { it.id }) { tx ->
        TransactionItemCard(
          transaction = tx,
          walletCurrency = currentWallet.currency
        )
      }
    }
  }
}

@Composable
private fun WalletHeroCard(
  wallet: CurrencyWallet,
  valuation: WalletValuation?,
  modifier: Modifier = Modifier
) {
  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge,
    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f),
    testTag = "wallet_hero_card"
  ) {
    Column(modifier = Modifier.padding(PlutoSpacing.xl)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          CurrencyBadge(currency = wallet.currency)
          Spacer(modifier = Modifier.width(10.dp))
          Text(
            text = wallet.currency.name,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
          )
        }

        Surface(
          shape = PlutoShapes.medium,
          color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)
        ) {
          Text(
            text = "Opened with ${wallet.initialBalance.format()}",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            modifier = Modifier.padding(horizontal = PlutoSpacing.sm, vertical = PlutoSpacing.xs),
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }

      Spacer(modifier = Modifier.height(14.dp))

      Text(
        text = "CURRENT HOLDING BALANCE",
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary
      )

      Text(
        text = wallet.balance.format(),
        style = MaterialTheme.typography.headlineLarge.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface
      )

      Spacer(modifier = Modifier.height(4.dp))

      when (valuation) {
        is WalletValuation.Valued -> {
          val primaryVal = valuation.destValue?.format() ?: valuation.homeValue.format()
          Text(
            text = "≈ $primaryVal in local currency",
            style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold
          )
          Spacer(modifier = Modifier.height(PlutoSpacing.xxs))
          Text(
            text = "≈ ${valuation.homeValue.format()} in reference currency (${valuation.homeValue.currency.code}) · ${valuation.compositionPercentage.toPlainString()}% of portfolio",
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Medium
          )
        }
        is WalletValuation.Unavailable -> {
          Text(
            text = "Exchange rate currently unavailable for portfolio valuation",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error
          )
        }
        null -> {}
      }
    }
  }
}

@Composable
private fun WalletActionsRow(
  hasOtherWallets: Boolean,
  onDepositClick: () -> Unit,
  onWithdrawClick: () -> Unit,
  onTransferClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(10.dp)
  ) {
    Button(
      onClick = onDepositClick,
      modifier = Modifier
        .weight(1f)
        .testTag("wallet_action_deposit"),
      shape = PlutoShapes.large,
      contentPadding = PaddingValues(vertical = 12.dp)
    ) {
      Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
      Spacer(modifier = Modifier.width(6.dp))
      Text("Deposit", fontWeight = FontWeight.SemiBold)
    }

    FilledTonalButton(
      onClick = onWithdrawClick,
      modifier = Modifier
        .weight(1f)
        .testTag("wallet_action_withdraw"),
      shape = PlutoShapes.large,
      contentPadding = PaddingValues(vertical = 12.dp)
    ) {
      Icon(Icons.Rounded.Remove, contentDescription = null, modifier = Modifier.size(18.dp))
      Spacer(modifier = Modifier.width(6.dp))
      Text("Withdraw", fontWeight = FontWeight.SemiBold)
    }

    OutlinedButton(
      onClick = onTransferClick,
      enabled = hasOtherWallets,
      modifier = Modifier
        .weight(1f)
        .testTag("wallet_action_transfer"),
      shape = PlutoShapes.large,
      contentPadding = PaddingValues(vertical = 12.dp)
    ) {
      Icon(Icons.Rounded.SwapHoriz, contentDescription = null, modifier = Modifier.size(18.dp))
      Spacer(modifier = Modifier.width(6.dp))
      Text("Transfer", fontWeight = FontWeight.SemiBold)
    }
  }
}

@Composable
private fun TransactionItemCard(
  transaction: WalletTransaction,
  walletCurrency: com.pluto.app.domain.model.Currency,
  modifier: Modifier = Modifier
) {
  val isPositive = transaction.isPositiveMovement
  val color = if (isPositive) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
  val iconTint = if (isPositive) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onErrorContainer
  val iconBg = if (isPositive) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.errorContainer

  val dateFormat = remember { SimpleDateFormat("MMM d, yyyy · HH:mm", Locale.getDefault()) }
  val dateString = remember(transaction.timestamp) { dateFormat.format(Date(transaction.timestamp)) }

  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.large,
    testTag = "wallet_transaction_item_${transaction.id}"
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(PlutoSpacing.lg),
      verticalAlignment = Alignment.CenterVertically
    ) {
      // Type Icon Circle
      Surface(
        shape = CircleShape,
        color = iconBg,
        modifier = Modifier.size(42.dp)
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            imageVector = when (transaction.type) {
              WalletTransactionType.DEPOSIT -> Icons.Rounded.ArrowDownward
              WalletTransactionType.WITHDRAWAL -> Icons.Rounded.ArrowUpward
              WalletTransactionType.TRANSFER_IN -> Icons.Rounded.SwapHoriz
              WalletTransactionType.TRANSFER_OUT -> Icons.Rounded.SwapHoriz
            },
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(20.dp)
          )
        }
      }

      Spacer(modifier = Modifier.width(14.dp))

      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = when (transaction.type) {
            WalletTransactionType.DEPOSIT -> "Deposit"
            WalletTransactionType.WITHDRAWAL -> "Withdrawal"
            WalletTransactionType.TRANSFER_IN -> "Transfer Received"
            WalletTransactionType.TRANSFER_OUT -> "Transfer Sent"
          },
          style = MaterialTheme.typography.titleSmall,
          fontWeight = FontWeight.Bold
        )

        if (transaction.note.isNotBlank()) {
          Text(
            text = transaction.note,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }

        if (transaction.targetAmount != null && transaction.exchangeRate != null) {
          val rateStr = transaction.exchangeRate.rate.stripTrailingZeros().toPlainString()
          val rateInfo = if (transaction.type == WalletTransactionType.TRANSFER_OUT) {
            "Sent to ${transaction.targetAmount.currency.code} (${transaction.targetAmount.format()} @ rate $rateStr)"
          } else {
            "Received from ${transaction.targetAmount.currency.code} (${transaction.targetAmount.format()} @ rate $rateStr)"
          }
          Text(
            text = rateInfo,
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.primary
          )
        }

        Text(
          text = dateString,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
      }

      Text(
        text = if (isPositive) "+${transaction.amount.format()}" else "-${transaction.amount.format()}",
        style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = color
      )
    }
  }
}

@Composable
private fun DepositDialog(
  wallet: CurrencyWallet,
  isSubmitting: Boolean = false,
  externalErrorMessage: String? = null,
  onClearExternalError: () -> Unit = {},
  onDismiss: () -> Unit,
  onConfirm: (BigDecimal, String) -> Unit
) {
  var amountInput by remember { mutableStateOf("") }
  var noteInput by remember { mutableStateOf("") }
  var errorMessage by remember { mutableStateOf<String?>(null) }
  val displayedError = errorMessage ?: externalErrorMessage

  AlertDialog(
    onDismissRequest = { if (!isSubmitting) onDismiss() },
    title = { Text("Deposit to ${wallet.currency.code} Wallet") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
          text = "Enter amount to add to your holding balance:",
          style = MaterialTheme.typography.bodyMedium
        )

        OutlinedTextField(
          value = amountInput,
          onValueChange = {
            val sanitized = wallet.currency.sanitizeAmountInput(it) ?: return@OutlinedTextField
            amountInput = sanitized
            errorMessage = null
            onClearExternalError()
          },
          label = { Text("Amount (${wallet.currency.code})") },
          placeholder = { Text(wallet.currency.zeroPlaceholder()) },
          singleLine = true,
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(
            keyboardType = if (wallet.currency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
          ),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("deposit_amount_input")
        )

        OutlinedTextField(
          value = noteInput,
          onValueChange = { noteInput = it },
          label = { Text("Note (optional)") },
          placeholder = { Text("e.g. Salary, ATM Deposit") },
          singleLine = true,
          modifier = Modifier
            .fillMaxWidth()
            .testTag("deposit_note_input")
        )

        if (displayedError != null) {
          Text(
            text = displayedError,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("deposit_error_message")
          )
        }
      }
    },
    confirmButton = {
      PlutoButton(
        text = if (isSubmitting) "Processing..." else "Deposit",
        onClick = {
          val bd = try {
            BigDecimal(amountInput.trim())
          } catch (_: Exception) {
            null
          }
          if (bd == null || bd <= BigDecimal.ZERO) {
            errorMessage = "Please enter an amount strictly greater than zero"
          } else {
            onConfirm(bd, noteInput)
          }
        },
        variant = PlutoButtonVariant.PRIMARY,
        enabled = !isSubmitting,
        testTag = "deposit_confirm_button"
      )
    },
    dismissButton = {
      PlutoButton(
        text = "Cancel",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST,
        enabled = !isSubmitting
      )
    }
  )
}

@Composable
private fun WithdrawDialog(
  wallet: CurrencyWallet,
  isSubmitting: Boolean = false,
  externalErrorMessage: String? = null,
  onClearExternalError: () -> Unit = {},
  onDismiss: () -> Unit,
  onConfirm: (BigDecimal, String) -> Unit
) {
  var amountInput by remember { mutableStateOf("") }
  var noteInput by remember { mutableStateOf("") }
  var errorMessage by remember { mutableStateOf<String?>(null) }
  val displayedError = errorMessage ?: externalErrorMessage

  AlertDialog(
    onDismissRequest = { if (!isSubmitting) onDismiss() },
    title = { Text("Withdraw from ${wallet.currency.code} Wallet") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
          text = "Available balance: ${wallet.balance.format()}",
          style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary
        )

        OutlinedTextField(
          value = amountInput,
          onValueChange = {
            val sanitized = wallet.currency.sanitizeAmountInput(it) ?: return@OutlinedTextField
            amountInput = sanitized
            errorMessage = null
            onClearExternalError()
          },
          label = { Text("Amount (${wallet.currency.code})") },
          placeholder = { Text(wallet.currency.zeroPlaceholder()) },
          singleLine = true,
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(
            keyboardType = if (wallet.currency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
          ),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("withdraw_amount_input")
        )

        OutlinedTextField(
          value = noteInput,
          onValueChange = { noteInput = it },
          label = { Text("Note (optional)") },
          placeholder = { Text("e.g. Cash withdrawal") },
          singleLine = true,
          modifier = Modifier
            .fillMaxWidth()
            .testTag("withdraw_note_input")
        )

        if (displayedError != null) {
          Text(
            text = displayedError,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("withdraw_error_message")
          )
        }
      }
    },
    confirmButton = {
      PlutoButton(
        text = if (isSubmitting) "Processing..." else "Withdraw",
        onClick = {
          val bd = try {
            BigDecimal(amountInput.trim())
          } catch (_: Exception) {
            null
          }
          if (bd == null || bd <= BigDecimal.ZERO) {
            errorMessage = "Please enter an amount strictly greater than zero"
          } else if (bd > wallet.balance.amount) {
            errorMessage = "Insufficient funds. Available: ${wallet.balance.format()}"
          } else {
            onConfirm(bd, noteInput)
          }
        },
        variant = PlutoButtonVariant.PRIMARY,
        enabled = !isSubmitting,
        testTag = "withdraw_confirm_button"
      )
    },
    dismissButton = {
      PlutoButton(
        text = "Cancel",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST,
        enabled = !isSubmitting
      )
    }
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TransferDialog(
  sourceWallet: CurrencyWallet,
  availableWallets: List<CurrencyWallet>,
  isSubmitting: Boolean = false,
  externalErrorMessage: String? = null,
  onClearExternalError: () -> Unit = {},
  onDismiss: () -> Unit,
  onConfirm: (String, BigDecimal, String) -> Unit
) {
  var selectedDestWalletId by remember {
    mutableStateOf(availableWallets.firstOrNull()?.id ?: "")
  }
  var amountInput by remember { mutableStateOf("") }
  var noteInput by remember { mutableStateOf("") }
  var errorMessage by remember { mutableStateOf<String?>(null) }
  var expandedDropdown by remember { mutableStateOf(false) }

  val targetWallet = availableWallets.find { it.id == selectedDestWalletId }
  val displayedError = errorMessage ?: externalErrorMessage

  AlertDialog(
    onDismissRequest = { if (!isSubmitting) onDismiss() },
    title = { Text("Transfer from ${sourceWallet.currency.code}") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
          text = "Available balance: ${sourceWallet.balance.format()}",
          style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary
        )

        // Target wallet selector
        ExposedDropdownMenuBox(
          expanded = expandedDropdown,
          onExpandedChange = { expandedDropdown = !expandedDropdown }
        ) {
          OutlinedTextField(
            value = targetWallet?.let { "${it.currency.name} (${it.currency.code})" } ?: "Select target wallet",
            onValueChange = {},
            readOnly = true,
            label = { Text("Transfer to") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedDropdown) },
            modifier = Modifier
              .fillMaxWidth()
              .menuAnchor(MenuAnchorType.PrimaryNotEditable)
              .testTag("transfer_dest_selector")
          )

          ExposedDropdownMenu(
            expanded = expandedDropdown,
            onDismissRequest = { expandedDropdown = false }
          ) {
            availableWallets.forEach { w ->
              DropdownMenuItem(
                text = { Text("${w.currency.name} (${w.currency.code}) — Balance: ${w.balance.format()}") },
                onClick = {
                  selectedDestWalletId = w.id
                  expandedDropdown = false
                  onClearExternalError()
                }
              )
            }
          }
        }

        OutlinedTextField(
          value = amountInput,
          onValueChange = {
            val sanitized = sourceWallet.currency.sanitizeAmountInput(it) ?: return@OutlinedTextField
            amountInput = sanitized
            errorMessage = null
            onClearExternalError()
          },
          label = { Text("Amount (${sourceWallet.currency.code})") },
          placeholder = { Text(sourceWallet.currency.zeroPlaceholder()) },
          singleLine = true,
          textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
          keyboardOptions = KeyboardOptions(
            keyboardType = if (sourceWallet.currency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
          ),
          modifier = Modifier
            .fillMaxWidth()
            .testTag("transfer_amount_input")
        )

        OutlinedTextField(
          value = noteInput,
          onValueChange = { noteInput = it },
          label = { Text("Note (optional)") },
          placeholder = { Text("e.g. Tuition transfer, FX swap") },
          singleLine = true,
          modifier = Modifier
            .fillMaxWidth()
            .testTag("transfer_note_input")
        )

        if (displayedError != null) {
          Text(
            text = displayedError,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag("transfer_error_message")
          )
        }
      }
    },
    confirmButton = {
      PlutoButton(
        text = if (isSubmitting) "Processing..." else "Confirm Transfer",
        onClick = {
          val bd = try {
            BigDecimal(amountInput.trim())
          } catch (_: Exception) {
            null
          }
          if (selectedDestWalletId.isBlank()) {
            errorMessage = "Please select a target wallet"
          } else if (bd == null || bd <= BigDecimal.ZERO) {
            errorMessage = "Please enter an amount strictly greater than zero"
          } else if (bd > sourceWallet.balance.amount) {
            errorMessage = "Insufficient funds. Available: ${sourceWallet.balance.format()}"
          } else {
            onConfirm(selectedDestWalletId, bd, noteInput)
          }
        },
        variant = PlutoButtonVariant.PRIMARY,
        enabled = !isSubmitting,
        testTag = "transfer_confirm_button"
      )
    },
    dismissButton = {
      PlutoButton(
        text = "Cancel",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST,
        enabled = !isSubmitting
      )
    }
  )
}
