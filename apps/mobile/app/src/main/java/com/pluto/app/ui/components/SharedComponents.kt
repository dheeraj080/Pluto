package com.pluto.app.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.Currency
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale

enum class PlutoButtonVariant {
  PRIMARY,
  SECONDARY,
  OUTLINED,
  GHOST,
  DESTRUCTIVE
}

/**
 * Universal Pluto button supporting multiple variants, loading state, leading/trailing icons, and testTag.
 */
@Composable
fun PlutoButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  variant: PlutoButtonVariant = PlutoButtonVariant.PRIMARY,
  enabled: Boolean = true,
  isLoading: Boolean = false,
  leadingIcon: ImageVector? = null,
  trailingIcon: ImageVector? = null,
  testTag: String = "pluto_button"
) {
  val shape = PlutoShapes.medium
  val interactionSource = remember { MutableInteractionSource() }
  val isInteractive = enabled && !isLoading
  val pressModifier = Modifier.plutoPressableScale(
    enabled = isInteractive,
    pressedScale = PlutoMotion.PressScale,
    interactionSource = interactionSource
  )

  when (variant) {
    PlutoButtonVariant.PRIMARY -> {
      Button(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier
          .then(pressModifier)
          .heightIn(min = 48.dp)
          .testTag(testTag),
        enabled = isInteractive,
        shape = shape,
        colors = ButtonDefaults.buttonColors(
          containerColor = MaterialTheme.colorScheme.primary,
          contentColor = MaterialTheme.colorScheme.onPrimary,
          disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
          disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
      ) {
        ButtonContent(text, isLoading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.onPrimary)
      }
    }
    PlutoButtonVariant.SECONDARY -> {
      Button(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier
          .then(pressModifier)
          .heightIn(min = 48.dp)
          .testTag(testTag),
        enabled = isInteractive,
        shape = shape,
        colors = ButtonDefaults.buttonColors(
          containerColor = MaterialTheme.colorScheme.surfaceVariant,
          contentColor = MaterialTheme.colorScheme.onSurface,
          disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
          disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
        )
      ) {
        ButtonContent(text, isLoading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.onSurface)
      }
    }
    PlutoButtonVariant.OUTLINED -> {
      OutlinedButton(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier
          .then(pressModifier)
          .heightIn(min = 48.dp)
          .testTag(testTag),
        enabled = isInteractive,
        shape = shape,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        colors = ButtonDefaults.outlinedButtonColors(
          contentColor = MaterialTheme.colorScheme.onSurface
        )
      ) {
        ButtonContent(text, isLoading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.onSurface)
      }
    }
    PlutoButtonVariant.GHOST -> {
      TextButton(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier
          .then(pressModifier)
          .minimumInteractiveComponentSize()
          .testTag(testTag),
        enabled = isInteractive,
        shape = shape,
        colors = ButtonDefaults.textButtonColors(
          contentColor = MaterialTheme.colorScheme.primary
        )
      ) {
        ButtonContent(text, isLoading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.primary)
      }
    }
    PlutoButtonVariant.DESTRUCTIVE -> {
      Button(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier
          .then(pressModifier)
          .heightIn(min = 48.dp)
          .testTag(testTag),
        enabled = isInteractive,
        shape = shape,
        colors = ButtonDefaults.buttonColors(
          containerColor = MaterialTheme.colorScheme.error,
          contentColor = MaterialTheme.colorScheme.onError
        )
      ) {
        ButtonContent(text, isLoading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.onError)
      }
    }
  }
}

@Composable
private fun ButtonContent(
  text: String,
  isLoading: Boolean,
  leadingIcon: ImageVector?,
  trailingIcon: ImageVector?,
  tint: Color
) {
  if (isLoading) {
    CircularProgressIndicator(
      modifier = Modifier.size(20.dp),
      color = tint,
      strokeWidth = 2.dp
    )
  } else {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.Center
    ) {
      if (leadingIcon != null) {
        Icon(
          imageVector = leadingIcon,
          contentDescription = null,
          modifier = Modifier.size(18.dp),
          tint = tint
        )
        Spacer(modifier = Modifier.width(PlutoSpacing.sm))
      }
      Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        textAlign = TextAlign.Center,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis
      )
      if (trailingIcon != null) {
        Spacer(modifier = Modifier.width(PlutoSpacing.sm))
        Icon(
          imageVector = trailingIcon,
          contentDescription = null,
          modifier = Modifier.size(18.dp),
          tint = tint
        )
      }
    }
  }
}

