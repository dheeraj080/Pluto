package com.pluto.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.pluto.app.domain.model.ThemeMode

val EditorialDarkColorScheme = darkColorScheme(
  primary = LuminousMintPrimary,
  onPrimary = DeepPineOnPrimary,
  primaryContainer = DeepPineContainer,
  onPrimaryContainer = DeepPineOnContainer,
  secondary = SageEmeraldSecondary,
  onSecondary = Color(0xFF052E16),
  secondaryContainer = SageEmeraldContainer,
  onSecondaryContainer = SageEmeraldOnContainer,
  tertiary = WarmAmberTertiary,
  onTertiary = WarmAmberOnTertiary,
  tertiaryContainer = WarmAmberContainer,
  onTertiaryContainer = WarmAmberOnContainer,
  error = CoralErrorDark,
  onError = Color(0xFF3F0A0E),
  errorContainer = CoralErrorDarkContainer,
  onErrorContainer = CoralErrorDarkOnContainer,
  background = EspressoForestCanvas,
  onBackground = EspressoInkPrimary,
  surface = CharcoalPineSurface,
  onSurface = EspressoInkPrimary,
  surfaceVariant = DarkMossElevated,
  onSurfaceVariant = EspressoInkSecondary,
  surfaceContainerLowest = EspressoForestCanvas,
  surfaceContainerLow = CharcoalPineSurface,
  surfaceContainer = CharcoalPineSurface,
  surfaceContainerHigh = DarkMossElevated,
  surfaceContainerHighest = Color(0xFF273730),
  outline = EspressoOutline,
  outlineVariant = EspressoOutlineSubtle
)

val EditorialLightColorScheme = lightColorScheme(
  primary = ForestPrimary,
  onPrimary = Color.White,
  primaryContainer = EditorialMintContainer,
  onPrimaryContainer = EditorialMintOnContainer,
  secondary = BotanicalSecondary,
  onSecondary = Color.White,
  secondaryContainer = BotanicalSecondaryContainer,
  onSecondaryContainer = BotanicalSecondaryOnContainer,
  tertiary = HarvestGold,
  onTertiary = Color.White,
  tertiaryContainer = HarvestGoldContainer,
  onTertiaryContainer = HarvestGoldOnContainer,
  error = TerracottaError,
  onError = Color.White,
  errorContainer = TerracottaErrorContainer,
  onErrorContainer = TerracottaErrorOnContainer,
  background = AlabasterCanvas,
  onBackground = SageInkPrimary,
  surface = IvoryCardSurface,
  onSurface = SageInkPrimary,
  surfaceVariant = SoftSageMist,
  onSurfaceVariant = SageInkSecondary,
  surfaceContainerLowest = IvoryCardSurface,
  surfaceContainerLow = AlabasterCanvas,
  surfaceContainer = IvoryCardSurface,
  surfaceContainerHigh = SoftSageMist,
  surfaceContainerHighest = Color(0xFFE1E8E2),
  outline = SageOutline,
  outlineVariant = SageOutlineSubtle
)

@Composable
fun PlutoTheme(
  themeMode: ThemeMode = ThemeMode.SYSTEM,
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit
) {
  val isDark = when (themeMode) {
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
    ThemeMode.LIGHT -> false
    ThemeMode.DARK -> true
  }

  val colorScheme = when {
    dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
      val context = LocalContext.current
      if (isDark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    }
    isDark -> EditorialDarkColorScheme
    else -> EditorialLightColorScheme
  }

  MaterialTheme(
    colorScheme = colorScheme,
    typography = Typography,
    shapes = PlutoShapes,
    content = content
  )
}

/**
 * Backward-compatible boolean overload for [PlutoTheme].
 */
@Composable
fun PlutoTheme(
  darkTheme: Boolean,
  dynamicColor: Boolean = false,
  content: @Composable () -> Unit
) = PlutoTheme(
  themeMode = if (darkTheme) ThemeMode.DARK else ThemeMode.LIGHT,
  dynamicColor = dynamicColor,
  content = content
)
