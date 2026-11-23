package com.pluto.app.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.pluto.app.data.remote.cloud.CloudSyncState
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.auth.SignInScreen
import com.pluto.app.ui.settings.SettingsScreen
import com.pluto.app.ui.theme.PlutoTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class AdaptiveShellAndAuthUiTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  @Test
  fun `sign in screen displays Google sign in CTA and Continue Offline button`() {
    var offlineClicked = false
    composeTestRule.setContent {
      PlutoTheme {
        SignInScreen(
          onAuthSuccess = {},
          onContinueOffline = { offlineClicked = true }
        )
      }
    }

    composeTestRule.onNodeWithTag("sign_in_screen").assertIsDisplayed()
    composeTestRule.onNodeWithTag("sign_in_hero_image").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("google_sign_in_button").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithText("Sign in with Google").performScrollTo().assertIsDisplayed()

    composeTestRule.onNodeWithTag("continue_offline_button").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithText("Continue Offline").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("continue_offline_button").performClick()
    assertTrue("Expected onContinueOffline callback to fire", offlineClicked)
  }

  @Test
  fun `settings screen shows signed in email sync controls and notification toggle`() {
    composeTestRule.setContent {
      PlutoTheme {
        SettingsScreen(
          userSettings = UserSettings(
            homeCurrency = Currency.USD,
            destinationCurrency = Currency.JPY,
            isOnboardingCompleted = true
          ),
          onChangeHomeCurrencyClick = {},
          onChangeDestinationClick = {},
          onUpdateSpendingCaps = { _, _ -> },
          onResetOnboardingClick = {},
          cloudSyncState = CloudSyncState.Synced(
            lastSyncedMillis = 1_700_000_000_000L,
            userEmail = "traveler@example.com",
            syncedRecordsCount = 12
          ),
          signedInEmail = "traveler@example.com",
          signedInDisplayName = "Alex Traveler"
        )
      }
    }

    composeTestRule.onNodeWithText("Alex Traveler").assertIsDisplayed()
    composeTestRule.onNodeWithText("traveler@example.com").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_cloud_sync_status").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_sync_now_button").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_sign_out_button").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_switch_notifications").assertExists()
  }

  @Test
  fun `settings screen in offline mode displays local vault status and Google sign in upgrade CTA`() {
    composeTestRule.setContent {
      PlutoTheme {
        SettingsScreen(
          userSettings = UserSettings(
            homeCurrency = Currency.USD,
            destinationCurrency = Currency.EUR,
            isOnboardingCompleted = true
          ),
          onChangeHomeCurrencyClick = {},
          onChangeDestinationClick = {},
          onUpdateSpendingCaps = { _, _ -> },
          onResetOnboardingClick = {},
          signedInEmail = null,
          isOfflineMode = true
        )
      }
    }

    composeTestRule.onNodeWithText("Pluto Local Vault").assertIsDisplayed()
    composeTestRule.onNodeWithText("Offline Mode · Local Vault").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_offline_merge_hint").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_google_sign_in_button").assertIsDisplayed()
    composeTestRule.onNodeWithTag("settings_sync_now_button").assertDoesNotExist()
    composeTestRule.onNodeWithTag("settings_sign_out_button").assertDoesNotExist()
  }
}
