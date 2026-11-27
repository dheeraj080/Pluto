package com.pluto.app.ui.home

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.text.format.DateFormat
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.NightsStay
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.WbSunny
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.pluto.app.R
import com.pluto.app.domain.model.DualClockSnapshot
import com.pluto.app.domain.model.DualZoneClockEngine
import com.pluto.app.domain.model.TimeZonePickerItem
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import kotlinx.coroutines.delay
import java.util.Locale
import java.util.TimeZone

/**
 * Observes minute-boundary clock updates and system time-zone broadcasts so the
 * Home header Dual-Zone Clock stays accurate across time-zone changes and midnight.
 */
@Composable
fun rememberDualClockTickMillis(): Long {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  var tickMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }

  LaunchedEffect(lifecycleOwner) {
    lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      while (true) {
        val now = System.currentTimeMillis()
        tickMillis = now
        val millisUntilNextMinute = 60_000L - (now % 60_000L)
        delay(millisUntilNextMinute.coerceAtLeast(1_000L))
      }
    }
  }

  DisposableEffect(context) {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context?, intent: Intent?) {
        tickMillis = System.currentTimeMillis()
      }
    }
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_TIMEZONE_CHANGED)
      addAction(Intent.ACTION_TIME_CHANGED)
    }
    ContextCompat.registerReceiver(
      context,
      receiver,
      filter,
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
    onDispose {
      runCatching { context.unregisterReceiver(receiver) }
    }
  }

  return tickMillis
}

/**
 * Compact dual-zone clock row embedded inside the stacked wallet hero card header.
 * Shows device time, offset pill, and reference city time with day/night indicators.
 */
@Composable
fun DualZoneClockInlineRow(
  userSettings: UserSettings,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  containerColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.14f),
  contentColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onPrimary,
  secondaryContentColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
  dayIconTint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.tertiaryContainer,
  nightIconTint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onPrimary,
  nowMillis: Long = rememberDualClockTickMillis(),
  localTimeZone: TimeZone = TimeZone.getDefault()
) {
  val snapshot = rememberDualClockSnapshot(userSettings, nowMillis, localTimeZone)
  DualZoneClockSurface(
    snapshot = snapshot,
    onClick = onClick,
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.medium,
    containerColor = containerColor,
    contentColor = contentColor,
    secondaryContentColor = secondaryContentColor,
    dayIconTint = dayIconTint,
    nightIconTint = nightIconTint,
    badgeColor = contentColor.copy(alpha = 0.16f),
    badgeTextColor = contentColor,
    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
    labelStyle = MaterialTheme.typography.labelSmall,
    timeStyle = MaterialTheme.typography.labelLarge,
    iconSpacing = 6.dp,
    badgePadding = PaddingValues(horizontal = 8.dp, vertical = 3.dp),
    pressScale = PlutoMotion.PressScale
  )
}

/**
 * Standalone Dual-Zone Clock chip (retained for tests and standalone previews).
 */
@Composable
fun DualZoneClockHeaderChip(
  userSettings: UserSettings,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  nowMillis: Long = rememberDualClockTickMillis(),
  localTimeZone: TimeZone = TimeZone.getDefault()
) {
  val snapshot = rememberDualClockSnapshot(userSettings, nowMillis, localTimeZone)
  Box(
    modifier = modifier
      .fillMaxWidth()
      .padding(horizontal = PlutoSpacing.xl, vertical = PlutoSpacing.xs),
    contentAlignment = Alignment.Center
  ) {
    DualZoneClockSurface(
      snapshot = snapshot,
      onClick = onClick,
      modifier = Modifier
        .widthIn(max = 840.dp)
        .fillMaxWidth(),
      shape = PlutoShapes.large,
      containerColor = MaterialTheme.colorScheme.surface,
      contentColor = MaterialTheme.colorScheme.onSurface,
      secondaryContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
      dayIconTint = MaterialTheme.colorScheme.tertiary,
      nightIconTint = MaterialTheme.colorScheme.primary,
      badgeColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f),
      badgeTextColor = MaterialTheme.colorScheme.primary,
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
      badgeBorder = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)),
      contentPadding = PaddingValues(horizontal = PlutoSpacing.md, vertical = PlutoSpacing.sm),
      labelStyle = MaterialTheme.typography.labelSmall,
      timeStyle = MaterialTheme.typography.titleSmall,
      iconSpacing = PlutoSpacing.sm,
      badgePadding = PaddingValues(horizontal = PlutoSpacing.sm, vertical = PlutoSpacing.xs),
      pressScale = PlutoMotion.CardPressScale
    )
  }
}

