package com.pluto.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pluto.app.ui.navigation.TopLevelDestination
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.theme.rememberPrefersReducedMotion

@Composable
fun PlutoNavigationBar(
  selectedTab: TopLevelDestination,
  onTabSelected: (TopLevelDestination) -> Unit,
  modifier: Modifier = Modifier
) {
  val prefersReducedMotion = rememberPrefersReducedMotion()

  Surface(
    color = MaterialTheme.colorScheme.surface,
    tonalElevation = 0.dp,
    shadowElevation = 0.dp,
    modifier = modifier
      .fillMaxWidth()
      .testTag("main_bottom_nav_bar")
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      HorizontalDivider(
        color = MaterialTheme.colorScheme.outlineVariant,
        thickness = 1.dp
      )
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .navigationBarsPadding()
          .padding(horizontal = PlutoSpacing.xs, vertical = PlutoSpacing.sm)
          .selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.xxs),
        verticalAlignment = Alignment.CenterVertically
      ) {
        TopLevelDestination.entries.forEach { destination ->
          val isSelected = selectedTab == destination
          val interactionSource = remember(destination) { MutableInteractionSource() }
          val animDuration = if (prefersReducedMotion) 0 else PlutoMotion.StateDurationMs

          val indicatorColor by animateColorAsState(
            targetValue = if (isSelected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent,
            animationSpec = tween(durationMillis = animDuration),
            label = "nav_indicator_bg_${destination.name}"
          )
          val iconColor by animateColorAsState(
            targetValue = if (isSelected) {
              MaterialTheme.colorScheme.onPrimaryContainer
            } else {
              MaterialTheme.colorScheme.onSurfaceVariant
            },
            animationSpec = tween(durationMillis = animDuration),
            label = "nav_icon_fg_${destination.name}"
          )
          val labelColor by animateColorAsState(
            targetValue = if (isSelected) {
              MaterialTheme.colorScheme.primary
            } else {
              MaterialTheme.colorScheme.onSurfaceVariant
            },
            animationSpec = tween(durationMillis = animDuration),
            label = "nav_label_fg_${destination.name}"
          )

          Column(
            modifier = Modifier
              .weight(1f)
              .defaultMinSize(minHeight = 56.dp)
              .minimumInteractiveComponentSize()
              .plutoPressableScale(
                enabled = true,
                pressedScale = PlutoMotion.PressScale,
                interactionSource = interactionSource
              )
              .clip(PlutoShapes.large)
              .selectable(
                selected = isSelected,
                interactionSource = interactionSource,
                indication = ripple(),
                role = Role.Tab,
                onClick = { onTabSelected(destination) }
              )
              .padding(horizontal = PlutoSpacing.xxs, vertical = PlutoSpacing.xs)
              .testTag("nav_tab_${destination.name.lowercase()}"),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
          ) {
            Surface(
              shape = CircleShape,
              color = indicatorColor,
              tonalElevation = 0.dp,
              shadowElevation = 0.dp,
              modifier = Modifier
                .width(56.dp)
                .height(30.dp)
            ) {
              Box(contentAlignment = Alignment.Center) {
                Icon(
                  imageVector = if (isSelected) destination.selectedIcon else destination.unselectedIcon,
                  contentDescription = null,
                  tint = iconColor,
                  modifier = Modifier.size(20.dp)
                )
              }
            }
            Spacer(modifier = Modifier.height(PlutoSpacing.xs))
            Text(
              text = destination.title,
              style = MaterialTheme.typography.labelMedium,
              fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
              color = labelColor,
              textAlign = TextAlign.Center,
              softWrap = true,
              maxLines = 2,
              overflow = TextOverflow.Ellipsis
            )
          }
        }
      }
    }
  }
}
