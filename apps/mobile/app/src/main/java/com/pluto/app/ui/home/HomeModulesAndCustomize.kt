package com.pluto.app.ui.home

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.AccountBalance
import androidx.compose.material.icons.rounded.AccountBalanceWallet
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CreditCard
import androidx.compose.material.icons.rounded.CurrencyExchange
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.PieChart
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material.icons.rounded.Wallet
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.CurrencyWallet
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.PortfolioValuationSummary
import com.pluto.app.domain.model.RunwayPaceStatus
import com.pluto.app.domain.model.TermRunwaySummary
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.theme.rememberPrefersReducedMotion
import java.math.BigDecimal
import java.util.Locale

/**
 * Stacked Dual Wallet Hero:
 * - Back card: Warm Harvest Gold / Sand Home Reserve account.
 * - Front card: Deep Forest Green (or Luminous Mint in dark mode) Active Travel Wallet
 *   with an inline Dual-Zone Clock row in the header.
 */
@Composable
fun StackedCardsHero(
  summary: DashboardSummary,
  portfolioValuation: PortfolioValuationSummary?,
  userSettings: UserSettings,
  wallets: List<CurrencyWallet> = emptyList(),
  onNavigateToWallets: () -> Unit = {},
  onClockClick: () -> Unit = {},
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destinationCurrency = userSettings.destinationCurrency

  val travelWallet = wallets.find { it.currency.code.equals(destinationCurrency.code, ignoreCase = true) }
    ?: wallets.firstOrNull { !it.currency.code.equals(homeCurrency.code, ignoreCase = true) }
    ?: wallets.firstOrNull()

  val homeWallet = wallets.find { it.currency.code.equals(homeCurrency.code, ignoreCase = true) }
    ?: wallets.getOrNull(1)

  val travelWalletBalance = travelWallet?.balance?.format()
    ?: "${destinationCurrency.symbol}0.00"

  val homeWalletBalance = homeWallet?.balance?.format()
    ?: "${homeCurrency.symbol}0.00"

  Box(
    modifier = modifier
      .fillMaxWidth()
      .testTag("stacked_cards_hero")
  ) {
    // Back / Layered Card: Home Reserve Account (Warm Harvest Gold)
    val reserveInteraction = remember { MutableInteractionSource() }
    Surface(
      shape = PlutoShapes.extraLarge,
      color = MaterialTheme.colorScheme.tertiaryContainer,
      modifier = Modifier
        .fillMaxWidth()
        .heightIn(min = 124.dp)
        .align(Alignment.TopCenter)
        .plutoPressableScale(
          enabled = true,
          pressedScale = PlutoMotion.CardPressScale,
          interactionSource = reserveInteraction
        )
        .clip(PlutoShapes.extraLarge)
        .clickable(
          interactionSource = reserveInteraction,
          indication = androidx.compose.material3.ripple(),
          role = Role.Button,
          onClick = onNavigateToWallets
        )
        .testTag("home_reserve_hero_card")
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.AccountBalance,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onTertiaryContainer,
            modifier = Modifier.size(16.dp)
          )
          Spacer(modifier = Modifier.width(6.dp))
          Text(
            text = "HOME RESERVE · ${homeCurrency.code}",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onTertiaryContainer
          )
        }

        Text(
          text = homeWalletBalance,
          style = MaterialTheme.typography.labelLarge.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onTertiaryContainer
        )
      }
    }

    // Front Card: Active Travel Wallet (Deep Forest Green / Luminous Mint)
    val frontInteraction = remember { MutableInteractionSource() }
    Surface(
      shape = PlutoShapes.extraLarge,
      color = MaterialTheme.colorScheme.primary,
      modifier = Modifier
        .fillMaxWidth()
        .padding(top = 46.dp)
        .align(Alignment.BottomCenter)
        .plutoPressableScale(
          enabled = true,
          pressedScale = PlutoMotion.CardPressScale,
          interactionSource = frontInteraction
        )
        .clip(PlutoShapes.extraLarge)
        .clickable(
          interactionSource = frontInteraction,
          indication = androidx.compose.material3.ripple(),
          role = Role.Button,
          onClick = onNavigateToWallets
        )
        .testTag("main_wallet_hero_card")
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
      ) {
        // Inline Dual-Zone Clock inside card header
        DualZoneClockInlineRow(
          userSettings = userSettings,
          onClick = onClockClick
        )

        // Wallet Header Row
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Surface(
              shape = CircleShape,
              color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.16f),
              modifier = Modifier.size(28.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = Icons.Rounded.CreditCard,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.onPrimary,
                  modifier = Modifier.size(16.dp)
                )
              }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = "ACTIVE TRAVEL WALLET",
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              letterSpacing = 0.8.sp,
              color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f)
            )
          }

          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.18f)
          ) {
            Text(
              text = travelWallet?.currency?.code ?: destinationCurrency.code,
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onPrimary,
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
            )
          }
        }

        // Prominent Travel Balance + Portfolio Equivalent
        Column {
          Text(
            text = "Available Travel Funds",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = travelWalletBalance,
            style = MaterialTheme.typography.displaySmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.testTag("hero_travel_balance_amount")
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = portfolioValuation?.let { valuation ->
              "Total Portfolio: ${valuation.totalValuedHomeAmount.format()} in ${homeCurrency.code}"
            } ?: "Trip Currency: ${destinationCurrency.name}",
            style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }

        // Bottom Row: Account Count + Manage Wallets Pill
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = "Accounts",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.72f)
            )
            Text(
              text = if (wallets.isNotEmpty()) {
                "${wallets.size} Active ${if (wallets.size == 1) "Wallet" else "Wallets"}"
              } else {
                "1 Primary Wallet"
              },
              style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onPrimary
            )
          }

          val manageInteraction = remember { MutableInteractionSource() }
          Surface(
            shape = PlutoShapes.extraLarge,
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .plutoPressableScale(
                enabled = true,
                pressedScale = PlutoMotion.PressScale,
                interactionSource = manageInteraction
              )
              .clip(PlutoShapes.extraLarge)
              .clickable(
                interactionSource = manageInteraction,
                indication = androidx.compose.material3.ripple(),
                role = Role.Button,
                onClick = onNavigateToWallets
              )
              .testTag("stacked_card_adjust_budget_button")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.AccountBalanceWallet,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.size(16.dp)
              )
              Spacer(modifier = Modifier.width(6.dp))
              Text(
                text = "Manage Wallets",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
              )
            }
          }
        }
      }
    }
  }
}

