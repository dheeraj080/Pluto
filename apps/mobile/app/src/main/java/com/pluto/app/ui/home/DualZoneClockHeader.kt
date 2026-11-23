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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
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
 * Home header Dual-Zone Clock stays accurate when crossing borders or midnight.
 */
@Composable
fun rememberDualClockTickMillis(): Long {
  val context = LocalContext.current
  var tickMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }

  LaunchedEffect(Unit) {
    while (true) {
      val now = System.currentTimeMillis()
      tickMillis = now
      val millisUntilNextMinute = 60_000L - (now % 60_000L)
      delay(millisUntilNextMinute.coerceAtLeast(1_000L))
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
 * Compact dual-zone clock row embedded inside the Stacked Travel Wallet hero card header.
 * Shows local time, offset pill, and home city time with day/night indicators.
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
  val context = LocalContext.current
  val is24Hour = remember(context) { DateFormat.is24HourFormat(context) }
  val locale = Locale.getDefault()

  val homeZoneId = DualZoneClockEngine.resolveHomeZoneId(userSettings)
  val homeTimeZone = remember(homeZoneId) { TimeZone.getTimeZone(homeZoneId) }
  val snapshot = remember(nowMillis, localTimeZone.id, homeTimeZone.id, userSettings.homeTimeZoneId, is24Hour, locale) {
    DualZoneClockEngine.computeSnapshot(
      nowMillis = nowMillis,
      localTimeZone = localTimeZone,
      homeTimeZone = homeTimeZone,
      isHomeZoneCustomized = !userSettings.homeTimeZoneId.isNullOrBlank(),
      is24Hour = is24Hour,
      locale = locale
    )
  }

  val interactionSource = remember { MutableInteractionSource() }
  val accessibilityLabel = buildString {
    append("Local time in ${snapshot.localLabel} is ${snapshot.localTimeFormatted}, ")
    append(if (snapshot.localIsDaytime) "daytime. " else "nighttime. ")
    append("Home time in ${snapshot.homeLabel} is ${snapshot.homeTimeFormatted}, ")
    append(if (snapshot.homeIsDaytime) "daytime. " else "nighttime. ")
    append("Offset ${snapshot.offsetBadgeText}")
    if (snapshot.dayRolloverLabel != null) {
      append(", ${snapshot.dayRolloverLabel}")
    }
    append(". Tap to change home time zone.")
  }

  Surface(
    shape = PlutoShapes.medium,
    color = containerColor,
    modifier = modifier
      .fillMaxWidth()
      .minimumInteractiveComponentSize()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.PressScale,
        interactionSource = interactionSource
      )
      .clip(PlutoShapes.medium)
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
        .padding(horizontal = 12.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      // Local zone
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
        Spacer(modifier = Modifier.width(6.dp))
        Column {
          Text(
            text = snapshot.localLabel,
            style = MaterialTheme.typography.labelSmall,
            color = secondaryContentColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.testTag("dual_clock_local_label")
          )
          Text(
            text = snapshot.localTimeFormatted,
            style = MaterialTheme.typography.labelLarge.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = contentColor,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.testTag("dual_clock_local_time")
          )
        }
      }

      val badgeLabel = if (snapshot.dayRolloverLabel != null) {
        "${snapshot.offsetBadgeText} · ${snapshot.dayRolloverLabel}"
      } else {
        snapshot.offsetBadgeText
      }
      Surface(
        shape = PlutoShapes.small,
        color = contentColor.copy(alpha = 0.16f)
      ) {
        Text(
          text = badgeLabel,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          fontWeight = FontWeight.Bold,
          color = contentColor,
          maxLines = 1,
          softWrap = false,
          modifier = Modifier
            .padding(horizontal = 8.dp, vertical = 3.dp)
            .testTag("dual_clock_offset_badge")
        )
      }

      // Home zone
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
              text = snapshot.homeLabel,
              style = MaterialTheme.typography.labelSmall,
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
            style = MaterialTheme.typography.labelLarge.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = contentColor,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.testTag("dual_clock_home_time")
          )
        }
        Spacer(modifier = Modifier.width(6.dp))
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
  val context = LocalContext.current
  val is24Hour = remember(context) { DateFormat.is24HourFormat(context) }
  val locale = Locale.getDefault()

  val homeZoneId = DualZoneClockEngine.resolveHomeZoneId(userSettings)
  val homeTimeZone = remember(homeZoneId) { TimeZone.getTimeZone(homeZoneId) }
  val snapshot = remember(nowMillis, localTimeZone.id, homeTimeZone.id, userSettings.homeTimeZoneId, is24Hour, locale) {
    DualZoneClockEngine.computeSnapshot(
      nowMillis = nowMillis,
      localTimeZone = localTimeZone,
      homeTimeZone = homeTimeZone,
      isHomeZoneCustomized = !userSettings.homeTimeZoneId.isNullOrBlank(),
      is24Hour = is24Hour,
      locale = locale
    )
  }

  val interactionSource = remember { MutableInteractionSource() }
  val accessibilityLabel = buildString {
    append("Local time in ${snapshot.localLabel} is ${snapshot.localTimeFormatted}, ")
    append(if (snapshot.localIsDaytime) "daytime. " else "nighttime. ")
    append("Home time in ${snapshot.homeLabel} is ${snapshot.homeTimeFormatted}, ")
    append(if (snapshot.homeIsDaytime) "daytime. " else "nighttime. ")
    append("Offset ${snapshot.offsetBadgeText}")
    if (snapshot.dayRolloverLabel != null) {
      append(", ${snapshot.dayRolloverLabel}")
    }
    append(". Tap to change home time zone.")
  }

  Box(
    modifier = modifier
      .fillMaxWidth()
      .padding(horizontal = PlutoSpacing.xl, vertical = PlutoSpacing.xs),
    contentAlignment = Alignment.Center
  ) {
    Surface(
      shape = PlutoShapes.large,
      color = MaterialTheme.colorScheme.surface,
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
      modifier = Modifier
        .widthIn(max = 840.dp)
        .fillMaxWidth()
        .minimumInteractiveComponentSize()
        .plutoPressableScale(
          enabled = true,
          pressedScale = PlutoMotion.CardPressScale,
          interactionSource = interactionSource
        )
        .clip(PlutoShapes.large)
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
          .padding(horizontal = PlutoSpacing.md, vertical = PlutoSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        // Left: Device Local Clock
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f)
        ) {
          DayNightIndicatorIcon(
            isDaytime = snapshot.localIsDaytime,
            testTag = "dual_clock_local_day_night_icon"
          )
          Spacer(modifier = Modifier.width(PlutoSpacing.sm))
          Column {
            Text(
              text = "${stringResource(R.string.dual_clock_local_prefix)} · ${snapshot.localLabel}",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.testTag("dual_clock_local_label")
            )
            Text(
              text = snapshot.localTimeFormatted,
              style = MaterialTheme.typography.titleSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onSurface,
              maxLines = 1,
              softWrap = false,
              modifier = Modifier.testTag("dual_clock_local_time")
            )
          }
        }

        Spacer(modifier = Modifier.width(PlutoSpacing.sm))

        // Center: Offset + Day Rollover Pill
        val badgeLabel = if (snapshot.dayRolloverLabel != null) {
          "${snapshot.offsetBadgeText} · ${snapshot.dayRolloverLabel}"
        } else {
          snapshot.offsetBadgeText
        }
        Surface(
          shape = PlutoShapes.small,
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f),
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f))
        ) {
          Text(
            text = badgeLabel,
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier
              .padding(horizontal = PlutoSpacing.sm, vertical = PlutoSpacing.xs)
              .testTag("dual_clock_offset_badge")
          )
        }

        Spacer(modifier = Modifier.width(PlutoSpacing.sm))

        // Right: Selected Home Clock
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
                text = "${stringResource(R.string.dual_clock_home_prefix)} · ${snapshot.homeLabel}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp)
              )
            }
            Text(
              text = snapshot.homeTimeFormatted,
              style = MaterialTheme.typography.titleSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onSurface,
              maxLines = 1,
              softWrap = false,
              modifier = Modifier.testTag("dual_clock_home_time")
            )
          }
          Spacer(modifier = Modifier.width(PlutoSpacing.sm))
          DayNightIndicatorIcon(
            isDaytime = snapshot.homeIsDaytime,
            testTag = "dual_clock_home_day_night_icon"
          )
        }
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
    contentDescription = if (isDaytime) "Daytime" else "Nighttime",
    tint = if (isDaytime) dayTint else nightTint,
    modifier = modifier
      .size(16.dp)
      .testTag(testTag)
  )
}

/**
 * Searchable bottom sheet allowing users to manually pick their Home Time Zone.
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
  val currentResolvedZoneId = DualZoneClockEngine.resolveHomeZoneId(userSettings)
  val defaultCurrencyZoneId = DualZoneClockEngine.defaultZoneIdForCurrency(userSettings.homeCurrency)
  val defaultCityLabel = DualZoneClockEngine.friendlyCityName(defaultCurrencyZoneId)

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

        if (!userSettings.homeTimeZoneId.isNullOrBlank()) {
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
                contentDescription = "Clear search"
              )
            }
          }
        },
        singleLine = true,
        shape = PlutoShapes.medium
      )

      if (searchQuery.isBlank() && suggestedZones.isNotEmpty()) {
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
              onClick = {
                onSelectTimeZone(option.zoneId)
                onDismiss()
              },
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
            onClick = {
              onSelectTimeZone(item.zoneId)
              onDismiss()
            }
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
        contentDescription = "Selected",
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(18.dp)
      )
    }
  }
}
