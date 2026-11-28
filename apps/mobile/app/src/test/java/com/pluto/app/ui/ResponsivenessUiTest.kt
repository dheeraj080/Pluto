package com.pluto.app.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.pluto.app.ui.components.DualCurrencyAmountView
import com.pluto.app.ui.navigation.TopLevelDestination
import com.pluto.app.ui.theme.PlutoResponsive
import com.pluto.app.ui.theme.PlutoTheme
import com.pluto.app.ui.theme.useLargeFontLayout
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Static-matrix coverage for the reflow-first responsiveness policy.
 *
 * The app keeps every text size in `.sp` and honours system font scale; layouts stack or
 * reflow instead of shrinking type. These tests assert the structural guarantees that keep
 * critical content reachable on compact widths and at large accessibility scales.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], qualifiers = "w320dp-h640dp")
class ResponsivenessUiTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  @Test
  fun `dual currency amount column never takes more than half of a compact row`() {
    composeTestRule.setContent {
      PlutoTheme {
        val currentDensity = LocalDensity.current
        CompositionLocalProvider(
          LocalDensity provides Density(
            density = currentDensity.density,
            fontScale = PlutoResponsive.ExtraLargeFontScale
          )
        ) {
          Row(modifier = Modifier.width(320.dp)) {
            androidx.compose.material3.Text(
              text = "Long merchant name with category metadata",
              modifier = Modifier
                .weight(1f)
                .testTag("responsiveness_label")
            )
            DualCurrencyAmountView(
              primaryAmount = "12,345,678.90 (USD)",
              secondaryAmount = "1,234,567.89 (INR)",
              modifier = Modifier.testTag("responsiveness_amount")
            )
          }
        }
      }
    }

    val density = composeTestRule.density.density
    val labelWidthDp = composeTestRule.onNodeWithTag("responsiveness_label")
      .fetchSemanticsNode().size.width / density
    val amountWidthDp = composeTestRule.onNodeWithTag("responsiveness_amount")
      .fetchSemanticsNode().size.width / density

    assertTrue("label column collapsed to ${labelWidthDp}dp", labelWidthDp >= 100f)
    assertTrue("amount column too wide: ${amountWidthDp}dp", amountWidthDp <= 160f)
  }

  @Test
  fun `navigation tabs keep accessible targets at compact width across font scales`() {
    val fontScale = mutableStateOf(1.0f)
    composeTestRule.setContent {
      PlutoTheme {
        val currentDensity = LocalDensity.current
        CompositionLocalProvider(
          LocalDensity provides Density(
            density = currentDensity.density,
            fontScale = fontScale.value
          )
        ) {
          PlutoNavigationBar(
            selectedTab = TopLevelDestination.EXPENSES,
            onTabSelected = {}
          )
        }
      }
    }

    listOf(1.0f, PlutoResponsive.LargeFontScale, PlutoResponsive.ExtraLargeFontScale)
      .forEach { scale ->
        composeTestRule.runOnIdle { fontScale.value = scale }
        composeTestRule.waitForIdle()

        TopLevelDestination.entries.forEach { destination ->
          composeTestRule.onNodeWithTag("nav_tab_${destination.name.lowercase()}")
            .assertIsDisplayed()
            .assertHeightIsAtLeast(48.dp)
        }
      }
  }

  @Test
  fun `large font layout helper follows the documented threshold`() {
    val fontScale = mutableStateOf(1.2f)
    composeTestRule.setContent {
      val currentDensity = LocalDensity.current
      CompositionLocalProvider(
        LocalDensity provides Density(
          density = currentDensity.density,
          fontScale = fontScale.value
        )
      ) {
        Text(
          text = if (useLargeFontLayout()) "large" else "normal",
          modifier = Modifier.testTag("responsiveness_layout_mode")
        )
      }
    }

    composeTestRule.onNodeWithText("normal").assertIsDisplayed()

    composeTestRule.runOnIdle { fontScale.value = PlutoResponsive.LargeFontScale }
    composeTestRule.waitForIdle()
    composeTestRule.onNodeWithText("large").assertIsDisplayed()
  }
}