/**
 * Fixed 4-action pill row directly below the Stacked Dual Wallet hero.
 * Non-redundant actions: + Expense, Convert, Transfer, + Income.
 */
@Composable
fun FixedActionDock(
  onAddExpense: () -> Unit,
  onConvert: () -> Unit,
  onTransfer: () -> Unit,
  onAddIncome: () -> Unit,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .testTag("fixed_action_dock"),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    ActionDockPill(
      icon = Icons.Rounded.Add,
      label = "Expense",
      onClick = onAddExpense,
      containerColor = MaterialTheme.colorScheme.primary,
      contentColor = MaterialTheme.colorScheme.onPrimary,
      border = null,
      testTag = "quick_action_expense",
      modifier = Modifier.weight(1f)
    )
    ActionDockPill(
      icon = Icons.Rounded.CurrencyExchange,
      label = "Convert",
      onClick = onConvert,
      containerColor = MaterialTheme.colorScheme.surface,
      contentColor = MaterialTheme.colorScheme.onSurface,
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
      testTag = "quick_action_convert",
      modifier = Modifier.weight(1f)
    )
    ActionDockPill(
      icon = Icons.Rounded.SwapHoriz,
      label = "Transfer",
      onClick = onTransfer,
      containerColor = MaterialTheme.colorScheme.surface,
      contentColor = MaterialTheme.colorScheme.onSurface,
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
      testTag = "quick_action_transfer",
      modifier = Modifier.weight(1f)
    )
    ActionDockPill(
      icon = Icons.Rounded.ArrowDownward,
      label = "Income",
      onClick = onAddIncome,
      containerColor = MaterialTheme.colorScheme.secondaryContainer,
      contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
      border = null,
      testTag = "quick_action_income",
      modifier = Modifier.weight(1f)
    )
  }
}