@Composable
private fun rememberDualClockSnapshot(
  userSettings: UserSettings,
  nowMillis: Long,
  localTimeZone: TimeZone
): DualClockSnapshot {
  val context = LocalContext.current
  val is24Hour = remember(context) { DateFormat.is24HourFormat(context) }
  val locale = Locale.getDefault()
  val homeZoneId = DualZoneClockEngine.resolveHomeZoneId(userSettings)
  val homeTimeZone = remember(homeZoneId) { TimeZone.getTimeZone(homeZoneId) }
  val isHomeZoneCustomized = remember(userSettings.homeCurrency, userSettings.homeTimeZoneId) {
    DualZoneClockEngine.normalizeHomeTimeZoneId(
      userSettings.homeTimeZoneId,
      userSettings.homeCurrency
    ) != null
  }
  return remember(nowMillis, localTimeZone.id, homeTimeZone.id, isHomeZoneCustomized, is24Hour, locale) {
    DualZoneClockEngine.computeSnapshot(
      nowMillis = nowMillis,
      localTimeZone = localTimeZone,
      homeTimeZone = homeTimeZone,
      isHomeZoneCustomized = isHomeZoneCustomized,
      is24Hour = is24Hour,
      locale = locale
    )
  }
}

/**
 * Shared rendering for both the inline Home hero row and the standalone legacy chip.
 * A single implementation keeps the DEVICE/REFERENCE prefixes, test tags, and semantics aligned.
 */
@Composable
private fun DualZoneClockSurface(
  snapshot: DualClockSnapshot,
  onClick: () -> Unit,
  modifier: Modifier,
  shape: androidx.compose.ui.graphics.Shape,
  containerColor: androidx.compose.ui.graphics.Color,
  contentColor: androidx.compose.ui.graphics.Color,
  secondaryContentColor: androidx.compose.ui.graphics.Color,
  dayIconTint: androidx.compose.ui.graphics.Color,
  nightIconTint: androidx.compose.ui.graphics.Color,
  badgeColor: androidx.compose.ui.graphics.Color,
  badgeTextColor: androidx.compose.ui.graphics.Color,
  contentPadding: PaddingValues,
  labelStyle: TextStyle,
  timeStyle: TextStyle,
  iconSpacing: Dp,
  badgePadding: PaddingValues,
  pressScale: Float,
  border: BorderStroke? = null,
  badgeBorder: BorderStroke? = null
) {
  val interactionSource = remember { MutableInteractionSource() }
  val daytimeLabel = stringResource(R.string.dual_clock_daytime)
  val nighttimeLabel = stringResource(R.string.dual_clock_nighttime)
  val rolloverSuffix = snapshot.dayRolloverLabel?.let {
    stringResource(R.string.dual_clock_day_rollover_accessibility, it)
  }.orEmpty()
  val accessibilityLabel = stringResource(
    R.string.dual_clock_accessibility_label,
    snapshot.localLabel,
    snapshot.localTimeFormatted,
    if (snapshot.localIsDaytime) daytimeLabel else nighttimeLabel,
    snapshot.homeLabel,
    snapshot.homeTimeFormatted,
    if (snapshot.homeIsDaytime) daytimeLabel else nighttimeLabel,
    snapshot.offsetBadgeText,
    rolloverSuffix
  )
  val localPrefix = stringResource(R.string.dual_clock_local_prefix)
  val homePrefix = stringResource(R.string.dual_clock_home_prefix)

  Surface(
    shape = shape,
    color = containerColor,
    border = border,
    modifier = modifier
      .minimumInteractiveComponentSize()
      .plutoPressableScale(
        enabled = true,
        pressedScale = pressScale,
        interactionSource = interactionSource
      )
      .clip(shape)
      .clickable(
        interactionSource = interactionSource,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onClick
      )
      .semantics(mergeDescendants = true) {
        contentDescription = accessibilityLabel
      }
      .testTag("home_dual_zone_clock_chip")
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(contentPadding),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.weight(1f)
      ) {
        DayNightIndicatorIcon(
          isDaytime = snapshot.localIsDaytime,
          dayTint = dayIconTint,
          nightTint = nightIconTint,
          testTag = "dual_clock_local_day_night_icon"
        )
        Spacer(modifier = Modifier.width(iconSpacing))
        Column {
          Text(
            text = stringResource(R.string.dual_clock_zone_label, localPrefix, snapshot.localLabel),
            style = labelStyle,
            color = secondaryContentColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.testTag("dual_clock_local_label")
          )
          Text(
            text = snapshot.localTimeFormatted,
            style = timeStyle.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = contentColor,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.testTag("dual_clock_local_time")
          )
        }
      }

      val badgeLabel = snapshot.dayRolloverLabel?.let {
        stringResource(R.string.dual_clock_badge_with_rollover, snapshot.offsetBadgeText, it)
      } ?: snapshot.offsetBadgeText
      Surface(
        shape = PlutoShapes.small,
        color = badgeColor,
        border = badgeBorder
      ) {
        Text(
          text = badgeLabel,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = badgeTextColor,
          maxLines = 1,
          softWrap = false,
          modifier = Modifier
            .padding(badgePadding)
            .testTag("dual_clock_offset_badge")
        )
      }

      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.End,
        modifier = Modifier.weight(1f)
      ) {
        Column(
          horizontalAlignment = Alignment.End,
          modifier = Modifier.weight(1f, fill = false)
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
              text = stringResource(R.string.dual_clock_zone_label, homePrefix, snapshot.homeLabel),
              style = labelStyle,
              color = secondaryContentColor,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier
                .weight(1f, fill = false)
                .testTag("dual_clock_home_label")
            )
            Spacer(modifier = Modifier.width(2.dp))
            Icon(
              imageVector = Icons.Rounded.KeyboardArrowDown,
              contentDescription = null,
              tint = secondaryContentColor,
              modifier = Modifier.size(14.dp)
            )
          }
          Text(
            text = snapshot.homeTimeFormatted,
            style = timeStyle.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = contentColor,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.testTag("dual_clock_home_time")
          )
        }
        Spacer(modifier = Modifier.width(iconSpacing))
        DayNightIndicatorIcon(
          isDaytime = snapshot.homeIsDaytime,
          dayTint = dayIconTint,
          nightTint = nightIconTint,
          testTag = "dual_clock_home_day_night_icon"
        )
      }
    }
  }
}

