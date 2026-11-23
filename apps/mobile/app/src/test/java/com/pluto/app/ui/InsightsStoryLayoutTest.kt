package com.pluto.app.ui

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencySpendingSummary
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.ui.insights.InsightsContent
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
class InsightsStoryLayoutTest {

  @get:Rule
  val composeTestRule = createComposeRule()

  private val isHeadingMatcher = SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading)

  private val usd = Currency.USD
  private val eur = Currency.EUR
  private val now = System.currentTimeMillis()
  private val eurToUsd = ExchangeRate.of(eur, usd, 1.10)
  private val usdIdentity = ExchangeRate.identity(usd)

  private val sampleExpenses = listOf(
    Expense(
      id = "exp_1",
      originalAmount = Money.of(BigDecimal("45.00"), eur),
      homeAmount = Money.of(BigDecimal("49.50"), usd),
      exchangeRate = eurToUsd,
      category = Category.FOOD,
      note = "Bistro Dinner",
      merchant = "Cafe Nordic",
      timestamp = now - 60_000L
    ),
    Expense(
      id = "exp_2",
      originalAmount = Money.of(BigDecimal("20.00"), usd),
      homeAmount = Money.of(BigDecimal("20.00"), usd),
      exchangeRate = usdIdentity,
      category = Category.TRANSPORT,
      note = "Metro Pass",
      merchant = "Transit",
      timestamp = now - 120_000L
    )
  )

  private val sampleSummary = DashboardSummary(
    period = DashboardPeriod.THIS_MONTH,
    homeCurrency = usd,
    destinationCurrency = eur,
    totalHomeSpending = Money.of(BigDecimal("69.50"), usd),
    totalDestSpending = Money.of(BigDecimal("63.18"), eur),
    todayHomeSpending = Money.of(BigDecimal("69.50"), usd),
    thirtyDayDailyAvgHome = Money.of(BigDecimal("2.32"), usd),
    thirtyDayDailyAvgDest = Money.of(BigDecimal("2.11"), eur),
    transactionCount = 2,
    categoryBreakdowns = listOf(
      CategorySpendingSummary(
        category = Category.FOOD,
        totalHomeAmount = Money.of(BigDecimal("49.50"), usd),
        percentageOfTotal = BigDecimal("71.2"),
        transactionCount = 1
      ),
      CategorySpendingSummary(
        category = Category.TRANSPORT,
        totalHomeAmount = Money.of(BigDecimal("20.00"), usd),
        percentageOfTotal = BigDecimal("28.8"),
        transactionCount = 1
      )
    ),
    currencyBreakdowns = listOf(
      CurrencySpendingSummary(
        currency = eur,
        totalOriginalAmount = Money.of(BigDecimal("45.00"), eur),
        totalHomeEquivalent = Money.of(BigDecimal("49.50"), usd),
        transactionCount = 1
      ),
      CurrencySpendingSummary(
        currency = usd,
        totalOriginalAmount = Money.of(BigDecimal("20.00"), usd),
        totalHomeEquivalent = Money.of(BigDecimal("20.00"), usd),
        transactionCount = 1
      )
    ),
    recentExpenses = sampleExpenses,
    hasExpensesInPeriod = true,
    totalAllTimeExpensesCount = 2
  )

  private val sampleSettings = UserSettings(
    homeCurrency = usd,
    destinationCurrency = eur,
    isOnboardingCompleted = true
  )

  @Test
  fun `insights story displays spend pulse bento breakdown cards and accessible export buttons`() {
    var selectedPeriod = DashboardPeriod.THIS_MONTH

    composeTestRule.setContent {
      PlutoTheme {
        InsightsContent(
          summary = sampleSummary,
          userSettings = sampleSettings,
          selectedPeriod = selectedPeriod,
          onPeriodSelected = { selectedPeriod = it },
          allExpenses = sampleExpenses,
          onExpenseClick = {},
          onShowSnackbar = {}
        )
      }
    }

    // 1. Period Filter Chips
    composeTestRule.onNodeWithTag("insights_period_selector").assertIsDisplayed()
    composeTestRule.onNodeWithTag("insights_period_today")
      .assertIsDisplayed()
      .performClick()
    assertEquals(DashboardPeriod.TODAY, selectedPeriod)

    // 2. Chapter 1: Spend Pulse Bento
    composeTestRule.onNodeWithTag("insights_total_spent_card").assertIsDisplayed()
    composeTestRule.onNodeWithTag("insights_burn_rate_card").assertIsDisplayed()
    composeTestRule.onNodeWithTag("insights_avg_expense_card").assertIsDisplayed()

    // 3. Chapter 2 & 3: Velocity Curve + Category Breakdown
    composeTestRule.onNodeWithTag("spending_trend_card").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("category_breakdown_chart_card").performScrollTo().assertIsDisplayed()

    // 4. Chapter 4: Currency Distribution with heading semantics
    composeTestRule.onNodeWithTag("insights_currency_breakdown_card").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithText("Currency Distribution").assert(isHeadingMatcher)

    // 5. Chapter 5: Highest Expenses + Export Dock
    composeTestRule.onNodeWithTag("insights_top_expenses_card").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("insights_export_summary_card").performScrollTo().assertIsDisplayed()
    composeTestRule.onNodeWithTag("btn_export_pdf")
      .performScrollTo()
      .assertIsDisplayed()
      .assertHeightIsAtLeast(48.dp)
    composeTestRule.onNodeWithTag("btn_export_csv").assertHeightIsAtLeast(48.dp)
    composeTestRule.onNodeWithTag("btn_share_report").assertHeightIsAtLeast(48.dp)
    composeTestRule.onNodeWithTag("btn_copy_summary").assertHeightIsAtLeast(48.dp)
  }
}