@Composable
private fun ActionDockPill(
  icon: ImageVector,
  label: String,
  onClick: () -> Unit,
  containerColor: Color,
  contentColor: Color,
  border: BorderStroke?,
  testTag: String,
  modifier: Modifier = Modifier
) {
  val interactionSource = remember { MutableInteractionSource() }
  Surface(
    shape = PlutoShapes.large,
    color = containerColor,
    border = border,
    modifier = modifier
      .heightIn(min = 48.dp)
      .minimumInteractiveComponentSize()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.PressScale,
        interactionSource = interactionSource
      )
      .clip(PlutoShapes.large)
      .clickable(
        interactionSource = interactionSource,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onClick
      )
      .testTag(testTag)
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 6.dp, vertical = 10.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center
    ) {
      Icon(
        imageVector = icon,
        contentDescription = label,
        tint = contentColor,
        modifier = Modifier.size(18.dp)
      )
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = contentColor,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}

/**
 * Compact borderless Portfolio Breakdown module (toggleable via Customize Home).
 */
@Composable
fun PortfolioOverviewModuleCard(
  portfolioValuation: PortfolioValuationSummary?,
  wallets: List<CurrencyWallet>,
  userSettings: UserSettings,
  onNavigateToWallets: () -> Unit,
  modifier: Modifier = Modifier
) {
  val interaction = remember { MutableInteractionSource() }
  Card(
    modifier = modifier
      .fillMaxWidth()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.CardPressScale,
        interactionSource = interaction
      )
      .clip(PlutoShapes.extraLarge)
      .clickable(
        interactionSource = interaction,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onNavigateToWallets
      )
      .testTag("module_card_stacked_wallets"),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.Wallet,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp)
          )
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = "WALLET PORTFOLIO BREAKDOWN",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
        }
        Text(
          text = "${wallets.size} accounts",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }

      if (portfolioValuation != null && portfolioValuation.walletValuations.isNotEmpty()) {
        portfolioValuation.walletValuations.take(3).forEach { valuation ->
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "${valuation.wallet.currency.flagEmoji} ${valuation.wallet.currency.code}",
              style = MaterialTheme.typography.bodyMedium,
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSurface
            )
            Column(horizontalAlignment = Alignment.End) {
              Text(
                text = valuation.wallet.balance.format(),
                style = MaterialTheme.typography.bodyMedium.merge(PlutoNumericStyle),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
              )
              if (valuation is com.pluto.app.domain.model.WalletValuation.Valued) {
                Text(
                  text = "≈ ${valuation.homeValue.format()} · ${valuation.compositionPercentage.toPlainString()}%",
                  style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
          }
        }
      } else {
        Text(
          text = "No multi-currency wallets yet. Tap to open a ${userSettings.destinationCurrency.code} or ${userSettings.homeCurrency.code} wallet.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

/**
 * Calm borderless Daily Safe-to-Spend feed module (replaces heavy radial gauge on Home).
 */
@Composable
fun DailySafeToSpendModuleCard(
  summary: DashboardSummary,
  userSettings: UserSettings,
  onOpenCapsDialog: () -> Unit,
  onUpdateWarningThreshold: (Double?, Boolean) -> Unit,
  onTestNotification: () -> Boolean,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency
  val destCurrency = userSettings.destinationCurrency
  val dailyCap = userSettings.dailySpendingCap
  val progress = (summary.dailyCapProgress ?: 0f).coerceIn(0f, 1f)

  val isExceeded = summary.isDailyBudgetExceeded
  val isBelowWarning = summary.isBelowWarningThreshold
  val isCaution = summary.isDailyBudgetCautious

  var showThresholdDialog by remember { mutableStateOf(false) }

  val statusColor = when {
    isExceeded -> MaterialTheme.colorScheme.error
    isBelowWarning || isCaution -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.secondary
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
    isExceeded -> "Exceeded"
    isBelowWarning -> "Safety Alert"
    isCaution -> "Caution"
    dailyCap != null -> "On Track"
    else -> "Daily Flow"
  }
  val statusIcon = when {
    isExceeded || isCaution -> Icons.Rounded.Warning
    isBelowWarning -> Icons.Rounded.NotificationsActive
    dailyCap != null -> Icons.Rounded.CheckCircle
    else -> Icons.Rounded.Info
  }

  val hasBudgetBase = dailyCap != null || summary.todayIncomeHome.amount > BigDecimal.ZERO
  val isRemainingNegative = summary.safeToSpendTodayHome.amount < BigDecimal.ZERO
  val primaryAmountFormatted = if (summary.safeToSpendTodayDest != null) {
    if (isRemainingNegative) {
      "-${destCurrency.symbol}${summary.safeToSpendTodayDest.amount.abs().toPlainString()}"
    } else {
      summary.safeToSpendTodayDest.format()
    }
  } else if (hasBudgetBase) {
    summary.safeToSpendTodayHome.format()
  } else {
    summary.todayDestSpending?.format() ?: summary.todayHomeSpending.format()
  }
  val secondaryAmountFormatted = if (hasBudgetBase) {
    summary.safeToSpendTodayHome.format()
  } else {
    summary.todayHomeSpending.format()
  }

  val prefersReducedMotion = rememberPrefersReducedMotion()
  val animatedProgress by animateFloatAsState(
    targetValue = progress,
    animationSpec = tween(
      durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.EntranceDurationMs,
      easing = FastOutSlowInEasing
    ),
    label = "daily_safe_spend_progress"
  )

  Card(
    modifier = modifier
      .fillMaxWidth()
      .testTag("module_card_daily_safe_to_spend"),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Surface(
          shape = PlutoShapes.medium,
          color = statusContainerColor
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = statusIcon,
              contentDescription = null,
              tint = statusColor,
              modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(5.dp))
            Text(
              text = statusLabel,
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = statusOnContainerColor
            )
          }
        }

        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          val alertInteraction = remember { MutableInteractionSource() }
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .clip(PlutoShapes.medium)
              .clickable(
                interactionSource = alertInteraction,
                indication = androidx.compose.material3.ripple(),
                role = Role.Button
              ) { showThresholdDialog = true }
              .testTag("gauge_threshold_button")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = if (isBelowWarning) Icons.Rounded.NotificationsActive else Icons.Rounded.Notifications,
                contentDescription = "Alert Threshold",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(14.dp)
              )
              Spacer(modifier = Modifier.width(4.dp))
              Text(
                text = "Alert",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }

          val capInteraction = remember { MutableInteractionSource() }
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .clip(PlutoShapes.medium)
              .clickable(
                interactionSource = capInteraction,
                indication = androidx.compose.material3.ripple(),
                role = Role.Button,
                onClick = onOpenCapsDialog
              )
              .testTag("dashboard_hero_edit_caps_button")
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.Tune,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(14.dp)
              )
              Spacer(modifier = Modifier.width(4.dp))
              Text(
                text = if (dailyCap != null) "Edit Cap" else "Set Cap",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
              )
            }
          }
        }
      }

      Column {
        Text(
          text = "DAILY SAFE-TO-SPEND",
          style = MaterialTheme.typography.labelSmall,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
          text = primaryAmountFormatted,
          style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = if (isExceeded) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
          modifier = Modifier.testTag("gauge_primary_amount")
        )
        Text(
          text = "≈ $secondaryAmountFormatted in ${homeCurrency.code}",
          style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier.testTag("gauge_secondary_amount")
        )
      }

      LinearProgressIndicator(
        progress = { animatedProgress },
        modifier = Modifier
          .fillMaxWidth()
          .height(6.dp)
          .clip(PlutoShapes.extraSmall),
        color = statusColor,
        trackColor = MaterialTheme.colorScheme.surfaceVariant,
        strokeCap = StrokeCap.Round
      )

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        val capText = summary.dailySpendingCapDest?.format()
          ?: dailyCap?.let { "${homeCurrency.symbol}${String.format(Locale.US, "%.0f", it)}" }
          ?: "—"
        Text(
          text = "Daily Cap: $capText",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        val spentDestText = summary.todayDestSpending?.format() ?: summary.todayHomeSpending.format()
        Text(
          text = "Spent today: $spentDestText",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.SemiBold,
          color = if (isExceeded) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
        )
      }
    }
  }

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

