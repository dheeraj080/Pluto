package com.pluto.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pluto.app.ui.navigation.TopLevelDestination
import com.pluto.app.ui.theme.PlutoMotion
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
          .padding(horizontal = 10.dp, vertical = 8.dp)
          .selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        TopLevelDestination.entries.forEach { destination ->
          val isSelected = selectedTab == destination
          val interactionSource = remember(destination) { MutableInteractionSource() }

          val pillColor by animateColorAsState(
            targetValue = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
            animationSpec = tween(durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.StateDurationMs),
            label = "nav_pill_bg_${destination.name}"
          )
          val contentColor by animateColorAsState(
            targetValue = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            animationSpec = tween(durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.StateDurationMs),
            label = "nav_pill_fg_${destination.name}"
          )

          Box(
            modifier = Modifier
              .weight(1f)
              .minimumInteractiveComponentSize()
              .plutoPressableScale(
                enabled = true,
                pressedScale = PlutoMotion.PressScale,
                interactionSource = interactionSource
              )
              .clip(CircleShape)
              .selectable(
                selected = isSelected,
                interactionSource = interactionSource,
                indication = ripple(),
                role = Role.Tab,
                onClick = { onTabSelected(destination) }
              )
              .testTag("nav_tab_${destination.name.lowercase()}"),
            contentAlignment = Alignment.Center
          ) {
            Surface(
              shape = CircleShape,
              color = pillColor,
              contentColor = contentColor,
              tonalElevation = 0.dp,
              shadowElevation = 0.dp
            ) {
              Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
              ) {
                Icon(
                  imageVector = if (isSelected) destination.selectedIcon else destination.unselectedIcon,
                  contentDescription = destination.title,
                  tint = contentColor,
                  modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                  text = destination.title,
                  style = MaterialTheme.typography.labelSmall,
                  fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                  color = contentColor,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis
                )
              }
            }
          }
        }
      }
    }
  }
}
