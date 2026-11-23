package com.pluto.app.home

import android.content.Context
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.remote.cloud.CloudUserSettings
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.HomeModuleId
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.home.HomeCustomizeSheet
import com.pluto.app.ui.theme.PlutoTheme
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class HomeCustomizationTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private lateinit var context: Context

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    context.getSharedPreferences("global_expense_user_settings", Context.MODE_PRIVATE)
      .edit()
      .clear()
      .commit()
  }

  @Test
  fun `persona presets enable exactly three default modules per persona`() {
    val studentEnabled = HomeLayoutPresets.forPersona(UserPersona.INTERNATIONAL_STUDENT)
      .filter { it.isEnabled }.map { it.id }
    assertEquals(
      listOf(HomeModuleId.CYCLE_RUNWAY, HomeModuleId.DAILY_SAFE_TO_SPEND, HomeModuleId.RECENT_EXPENSES),
      studentEnabled
    )

    val expatEnabled = HomeLayoutPresets.forPersona(UserPersona.EXPAT)
      .filter { it.isEnabled }.map { it.id }
    assertEquals(
      listOf(HomeModuleId.CASH_FLOW_SUMMARY, HomeModuleId.CATEGORY_BUDGETS, HomeModuleId.RECENT_EXPENSES),
      expatEnabled
    )

    val touristEnabled = HomeLayoutPresets.forPersona(UserPersona.TOURIST)
      .filter { it.isEnabled }.map { it.id }
    assertEquals(
      listOf(HomeModuleId.DAILY_SAFE_TO_SPEND, HomeModuleId.SPENDING_TREND, HomeModuleId.RECENT_EXPENSES),
      touristEnabled
    )

    assertEquals(HomeModuleId.entries.size, HomeLayoutPresets.forPersona(UserPersona.EXPAT).size)
  }

  @Test
  fun `normalize deduplicates modules, appends missing disabled, and detects custom layouts`() {
    val preset = HomeLayoutPresets.forPersona(UserPersona.TOURIST)
    assertFalse(HomeLayoutPresets.isCustomLayout(preset, UserPersona.TOURIST))

    val partialWithDupes = listOf(
      HomeModuleConfig(HomeModuleId.RECENT_EXPENSES, isEnabled = true),
      HomeModuleConfig(HomeModuleId.RECENT_EXPENSES, isEnabled = false),
      HomeModuleConfig(HomeModuleId.SPENDING_TREND, isEnabled = true)
    )
    val normalized = HomeLayoutPresets.normalize(partialWithDupes, UserPersona.TOURIST)
    assertEquals(HomeModuleId.entries.size, normalized.size)
    assertEquals(HomeModuleId.RECENT_EXPENSES, normalized[0].id)
    assertTrue(normalized[0].isEnabled)
    assertEquals(HomeModuleId.SPENDING_TREND, normalized[1].id)
    assertTrue(normalized[1].isEnabled)
    assertTrue(normalized.drop(2).all { !it.isEnabled })
    assertTrue(HomeLayoutPresets.isCustomLayout(normalized, UserPersona.TOURIST))

    val fallback = HomeLayoutPresets.normalize(emptyList(), UserPersona.EXPAT)
    assertEquals(HomeLayoutPresets.forPersona(UserPersona.EXPAT), fallback)
  }

  @Test
  fun `shared preferences repository persists and restores custom home modules and falls back on corrupt data`() = runBlocking {
    val repo = SharedPreferencesUserSettingsRepository(context)
    val customModules = listOf(
      HomeModuleConfig(HomeModuleId.SPENDING_TREND, true),
      HomeModuleConfig(HomeModuleId.STACKED_WALLETS, true),
      HomeModuleConfig(HomeModuleId.RECENT_EXPENSES, true)
    )
    repo.updateHomeModules(customModules)

    val reloadedRepo = SharedPreferencesUserSettingsRepository(context)
    val loaded = reloadedRepo.getSettings().homeModules
    assertEquals(HomeModuleId.SPENDING_TREND, loaded[0].id)
    assertTrue(loaded[0].isEnabled)
    assertEquals(HomeModuleId.STACKED_WALLETS, loaded[1].id)
    assertTrue(loaded[1].isEnabled)
    assertEquals(HomeModuleId.entries.size, loaded.size)

    // Corrupt serialized value falls back to persona preset
    context.getSharedPreferences("global_expense_user_settings", Context.MODE_PRIVATE)
      .edit()
      .putString("key_home_modules", "INVALID_ENTRY,BROKEN")
      .commit()

    val recovered = SharedPreferencesUserSettingsRepository(context).getSettings()
    assertEquals(HomeLayoutPresets.forPersona(recovered.persona), recovered.homeModules)
  }

  @Test
  fun `cloud user settings preserves homeModules across domain serialization round-trip`() {
    val customModules = HomeLayoutPresets.normalize(
      listOf(
        HomeModuleConfig(HomeModuleId.CASH_FLOW_SUMMARY, true),
        HomeModuleConfig(HomeModuleId.DAILY_SAFE_TO_SPEND, true)
      ),
      UserPersona.EXPAT
    )
    val domain = UserSettings(
      persona = UserPersona.EXPAT,
      homeModules = customModules
    )
    val map = CloudUserSettings.toCreateMap("uid-1", domain)
    @Suppress("UNCHECKED_CAST")
    val serializedList = map["homeModules"] as List<String>

    val cloud = CloudUserSettings(
      persona = UserPersona.EXPAT.name,
      homeModules = serializedList
    )
    val roundTripped = cloud.toDomain()
    assertEquals(customModules, roundTripped.homeModules)
  }

  @Test
  fun `home customize sheet supports persona presets, toggling, reordering, and reset`() {
    var updatedModules: List<HomeModuleConfig>? = null
    var appliedPreset: UserPersona? = null
    val initialModules = HomeLayoutPresets.forPersona(UserPersona.INTERNATIONAL_STUDENT)

    composeTestRule.setContent {
      PlutoTheme {
        HomeCustomizeSheet(
          currentPersona = UserPersona.INTERNATIONAL_STUDENT,
          currentModules = initialModules,
          onUpdateModules = { updatedModules = it },
          onApplyPersonaPreset = { appliedPreset = it },
          onDismiss = {}
        )
      }
    }

    composeTestRule.onNodeWithTag("home_customize_sheet").assertIsDisplayed()
    // Preset layout should NOT show custom badge or reset button
    composeTestRule.onAllNodesWithTag("customize_custom_badge").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("reset_home_preset_button").assertCountEquals(0)

    // Selecting Expat preset triggers callback
    composeTestRule.onNodeWithTag("preset_chip_expat")
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    assertEquals(UserPersona.EXPAT, appliedPreset)

    // Toggling Spending Trend enables it
    composeTestRule.onNodeWithTag("toggle_spending_trend")
      .performScrollTo()
      .performClick()
    val afterToggle = updatedModules!!
    assertTrue(afterToggle.first { it.id == HomeModuleId.SPENDING_TREND }.isEnabled)

    // Moving Daily Safe-to-Spend (index 1) up moves it to index 0
    composeTestRule.onNodeWithTag("move_up_daily_safe_to_spend")
      .performScrollTo()
      .performClick()
    val afterReorder = updatedModules!!
    assertEquals(HomeModuleId.DAILY_SAFE_TO_SPEND, afterReorder[0].id)
    assertEquals(HomeModuleId.CYCLE_RUNWAY, afterReorder[1].id)
  }

  @Test
  fun `home customize sheet shows custom badge and resets custom layout to active preset`() {
    var resetPersona: UserPersona? = null
    val customModules = HomeLayoutPresets.normalize(
      listOf(HomeModuleConfig(HomeModuleId.SPENDING_TREND, true)),
      UserPersona.TOURIST
    )

    composeTestRule.setContent {
      PlutoTheme {
        HomeCustomizeSheet(
          currentPersona = UserPersona.TOURIST,
          currentModules = customModules,
          onUpdateModules = {},
          onApplyPersonaPreset = { resetPersona = it },
          onDismiss = {}
        )
      }
    }

    composeTestRule.onNodeWithTag("customize_custom_badge").assertIsDisplayed()
    composeTestRule.onNodeWithTag("reset_home_preset_button")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertEquals(UserPersona.TOURIST, resetPersona)
  }
}