/**
 * Compact borderless Cycle / Semester Runway module card.
 */
@Composable
fun CycleRunwayModuleCard(
  runwaySummary: TermRunwaySummary?,
  userSettings: UserSettings,
  onEditTermClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val interaction = remember { MutableInteractionSource() }
  Card(
    modifier = modifier
      .fillMaxWidth()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.CardPressScale,
        interactionSource = interaction
      )
      .clip(PlutoShapes.extraLarge)
      .clickable(
        interactionSource = interaction,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onEditTermClick
      )
      .testTag("module_card_cycle_runway"),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    if (runwaySummary == null) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(18.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
          Icon(
            imageVector = Icons.Rounded.School,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
          )
          Spacer(modifier = Modifier.width(10.dp))
          Column {
            Text(
              text = "Semester & Cycle Runway",
              style = MaterialTheme.typography.titleSmall,
              fontWeight = FontWeight.Bold
            )
            Text(
              text = "Set allowance and fixed tuition to calculate daily pace",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
        IconButton(
          onClick = onEditTermClick,
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("runway_edit_button")
        ) {
          Icon(
            imageVector = Icons.Rounded.Edit,
            contentDescription = "Edit Term Settings",
            tint = MaterialTheme.colorScheme.primary
          )
        }
      }
      return@Card
    }

    val homeCurrency = userSettings.homeCurrency
    val paceColor = when (runwaySummary.paceStatus) {
      RunwayPaceStatus.ON_TRACK -> MaterialTheme.colorScheme.secondary
      RunwayPaceStatus.CAUTION -> MaterialTheme.colorScheme.tertiary
      RunwayPaceStatus.DEFICIT -> MaterialTheme.colorScheme.error
    }
    val prefersReducedMotion = rememberPrefersReducedMotion()
    val percentDaysPassed = (runwaySummary.percentPassed / 100f).coerceIn(0f, 1f)
    val animatedProgress by animateFloatAsState(
      targetValue = percentDaysPassed,
      animationSpec = tween(
        durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.EntranceDurationMs,
        easing = FastOutSlowInEasing
      ),
      label = "cycle_runway_progress"
    )

    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
          Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(32.dp)
          ) {
            Box(contentAlignment = Alignment.Center) {
              Icon(
                imageVector = Icons.Rounded.School,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(18.dp)
              )
            }
          }
          Spacer(modifier = Modifier.width(10.dp))
          Column {
            Text(
              text = runwaySummary.termName.uppercase(),
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis
            )
            Text(
              text = "Cycle Runway",
              style = MaterialTheme.typography.titleSmall,
              fontWeight = FontWeight.SemiBold,
              color = MaterialTheme.colorScheme.onSurface
            )
          }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
          Surface(
            shape = PlutoShapes.medium,
            color = paceColor.copy(alpha = 0.14f)
          ) {
            Text(
              text = runwaySummary.paceStatus.label,
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = paceColor,
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
          }
          IconButton(
            onClick = onEditTermClick,
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("runway_edit_button")
          ) {
            Icon(
              imageVector = Icons.Rounded.Edit,
              contentDescription = "Edit Term Settings",
              tint = MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.size(18.dp)
            )
          }
        }
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          val primaryDaily = runwaySummary.dailyRunwaySafeToSpendDest ?: runwaySummary.dailyRunwaySafeToSpendHome
          val secondaryDaily = if (primaryDaily.currency != homeCurrency) runwaySummary.dailyRunwaySafeToSpendHome else null
          Text(
            text = "${primaryDaily.format()} / day",
            style = MaterialTheme.typography.headlineSmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.testTag("runway_safe_to_spend_value")
          )
          if (secondaryDaily != null) {
            Text(
              text = "≈ ${secondaryDaily.format()} / day in ${homeCurrency.code}",
              style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        Surface(
          shape = PlutoShapes.large,
          color = MaterialTheme.colorScheme.surfaceVariant,
          modifier = Modifier.testTag("runway_days_remaining")
        ) {
          Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
          ) {
            Text(
              text = "${runwaySummary.daysRemaining}",
              style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )
            Text(
              text = "days left",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }

      LinearProgressIndicator(
        progress = { animatedProgress },
        modifier = Modifier
          .fillMaxWidth()
          .height(6.dp)
          .clip(PlutoShapes.extraSmall),
        color = paceColor,
        trackColor = MaterialTheme.colorScheme.surfaceVariant,
        strokeCap = StrokeCap.Round
      )

      val remainingMoney = runwaySummary.remainingDiscretionaryDest ?: runwaySummary.remainingDiscretionaryHome
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text(
          text = "Discretionary: ${remainingMoney.format()} left",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
          text = "${(percentDaysPassed * 100).toInt()}% passed",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

/**
 * Category Budgets module wrapper that shows CollapsibleCategoryBudgets when populated
 * or a compact prompt card when no expenses exist yet.
 */
@Composable
fun CategoryBudgetsModuleCard(
  categories: List<CategorySpendingSummary>,
  isExpanded: Boolean,
  onToggle: () -> Unit,
  onManageBudgetsClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  if (categories.isNotEmpty()) {
    CollapsibleCategoryBudgets(
      categories = categories,
      isExpanded = isExpanded,
      onToggle = onToggle,
      onManageBudgetsClick = onManageBudgetsClick,
      modifier = modifier.testTag("module_card_category_budgets")
    )
  } else {
    Card(
      modifier = modifier
        .fillMaxWidth()
        .testTag("module_card_category_budgets"),
      shape = PlutoShapes.extraLarge,
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
      elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(18.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "CATEGORY BUDGETS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
          Spacer(modifier = Modifier.height(4.dp))
          Text(
            text = "No category spending logged yet",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        OutlinedButton(
          onClick = onManageBudgetsClick,
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("manage_category_budgets_button")
        ) {
          Text("Set Budgets")
        }
      }
    }
  }
}

/**
 * Customize Home Modal Bottom Sheet:
 * - Persona Preset Chips (Student, Expat, Traveler) + Custom badge + Reset to Preset.
 * - Toggle visibility & reorder (Move Up / Move Down) for all 7 Home modules.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HomeCustomizeSheet(
  currentPersona: UserPersona,
  currentModules: List<HomeModuleConfig>,
  onUpdateModules: (List<HomeModuleConfig>) -> Unit,
  onApplyPersonaPreset: (UserPersona) -> Unit,
  onDismiss: () -> Unit,
  modifier: Modifier = Modifier
) {
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val normalizedModules = remember(currentModules, currentPersona) {
    HomeLayoutPresets.normalize(currentModules, currentPersona)
  }
  val isCustom = remember(normalizedModules, currentPersona) {
    HomeLayoutPresets.isCustomLayout(normalizedModules, currentPersona)
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    dragHandle = { BottomSheetDefaults.DragHandle() },
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = modifier.testTag("home_customize_sheet")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp)
        .padding(bottom = 24.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      // Sheet Header
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = "Customize Home",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.plutoHeading()
          )
          Text(
            text = "Pick a persona preset or toggle and reorder modules.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        IconButton(
          onClick = onDismiss,
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag("close_customize_home_sheet")
        ) {
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = "Close Customize Home"
          )
        }
      }

      // Persona Presets + Custom Badge + Reset
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
              text = "PERSONA PRESETS",
              style = MaterialTheme.typography.labelSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )
            if (isCustom) {
              Spacer(modifier = Modifier.width(8.dp))
              Surface(
                shape = PlutoShapes.small,
                color = MaterialTheme.colorScheme.tertiaryContainer,
                modifier = Modifier.testTag("customize_custom_badge")
              ) {
                Text(
                  text = "Custom",
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = FontWeight.Bold,
                  color = MaterialTheme.colorScheme.onTertiaryContainer,
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                )
              }
            }
          }

          if (isCustom) {
            TextButton(
              onClick = { onApplyPersonaPreset(currentPersona) },
              modifier = Modifier
                .heightIn(min = 48.dp)
                .minimumInteractiveComponentSize()
                .testTag("reset_home_preset_button"),
              contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
            ) {
              Text(
                text = "Reset to Preset",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
              )
            }
          }
        }

        FlowRow(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          listOf(
            UserPersona.INTERNATIONAL_STUDENT to "Student",
            UserPersona.EXPAT to "Expat",
            UserPersona.TOURIST to "Traveler"
          ).forEach { (persona, shortLabel) ->
            val selected = currentPersona == persona
            FilterChip(
              selected = selected,
              onClick = { onApplyPersonaPreset(persona) },
              label = {
                Text(
                  text = shortLabel,
                  fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                )
              },
              colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
              ),
              modifier = Modifier
                .heightIn(min = 48.dp)
                .minimumInteractiveComponentSize()
                .testTag("preset_chip_${persona.name.lowercase()}")
            )
          }
        }
      }

      HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

      // Modules Toggle & Reorder List
      Text(
        text = "FEED MODULES (${normalizedModules.count { it.isEnabled }} ACTIVE)",
        style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      normalizedModules.forEachIndexed { index, module ->
        val meta = moduleMetadata(module.id)
        Surface(
          shape = PlutoShapes.large,
          color = if (module.isEnabled) {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
          } else {
            MaterialTheme.colorScheme.surface
          },
          border = if (!module.isEnabled) BorderStroke(1.dp, MaterialTheme.colorScheme.outline) else null,
          modifier = Modifier
            .fillMaxWidth()
            .testTag("home_module_row_${module.id.name.lowercase()}")
        ) {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Surface(
              shape = CircleShape,
              color = if (module.isEnabled) {
                MaterialTheme.colorScheme.primaryContainer
              } else {
                MaterialTheme.colorScheme.surfaceVariant
              },
              modifier = Modifier.size(36.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = meta.icon,
                  contentDescription = null,
                  tint = if (module.isEnabled) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                  } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                  },
                  modifier = Modifier.size(18.dp)
                )
              }
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
              Text(
                text = meta.title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
              )
              Text(
                text = meta.subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
              )
            }

            IconButton(
              onClick = {
                if (index > 0) {
                  val reordered = normalizedModules.toMutableList()
                  val item = reordered.removeAt(index)
                  reordered.add(index - 1, item)
                  onUpdateModules(reordered)
                }
              },
              enabled = index > 0,
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("move_up_${module.id.name.lowercase()}")
            ) {
              Icon(
                imageVector = Icons.Rounded.ArrowUpward,
                contentDescription = "Move ${meta.title} up"
              )
            }

            IconButton(
              onClick = {
                if (index < normalizedModules.lastIndex) {
                  val reordered = normalizedModules.toMutableList()
                  val item = reordered.removeAt(index)
                  reordered.add(index + 1, item)
                  onUpdateModules(reordered)
                }
              },
              enabled = index < normalizedModules.lastIndex,
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("move_down_${module.id.name.lowercase()}")
            ) {
              Icon(
                imageVector = Icons.Rounded.ArrowDownward,
                contentDescription = "Move ${meta.title} down"
              )
            }

            Switch(
              checked = module.isEnabled,
              onCheckedChange = { checked ->
                val updated = normalizedModules.map {
                  if (it.id == module.id) it.copy(isEnabled = checked) else it
                }
                onUpdateModules(updated)
              },
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("toggle_${module.id.name.lowercase()}")
            )
          }
        }
      }
    }
  }
}

private data class HomeModuleMeta(
  val title: String,
  val subtitle: String,
  val icon: ImageVector
)

private fun moduleMetadata(id: HomeModuleId): HomeModuleMeta = when (id) {
  HomeModuleId.STACKED_WALLETS -> HomeModuleMeta(
    title = "Portfolio Breakdown",
    subtitle = "Multi-currency holdings & valuation split",
    icon = Icons.Rounded.Wallet
  )
  HomeModuleId.DAILY_SAFE_TO_SPEND -> HomeModuleMeta(
    title = "Daily Safe-to-Spend",
    subtitle = "Today's remaining allowance & alert threshold",
    icon = Icons.Rounded.Speed
  )
  HomeModuleId.CYCLE_RUNWAY -> HomeModuleMeta(
    title = "Cycle & Term Runway",
    subtitle = "Days left & daily discretionary pace",
    icon = Icons.Rounded.School
  )
  HomeModuleId.CASH_FLOW_SUMMARY -> HomeModuleMeta(
    title = "Cash Flow Summary",
    subtitle = "Period income, expenses & net flow",
    icon = Icons.Rounded.SwapHoriz
  )
  HomeModuleId.SPENDING_TREND -> HomeModuleMeta(
    title = "30-Day Spending Trend",
    subtitle = "Interactive curve & daily average",
    icon = Icons.Rounded.BarChart
  )
  HomeModuleId.CATEGORY_BUDGETS -> HomeModuleMeta(
    title = "Category Budgets",
    subtitle = "Per-category caps & progress",
    icon = Icons.Rounded.PieChart
  )
  HomeModuleId.RECENT_EXPENSES -> HomeModuleMeta(
    title = "Recent Activity",
    subtitle = "Latest travel expenses at a glance",
    icon = Icons.AutoMirrored.Rounded.ReceiptLong
  )
}
