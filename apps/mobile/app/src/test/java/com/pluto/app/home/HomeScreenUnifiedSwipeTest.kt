package com.pluto.app.home

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.AcademicTermSettings
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.RunwayPaceStatus
import com.pluto.app.domain.model.TermRunwaySummary
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.home.HomeDashboardContent
import com.pluto.app.ui.theme.PlutoTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.math.BigDecimal

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class HomeScreenUnifiedSwipeTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private val usd = Currency.USD
  private val inr = Currency.INR

  private val sampleRunway = TermRunwaySummary(
    termName = "Fall Semester",
    daysRemaining = 45,
    totalDays = 120,
    percentPassed = 62.5f,
    totalAllowanceHome = Money.of(BigDecimal("6000.00"), usd),
    totalAllowanceDest = Money.of(BigDecimal("500000.00"), inr),
    committedFixedHome = Money.of(BigDecimal("1500.00"), usd),
    committedFixedDest = Money.of(BigDecimal("125000.00"), inr),
    termSpentHome = Money.of(BigDecimal("1800.00"), usd),
    termSpentDest = Money.of(BigDecimal("150000.00"), inr),
    remainingDiscretionaryHome = Money.of(BigDecimal("2700.00"), usd),
    remainingDiscretionaryDest = Money.of(BigDecimal("225000.00"), inr),
    dailyRunwaySafeToSpendHome = Money.of(BigDecimal("60.00"), usd),
    dailyRunwaySafeToSpendDest = Money.of(BigDecimal("5000.00"), inr),
    actualDailyAverageHome = Money.of(BigDecimal("24.00"), usd),
    actualDailyAverageDest = Money.of(BigDecimal("2000.00"), inr),
    paceStatus = RunwayPaceStatus.ON_TRACK
  )

  private val sampleSummary = DashboardSummary(
    period = DashboardPeriod.THIS_MONTH,
    homeCurrency = usd,
    destinationCurrency = inr,
    totalHomeSpending = Money.of(BigDecimal("120.00"), usd),
    todayHomeSpending = Money.of(BigDecimal("25.00"), usd),
    transactionCount = 5,
    categoryBreakdowns = emptyList(),
    currencyBreakdowns = emptyList(),
    recentExpenses = emptyList(),
    hasExpensesInPeriod = true,
    totalAllTimeExpensesCount = 5,
    safeToSpendTodayHome = Money.of(BigDecimal("75.00"), usd),
    safeToSpendTodayDest = Money.of(BigDecimal("6250.00"), inr),
    dailyCapProgress = 0.25f,
    termRunwaySummary = sampleRunway
  )

  private val sampleSettings = UserSettings(
    homeCurrency = usd,
    destinationCurrency = inr,
    persona = UserPersona.INTERNATIONAL_STUDENT,
    dailySpendingCap = 100.0,
    monthlySpendingCap = 3000.0,
    academicTermSettings = AcademicTermSettings(
      termName = "Fall Semester",
      totalAllowanceHome = 6000.0,
      tuitionAndFixedCommittedHome = 1500.0
    ),
    homeModules = HomeLayoutPresets.forPersona(UserPersona.INTERNATIONAL_STUDENT)
  )

  @Test
  fun `home dashboard renders stacked dual wallet hero, fixed 4-action dock, 3 student modules, and customize trigger`() {
    var walletClicks = 0
    var clockClicks = 0
    var capsClicks = 0
    var termClicks = 0
    var expenseClicks = 0
    var incomeClicks = 0
    var transferClicks = 0
    var convertClicks = 0
    var customizeClicks = 0

    composeTestRule.setContent {
      PlutoTheme {
        HomeDashboardContent(
          summary = sampleSummary,
          userSettings = sampleSettings,
          onOpenCapsDialog = { capsClicks++ },
          onOpenCategoryBudgetsDialog = {},
          onOpenTermDialog = { termClicks++ },
          onOpenTimeZonePicker = { clockClicks++ },
          onOpenCustomizeSheet = { customizeClicks++ },
          onAddExpenseClick = { expenseClicks++ },
          onExpenseClick = {},
          onNavigateToWallets = { walletClicks++ },
          onNavigateToConvert = { convertClicks++ },
          onAddIncomeClick = { incomeClicks++ },
          onTransferClick = { transferClicks++ }
        )
      }
    }

    // 1. Legacy removed elements do NOT exist
    composeTestRule.onAllNodesWithTag("dashboard_fab_actions").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("home_hero_pager").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("unified_runway_hero_card").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("home_notification_button").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("home_topbar_subtitle").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("quick_action_send").assertCountEquals(0)

    // 2. Stacked Dual Wallet Hero Cards + Inline Dual-Zone Clock
    composeTestRule.onNodeWithTag("stacked_cards_hero").assertIsDisplayed()
    composeTestRule.onNodeWithTag("home_reserve_hero_card").assertIsDisplayed()
    composeTestRule.onNodeWithTag("main_wallet_hero_card").assertIsDisplayed()
    composeTestRule.onNodeWithTag("hero_travel_balance_amount", useUnmergedTree = true).assertExists()

    composeTestRule.onNodeWithTag("home_dual_zone_clock_chip")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    assertEquals(1, clockClicks)

    composeTestRule.onNodeWithTag("stacked_card_adjust_budget_button")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    assertEquals(1, walletClicks)

    // 3. Fixed 4-Action Pill Dock (+ Expense, Convert, Transfer, + Income)
    composeTestRule.onNodeWithTag("fixed_action_dock").assertIsDisplayed()
    composeTestRule.onNodeWithTag("quick_action_expense")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    composeTestRule.onNodeWithTag("quick_action_convert")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    composeTestRule.onNodeWithTag("quick_action_transfer")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    composeTestRule.onNodeWithTag("quick_action_income")
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()

    assertEquals(1, expenseClicks)
    assertEquals(1, convertClicks)
    assertEquals(1, transferClicks)
    assertEquals(1, incomeClicks)

    // 4. Default Student Persona renders 3 modules and hides disabled modules
    composeTestRule.onNodeWithTag("module_card_cycle_runway").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("runway_edit_button").performScrollTo().performClick()
    assertEquals(1, termClicks)

    composeTestRule.onNodeWithTag("module_card_daily_safe_to_spend").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("dashboard_hero_edit_caps_button").performScrollTo().performClick()
    assertEquals(1, capsClicks)

    composeTestRule.onNodeWithTag("manage_expenses_section").performScrollTo().assertIsDisplayed()

    composeTestRule.onAllNodesWithTag("spending_trend_card").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("module_card_cash_flow_summary").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("module_card_category_budgets").assertCountEquals(0)
    composeTestRule.onAllNodesWithTag("module_card_stacked_wallets").assertCountEquals(0)

    // 5. Customize Home button at bottom of feed meets 48dp and opens customize sheet
    composeTestRule.onNodeWithTag("customize_home_button")
      .performScrollTo()
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
      .performClick()
    assertEquals(1, customizeClicks)
  }
}
