package com.pluto.app.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.pluto.app.BuildConfig
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.settings.SettingsScreen
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.math.BigDecimal

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class DevModeEnvironmentConfigTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private val testUserSettings = UserSettings(
    homeCurrency = Currency.USD,
    destinationCurrency = Currency.EUR,
    dailySpendingCap = BigDecimal("150.00"),
    monthlySpendingCap = BigDecimal("4500.00"),
    isOnboardingCompleted = true
  )

  @Test
  fun `buildConfig fields exist and have correct boolean defaults`() {
    // Verifies that BuildConfig fields are generated from .env / .env.example
    val isDevMode: Boolean = BuildConfig.DEV_MODE
    val isSeedSampleData: Boolean = BuildConfig.SEED_SAMPLE_DATA

    assertNotNull(isDevMode)
    assertNotNull(isSeedSampleData)
    // Default in .env.example is false
    assertFalse(isDevMode)
    assertFalse(isSeedSampleData)
  }

  @Test
  fun `settings screen hides developer options when isDevMode is false`() {
    composeTestRule.setContent {
      SettingsScreen(
        userSettings = testUserSettings,
        onChangeHomeCurrencyClick = {},
        onChangeDestinationClick = {},
        onUpdateSpendingCaps = { _, _ -> },
        onResetOnboardingClick = {},
        onSeedDummyDataClick = {},
        isDevMode = false
      )
    }

    // Developer tools section should NOT exist in the node tree
    composeTestRule.onNodeWithTag("settings_row_seed_dummy_data").assertDoesNotExist()
    composeTestRule.onNodeWithTag("settings_row_reset_onboarding").assertDoesNotExist()
    composeTestRule.onNodeWithText("Developer & Debug Tools").assertDoesNotExist()
    composeTestRule.onNodeWithText("DEV MODE").assertDoesNotExist()
  }

  @Test
  fun `settings screen displays developer options when isDevMode is true`() {
    composeTestRule.setContent {
      SettingsScreen(
        userSettings = testUserSettings,
        onChangeHomeCurrencyClick = {},
        onChangeDestinationClick = {},
        onUpdateSpendingCaps = { _, _ -> },
        onResetOnboardingClick = {},
        onSeedDummyDataClick = {},
        isDevMode = true
      )
    }

    // Developer tools section MUST be present in the composition tree
    composeTestRule.onNodeWithText("Developer & Debug Tools").assertExists()
    composeTestRule.onNodeWithText("DEV MODE").assertExists()
    composeTestRule.onNodeWithTag("settings_row_seed_dummy_data").assertExists()
    composeTestRule.onNodeWithTag("settings_row_reset_onboarding").assertExists()
  }
}
