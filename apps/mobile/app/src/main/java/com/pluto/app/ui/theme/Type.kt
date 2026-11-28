package com.pluto.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.pluto.app.R

val ManropeFontFamily = FontFamily(
  Font(R.font.manrope, FontWeight.Normal),
  Font(R.font.manrope, FontWeight.Medium),
  Font(R.font.manrope, FontWeight.SemiBold),
  Font(R.font.manrope, FontWeight.Bold),
  Font(R.font.manrope, FontWeight.ExtraBold)
)

val RobotoMonoFontFamily = FontFamily(
  Font(R.font.roboto_mono, FontWeight.Normal),
  Font(R.font.roboto_mono, FontWeight.Medium),
  Font(R.font.roboto_mono, FontWeight.SemiBold),
  Font(R.font.roboto_mono, FontWeight.Bold)
)

/**
 * Tabular-numeric monospaced text style for currency totals, FX rates, clocks, percentages, and budgets.
 */
val PlutoNumericStyle = TextStyle(
  fontFamily = RobotoMonoFontFamily,
  fontFeatureSettings = "tnum"
)

/**
 * Warm Editorial Mint typography scale powered by locally bundled Manrope,
 * featuring breathable 1.4-1.6x body line-heights and >= -0.02em tracking floor.
 */
val Typography = Typography(
  displayLarge = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.ExtraBold,
    fontSize = 38.sp,
    lineHeight = 46.sp,
    letterSpacing = (-0.015).em
  ),
  displayMedium = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 32.sp,
    lineHeight = 40.sp,
    letterSpacing = (-0.01).em
  ),
  headlineLarge = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 28.sp,
    lineHeight = 36.sp,
    letterSpacing = (-0.01).em
  ),
  headlineMedium = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 24.sp,
    lineHeight = 32.sp,
    letterSpacing = 0.sp
  ),
  headlineSmall = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.SemiBold,
    fontSize = 20.sp,
    lineHeight = 28.sp,
    letterSpacing = 0.sp
  ),
  titleLarge = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 18.sp,
    lineHeight = 25.sp,
    letterSpacing = 0.sp
  ),
  titleMedium = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.SemiBold,
    fontSize = 16.sp,
    lineHeight = 23.sp,
    letterSpacing = 0.sp
  ),
  titleSmall = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.SemiBold,
    fontSize = 14.sp,
    lineHeight = 20.sp,
    letterSpacing = 0.05.sp
  ),
  bodyLarge = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Normal,
    fontSize = 15.sp,
    lineHeight = 23.sp,
    letterSpacing = 0.1.sp
  ),
  bodyMedium = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Normal,
    fontSize = 13.sp,
    lineHeight = 20.sp,
    letterSpacing = 0.15.sp
  ),
  bodySmall = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Normal,
    fontSize = 12.sp,
    lineHeight = 18.sp,
    letterSpacing = 0.2.sp
  ),
  labelLarge = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.SemiBold,
    fontSize = 13.sp,
    lineHeight = 18.sp,
    letterSpacing = 0.15.sp
  ),
  labelMedium = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 11.sp,
    lineHeight = 16.sp,
    letterSpacing = 0.3.sp
  ),
  labelSmall = TextStyle(
    fontFamily = ManropeFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 10.sp,
    lineHeight = 14.sp,
    letterSpacing = 0.4.sp
  )
)