/**
 * Backward-compatible full-width primary action button.
 */
@Composable
fun PrimaryActionButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  isLoading: Boolean = false,
  testTag: String = "primary_action_button"
) {
  PlutoButton(
    text = text,
    onClick = onClick,
    modifier = modifier.fillMaxWidth(),
    variant = PlutoButtonVariant.PRIMARY,
    enabled = enabled,
    isLoading = isLoading,
    testTag = testTag
  )
}

/**
 * Universal Pluto Card container defaulting to borderless Ivory White surfaces on Warm Alabaster canvas.
 */
@Composable
fun PlutoCard(
  modifier: Modifier = Modifier,
  onClick: (() -> Unit)? = null,
  containerColor: Color = MaterialTheme.colorScheme.surface,
  contentColor: Color = MaterialTheme.colorScheme.onSurface,
  borderColor: Color? = null,
  shape: Shape = PlutoShapes.large,
  elevation: androidx.compose.ui.unit.Dp = 0.dp,
  testTag: String = "pluto_card",
  content: @Composable ColumnScope.() -> Unit
) {
  val border = borderColor?.let { BorderStroke(1.dp, it) }
  if (onClick != null) {
    val interactionSource = remember { MutableInteractionSource() }
    Card(
      onClick = onClick,
      interactionSource = interactionSource,
      modifier = modifier
        .minimumInteractiveComponentSize()
        .plutoPressableScale(
          enabled = true,
          pressedScale = PlutoMotion.CardPressScale,
          interactionSource = interactionSource
        )
        .testTag(testTag),
      shape = shape,
      colors = CardDefaults.cardColors(
        containerColor = containerColor,
        contentColor = contentColor
      ),
      border = border,
      elevation = CardDefaults.cardElevation(defaultElevation = elevation),
      content = content
    )
  } else {
    Card(
      modifier = modifier.testTag(testTag),
      shape = shape,
      colors = CardDefaults.cardColors(
        containerColor = containerColor,
        contentColor = contentColor
      ),
      border = border,
      elevation = CardDefaults.cardElevation(defaultElevation = elevation),
      content = content
    )
  }
}

/**
 * Compact currency badge pill displaying ISO code and flag with sharp Swiss precision.
 */
@Composable
fun CurrencyBadge(
  currency: Currency,
  modifier: Modifier = Modifier,
  showFlag: Boolean = true,
  compact: Boolean = false
) {
  Surface(
    modifier = modifier,
    shape = PlutoShapes.small,
    color = MaterialTheme.colorScheme.primaryContainer,
    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f))
  ) {
    Row(
      modifier = Modifier.padding(
        horizontal = if (compact) 6.dp else PlutoSpacing.sm,
        vertical = if (compact) 2.dp else PlutoSpacing.xs
      ),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (showFlag && currency.flagEmoji.isNotBlank()) {
        Text(
          text = currency.flagEmoji,
          fontSize = if (compact) 11.sp else 13.sp,
          modifier = Modifier.padding(end = 4.dp)
        )
      }
      Text(
        text = currency.code,
        style = if (compact) MaterialTheme.typography.labelSmall else MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.5.sp
      )
    }
  }
}

/**
 * Reusable row item for selecting or displaying a currency with symbol, code, and region flag.
 */
