package com.pluto.app.ui.wallet

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.AccountBalanceWallet
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.R
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.PortfolioValuationSummary
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.model.WalletValuation
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.EmptyState
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.RobotoMonoFontFamily
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletListScreen(
  viewModel: WalletViewModel,
  userSettings: UserSettings,
  onNavigateBack: () -> Unit,
  onAddWalletClick: () -> Unit,
  onWalletClick: (CurrencyWallet) -> Unit,
  onEditWalletClick: (CurrencyWallet) -> Unit,
  modifier: Modifier = Modifier
) {
  val valuationSummary by viewModel.portfolioValuation.collectAsStateWithLifecycle()
  var walletToDelete by remember { mutableStateOf<CurrencyWallet?>(null) }
  var selectedWalletId by remember { mutableStateOf<String?>(null) }

  if (walletToDelete != null) {
    val wallet = walletToDelete!!
    AlertDialog(
      onDismissRequest = { walletToDelete = null },
      title = { Text("Delete ${wallet.currency.code} Wallet?") },
      text = {
        Text("This removes the ${wallet.currency.code} wallet from your portfolio. Recorded ${wallet.currency.code} expenses remain intact.")
      },
      confirmButton = {
        TextButton(
          onClick = {
            viewModel.deleteWallet(wallet.id) {
              if (selectedWalletId == wallet.id) {
                selectedWalletId = null
              }
              walletToDelete = null
            }
          },
          colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
          modifier = Modifier.testTag("confirm_delete_wallet_button")
        ) {
          Text("Delete Wallet")
        }
      },
      dismissButton = {
        TextButton(onClick = { walletToDelete = null }) {
          Text("Cancel")
        }
      }
    )
  }

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        title = {
          Text(
            text = "Currency Wallets",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
        },
        navigationIcon = {
          IconButton(
            onClick = onNavigateBack,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("wallet_list_back_button")
          ) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.background
        )
      )
    },
    floatingActionButton = {
      val fabInteraction = remember { MutableInteractionSource() }
      FloatingActionButton(
        onClick = onAddWalletClick,
        interactionSource = fabInteraction,
        containerColor = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary,
        modifier = Modifier
          .plutoPressableScale(
            enabled = true,
            pressedScale = PlutoMotion.PressScale,
            interactionSource = fabInteraction
          )
          .testTag("wallet_fab_add")
      ) {
        Icon(imageVector = Icons.Rounded.Add, contentDescription = "Add Wallet")
      }
    }
  ) { innerPadding ->
    BoxWithConstraints(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
    ) {
      val isWideLayout = maxWidth >= 600.dp
      val summary = valuationSummary

      if (summary == null || !summary.hasAnyWallets) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
          EmptyState(
            icon = Icons.Rounded.AccountBalanceWallet,
            illustrationRes = R.drawable.img_empty_wallets,
            title = "No Currency Wallets",
            description = "Track money you hold across countries. Add a wallet for EUR, USD, INR or other currencies.",
            actionText = "Add Your First Wallet",
            onActionClick = onAddWalletClick,
            actionTestTag = "wallet_empty_add_button"
          )
        }
      } else if (isWideLayout) {
        val activeWallet = summary.walletValuations
          .find { it.wallet.id == selectedWalletId }?.wallet
          ?: summary.walletValuations.firstOrNull()?.wallet

        Row(modifier = Modifier.fillMaxSize()) {
          LazyColumn(
            modifier = Modifier
              .weight(0.46f)
              .fillMaxHeight()
              .testTag("wallet_list_items"),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
          ) {
            item {
              PortfolioHeroCard(summary = summary)
            }
            item {
              Text(
                text = "Your Wallets",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                  .padding(top = 8.dp, bottom = 4.dp)
                  .plutoHeading()
              )
            }
            items(summary.walletValuations, key = { it.wallet.id }) { valuation ->
              WalletItemCard(
                valuation = valuation,
                isSelected = activeWallet?.id == valuation.wallet.id,
                onCardClick = { selectedWalletId = valuation.wallet.id },
                onEditClick = { onEditWalletClick(valuation.wallet) },
                onDeleteClick = { walletToDelete = valuation.wallet }
              )
            }
          }

          VerticalDivider(
            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
          )

          Box(
            modifier = Modifier
              .weight(0.54f)
              .fillMaxHeight()
          ) {
            if (activeWallet != null) {
              WalletDetailPaneContent(
                wallet = activeWallet,
                viewModel = viewModel
              )
            }
          }
        }
      } else {
        LazyColumn(
          modifier = Modifier
            .fillMaxSize()
            .testTag("wallet_list_items"),
          contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
          item {
            PortfolioHeroCard(summary = summary)
          }

          item {
            Text(
              text = "Your Wallets",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              modifier = Modifier
                .padding(top = 8.dp, bottom = 4.dp)
                .plutoHeading()
            )
          }

          items(summary.walletValuations, key = { it.wallet.id }) { valuation ->
            WalletItemCard(
              valuation = valuation,
              onCardClick = { onWalletClick(valuation.wallet) },
              onEditClick = { onEditWalletClick(valuation.wallet) },
              onDeleteClick = { walletToDelete = valuation.wallet }
            )
          }
        }
      }
    }
  }
}

