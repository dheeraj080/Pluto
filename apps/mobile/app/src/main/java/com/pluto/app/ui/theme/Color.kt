package com.pluto.app.ui.theme

import androidx.compose.ui.graphics.Color

// Warm Editorial Mint & Forest Green Palette — Light Theme
val ForestPrimary = Color(0xFF114B3E)             // Deep Forest Green primary accent
val EditorialMintContainer = Color(0xFFD2F4E5)    // Crisp Editorial Mint container
val EditorialMintOnContainer = Color(0xFF09332A)  // High-contrast ink on mint container

val BotanicalSecondary = Color(0xFF15805A)        // Botanical Mint positive/savings accent
val BotanicalSecondaryContainer = Color(0xFFDCFCE7)
val BotanicalSecondaryOnContainer = Color(0xFF064E3B)

val HarvestGold = Color(0xFFC88A1E)               // Warm Harvest Gold for Reserve & caution
val HarvestGoldContainer = Color(0xFFFEF3C7)      // Layered Home Reserve card surface
val HarvestGoldOnContainer = Color(0xFF4A3005)

val TerracottaError = Color(0xFFC8372D)           // Terracotta Crimson outflow / alert
val TerracottaErrorContainer = Color(0xFFFEE2E2)
val TerracottaErrorOnContainer = Color(0xFF7F1D1D)

val AlabasterCanvas = Color(0xFFF7F8F5)           // Warm Alabaster background canvas
val IvoryCardSurface = Color(0xFFFFFFFF)          // Borderless Ivory White card surface
val SoftSageMist = Color(0xFFECF1EC)              // Elevated tonal surfaceVariant
val SoftSageMistHighest = Color(0xFFE1E8E2)       // Highest light tonal container
val SageInkPrimary = Color(0xFF141C18)            // Deep ink on alabaster / ivory
val SageInkSecondary = Color(0xFF516058)          // Muted sage slate ink
val SageOutline = Color(0xFFDDE3DC)               // 1dp hairline border reserved for pills, chips & inputs
val SageOutlineSubtle = Color(0xFFE8EDE7)         // Subtle divider hairline

// Warm Editorial Mint & Forest Green Palette — Dark Theme
val LuminousMintPrimary = Color(0xFF5CE1B5)       // Luminous Mint primary accent
val DeepPineOnPrimary = Color(0xFF06291F)
val DeepPineContainer = Color(0xFF123D31)
val DeepPineOnContainer = Color(0xFFC7F9E5)

val SageEmeraldSecondary = Color(0xFF4ADE80)
val SageEmeraldOnSecondary = Color(0xFF052E16)
val SageEmeraldContainer = Color(0xFF143B29)
val SageEmeraldOnContainer = Color(0xFFBBF7D0)

val WarmAmberTertiary = Color(0xFFF2B84B)
val WarmAmberOnTertiary = Color(0xFF2B1B02)
val WarmAmberContainer = Color(0xFF42300E)
val WarmAmberOnContainer = Color(0xFFFDE68A)

val CoralErrorDark = Color(0xFFF87171)
val CoralErrorDarkOnError = Color(0xFF3F0A0E)
val CoralErrorDarkContainer = Color(0xFF4C1519)
val CoralErrorDarkOnContainer = Color(0xFFFEE2E2)

val EspressoForestCanvas = Color(0xFF0E1412)      // Deep Espresso Forest dark canvas
val CharcoalPineSurface = Color(0xFF161F1B)       // Charcoal Pine dark card surface
val DarkMossElevated = Color(0xFF1F2B26)          // Dark Moss elevated surfaceVariant
val DarkMossElevatedHighest = Color(0xFF273730)   // Highest dark tonal container
val EspressoInkPrimary = Color(0xFFF2F5F3)        // Primary ink on dark canvas
val EspressoInkSecondary = Color(0xFF9AA8A0)      // Muted ink on dark canvas
val EspressoOutline = Color(0xFF26342E)           // Hairline border on dark pills, chips & inputs
val EspressoOutlineSubtle = Color(0xFF1E2924)     // Subtle dark divider hairline

// Deep Emerald Dark-Mode Hero Card Surface (prevents glaring mint hero slab in dark theme)
val DeepEmeraldHeroSurface = Color(0xFF0E342A)
val DeepEmeraldHeroOnSurface = Color(0xFFECFDF5)
val DeepEmeraldHeroBorder = Color(0xFF235648)

/**
 * Safely parses a persisted hex category color string with [BotanicalSecondary] fallback.
 */
fun parseCategoryColor(hex: String): Color {
  return try {
    Color(android.graphics.Color.parseColor(hex))
  } catch (_: Exception) {
    BotanicalSecondary
  }
}