@Composable
fun CurrencyRow(
  currency: Currency,
  isSelected: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  testTag: String = "currency_row_${currency.code.lowercase()}"
) {
  PlutoCard(
    modifier = modifier
      .fillMaxWidth()
      .padding(vertical = PlutoSpacing.xxs),
    onClick = onClick,
    containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
    else MaterialTheme.colorScheme.surface,
    borderColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
    shape = PlutoShapes.medium,
    testTag = testTag
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = PlutoSpacing.lg, vertical = PlutoSpacing.md),
      verticalAlignment = Alignment.CenterVertically
    ) {
      // Flag / Symbol circle
      Box(
        modifier = Modifier
          .size(40.dp)
          .clip(CircleShape)
          .background(
            if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
            else MaterialTheme.colorScheme.surfaceVariant
          ),
        contentAlignment = Alignment.Center
      ) {
        if (currency.flagEmoji.isNotBlank()) {
          Text(text = currency.flagEmoji, fontSize = 20.sp)
        } else {
          Text(
            text = currency.symbol,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
          )
        }
      }

      Spacer(modifier = Modifier.width(PlutoSpacing.md))

      Column(modifier = Modifier.weight(1f)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text(
            text = currency.code,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
          )
          Spacer(modifier = Modifier.width(PlutoSpacing.sm))
          Text(
            text = "(${currency.symbol})",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        Spacer(modifier = Modifier.height(PlutoSpacing.xxs))
        Text(
          text = currency.name,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
      }

      if (isSelected) {
        Box(
          modifier = Modifier
            .size(22.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.Rounded.Check,
            contentDescription = "Selected",
            tint = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier.size(14.dp)
          )
        }
      }
    }
  }
}

/**
 * Reusable empty state view with icon, title, description, and optional action.
 */
@Composable
fun EmptyState(
  icon: ImageVector,
  title: String,
  description: String,
  modifier: Modifier = Modifier,
  @DrawableRes illustrationRes: Int? = null,
  actionText: String? = null,
  onActionClick: (() -> Unit)? = null,
  actionTestTag: String = "empty_state_action"
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .padding(PlutoSpacing.xxl),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    if (illustrationRes != null) {
      Image(
        painter = painterResource(id = illustrationRes),
        contentDescription = title,
        contentScale = ContentScale.Crop,
        modifier = Modifier
          .size(160.dp)
          .clip(PlutoShapes.extraLarge)
      )
    } else {
      Box(
        modifier = Modifier
          .size(56.dp)
          .clip(PlutoShapes.medium)
          .background(MaterialTheme.colorScheme.surfaceVariant)
          .padding(PlutoSpacing.sm),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(28.dp)
        )
      }
    }

    Spacer(modifier = Modifier.height(PlutoSpacing.lg))

    Text(
      text = title,
      style = MaterialTheme.typography.titleMedium,
      fontWeight = FontWeight.Bold,
      color = MaterialTheme.colorScheme.onSurface,
      textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(PlutoSpacing.xs))

    Text(
      text = description,
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      textAlign = TextAlign.Center
    )

    if (actionText != null && onActionClick != null) {
      Spacer(modifier = Modifier.height(PlutoSpacing.lg))
      PlutoButton(
        text = actionText,
        onClick = onActionClick,
        testTag = actionTestTag,
        variant = PlutoButtonVariant.PRIMARY,
        modifier = Modifier.widthIn(min = 200.dp, max = 320.dp)
      )
    }
  }
}

/**
 * Standard section header with optional auxiliary action/tag.
 */
@Composable
fun SectionHeader(
  title: String,
  modifier: Modifier = Modifier,
  badgeText: String? = null,
  actionText: String? = null,
  onActionClick: (() -> Unit)? = null,
  actionTestTag: String? = null
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .padding(vertical = PlutoSpacing.sm),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(
      text = title,
      style = MaterialTheme.typography.titleMedium,
      fontWeight = FontWeight.Bold,
      color = MaterialTheme.colorScheme.onSurface,
      modifier = Modifier.plutoHeading()
    )
    if (badgeText != null) {
      Spacer(modifier = Modifier.width(PlutoSpacing.sm))
      Surface(
        shape = PlutoShapes.extraSmall,
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.padding(top = 1.dp)
      ) {
        Text(
          text = badgeText,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
      }
    }
    Spacer(modifier = Modifier.weight(1f))
    if (actionText != null && onActionClick != null) {
      val actionInteraction = remember { MutableInteractionSource() }
      Box(
        modifier = Modifier
          .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
          .plutoPressableScale(
            enabled = true,
            pressedScale = PlutoMotion.PressScale,
            interactionSource = actionInteraction
          )
          .clip(PlutoShapes.small)
          .clickable(
            interactionSource = actionInteraction,
            indication = androidx.compose.material3.ripple(),
            role = Role.Button,
            onClick = onActionClick
          )
          .then(if (actionTestTag != null) Modifier.testTag(actionTestTag) else Modifier)
          .padding(horizontal = PlutoSpacing.sm),
        contentAlignment = Alignment.Center
      ) {
        Text(
          text = actionText,
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary,
          fontWeight = FontWeight.SemiBold
        )
      }
    }
  }
}

