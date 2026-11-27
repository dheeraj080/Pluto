package com.pluto.app.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.School
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing

/**
 * Quick dialog allowing users to switch active profile between International Student, Expat, and Short-cycle modes.
 */
@Composable
fun PersonaSwitcherDialog(
  currentPersona: UserPersona,
  onDismiss: () -> Unit,
  onPersonaSelected: (UserPersona) -> Unit
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = {
      Text(
        text = "Switch Profile Mode",
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold
      )
    },
    text = {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        Text(
          text = "Adapt your dashboard widgets, allowance runway, and budgeting cycles for your current lifestyle.",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        PersonaOptionRow(
          persona = UserPersona.INTERNATIONAL_STUDENT,
          icon = Icons.Rounded.School,
          title = "International Student",
          subtitle = "Semester allowance runway, tuition & books, flatmate splits",
          isSelected = currentPersona == UserPersona.INTERNATIONAL_STUDENT,
          testTag = "switch_to_student",
          onClick = {
            onPersonaSelected(UserPersona.INTERNATIONAL_STUDENT)
            onDismiss()
          }
        )

        PersonaOptionRow(
          persona = UserPersona.EXPAT,
          icon = Icons.Rounded.Home,
          title = "Expat & Remote Worker",
          subtitle = "Monthly income, recurring rent, utilities & remittances",
          isSelected = currentPersona == UserPersona.EXPAT,
          testTag = "switch_to_expat",
          onClick = {
            onPersonaSelected(UserPersona.EXPAT)
            onDismiss()
          }
        )

        PersonaOptionRow(
          persona = UserPersona.TOURIST,
          icon = Icons.Rounded.FlightTakeoff,
          title = "Short-cycle",
          subtitle = "Short-cycle budget, daily spending & live FX",
          isSelected = currentPersona == UserPersona.TOURIST,
          testTag = "switch_to_tourist",
          onClick = {
            onPersonaSelected(UserPersona.TOURIST)
            onDismiss()
          }
        )
      }
    },
    confirmButton = {
      PlutoButton(
        text = "Done",
        onClick = onDismiss,
        variant = PlutoButtonVariant.GHOST,
        testTag = "persona_dialog_close"
      )
    }
  )
}

@Composable
private fun PersonaOptionRow(
  persona: UserPersona,
  icon: ImageVector,
  title: String,
  subtitle: String,
  isSelected: Boolean,
  testTag: String,
  onClick: () -> Unit
) {
  PlutoCard(
    modifier = Modifier.fillMaxWidth(),
    onClick = onClick,
    shape = PlutoShapes.large,
    containerColor = if (isSelected) {
      MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
    } else {
      MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
    },
    borderColor = if (isSelected) MaterialTheme.colorScheme.primary else null,
    testTag = testTag
  ) {
    Row(
      modifier = Modifier.padding(PlutoSpacing.md),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Surface(
        shape = PlutoShapes.medium,
        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.size(38.dp)
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
          )
        }
      }

      Spacer(modifier = Modifier.width(12.dp))

      Column(modifier = Modifier.weight(1f)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
          )
          if (isSelected) {
            Surface(
              shape = PlutoShapes.extraSmall,
              color = MaterialTheme.colorScheme.primary
            ) {
              Text(
                text = "ACTIVE",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                fontSize = 10.sp
              )
            }
          }
        }
        Spacer(modifier = Modifier.height(2.dp))
        Text(
          text = subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          fontSize = 11.sp,
          lineHeight = 15.sp
        )
      }
    }
  }
}
