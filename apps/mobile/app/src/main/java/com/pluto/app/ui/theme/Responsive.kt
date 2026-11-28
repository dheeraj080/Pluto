package com.pluto.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Shared responsiveness thresholds for Pluto screens.
 *
 * The app deliberately keeps every text size in [androidx.compose.ui.unit.TextUnitType.sp]
 * and honours the system font scale. Layouts reflow instead of shrinking text: callers use
 * [useLargeFontLayout] (or [fontScale]) to stack dense rows, wrap values and drop secondary
 * decoration when text grows. Width/height breakpoints live in [PlutoResponsive] so screens
 * and shared components make the same decisions.
 */
object PlutoResponsive {
  /** Aligns with the documented "verify at font_scale = 1.3" rule in DESIGN.md. */
  const val LargeFontScale = 1.3f

  /** Very large accessibility scale used by the test matrix. */
  const val ExtraLargeFontScale = 1.8f

  val CompactWidth: Dp = 360.dp
  val MediumWidth: Dp = 600.dp
  val ExpandedWidth: Dp = 840.dp

  /** Short landscape / foldable pane height where fixed-height sheets must scroll. */
  val ShortHeight: Dp = 480.dp

  /** Maximum share of a row a trailing amount column may claim before the label collapses. */
  const val AmountColumnWidthFraction = 0.5f

  /** Space reserved inside a bottom sheet for the drag handle and sticky action footer. */
  val SheetFooterReserve: Dp = 112.dp

  /** Smallest scrollable body height that still leaves room for controls on short screens. */
  val MinSheetBodyHeight: Dp = 96.dp

  /** Upper bound for a scrollable sheet body on tall screens. */
  val SheetBodyMaxHeight: Dp = 520.dp

  /**
   * Height for a scrollable bottom-sheet body. The sheet still wraps its content; this only
   * caps the body when it would otherwise push the sticky footer off-screen.
   */
  fun sheetBodyMaxHeight(availableHeight: Dp): Dp =
    (availableHeight - SheetFooterReserve).coerceIn(MinSheetBodyHeight, SheetBodyMaxHeight)
}

/** Current system font scale. Prefer this over hard-coded thresholds. */
@Composable
fun fontScale(): Float = LocalDensity.current.fontScale

/** True when system text is large enough that dense rows should stack/reflow. */
@Composable
fun useLargeFontLayout(): Boolean = fontScale() >= PlutoResponsive.LargeFontScale