/**
 * Standard Dual Currency Amount component adhering to the rule:
 * 1. Primary: Current Country (Destination Currency)
 * 2. Secondary: Home Country (Home Currency)
 */
@Composable
fun DualCurrencyAmountView(
  primaryAmount: String,
  secondaryAmount: String?,
  modifier: Modifier = Modifier,
  primaryStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.titleMedium,
  primaryColor: Color = MaterialTheme.colorScheme.onSurface,
  primaryFontWeight: FontWeight = FontWeight.Bold,
  secondaryStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodySmall,
  secondaryColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
  secondaryFontWeight: FontWeight = FontWeight.Medium,
  horizontalAlignment: Alignment.Horizontal = Alignment.End
) {
  Column(
    modifier = modifier,
    horizontalAlignment = horizontalAlignment
  ) {
    Text(
      text = primaryAmount,
      style = primaryStyle.merge(PlutoNumericStyle),
      fontWeight = primaryFontWeight,
      color = primaryColor
    )
    if (!secondaryAmount.isNullOrBlank()) {
      Spacer(modifier = Modifier.height(PlutoSpacing.xxs))
      Text(
        text = secondaryAmount,
        style = secondaryStyle.merge(PlutoNumericStyle),
        fontWeight = secondaryFontWeight,
        color = secondaryColor
      )
    }
  }
}

/**
 * High-density Fintech Metric Tile (e.g. for Home and Insights overview cards)
 */
@Composable
fun PlutoMetricTile(
  label: String,
  primaryValue: String,
  modifier: Modifier = Modifier,
  secondaryValue: String? = null,
  deltaText: String? = null,
  isPositiveDelta: Boolean = true,
  leadingIcon: ImageVector? = null,
  iconTint: Color = MaterialTheme.colorScheme.primary,
  shape: Shape = PlutoShapes.medium,
  testTag: String = "pluto_metric_tile",
  onClick: (() -> Unit)? = null
) {
  PlutoCard(
    modifier = modifier,
    onClick = onClick,
    containerColor = MaterialTheme.colorScheme.surface,
    shape = shape,
    testTag = testTag
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(PlutoSpacing.md)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f, fill = false)
        ) {
          if (leadingIcon != null) {
            Icon(
              imageVector = leadingIcon,
              contentDescription = null,
              tint = iconTint,
              modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
          }
          Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
        if (deltaText != null) {
          val deltaTint = if (isPositiveDelta) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
          val deltaContainer = if (isPositiveDelta) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.errorContainer
          Surface(
            shape = PlutoShapes.extraSmall,
            color = deltaContainer.copy(alpha = 0.7f)
          ) {
            Text(
              text = deltaText,
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = deltaTint,
              modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(PlutoSpacing.xs))

      Text(
        text = primaryValue,
        style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )

      if (!secondaryValue.isNullOrBlank()) {
        Spacer(modifier = Modifier.height(PlutoSpacing.xxs))
        Text(
          text = secondaryValue,
          style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
      }
    }
  }
}

/**
 * Standardized Pluto Top App Bar with back navigation, high-contrast title, and contextual actions.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlutoTopBar(
  title: String,
  modifier: Modifier = Modifier,
  onNavigateBack: (() -> Unit)? = null,
  subtitle: String? = null,
  titleStyle: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.titleMedium,
  backButtonTestTag: String = "top_bar_back_button",
  backContentDescription: String = "Back",
  actions: @Composable () -> Unit = {}
) {
  TopAppBar(
    title = {
      Column {
        Text(
          text = title,
          style = titleStyle,
          fontWeight = FontWeight.Bold,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.plutoHeading()
        )
        if (!subtitle.isNullOrBlank()) {
          Text(
            text = subtitle,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      }
    },
    navigationIcon = {
      if (onNavigateBack != null) {
        IconButton(
          onClick = onNavigateBack,
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .testTag(backButtonTestTag)
        ) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = backContentDescription,
            tint = MaterialTheme.colorScheme.onSurface
          )
        }
      }
    },
    actions = { actions() },
    colors = TopAppBarDefaults.topAppBarColors(
      containerColor = MaterialTheme.colorScheme.background,
      titleContentColor = MaterialTheme.colorScheme.onBackground
    ),
    modifier = modifier
  )
}