@Composable
private fun DayNightIndicatorIcon(
  isDaytime: Boolean,
  testTag: String,
  modifier: Modifier = Modifier,
  dayTint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.tertiary,
  nightTint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary
) {
  Icon(
    imageVector = if (isDaytime) Icons.Rounded.WbSunny else Icons.Rounded.NightsStay,
    contentDescription = stringResource(
      if (isDaytime) R.string.dual_clock_daytime else R.string.dual_clock_nighttime
    ),
    tint = if (isDaytime) dayTint else nightTint,
    modifier = modifier
      .size(16.dp)
      .testTag(testTag)
  )
}

/**
 * Searchable bottom sheet allowing users to manually pick the reference time zone.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeTimeZonePickerSheet(
  userSettings: UserSettings,
  onSelectTimeZone: (String?) -> Unit,
  onDismiss: () -> Unit,
  nowMillis: Long = rememberDualClockTickMillis()
) {
  val context = LocalContext.current
  val is24Hour = remember(context) { DateFormat.is24HourFormat(context) }
  val locale = Locale.getDefault()
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  var searchQuery by remember { mutableStateOf("") }
  val normalizedHomeZoneId = DualZoneClockEngine.normalizeHomeTimeZoneId(
    userSettings.homeTimeZoneId,
    userSettings.homeCurrency
  )
  val currentResolvedZoneId = DualZoneClockEngine.resolveHomeZoneId(userSettings)
  val hasCurrencyDefault = DualZoneClockEngine.hasCurrencyDefaultForCurrency(userSettings.homeCurrency)
  val defaultCityLabel = DualZoneClockEngine.friendlyCityName(
    DualZoneClockEngine.defaultZoneIdForCurrency(userSettings.homeCurrency)
  )

  // Tapping the already-resolved zone (including the currency default) is a no-op.
  val selectZone: (String) -> Unit = { zoneId ->
    val normalized = DualZoneClockEngine.normalizeHomeTimeZoneId(zoneId, userSettings.homeCurrency)
    if (normalized != normalizedHomeZoneId) {
      onSelectTimeZone(normalized)
      onDismiss()
    }
  }

  val suggestedZones = remember(userSettings.homeCurrency) {
    DualZoneClockEngine.suggestedZonesForCurrency(userSettings.homeCurrency)
  }

  val filteredItems = remember(searchQuery, currentResolvedZoneId, nowMillis, is24Hour, locale) {
    DualZoneClockEngine.searchTimeZones(
      query = searchQuery,
      selectedZoneId = currentResolvedZoneId,
      nowMillis = nowMillis,
      is24Hour = is24Hour,
      locale = locale
    )
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.surface,
    modifier = Modifier.testTag("home_timezone_picker_sheet")
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .imePadding()
        .padding(horizontal = PlutoSpacing.xl)
        .padding(bottom = PlutoSpacing.xl)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = stringResource(R.string.dual_clock_picker_title),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.plutoHeading()
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = stringResource(R.string.dual_clock_picker_subtitle),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }

        if (normalizedHomeZoneId != null) {
          TextButton(
            onClick = {
              onSelectTimeZone(null)
              onDismiss()
            },
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("timezone_reset_default_button")
          ) {
            Text(
              text = stringResource(R.string.dual_clock_reset_default, defaultCityLabel),
              style = MaterialTheme.typography.labelMedium,
              fontWeight = FontWeight.SemiBold
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(PlutoSpacing.md))

      OutlinedTextField(
        value = searchQuery,
        onValueChange = { searchQuery = it },
        modifier = Modifier
          .fillMaxWidth()
          .testTag("timezone_search_input"),
        placeholder = {
          Text(
            text = stringResource(R.string.dual_clock_search_hint),
            style = MaterialTheme.typography.bodyMedium
          )
        },
        leadingIcon = {
          Icon(
            imageVector = Icons.Rounded.Search,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
          )
        },
        trailingIcon = {
          if (searchQuery.isNotEmpty()) {
            IconButton(
              onClick = { searchQuery = "" },
              modifier = Modifier.minimumInteractiveComponentSize()
            ) {
              Icon(
                imageVector = Icons.Rounded.Close,
                contentDescription = stringResource(R.string.dual_clock_clear_search)
              )
            }
          }
        },
        singleLine = true,
        shape = PlutoShapes.medium
      )

      if (searchQuery.isBlank()) {
        if (!hasCurrencyDefault) {
          Text(
            text = stringResource(R.string.dual_clock_no_currency_default, userSettings.homeCurrency.code),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("timezone_no_default_hint")
          )
        } else if (suggestedZones.isNotEmpty()) {
          Spacer(modifier = Modifier.height(PlutoSpacing.md))
          Text(
            text = stringResource(R.string.dual_clock_suggested_label, userSettings.homeCurrency.code),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary
          )
          Spacer(modifier = Modifier.height(PlutoSpacing.xs))
          LazyRow(
            horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.sm),
            contentPadding = PaddingValues(vertical = PlutoSpacing.xs)
          ) {
            items(suggestedZones, key = { it.zoneId }) { option ->
              val selected = option.zoneId == currentResolvedZoneId
              FilterChip(
                selected = selected,
                onClick = { selectZone(option.zoneId) },
                label = {
                  Text(
                    text = option.city,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                  )
                },
                colors = FilterChipDefaults.filterChipColors(
                  selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                  selectedLabelColor = MaterialTheme.colorScheme.primary
                ),
                modifier = Modifier
                  .minimumInteractiveComponentSize()
                  .testTag("timezone_suggested_chip_${option.zoneId}")
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(PlutoSpacing.sm))

      LazyColumn(
        modifier = Modifier
          .fillMaxWidth()
          .heightIn(max = 380.dp)
          .testTag("timezone_results_list")
      ) {
        items(filteredItems, key = { it.zoneId }) { item ->
          TimeZonePickerRow(
            item = item,
            onClick = { selectZone(item.zoneId) }
          )
          HorizontalDivider(
            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
          )
        }
      }
    }
  }
}

@Composable
private fun TimeZonePickerRow(
  item: TimeZonePickerItem,
  onClick: () -> Unit
) {
  val interactionSource = remember { MutableInteractionSource() }
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .minimumInteractiveComponentSize()
      .clickable(
        interactionSource = interactionSource,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onClick
      )
      .padding(vertical = PlutoSpacing.md, horizontal = PlutoSpacing.xs)
      .testTag("timezone_option_${item.zoneId}"),
    verticalAlignment = Alignment.CenterVertically
  ) {
    DayNightIndicatorIcon(
      isDaytime = item.isDaytime,
      testTag = "timezone_option_icon_${item.zoneId}"
    )

    Spacer(modifier = Modifier.width(PlutoSpacing.md))

    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = item.city,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = if (item.isSelected) FontWeight.Bold else FontWeight.SemiBold,
        color = if (item.isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = item.subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }

    Spacer(modifier = Modifier.width(PlutoSpacing.sm))

    Text(
      text = item.liveTimeFormatted,
      style = MaterialTheme.typography.titleSmall.merge(PlutoNumericStyle),
      fontWeight = FontWeight.Bold,
      color = if (item.isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
    )

    if (item.isSelected) {
      Spacer(modifier = Modifier.width(PlutoSpacing.sm))
      Icon(
        imageVector = Icons.Rounded.CheckCircle,
        contentDescription = stringResource(R.string.dual_clock_selected),
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(18.dp)
      )
    }
  }
}
