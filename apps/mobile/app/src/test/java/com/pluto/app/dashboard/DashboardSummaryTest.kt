package com.pluto.app.dashboard

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import com.pluto.app.domain.usecase.GetDashboardSummaryUseCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal
import java.util.Calendar

class DashboardSummaryTest {

  private lateinit var getDashboardSummaryUseCase: GetDashboardSummaryUseCase
  private val inr = Currency.INR
  private val eur = Currency.EUR
  private val usd = Currency.USD

  @Before
  fun setup() {
    getDashboardSummaryUseCase = GetDashboardSummaryUseCase()
  }

  @Test
  fun `empty expense list returns zero totals and empty breakdowns safely without division by zero`() {
    val summary = getDashboardSummaryUseCase(
      allExpenses = emptyList(),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = inr
    )

    assertEquals(inr, summary.homeCurrency)
    assertEquals("0.00", summary.totalHomeSpending.amount.toPlainString())
    assertEquals(0, summary.transactionCount)
    assertTrue(summary.categoryBreakdowns.isEmpty())
    assertTrue(summary.currencyBreakdowns.isEmpty())
    assertTrue(summary.recentExpenses.isEmpty())
    assertFalse(summary.hasExpensesInPeriod)
  }

  @Test
  fun `calculates period total from persisted homeAmount and groups categories with correct percentages`() {
    val now = System.currentTimeMillis()

    // Expense 1: Food 1000 INR
    val exp1 = Expense(
      id = "1",
      originalAmount = Money.of("1000.00", inr),
      homeAmount = Money.of("1000.00", inr),
      exchangeRate = ExchangeRate.identity(inr),
      category = Category.FOOD,
      timestamp = now
    )

    // Expense 2: Transport 3000 INR
    val exp2 = Expense(
      id = "2",
      originalAmount = Money.of("3000.00", inr),
      homeAmount = Money.of("3000.00", inr),
      exchangeRate = ExchangeRate.identity(inr),
      category = Category.TRANSPORT,
      timestamp = now
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(exp1, exp2),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = inr
    )

    assertEquals("4000.00", summary.totalHomeSpending.amount.toPlainString())
    assertEquals(2, summary.transactionCount)
    assertTrue(summary.hasExpensesInPeriod)

    // Category breakdown: Transport is 75.0%, Food is 25.0%
    val transportSummary = summary.categoryBreakdowns.first { it.category == Category.TRANSPORT }
    assertEquals("3000.00", transportSummary.totalHomeAmount.amount.toPlainString())
    assertEquals("75.0", transportSummary.percentageOfTotal.toPlainString())

    val foodSummary = summary.categoryBreakdowns.first { it.category == Category.FOOD }
    assertEquals("1000.00", foodSummary.totalHomeAmount.amount.toPlainString())
    assertEquals("25.0", foodSummary.percentageOfTotal.toPlainString())
  }

  @Test
  fun `currency breakdown keeps original currencies separate and aggregates home equivalents`() {
    val now = System.currentTimeMillis()

    // 25 EUR => 2400 INR
    val expEur = Expense(
      id = "1",
      originalAmount = Money.of("25.00", eur),
      homeAmount = Money.of("2400.00", inr),
      exchangeRate = ExchangeRate.of(eur, inr, 96.0),
      category = Category.GROCERIES,
      timestamp = now
    )

    // 50 USD => 4200 INR
    val expUsd = Expense(
      id = "2",
      originalAmount = Money.of("50.00", usd),
      homeAmount = Money.of("4200.00", inr),
      exchangeRate = ExchangeRate.of(usd, inr, 84.0),
      category = Category.SHOPPING,
      timestamp = now
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expEur, expUsd),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = inr
    )

    assertEquals(2, summary.currencyBreakdowns.size)

    val eurBreakdown = summary.currencyBreakdowns.first { it.currency == eur }
    assertEquals("25.00", eurBreakdown.totalOriginalAmount.amount.toPlainString())
    assertEquals("2400.00", eurBreakdown.totalHomeEquivalent.amount.toPlainString())
    assertEquals(eur, eurBreakdown.totalOriginalAmount.currency)
    assertEquals(inr, eurBreakdown.totalHomeEquivalent.currency)

