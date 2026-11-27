package com.pluto.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.pluto.app.domain.model.ThemeMode

@Immutable
data class PlutoExtendedColors(
  val isDark: Boolean,
  val heroContainer: Color,
  val onHeroContainer: Color,
  val heroBorder: Color?,
  val heroDayIconTint: Color
)

private val LightExtendedColors = PlutoExtendedColors(
  isDark = false,
  heroContainer = ForestPrimary,
  onHeroContainer = Color.White,
  heroBorder = null,
  heroDayIconTint = HarvestGoldContainer
)

private val DarkExtendedColors = PlutoExtendedColors(
  isDark = true,
  heroContainer = DeepEmeraldHeroSurface,
  onHeroContainer = DeepEmeraldHeroOnSurface,
  heroBorder = DeepEmeraldHeroBorder,
  heroDayIconTint = WarmAmberTertiary
)

val LocalPlutoExtendedColors = staticCompositionLocalOf { LightExtendedColors }

object PlutoThemeDefaults {
  val extendedColors: PlutoExtendedColors
    @Composable get() = LocalPlutoExtendedColors.current
}

val EditorialDarkColorScheme = darkColorScheme(
  primary = LuminousMintPrimary,
  onPrimary = DeepPineOnPrimary,
  primaryContainer = DeepPineContainer,
  onPrimaryContainer = DeepPineOnContainer,
  secondary = SageEmeraldSecondary,
  onSecondary = SageEmeraldOnSecondary,
  secondaryContainer = SageEmeraldContainer,
  onSecondaryContainer = SageEmeraldOnContainer,
  tertiary = WarmAmberTertiary,
  onTertiary = WarmAmberOnTertiary,
  tertiaryContainer = WarmAmberContainer,
  onTertiaryContainer = WarmAmberOnContainer,
  error = CoralErrorDark,
  onError = CoralErrorDarkOnError,
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
  surfaceContainerHighest = DarkMossElevatedHighest,
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
  surfaceContainerHighest = SoftSageMistHighest,
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

  val extendedColors = if (isDark) DarkExtendedColors else LightExtendedColors

  CompositionLocalProvider(LocalPlutoExtendedColors provides extendedColors) {
    MaterialTheme(
      colorScheme = colorScheme,
      typography = Typography,
      shapes = PlutoShapes,
      content = content
    )
  }
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
