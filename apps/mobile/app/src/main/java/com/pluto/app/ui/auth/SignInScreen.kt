package com.pluto.app.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.CurrencyExchange
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pluto.app.R
import com.pluto.app.data.remote.cloud.GoogleSignInButton
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading

@Composable
fun SignInScreen(
  onAuthSuccess: () -> Unit,
  modifier: Modifier = Modifier,
  onContinueOffline: () -> Unit = {}
) {
  var errorMessage by remember { mutableStateOf<String?>(null) }

  Scaffold(
    modifier = modifier
      .fillMaxSize()
      .testTag("sign_in_screen"),
    contentWindowInsets = WindowInsets.safeDrawing
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .background(MaterialTheme.colorScheme.background)
        .padding(innerPadding),
      contentAlignment = Alignment.Center
    ) {
      Column(
        modifier = Modifier
          .widthIn(max = 480.dp)
          .fillMaxWidth()
          .imePadding()
          .verticalScroll(rememberScrollState())
          .padding(horizontal = PlutoSpacing.xl, vertical = PlutoSpacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Spacer(modifier = Modifier.height(PlutoSpacing.md))

        Image(
          painter = painterResource(id = R.drawable.img_onboarding_hero),
          contentDescription = "Pluto multi-currency finance illustration",
          contentScale = ContentScale.Crop,
          modifier = Modifier
            .fillMaxWidth()
            .height(210.dp)
            .clip(PlutoShapes.extraLarge)
            .border(
              width = 1.dp,
              color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
              shape = PlutoShapes.extraLarge
            )
            .testTag("sign_in_hero_image")
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.xl))

        Text(
          text = "Pluto",
          style = MaterialTheme.typography.displayMedium,
          fontWeight = FontWeight.ExtraBold,
          color = MaterialTheme.colorScheme.onBackground,
          textAlign = TextAlign.Center,
          modifier = Modifier.plutoHeading()
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.xs))

        Text(
          text = "Multi-currency expenses, live FX wallets, and safe-to-spend runway synced across all your devices.",
          style = MaterialTheme.typography.bodyLarge,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.xl))

        PlutoCard(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.extraLarge
        ) {
          Column(
            modifier = Modifier.padding(PlutoSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(PlutoSpacing.md)
          ) {
            AuthFeatureRow(
              icon = Icons.Rounded.CloudDone,
              title = "Encrypted Cloud Sync",
              subtitle = "Automatic offline-first Firestore backup tied to your Google account."
            )
            AuthFeatureRow(
              icon = Icons.Rounded.CurrencyExchange,
              title = "Dual-Currency Precision",
              subtitle = "Track primary spending and reference currency equivalents side-by-side."
            )
            AuthFeatureRow(
              icon = Icons.Rounded.Lock,
              title = "Zero-Trust Isolation",
              subtitle = "Private per-user vaults accessible only by your authenticated session."
            )
          }
        }

        if (errorMessage != null) {
          Spacer(modifier = Modifier.height(PlutoSpacing.md))
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.errorContainer,
            modifier = Modifier
              .fillMaxWidth()
              .testTag("sign_in_error_banner")
          ) {
            Text(
              text = errorMessage ?: "",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onErrorContainer,
              modifier = Modifier.padding(PlutoSpacing.md)
            )
          }
        }

        Spacer(modifier = Modifier.height(PlutoSpacing.xl))

        GoogleSignInButton(
          onAuthSuccess = {
            errorMessage = null
            onAuthSuccess()
          },
          onAuthError = { error ->
            errorMessage = error
          },
          onAuthCancelled = {
            errorMessage = null
          }
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.md))

        PlutoButton(
          text = stringResource(R.string.sign_in_continue_offline),
          onClick = {
            errorMessage = null
            onContinueOffline()
          },
          variant = PlutoButtonVariant.OUTLINED,
          leadingIcon = Icons.Rounded.CloudOff,
          modifier = Modifier.fillMaxWidth(),
          testTag = "continue_offline_button"
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.sm))

        Text(
          text = stringResource(R.string.sign_in_offline_hint),
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          textAlign = TextAlign.Center,
          modifier = Modifier.padding(horizontal = PlutoSpacing.sm)
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.md))
      }
    }
  }
}

@Composable
private fun AuthFeatureRow(
  icon: ImageVector,
  title: String,
  subtitle: String
) {
  Row(verticalAlignment = Alignment.Top) {
    Surface(
      shape = PlutoShapes.small,
      color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.7f),
      modifier = Modifier.size(36.dp)
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(18.dp)
        )
      }
    }
    Spacer(modifier = Modifier.width(PlutoSpacing.md))
    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface
      )
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}
