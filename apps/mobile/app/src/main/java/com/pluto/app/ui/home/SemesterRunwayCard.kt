package com.pluto.app.ui.home

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.School
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.RunwayPaceStatus
import com.pluto.app.domain.model.TermRunwaySummary
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.rememberPrefersReducedMotion

/**
 * Striking collegiate financial hero card designed specifically for International Students.
 * Highlights the semester allowance runway, days remaining in the term, and daily safe-to-spend limit.
 */
@Composable
fun SemesterRunwayHeroCard(
  runwaySummary: TermRunwaySummary,
  userSettings: UserSettings,
  onEditTermClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = userSettings.homeCurrency

  val backgroundBrush = Brush.linearGradient(
    colors = listOf(
      MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.22f),
      MaterialTheme.colorScheme.surface,
      MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.16f)
    )
  )

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
    label = "term_progress"
  )

  Card(
    modifier = modifier
      .fillMaxWidth()
      .heightIn(min = 245.dp)
      .clip(PlutoShapes.extraLarge)
      .testTag("semester_runway_hero_card"),
    shape = PlutoShapes.extraLarge,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .heightIn(min = 245.dp)
        .background(backgroundBrush)
        .padding(18.dp)
    ) {
      Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
      ) {
        // Top Header Row
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
          ) {
            Box(
              modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f)),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = Icons.Rounded.School,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(18.dp)
              )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
              Text(
                text = runwaySummary.termName.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
              )
              Text(
                text = "Semester Allowance Runway",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
              )
            }
          }

          Row(verticalAlignment = Alignment.CenterVertically) {
            // Status Pill
            Surface(
              shape = PlutoShapes.medium,
              color = paceColor.copy(alpha = 0.14f),
              border = BorderStroke(1.dp, paceColor.copy(alpha = 0.45f))
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Box(
                  modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(paceColor)
                )
                Spacer(modifier = Modifier.width(5.dp))
                Text(
                  text = runwaySummary.paceStatus.label,
                  style = MaterialTheme.typography.labelSmall,
                  color = paceColor,
                  fontWeight = FontWeight.Bold
                )
              }
            }

            Spacer(modifier = Modifier.width(4.dp))

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

        // Center: Primary Daily Safe-to-Spend Metric
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = "TODAY'S SAFE-TO-SPEND",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.secondary,
              fontWeight = FontWeight.Bold,
              letterSpacing = 0.8.sp
            )
            Spacer(modifier = Modifier.height(2.dp))

            val primaryDaily = runwaySummary.dailyRunwaySafeToSpendDest ?: runwaySummary.dailyRunwaySafeToSpendHome
            val secondaryDaily = if (primaryDaily.currency != homeCurrency) runwaySummary.dailyRunwaySafeToSpendHome else null

            Text(
              text = "${primaryDaily.format()} / day",
              style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.onSurface,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.testTag("runway_safe_to_spend_value")
            )

            if (secondaryDaily != null) {
              Text(
                text = "≈ ${secondaryDaily.format()} / day home equivalent",
                style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }

          Spacer(modifier = Modifier.width(12.dp))

          // Days Remaining Badge
          Surface(
            shape = PlutoShapes.large,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            modifier = Modifier.testTag("runway_days_remaining")
          ) {
            Column(
              modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
              horizontalAlignment = Alignment.CenterHorizontally
            ) {
              Text(
                text = "${runwaySummary.daysRemaining}",
                style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.tertiary
              )
              Text(
                text = "days left",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }

        // Bottom Progress & Allowance Breakdown
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            val remainingMoney = runwaySummary.remainingDiscretionaryDest ?: runwaySummary.remainingDiscretionaryHome
            Text(
              text = "Discretionary: ${remainingMoney.format()} left",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurface,
              fontWeight = FontWeight.Medium
            )
            Text(
              text = "${(percentDaysPassed * 100).toInt()}% of term passed",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }

          Spacer(modifier = Modifier.height(6.dp))

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

          Spacer(modifier = Modifier.height(6.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            Text(
              text = "Allowance: ${runwaySummary.totalAllowanceHome.format()}",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
              text = "Tuition / Fixed: -${runwaySummary.committedFixedHome.format()}",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
    }
  }
}
