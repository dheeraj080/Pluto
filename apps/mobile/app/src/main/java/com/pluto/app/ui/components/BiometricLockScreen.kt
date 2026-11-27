package com.pluto.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Fingerprint
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading

/**
 * High-security lock screen overlay rendered when biometric authentication is required.
 */
@Composable
fun BiometricLockScreen(
  onUnlockClick: () -> Unit,
  errorMessage: String? = null,
  modifier: Modifier = Modifier
) {
  Scaffold(
    modifier = modifier
      .fillMaxSize()
      .testTag("biometric_lock_screen"),
    containerColor = MaterialTheme.colorScheme.background,
    contentWindowInsets = WindowInsets.safeDrawing
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding),
      contentAlignment = Alignment.Center
    ) {
      Column(
        modifier = Modifier
          .widthIn(max = 420.dp)
          .fillMaxWidth()
          .verticalScroll(rememberScrollState())
          .padding(PlutoSpacing.xxxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
      ) {
        Surface(
          shape = CircleShape,
          color = MaterialTheme.colorScheme.primaryContainer,
          modifier = Modifier.size(88.dp)
        ) {
          Box(contentAlignment = Alignment.Center) {
            Icon(
              imageVector = Icons.Rounded.Lock,
              contentDescription = "App Locked",
              tint = MaterialTheme.colorScheme.onPrimaryContainer,
              modifier = Modifier.size(44.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(PlutoSpacing.xxl))

        Text(
          text = "Pluto is Locked",
          style = MaterialTheme.typography.headlineMedium,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onBackground,
          textAlign = TextAlign.Center,
          modifier = Modifier.plutoHeading()
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.sm))

        Text(
          text = "Verify your biometric identity or device credentials to view your financial accounts.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          textAlign = TextAlign.Center,
          modifier = Modifier.padding(horizontal = PlutoSpacing.lg)
        )

        if (!errorMessage.isNullOrBlank()) {
          Spacer(modifier = Modifier.height(PlutoSpacing.lg))
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.errorContainer
          ) {
            Text(
              text = errorMessage,
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onErrorContainer,
              textAlign = TextAlign.Center,
              modifier = Modifier.padding(horizontal = PlutoSpacing.md, vertical = PlutoSpacing.sm)
            )
          }
        }

        Spacer(modifier = Modifier.height(PlutoSpacing.xxxl))

        PlutoButton(
          text = "Unlock with Biometrics",
          onClick = onUnlockClick,
          variant = PlutoButtonVariant.PRIMARY,
          leadingIcon = Icons.Rounded.Fingerprint,
          modifier = Modifier.fillMaxWidth(),
          testTag = "unlock_biometric_button"
        )
      }
    }
  }
}
