package com.pluto.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * Strict structural shapes adhering to Swiss Fintech geometry (content-first, intentional).
 */
val PlutoShapes = Shapes(
  extraSmall = RoundedCornerShape(4.dp),
  small = RoundedCornerShape(6.dp),
  medium = RoundedCornerShape(10.dp),
  large = RoundedCornerShape(14.dp),
  extraLarge = RoundedCornerShape(20.dp)
)