@Composable
fun PortfolioHeroCard(
  summary: PortfolioValuationSummary,
  modifier: Modifier = Modifier
) {
  val primaryAmount = summary.totalValuedDestAmount?.format() ?: summary.totalValuedHomeAmount.format()
  val secondaryAmount = summary.totalValuedHomeAmount.format()

  Card(
    modifier = modifier
      .fillMaxWidth()
      .testTag("portfolio_hero_card"),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
    ),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Column(modifier = Modifier.padding(20.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = "CURRENT PORTFOLIO VALUE",
          style = MaterialTheme.typography.labelMedium,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.primary
        )
        Text(
          text = "${summary.totalWalletsCount} currenc${if (summary.totalWalletsCount == 1) "y" else "ies"}",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      Spacer(modifier = Modifier.height(10.dp))

      Text(
        text = primaryAmount,
        style = MaterialTheme.typography.headlineLarge.copy(
          fontFamily = RobotoMonoFontFamily,
          fontFeatureSettings = "tnum"
        ),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )

      Spacer(modifier = Modifier.height(4.dp))

      Text(
        text = "≈ $secondaryAmount in home currency (${summary.homeCurrency.code})",
        style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Medium,
        color = MaterialTheme.colorScheme.primary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )

      if (summary.isPartiallyValued) {
        Spacer(modifier = Modifier.height(4.dp))
        Text(
          text = "(${summary.unavailableWalletsCount} wallet rate currently unavailable)",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.error
        )
      }
    }
  }
}

@Composable
private fun WalletItemCard(
  valuation: WalletValuation,
  onCardClick: () -> Unit,
  onEditClick: () -> Unit,
  onDeleteClick: () -> Unit,
  isSelected: Boolean = false,
  modifier: Modifier = Modifier
) {
  val wallet = valuation.wallet
  val cardInteraction = remember { MutableInteractionSource() }

  Card(
    modifier = modifier
      .fillMaxWidth()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.CardPressScale,
        interactionSource = cardInteraction
      )
      .clip(PlutoShapes.large)
      .clickable(
        interactionSource = cardInteraction,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onCardClick
      )
      .testTag("wallet_card_${wallet.currency.code.lowercase()}"),
    shape = PlutoShapes.large,
    colors = CardDefaults.cardColors(
      containerColor = if (isSelected) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f)
      } else {
        MaterialTheme.colorScheme.surface
      }
    ),
    border = if (isSelected) BorderStroke(1.5.dp, MaterialTheme.colorScheme.primary) else null,
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Column(modifier = Modifier.padding(16.dp)) {
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
            fontWeight = FontWeight.SemiBold
          )
        }

        Row {
          IconButton(
            onClick = onEditClick,
            modifier = Modifier
              .size(48.dp)
              .testTag("edit_wallet_${wallet.currency.code.lowercase()}")
          ) {
            Icon(Icons.Rounded.Edit, contentDescription = "Edit balance", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
          }
          IconButton(
            onClick = onDeleteClick,
            modifier = Modifier
              .size(48.dp)
              .testTag("delete_wallet_${wallet.currency.code.lowercase()}")
          ) {
            Icon(Icons.Rounded.Delete, contentDescription = "Delete wallet", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
      ) {
        Column {
          Text(
            text = "Holding Balance",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
          Text(
            text = wallet.balance.format(),
            style = MaterialTheme.typography.titleLarge.copy(
              fontFamily = RobotoMonoFontFamily,
              fontFeatureSettings = "tnum"
            ),
            fontWeight = FontWeight.Bold
          )
        }

        when (valuation) {
          is WalletValuation.Valued -> {
            Column(horizontalAlignment = Alignment.End) {
              val primaryVal = valuation.destValue?.format() ?: valuation.homeValue.format()
              Text(
                text = primaryVal,
                style = MaterialTheme.typography.titleMedium.copy(
                  fontFamily = RobotoMonoFontFamily,
                  fontFeatureSettings = "tnum"
                ),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
              )
              Text(
                text = "≈ ${valuation.homeValue.format()}",
                style = MaterialTheme.typography.bodySmall.copy(
                  fontFamily = RobotoMonoFontFamily,
                  fontFeatureSettings = "tnum"
                ),
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Medium
              )
              Text(
                text = "${valuation.compositionPercentage.toPlainString()}% of portfolio",
                style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
          is WalletValuation.Unavailable -> {
            Text(
              text = "Rate unavailable",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.error,
              fontWeight = FontWeight.Medium
            )
          }
        }
      }
    }
  }
}
