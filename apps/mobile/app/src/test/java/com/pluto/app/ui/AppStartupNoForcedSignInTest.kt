package com.pluto.app.ui

import android.content.Context
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.MainActivity
import com.pluto.app.data.repository.OfflineSessionPreferences
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.UserSettings
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class AppStartupNoForcedSignInTest {

  @get:Rule
  val composeTestRule = createEmptyComposeRule()

  @Before
  fun prepareSignedOutAppState() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    if (FirebaseApp.getApps(context).isEmpty()) {
      FirebaseApp.initializeApp(
        context,
        FirebaseOptions.Builder()
          .setApplicationId("com.pluto.app.nhpnee")
          .setProjectId("test-project")
          .setApiKey("fake-api-key")
          .build()
      )
    }
    FirebaseAuth.getInstance().signOut()
    OfflineSessionPreferences(context).setOfflineMode(false)
    runBlocking {
      SharedPreferencesUserSettingsRepository(context).updateSettings(
        UserSettings(isOnboardingCompleted = true)
      )
    }
  }

  @Test
  fun `opening app when signed out enters dashboard directly without showing sign in screen`() {
    ActivityScenario.launch(MainActivity::class.java).use {
      composeTestRule.waitForIdle()
      composeTestRule.onAllNodesWithTag("sign_in_screen").assertCountEquals(0)
      composeTestRule.onAllNodesWithTag("google_sign_in_button").assertCountEquals(0)
      composeTestRule.onNodeWithTag("home_topbar_title").assertIsDisplayed()
    }
  }
}
