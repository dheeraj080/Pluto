package com.pluto.app.ui.theme

import android.provider.Settings
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics

/**
 * Motion and accessibility helpers aligned with `better-ui` and `better-accessibility`:
 * - Exact press scale (`0.96f` over `150ms` ease-out), disabled controls never scale.
 * - Zero-bounce spring transitions (`Spring.DampingRatioNoBouncy`).
 * - Reduced-motion preference guard respecting Android system `ANIMATOR_DURATION_SCALE`.
 */
object PlutoMotion {
  const val PressScale: Float = 0.96f
  const val CardPressScale: Float = 0.985f
  const val PressDurationMs: Int = 150
  const val StateDurationMs: Int = 200
  const val EntranceDurationMs: Int = 300

  val NoBounceSpring = spring<Float>(
    dampingRatio = Spring.DampingRatioNoBouncy,
    stiffness = Spring.StiffnessMediumLow
  )
}

@Composable
fun rememberPrefersReducedMotion(): Boolean {
  val context = LocalContext.current
  return remember(context) {
    try {
      val scale = Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE,
        1f
      )
      scale <= 0f
    } catch (_: Exception) {
      false
    }
  }
}

/**
 * Applies tactile press scaling (`0.96f` for controls, `0.985f` for large cards) over `150ms` ease-out
 * while gating scale motion behind [enabled] and system reduced-motion settings.
 */
fun Modifier.plutoPressableScale(
  enabled: Boolean = true,
  pressedScale: Float = PlutoMotion.PressScale,
  interactionSource: MutableInteractionSource? = null
): Modifier = composed {
  if (!enabled || interactionSource == null) {
    return@composed this
  }
  val prefersReducedMotion = rememberPrefersReducedMotion()
  val isPressed by interactionSource.collectIsPressedAsState()
  val targetScale = if (!prefersReducedMotion && isPressed) pressedScale else 1f
  val scale by animateFloatAsState(
    targetValue = targetScale,
    animationSpec = tween(
      durationMillis = PlutoMotion.PressDurationMs,
      easing = FastOutSlowInEasing
    ),
    label = "pluto_press_scale"
  )
  this.graphicsLayer {
    scaleX = scale
    scaleY = scale
  }
}

/**
 * Marks section titles as semantic headings for TalkBack and keyboard exploration.
 */
fun Modifier.plutoHeading(): Modifier = this.semantics { heading() }