    val usdBreakdown = summary.currencyBreakdowns.first { it.currency == usd }
    assertEquals("50.00", usdBreakdown.totalOriginalAmount.amount.toPlainString())
    assertEquals("4200.00", usdBreakdown.totalHomeEquivalent.amount.toPlainString())
  }

  @Test
  fun `historical expenses outside the selected period are excluded from period total`() {
    val now = System.currentTimeMillis()

    // Expense today: 500 INR
    val expToday = Expense(
      id = "1",
      originalAmount = Money.of("500.00", inr),
      homeAmount = Money.of("500.00", inr),
      exchangeRate = ExchangeRate.identity(inr),
      category = Category.FOOD,
      timestamp = now
    )

    // Expense 60 days ago: 2000 INR
    val sixtyDaysAgo = Calendar.getInstance().apply {
      add(Calendar.DAY_OF_YEAR, -60)
    }.timeInMillis

    val expPast = Expense(
      id = "2",
      originalAmount = Money.of("2000.00", inr),
      homeAmount = Money.of("2000.00", inr),
      exchangeRate = ExchangeRate.identity(inr),
      category = Category.BILLS,
      timestamp = sixtyDaysAgo
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expToday, expPast),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = inr
    )

    // Only expToday is in this month
    assertEquals("500.00", summary.totalHomeSpending.amount.toPlainString())
    assertEquals(1, summary.transactionCount)
    // Recent expenses still sees both, newest first
    assertEquals(2, summary.recentExpenses.size)
    assertEquals("1", summary.recentExpenses[0].id)
    assertEquals("2", summary.recentExpenses[1].id)
  }

  @Test
  fun `dashboard does not recalculate historical expense amounts using current exchange rates`() {
    val now = System.currentTimeMillis()
    // Stored with historical snapshot: 10 EUR at rate 90 => 900 INR
    val historicalExpense = Expense(
      id = "1",
      originalAmount = Money.of("10.00", eur),
      homeAmount = Money.of("900.00", inr),
      exchangeRate = ExchangeRate(
        fromCurrency = eur,
        toCurrency = inr,
        rate = BigDecimal("90.00000000"),
        source = "historical_recorded_rate"
      ),
      category = Category.FOOD,
      timestamp = now
    )

    // If current market rate is 105 INR today, the dashboard MUST still use the stored 900.00 INR
    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(historicalExpense),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = inr
    )

    assertEquals("900.00", summary.totalHomeSpending.amount.toPlainString())
    val currBreakdown = summary.currencyBreakdowns.first()
    assertEquals("900.00", currBreakdown.totalHomeEquivalent.amount.toPlainString())
    assertEquals("10.00", currBreakdown.totalOriginalAmount.amount.toPlainString())
  }

  @Test
  fun `dashboard calculates today spending and spending cap progress accurately`() {
    val now = System.currentTimeMillis()
    val expToday = Expense(
      id = "1",
      originalAmount = Money.of("50.00", eur),
      homeAmount = Money.of("50.00", usd),
      exchangeRate = ExchangeRate.of(eur, usd, 1.0),
      category = Category.FOOD,
      timestamp = now
    )


    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expToday),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = usd,
      destinationCurrency = eur,
      dailySpendingCap = BigDecimal("100.00"),
      monthlySpendingCap = BigDecimal("1000.00")
    )

    assertEquals(usd, summary.homeCurrency)
    assertEquals(eur, summary.destinationCurrency)
    assertEquals("50.00", summary.todayHomeSpending.amount.toPlainString())
    assertEquals(0.5f, summary.dailyCapProgress ?: 0f, 0.01f)
    assertEquals(0.05f, summary.monthlyCapProgress ?: 0f, 0.01f)
    assertEquals("50.00", summary.safeToSpendTodayHome.amount.toPlainString())
  }

  @Test
  fun `dashboard calculates safe to spend today in both home and destination currencies`() {
    val now = System.currentTimeMillis()
    val expToday = Expense(
      id = "1",
      originalAmount = Money.of("30.00", eur),
      homeAmount = Money.of("30.00", usd),
      exchangeRate = ExchangeRate.of(eur, usd, 1.0),
      category = Category.FOOD,
      timestamp = now
    )

    // With home = USD, dest = EUR (rate USD -> EUR = 0.90)
    val destRate = ExchangeRate.of(usd, eur, 0.90)

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expToday),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = usd,
      destinationCurrency = eur,
      dailySpendingCap = BigDecimal("100.00"),
      destinationExchangeRate = BigDecimal("0.90")
    )

    // Daily cap is $100. Spent $30. Safe to spend = $70.
    assertEquals("70.00", summary.safeToSpendTodayHome.amount.toPlainString())
    assertEquals(usd, summary.safeToSpendTodayHome.currency)

    // Safe to spend in dest currency = 70 * 0.90 = 63.00 EUR
    assertEquals("63.00", summary.safeToSpendTodayDest?.amount?.toPlainString())
    assertEquals(eur, summary.safeToSpendTodayDest?.currency)
  }

  @Test
  fun `dashboard aggregates cash flow and builds unified transaction feed`() {
    val now = System.currentTimeMillis()
    val exp = Expense(
      id = "exp-1",
      originalAmount = Money.of("20.00", eur),
      homeAmount = Money.of("20.00", usd),
      exchangeRate = ExchangeRate.of(eur, usd, 1.0),
      category = Category.FOOD,
      note = "Sushi lunch",
      timestamp = now
    )

    val depositTx = com.pluto.app.domain.model.WalletTransaction(
      id = "tx-1",
      walletId = "w-usd",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("200.00", usd),
      note = "Salary topup",
      timestamp = now + 100
    )

    val transferTx = com.pluto.app.domain.model.WalletTransaction(
      id = "tx-2",
      walletId = "w-usd",
      targetWalletId = "w-eur",
      type = com.pluto.app.domain.model.WalletTransactionType.TRANSFER_OUT,
      amount = Money.of("50.00", usd),
      note = "Transfer to travel card",
      timestamp = now + 200
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(exp),
      walletTransactions = listOf(depositTx, transferTx),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = usd,
      destinationCurrency = eur
    )

    // Total expenses = $20
    assertEquals("20.00", summary.totalHomeSpending.amount.toPlainString())
    // Total income = $200
    assertEquals("200.00", summary.totalIncomeHome.amount.toPlainString())
    // Net cash flow = 200 - 20 = 180.00
    assertEquals("180.00", summary.netCashFlowHome.amount.toPlainString())

    // Unified feed has 3 items
    assertEquals(3, summary.unifiedRecentTransactions.size)
    // Most recent is tx-2 (transfer), then tx-1 (deposit), then exp-1 (expense)
    assertEquals(com.pluto.app.domain.model.UnifiedTransactionType.TRANSFER, summary.unifiedRecentTransactions[0].type)
    assertEquals(com.pluto.app.domain.model.UnifiedTransactionType.INCOME, summary.unifiedRecentTransactions[1].type)
    assertEquals(com.pluto.app.domain.model.UnifiedTransactionType.EXPENSE, summary.unifiedRecentTransactions[2].type)
  }

  @Test
  fun `dashboard systematically calculates finances in both primary destination and secondary home currencies`() {
    val now = System.currentTimeMillis()
    val exp1 = Expense(
      id = "exp-1",
      originalAmount = Money.of("1500", Currency.JPY),
      homeAmount = Money.of("10.00", Currency.USD),
      exchangeRate = ExchangeRate.of(Currency.JPY, Currency.USD, 0.00666667),
      category = Category.FOOD,
      note = "Ramen",
      timestamp = now
    )

    // Destination is JPY (rate USD -> JPY = 150.00)
    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(exp1),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.JPY,
      dailySpendingCap = BigDecimal("50.00"),
      destinationExchangeRate = BigDecimal("150.00")
    )

    // Primary (Current country / JPY) & Secondary (Home country / USD)
    assertEquals(Currency.JPY, summary.destinationCurrency)
    assertEquals(Currency.USD, summary.homeCurrency)

    // Total spending: Secondary Home = $10.00, Primary Destination = ¥1500
    assertEquals("10.00", summary.totalHomeSpending.amount.toPlainString())
    assertEquals(Currency.USD, summary.totalHomeSpending.currency)
    assertEquals("1500", summary.totalDestSpending?.amount?.toPlainString())
    assertEquals(Currency.JPY, summary.totalDestSpending?.currency)

    // Safe to spend: Cap is $50. Spent $10. Remaining Home = $40.00.
    // Safe to spend in JPY (Primary) = 40 * 150 = ¥6000
    assertEquals("40.00", summary.safeToSpendTodayHome.amount.toPlainString())
    assertEquals("6000", summary.safeToSpendTodayDest?.amount?.toPlainString())

    // Category breakdown has both amounts
    val cat = summary.categoryBreakdowns.first()
    assertEquals("10.00", cat.totalHomeAmount.amount.toPlainString())
    assertEquals("1500", cat.totalDestAmount?.amount?.toPlainString())

    // Unified item shows the actually-spent currency and the immutable home snapshot with ISO codes.
    val item = summary.unifiedRecentTransactions.first()
    assertTrue(item.primaryAmountFormatted.startsWith("SPENT ·"))
    assertTrue(item.primaryAmountFormatted.contains("JPY"))
    assertTrue(item.secondaryAmountFormatted?.startsWith("HOME ·") == true)
    assertTrue(item.secondaryAmountFormatted?.contains("(USD)") == true)
  }

  @Test
  fun `safe to spend gauge calculates remaining budget factoring both daily cap and today income inflow`() {
    val now = System.currentTimeMillis()

    // Today's expense: $15 USD (spent in destination currency JPY: ¥2250)
    val expense = Expense(
      id = "exp-today",
      originalAmount = Money.of("2250", Currency.JPY),
      homeAmount = Money.of("15.00", Currency.USD),
      exchangeRate = ExchangeRate.of(Currency.JPY, Currency.USD, 0.00666667),
      category = Category.FOOD,
      timestamp = now
    )

    // Today's deposit/income inflow: $25 USD into USD wallet
    val deposit = com.pluto.app.domain.model.WalletTransaction(
      id = "deposit-1",
      walletId = "wallet-usd",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("25.00", Currency.USD),
      timestamp = now,
      note = "Salary advance"
    )

    // Daily Cap is $50.00. Rate USD -> JPY = 150.00
    // Effective budget = Cap ($50) + Income ($25) = $75.00 (in JPY: ¥11,250)
    // Remaining safe to spend = $75 - $15 = $60.00 (in JPY: ¥9000)
    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      walletTransactions = listOf(deposit),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.JPY,
      dailySpendingCap = BigDecimal("50.00"),
      destinationExchangeRate = BigDecimal("150.00")
    )

    assertEquals("25.00", summary.todayIncomeHome.amount.toPlainString())
    assertEquals("3750", summary.todayIncomeDest?.amount?.toPlainString())
    assertEquals("75.00", summary.effectiveDailyBudgetHome?.amount?.toPlainString())
    assertEquals("11250", summary.effectiveDailyBudgetDest?.amount?.toPlainString())
    assertEquals("60.00", summary.safeToSpendTodayHome.amount.toPlainString())
    assertEquals("9000", summary.safeToSpendTodayDest?.amount?.toPlainString())
    assertFalse(summary.isDailyBudgetExceeded)
    assertFalse(summary.isDailyBudgetCautious)
  }

  @Test
  fun `threshold warning is triggered when safe to spend falls below user defined minimum`() {
    val now = System.currentTimeMillis()

    // Expense today: $85.00 USD
    val expense = Expense(
      id = "exp-threshold-1",
      originalAmount = Money.of("85.00", Currency.USD),
      homeAmount = Money.of("85.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.FOOD,
      timestamp = now
    )

    // Daily Cap is $100.00 USD, Warning Threshold is $25.00 USD. Rate USD -> EUR = 0.90
    // Remaining safe to spend = $100.00 - $85.00 = $15.00 USD (< $25.00 threshold)
    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      dailySpendingCap = BigDecimal("100.00"),
      safeToSpendWarningThreshold = BigDecimal("25.00"),
      destinationExchangeRate = BigDecimal("0.90")
    )

    assertEquals("15.00", summary.safeToSpendTodayHome.amount.toPlainString())
    assertEquals("13.50", summary.safeToSpendTodayDest?.amount?.toPlainString())
    assertEquals("25.00", summary.warningThresholdHome?.amount?.toPlainString())
    assertEquals("22.50", summary.warningThresholdDest?.amount?.toPlainString())
    assertTrue("Remaining is below threshold, isBelowWarningThreshold should be true", summary.isBelowWarningThreshold)
    assertTrue("Caution flag should be active when below warning threshold", summary.isDailyBudgetCautious)
    assertFalse("Budget is not exceeded yet", summary.isDailyBudgetExceeded)
  }

  @Test
  fun `threshold warning is false when safe to spend remains above minimum buffer`() {
    val now = System.currentTimeMillis()

    // Expense today: $40.00 USD
    val expense = Expense(
      id = "exp-threshold-2",
      originalAmount = Money.of("40.00", Currency.USD),
      homeAmount = Money.of("40.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.FOOD,
      timestamp = now
    )

    // Daily Cap is $100.00 USD, Warning Threshold is $20.00 USD.
    // Remaining safe to spend = $100.00 - $40.00 = $60.00 USD (> $20.00 threshold)
    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      dailySpendingCap = BigDecimal("100.00"),
      safeToSpendWarningThreshold = BigDecimal("20.00"),
      destinationExchangeRate = BigDecimal("0.90")
    )

    assertEquals("60.00", summary.safeToSpendTodayHome.amount.toPlainString())
    assertFalse("Remaining is above threshold, isBelowWarningThreshold should be false", summary.isBelowWarningThreshold)
    assertFalse("isDailyBudgetExceeded should be false", summary.isDailyBudgetExceeded)
    assertFalse("isDailyBudgetCautious should be false", summary.isDailyBudgetCautious)
  }

  @Test
  fun `budget exceeded takes precedence when safe to spend drops to zero or negative`() {
    val now = System.currentTimeMillis()

    // Expense today: $110.00 USD (exceeds cap of $100.00)
    val expense = Expense(
      id = "exp-threshold-3",
      originalAmount = Money.of("110.00", Currency.USD),
      homeAmount = Money.of("110.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.SHOPPING,
      timestamp = now
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      dailySpendingCap = BigDecimal("100.00"),
      safeToSpendWarningThreshold = BigDecimal("20.00"),
      destinationExchangeRate = BigDecimal("0.90")
    )

    assertEquals("-10.00", summary.safeToSpendTodayHome.amount.toPlainString())
    assertTrue("isDailyBudgetExceeded should be true", summary.isDailyBudgetExceeded)
    assertFalse("isBelowWarningThreshold is only for positive buffer breach", summary.isBelowWarningThreshold)
    assertTrue("isWarningActive should be true when exceeded", summary.isWarningActive)
  }

  @Test
  fun `thirty day spending trend generates 30 daily buckets with dual currency and calculates metrics correctly`() {
    val now = System.currentTimeMillis()
    val fiveDaysAgo = now - (5L * 86400000L)
    val twentyDaysAgo = now - (20L * 86400000L)

    val expToday = Expense(
      id = "exp-trend-1",
      originalAmount = Money.of("50.00", Currency.USD),
      homeAmount = Money.of("50.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.FOOD,
      timestamp = now
    )

    val exp5DaysAgo = Expense(
      id = "exp-trend-2",
      originalAmount = Money.of("150.00", Currency.USD),
      homeAmount = Money.of("150.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.ENTERTAINMENT,
      timestamp = fiveDaysAgo
    )

    val exp20DaysAgo = Expense(
      id = "exp-trend-3",
      originalAmount = Money.of("100.00", Currency.USD),
      homeAmount = Money.of("100.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.ACCOMMODATION,
      timestamp = twentyDaysAgo
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expToday, exp5DaysAgo, exp20DaysAgo),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      destinationExchangeRate = BigDecimal("0.90")
    )

    // Check size is exactly 30 days
    assertEquals(30, summary.thirtyDaySpendingTrend.size)

    // Total 30-day spend: 50 + 150 + 100 = 300.00 USD, 300 * 0.90 = 270.00 EUR
    assertEquals("300.00", summary.thirtyDayTotalHome.amount.toPlainString())
    assertEquals("270.00", summary.thirtyDayTotalDest?.amount?.toPlainString())

    // Daily Average: 300 / 30 = 10.00 USD, 9.00 EUR
    assertEquals("10.00", summary.thirtyDayDailyAvgHome.amount.toPlainString())
    assertEquals("9.00", summary.thirtyDayDailyAvgDest?.amount?.toPlainString())

    // Peak Day is the 150.00 USD day
    assertEquals("150.00", summary.thirtyDayPeakDay?.amountHome?.amount?.toPlainString())
    assertEquals("135.00", summary.thirtyDayPeakDay?.amountDest?.amount?.toPlainString())

    // Last point (Today) should have 50.00 USD
    val todayPoint = summary.thirtyDaySpendingTrend.last()
    assertEquals("50.00", todayPoint.amountHome.amount.toPlainString())
    assertEquals("45.00", todayPoint.amountDest?.amount?.toPlainString())
    assertEquals(1, todayPoint.transactionCount)
  }

  @Test
  fun `categoryBreakdowns correctly computes multiple category budgets and over-budget states`() {
    val now = System.currentTimeMillis()
    val expFood = Expense(
      id = "exp-food",
      originalAmount = Money.of("120.00", Currency.USD),
      homeAmount = Money.of("120.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.FOOD,
      timestamp = now
    )
    val expTransport = Expense(
      id = "exp-transport",
      originalAmount = Money.of("40.00", Currency.USD),
      homeAmount = Money.of("40.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.TRANSPORT,
      timestamp = now
    )

    val categoryBudgets = mapOf(
      Category.FOOD.id to BigDecimal("100.00"), // Food is 120 / 100 -> Over budget (120%)
      Category.TRANSPORT.id to BigDecimal("80.00") // Transport is 40 / 80 -> Under budget (50%)
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expFood, expTransport),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      destinationExchangeRate = BigDecimal("0.90"),
      categoryBudgets = categoryBudgets
    )

    val foodBreakdown = summary.categoryBreakdowns.find { it.category.id == Category.FOOD.id }
    val transportBreakdown = summary.categoryBreakdowns.find { it.category.id == Category.TRANSPORT.id }

    assertTrue(foodBreakdown != null)
    assertEquals("100.00", foodBreakdown?.budgetHome?.amount?.toPlainString())
    assertEquals("90.00", foodBreakdown?.budgetDest?.amount?.toPlainString())
    assertTrue(foodBreakdown!!.isOverBudget)
    assertEquals(1.2f, foodBreakdown.budgetProgress ?: 0f, 0.01f)

    assertTrue(transportBreakdown != null)
    assertEquals("80.00", transportBreakdown?.budgetHome?.amount?.toPlainString())
    assertEquals("72.00", transportBreakdown?.budgetDest?.amount?.toPlainString())
    assertFalse(transportBreakdown!!.isOverBudget)
    assertEquals(0.5f, transportBreakdown.budgetProgress ?: 0f, 0.01f)
  }

  @Test
  fun `calculates international student semester runway and daily safe to spend accurately`() {
    val now = System.currentTimeMillis()
    val termSettings = com.pluto.app.domain.model.AcademicTermSettings(
      termName = "Fall 2026",
      termStartDate = now - (10L * 86400000L), // 10 days ago
      termEndDate = now + (90L * 86400000L),   // 90 days left
      totalAllowanceHome = BigDecimal("6000.00"),
      tuitionAndFixedCommittedHome = BigDecimal("1500.00")
    )

    // Expense in term: $500 home currency
    val expense = Expense(
      id = "exp-books",
      originalAmount = Money.of("500.00", Currency.USD),
      homeAmount = Money.of("500.00", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.TUITION,
      timestamp = now - (2L * 86400000L)
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      period = DashboardPeriod.ACADEMIC_TERM,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      destinationExchangeRate = BigDecimal("0.90"),
      userPersona = com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
      academicTermSettings = termSettings
    )

    val runway = summary.termRunwaySummary
    assertTrue(runway != null)
    assertEquals("Fall 2026", runway?.termName)
    assertEquals(90, runway?.daysRemaining)
    assertEquals("6000.00", runway?.totalAllowanceHome?.amount?.toPlainString())
    assertEquals("1500.00", runway?.committedFixedHome?.amount?.toPlainString())
    assertEquals("500.00", runway?.termSpentHome?.amount?.toPlainString())

    // Remaining Discretionary = (6000 - 1500) - 500 = 4000.00 USD
    assertEquals("4000.00", runway?.remainingDiscretionaryHome?.amount?.toPlainString())
    // Daily Safe-to-Spend = 4000 / 90 days = 44.44 USD / day
    assertEquals("44.44", runway?.dailyRunwaySafeToSpendHome?.amount?.toPlainString())
    // In destination currency EUR (rate 0.90) = 44.44 * 0.90 = 40.00 EUR / day
    assertEquals("40.00", runway?.dailyRunwaySafeToSpendDest?.amount?.toPlainString())
    assertEquals(com.pluto.app.domain.model.RunwayPaceStatus.ON_TRACK, runway?.paceStatus)
  }

  @Test
  fun `fractional spending caps, warning threshold, category budgets, and term allowance compute with exact BigDecimal math`() {
    val now = System.currentTimeMillis()
    val exp = Expense(
      id = "exp-frac-1",
      originalAmount = Money.of("30.04", Currency.USD),
      homeAmount = Money.of("30.04", Currency.USD),
      exchangeRate = ExchangeRate.identity(Currency.USD),
      category = Category.FOOD,
      timestamp = now
    )
    val termSettings = com.pluto.app.domain.model.AcademicTermSettings(
      termName = "Winter 2027",
      termStartDate = now - (5L * 86400000L),
      termEndDate = now + (10L * 86400000L),
      totalAllowanceHome = BigDecimal("1000.55"),
      tuitionAndFixedCommittedHome = BigDecimal("250.25")
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(exp),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      dailySpendingCap = BigDecimal("49.99"),
      monthlySpendingCap = BigDecimal("320.50"),
      safeToSpendWarningThreshold = BigDecimal("19.95"),
      destinationExchangeRate = BigDecimal("0.90"),
      categoryBudgets = mapOf(Category.FOOD.id to BigDecimal("45.67")),
      userPersona = com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
      academicTermSettings = termSettings
    )

    // 49.99 - 30.04 = 19.95 -> equals threshold (<= 19.95), triggers warning
    assertEquals("19.95", summary.safeToSpendTodayHome.amount.toPlainString())
    assertEquals("19.95", summary.warningThresholdHome?.amount?.toPlainString())
    assertTrue(summary.isBelowWarningThreshold)
    assertFalse(summary.isDailyBudgetExceeded)
    assertEquals("49.99", summary.dailySpendingCap?.toPlainString())
    assertEquals("320.50", summary.monthlySpendingCap?.toPlainString())

    val foodBreakdown = summary.categoryBreakdowns.first { it.category == Category.FOOD }
    assertEquals("45.67", foodBreakdown.budgetHome?.amount?.toPlainString())

    val runway = summary.termRunwaySummary!!
    // 1000.55 - 250.25 - 30.04 = 720.26 remaining over 10 days = 72.03 (HALF_EVEN from 72.026)
    assertEquals("1000.55", runway.totalAllowanceHome.amount.toPlainString())
    assertEquals("250.25", runway.committedFixedHome.amount.toPlainString())
    assertEquals("720.26", runway.remainingDiscretionaryHome.amount.toPlainString())
    assertEquals("72.03", runway.dailyRunwaySafeToSpendHome.amount.toPlainString())
  }

  @Test
  fun `multi-currency deposits convert to home currency using resolved rates and never add raw cross-currency amounts`() {
    val now = System.currentTimeMillis()
    val usdDeposit = com.pluto.app.domain.model.WalletTransaction(
      id = "dep-usd",
      walletId = "w-usd",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("100.00", Currency.USD),
      note = "Base paycheck",
      timestamp = now
    )
    // Foreign deposit in JPY: 15000 JPY @ 0.00666667 = 100.00 USD
    val jpyDeposit = com.pluto.app.domain.model.WalletTransaction(
      id = "dep-jpy",
      walletId = "w-jpy",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("15000", Currency.JPY),
      note = "Part-time tutoring",
      timestamp = now - 500
    )
    // Foreign deposit in EUR: 90.00 EUR when USD -> EUR destination rate = 0.90 => 100.00 USD
    val eurDeposit = com.pluto.app.domain.model.WalletTransaction(
      id = "dep-eur",
      walletId = "w-eur",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("90.00", Currency.EUR),
      note = "Refund",
      timestamp = now - 1000
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = emptyList(),
      walletTransactions = listOf(usdDeposit, jpyDeposit, eurDeposit),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      destinationExchangeRate = BigDecimal("0.90"),
      depositToHomeRates = mapOf(
        Currency.JPY to BigDecimal("0.00666667")
      )
    )

    // USD (100.00) + JPY (100.00) + EUR (90 / 0.90 = 100.00) = 300.00 USD
    assertEquals("300.00", summary.totalIncomeHome.amount.toPlainString())
    assertEquals("300.00", summary.todayIncomeHome.amount.toPlainString())
    assertEquals("270.00", summary.totalIncomeDest?.amount?.toPlainString())
    assertEquals("300.00", summary.netCashFlowHome.amount.toPlainString())
    assertTrue(summary.unvaluedIncomeCurrencies.isEmpty())
    assertTrue(summary.unvaluedTodayIncomeCurrencies.isEmpty())

    // Unified feed JPY item should show converted ≈ +$100.00 home and +€90.00 dest
    val jpyFeedItem = summary.unifiedRecentTransactions.first { it.id == "dep-jpy" }
    assertTrue(jpyFeedItem.primaryAmountFormatted.contains("90.00"))
    assertTrue(jpyFeedItem.secondaryAmountFormatted?.contains("100.00") == true)
  }

  @Test
  fun `foreign deposits without exchange rates are excluded from home totals and reported in unvaluedIncomeCurrencies`() {
    val now = System.currentTimeMillis()
    val usdDeposit = com.pluto.app.domain.model.WalletTransaction(
      id = "dep-usd",
      walletId = "w-usd",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("50.00", Currency.USD),
      note = "USD Allowance",
      timestamp = now
    )
    // GBP deposit with NO GBP -> USD rate supplied
    val gbpDeposit = com.pluto.app.domain.model.WalletTransaction(
      id = "dep-gbp",
      walletId = "w-gbp",
      type = com.pluto.app.domain.model.WalletTransactionType.DEPOSIT,
      amount = Money.of("200.00", Currency.GBP),
      note = "UK Stipend",
      timestamp = now
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = emptyList(),
      walletTransactions = listOf(usdDeposit, gbpDeposit),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = Currency.USD,
      destinationCurrency = Currency.EUR,
      destinationExchangeRate = BigDecimal("0.90"),
      depositToHomeRates = emptyMap()
    )

    // Must NOT add raw 200.00 GBP into USD total: only 50.00 USD counts
    assertEquals("50.00", summary.totalIncomeHome.amount.toPlainString())
    assertEquals("50.00", summary.todayIncomeHome.amount.toPlainString())
    assertEquals(listOf(Currency.GBP), summary.unvaluedIncomeCurrencies)
    assertEquals(listOf(Currency.GBP), summary.unvaluedTodayIncomeCurrencies)

    val gbpItem = summary.unifiedRecentTransactions.first { it.id == "dep-gbp" }
    assertTrue(gbpItem.primaryAmountFormatted.contains("200.00"))
    assertEquals("Rate to USD unavailable", gbpItem.secondaryAmountFormatted)
  }

  @Test
  fun `former home snapshot is translated into current home currency using supplied forward rate`() {
    val now = System.currentTimeMillis()
    val expense = Expense(
      id = "exp-former-home",
      originalAmount = Money.of("10000", Currency.JPY),
      homeAmount = Money.of("100.00", eur),
      exchangeRate = ExchangeRate.of(Currency.JPY, eur, 0.01),
      category = Category.FOOD,
      timestamp = now
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = usd,
      homeCurrencyRates = mapOf(eur to BigDecimal("1.10"))
    )

    assertEquals("110.00", summary.totalHomeSpending.amount.toPlainString())
    assertEquals(usd, summary.totalHomeSpending.currency)
    assertTrue(summary.unconvertibleHomeCurrencies.isEmpty())

    val item = summary.unifiedRecentTransactions.first { it.id == expense.id }
    assertTrue(item.primaryAmountFormatted.contains("JPY"))
    assertTrue(item.secondaryAmountFormatted?.contains("EUR") == true)
  }

  @Test
  fun `former home snapshot without rate is excluded from totals but remains visible on the transaction row`() {
    val now = System.currentTimeMillis()
    val expense = Expense(
      id = "exp-unconvertible-home",
      originalAmount = Money.of("10000", Currency.JPY),
      homeAmount = Money.of("100.00", eur),
      exchangeRate = ExchangeRate.of(Currency.JPY, eur, 0.01),
      category = Category.FOOD,
      timestamp = now
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(expense),
      period = DashboardPeriod.THIS_MONTH,
      currentHomeCurrency = usd
    )

    assertEquals("0.00", summary.totalHomeSpending.amount.toPlainString())
    assertEquals(usd, summary.totalHomeSpending.currency)
    assertEquals(listOf(eur), summary.unconvertibleHomeCurrencies)

    val item = summary.unifiedRecentTransactions.first { it.id == expense.id }
    assertTrue(item.primaryAmountFormatted.startsWith("SPENT ·"))
    assertTrue(item.primaryAmountFormatted.contains("JPY"))
    assertTrue(item.secondaryAmountFormatted?.startsWith("RECORDED HOME ·") == true)
    assertTrue(item.secondaryAmountFormatted?.contains("EUR") == true)
    assertEquals("100.00", expense.homeAmount.amount.toPlainString())
  }

  @Test
  fun `rate-unavailable warning only reports currencies from the selected period`() {
    val calendar = Calendar.getInstance().apply { add(Calendar.MONTH, -2) }
    val oldExpense = Expense(
      id = "exp-old-former-home",
      originalAmount = Money.of("10000", Currency.JPY),
      homeAmount = Money.of("100.00", eur),
      exchangeRate = ExchangeRate.of(Currency.JPY, eur, 0.01),
      category = Category.FOOD,
      timestamp = calendar.timeInMillis
    )

    val summary = getDashboardSummaryUseCase(
      allExpenses = listOf(oldExpense),
      period = DashboardPeriod.TODAY,
      currentHomeCurrency = usd
    )

    assertEquals("0.00", summary.totalHomeSpending.amount.toPlainString())
    assertTrue(summary.unconvertibleHomeCurrencies.isEmpty())
  }
}


