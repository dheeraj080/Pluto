package com.pluto.app.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ThemeMode
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.settings.SettingsScreen
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ThemeModePreferenceTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  @Test
  fun `sharedPreferences repository saves and reads themeMode`() = runBlocking {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    val repository = SharedPreferencesUserSettingsRepository(context)

    // Initial default should be SYSTEM
    assertEquals(ThemeMode.SYSTEM, repository.getSettings().themeMode)

    // Update to LIGHT
    repository.updateThemeMode(ThemeMode.LIGHT)
    assertEquals(ThemeMode.LIGHT, repository.getSettings().themeMode)
    assertEquals(ThemeMode.LIGHT, repository.observeSettings().first().themeMode)

    // Update to DARK
    repository.updateThemeMode(ThemeMode.DARK)
    assertEquals(ThemeMode.DARK, repository.getSettings().themeMode)
    assertEquals(ThemeMode.DARK, repository.observeSettings().first().themeMode)

    // Restore to SYSTEM
    repository.updateThemeMode(ThemeMode.SYSTEM)
    assertEquals(ThemeMode.SYSTEM, repository.getSettings().themeMode)
  }

  @Test
  fun `settings screen opens theme dialog and shows options`() {
    var selectedMode = ThemeMode.SYSTEM

    composeTestRule.setContent {
      SettingsScreen(
        userSettings = UserSettings(
          homeCurrency = Currency.USD,
          destinationCurrency = Currency.EUR,
          themeMode = selectedMode,
          isOnboardingCompleted = true
        ),
        onChangeHomeCurrencyClick = {},
        onChangeDestinationClick = {},
        onUpdateSpendingCaps = { _, _ -> },
        onUpdateThemeMode = { mode -> selectedMode = mode },
        onResetOnboardingClick = {},
        onSeedDummyDataClick = {}
      )
    }

    // Appearance row should display current mode (scroll into view if needed)
    composeTestRule.onNodeWithTag("settings_row_theme").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithText("Follow system default").assertIsDisplayed()

    // Tap theme row to open selection dialog
    composeTestRule.onNodeWithTag("settings_row_theme").performClick()

    // Dialog options should be visible
    composeTestRule.onNodeWithTag("theme_option_system").assertIsDisplayed()
    composeTestRule.onNodeWithTag("theme_option_light").assertIsDisplayed()
    composeTestRule.onNodeWithTag("theme_option_dark").assertIsDisplayed()

    // Select Light Mode
    composeTestRule.onNodeWithTag("theme_option_light").performClick()
    assertEquals(ThemeMode.LIGHT, selectedMode)
  }
}
