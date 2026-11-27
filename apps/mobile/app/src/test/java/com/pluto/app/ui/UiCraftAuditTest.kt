package com.pluto.app.ui

import android.provider.Settings
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.remote.cloud.CloudSyncState
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.auth.SignInScreen
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.SectionHeader
import com.pluto.app.ui.home.StackedCardsHero
import com.pluto.app.ui.settings.SettingsScreen
import com.pluto.app.ui.theme.PlutoTheme
import com.pluto.app.ui.theme.rememberPrefersReducedMotion
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class UiCraftAuditTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private val isHeadingMatcher = SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading)

  @Test
  fun `section header exposes heading semantics and 48dp minimum action target`() {
    var actionClicks = 0
    composeTestRule.setContent {
      PlutoTheme {
        Column {
          SectionHeader(
            title = "Recent Activity",
            badgeText = "LIVE",
            actionText = "View All",
            onActionClick = { actionClicks += 1 }
          )
        }
      }
    }

    composeTestRule.onNodeWithText("Recent Activity").assert(isHeadingMatcher)
    composeTestRule.onNodeWithText("View All")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertTrue("Expected SectionHeader action click", actionClicks == 1)
  }

  @Test
  fun `sign in screen title has heading semantics and offline button is 48dp or taller`() {
    composeTestRule.setContent {
      PlutoTheme {
        SignInScreen(
          onAuthSuccess = {},
          onContinueOffline = {}
        )
      }
    }

    composeTestRule.onNodeWithText("Pluto").performScrollTo().assert(isHeadingMatcher)
    composeTestRule.onNodeWithTag("continue_offline_button")
      .performScrollTo()
      .assertHeightIsAtLeast(48.dp)
  }

  @Test
  fun `settings screen headers expose heading semantics and rows meet 48dp touch targets`() {
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
          cloudSyncState = CloudSyncState.Synced(
            lastSyncedMillis = 1_700_000_000_000L,
            userEmail = "traveler@example.com",
            syncedRecordsCount = 5
          ),
          signedInEmail = "traveler@example.com",
          signedInDisplayName = "Alex Traveler"
        )
      }
    }

    composeTestRule.onNodeWithText("Currency Tools").performScrollTo().assert(isHeadingMatcher)
    composeTestRule.onNodeWithText("Currency Preferences").performScrollTo().assert(isHeadingMatcher)
    composeTestRule.onNodeWithTag("settings_sync_now_button").performScrollTo().assertHeightIsAtLeast(48.dp)
    composeTestRule.onNodeWithTag("settings_sign_out_button").performScrollTo().assertHeightIsAtLeast(48.dp)
    composeTestRule.onNodeWithTag("settings_row_currency_converter").performScrollTo().assertHeightIsAtLeast(48.dp)
  }

  @Test
  fun `stacked cards hero manage wallets action meets 48dp minimum touch target`() {
    var walletClicks = 0
    val settings = UserSettings(
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      isOnboardingCompleted = true
    )
    val summary = DashboardSummary(
      period = DashboardPeriod.THIS_MONTH,
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      totalHomeSpending = Money.zero(Currency.USD),
      transactionCount = 0,
      categoryBreakdowns = emptyList(),
      currencyBreakdowns = emptyList(),
      recentExpenses = emptyList(),
      hasExpensesInPeriod = false,
      totalAllTimeExpensesCount = 0,
      todayHomeSpending = Money.zero(Currency.USD),
      monthHomeSpending = Money.zero(Currency.USD),
      safeToSpendTodayHome = Money.of("45.00", Currency.USD)
    )

    composeTestRule.setContent {
      PlutoTheme {
        StackedCardsHero(
          summary = summary,
          portfolioValuation = null,
          userSettings = settings,
          wallets = emptyList(),
          onNavigateToWallets = { walletClicks += 1 }
        )
      }
    }

    composeTestRule.onNodeWithTag("stacked_card_adjust_budget_button")
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertTrue("Expected hero card action button to navigate to wallets", walletClicks == 1)
  }

  @Test
  fun `disabled pluto button respects disabled state and reduced motion helper reads 0x scale`() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    Settings.Global.putFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 0f)
    var prefersReduced by mutableStateOf(false)

    composeTestRule.setContent {
      PlutoTheme {
        prefersReduced = rememberPrefersReducedMotion()
        Column {
          PlutoButton(
            text = "Disabled CTA",
            onClick = {},
            enabled = false,
            variant = PlutoButtonVariant.PRIMARY,
            testTag = "disabled_cta_button"
          )
        }
      }
    }

    assertTrue("Expected rememberPrefersReducedMotion() == true when ANIMATOR_DURATION_SCALE == 0f", prefersReduced)
    composeTestRule.onNodeWithTag("disabled_cta_button")
      .assertIsNotEnabled()
      .assertHeightIsAtLeast(48.dp)
  }

  @Test
  fun `reduced motion helper reads normal 1x system scale`() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    Settings.Global.putFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
    var normalScale by mutableStateOf(true)

    composeTestRule.setContent {
      PlutoTheme {
        normalScale = rememberPrefersReducedMotion()
      }
    }

    assertFalse("Expected rememberPrefersReducedMotion() == false when ANIMATOR_DURATION_SCALE == 1f", normalScale)
  }
}
