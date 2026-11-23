package com.pluto.app.home

import android.content.Context
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DualZoneClockEngine
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.home.DualZoneClockHeaderChip
import com.pluto.app.ui.home.HomeTimeZonePickerSheet
import com.pluto.app.ui.theme.PlutoTheme
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class DualZoneClockTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  @Test
  fun `engine formats half hour, quarter hour, same time, and whole hour offsets accurately`() {
    assertEquals("Same time", DualZoneClockEngine.formatOffsetDifference(0))
    assertEquals("+5.5h", DualZoneClockEngine.formatOffsetDifference(330))
    assertEquals("-5.5h", DualZoneClockEngine.formatOffsetDifference(-330))
    assertEquals("+5h 45m", DualZoneClockEngine.formatOffsetDifference(345))
    assertEquals("-8h", DualZoneClockEngine.formatOffsetDifference(-480))
    assertEquals("+9h", DualZoneClockEngine.formatOffsetDifference(540))
    assertEquals("+30m", DualZoneClockEngine.formatOffsetDifference(30))
  }

  @Test
  fun `computeSnapshot computes day rollover across year boundary and day night indicators`() {
    val losAngeles = TimeZone.getTimeZone("America/Los_Angeles")
    val tokyo = TimeZone.getTimeZone("Asia/Tokyo")

    // Dec 31, 2026 20:00 PST (Los Angeles, UTC-8) -> Jan 1, 2027 13:00 JST (Tokyo, UTC+9)
    val cal = Calendar.getInstance(losAngeles, Locale.US).apply {
      set(2026, Calendar.DECEMBER, 31, 20, 0, 0)
      set(Calendar.MILLISECOND, 0)
    }

    val snapshot = DualZoneClockEngine.computeSnapshot(
      nowMillis = cal.timeInMillis,
      localTimeZone = losAngeles,
      homeTimeZone = tokyo,
      isHomeZoneCustomized = true,
      is24Hour = true,
      locale = Locale.US
    )

    assertEquals("20:00", snapshot.localTimeFormatted)
    assertFalse("20:00 should be nighttime", snapshot.localIsDaytime)
    assertEquals("13:00", snapshot.homeTimeFormatted)
    assertTrue("13:00 should be daytime", snapshot.homeIsDaytime)
    assertEquals("+17h", snapshot.offsetBadgeText)
    assertEquals("+1d", snapshot.dayRolloverLabel)
    assertEquals("Tokyo", snapshot.homeLabel)
  }

  @Test
  fun `resolveHomeZoneId infers currency default until custom zone is picked`() {
    val defaultInr = UserSettings(homeCurrency = Currency.INR, homeTimeZoneId = null)
    assertEquals("Asia/Kolkata", DualZoneClockEngine.resolveHomeZoneId(defaultInr))

    val customUtc = defaultInr.copy(homeTimeZoneId = "America/Chicago")
    assertEquals("America/Chicago", DualZoneClockEngine.resolveHomeZoneId(customUtc))
  }

  @Test
  fun `searchTimeZones matches city, country, and UTC offset`() {
    val mumbaiMatches = DualZoneClockEngine.searchTimeZones(
      query = "Mumbai",
      selectedZoneId = "America/New_York",
      nowMillis = 1_700_000_000_000L,
      is24Hour = true,
      locale = Locale.US
    )
    assertTrue(mumbaiMatches.any { it.zoneId == "Asia/Kolkata" })

    val offsetMatches = DualZoneClockEngine.searchTimeZones(
      query = "UTC+9",
      selectedZoneId = "America/New_York",
      nowMillis = 1_700_000_000_000L,
      is24Hour = true,
      locale = Locale.US
    )
    assertTrue(offsetMatches.any { it.zoneId == "Asia/Tokyo" })
  }

  @Test
  fun `shared preferences repository persists and clears homeTimeZoneId`() = runBlocking {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val repo = SharedPreferencesUserSettingsRepository(context)
    repo.updateHomeTimeZone("Europe/London")
    assertEquals("Europe/London", repo.getSettings().homeTimeZoneId)

    repo.updateHomeTimeZone(null)
    assertNull(repo.getSettings().homeTimeZoneId)
  }

  @Test
  fun `dual zone clock header chip renders local, home, offset, icons, and meets 48dp touch target`() {
    val losAngeles = TimeZone.getTimeZone("America/Los_Angeles")
    val fixedCal = Calendar.getInstance(losAngeles, Locale.US).apply {
      set(2026, Calendar.NOVEMBER, 15, 10, 0, 0) // 10:00 PST -> 23:30 IST (+13.5h)
      set(Calendar.MILLISECOND, 0)
    }
    var tapped = false

    composeTestRule.setContent {
      PlutoTheme {
        DualZoneClockHeaderChip(
          userSettings = UserSettings(
            homeCurrency = Currency.INR,
            destinationCurrency = Currency.USD,
            homeTimeZoneId = "Asia/Kolkata"
          ),
          onClick = { tapped = true },
          nowMillis = fixedCal.timeInMillis,
          localTimeZone = losAngeles
        )
      }
    }

    composeTestRule.onNodeWithTag("home_dual_zone_clock_chip")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertTrue(tapped)
    composeTestRule.onNodeWithTag("dual_clock_offset_badge", useUnmergedTree = true)
      .assertTextContains("+13.5h")
    composeTestRule.onNodeWithTag("dual_clock_home_label", useUnmergedTree = true)
      .assertTextContains("Mumbai", substring = true)
    composeTestRule.onNodeWithTag("dual_clock_local_day_night_icon", useUnmergedTree = true).assertExists()
    composeTestRule.onNodeWithTag("dual_clock_home_day_night_icon", useUnmergedTree = true).assertExists()
  }

  @Test
  fun `home timezone picker searches and selects city and supports reset to default`() {
    var selectedZone: String? = "Asia/Kolkata"
    var dismissed = false

    composeTestRule.setContent {
      PlutoTheme {
        HomeTimeZonePickerSheet(
          userSettings = UserSettings(
            homeCurrency = Currency.USD,
            homeTimeZoneId = "Asia/Kolkata"
          ),
          onSelectTimeZone = { selectedZone = it },
          onDismiss = { dismissed = true },
          nowMillis = 1_700_000_000_000L
        )
      }
    }

    composeTestRule.onNodeWithTag("home_timezone_picker_sheet").assertIsDisplayed()
    composeTestRule.onNodeWithTag("timezone_search_input").performTextInput("Tokyo")
    composeTestRule.waitForIdle()

    composeTestRule.onNodeWithTag("timezone_option_Asia/Tokyo")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertEquals("Asia/Tokyo", selectedZone)
    assertTrue(dismissed)
  }

  @Test
  fun `home timezone picker reset button clears custom timezone back to null`() {
    var selectedZone: String? = "Asia/Tokyo"
    var dismissed = false
    composeTestRule.setContent {
      PlutoTheme {
        HomeTimeZonePickerSheet(
          userSettings = UserSettings(
            homeCurrency = Currency.USD,
            homeTimeZoneId = "Asia/Tokyo"
          ),
          onSelectTimeZone = { selectedZone = it },
          onDismiss = { dismissed = true },
          nowMillis = 1_700_000_000_000L
        )
      }
    }

    composeTestRule.onNodeWithTag("timezone_reset_default_button")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertNull(selectedZone)
    assertTrue(dismissed)
  }
}
