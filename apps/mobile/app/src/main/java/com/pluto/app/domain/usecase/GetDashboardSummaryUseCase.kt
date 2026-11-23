package com.pluto.app.domain.usecase

import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.CurrencySpendingSummary
import com.pluto.app.domain.model.DailySpendPoint
import com.pluto.app.domain.model.DashboardPeriod
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Domain UseCase to calculate Dashboard summary statistics from recorded expenses.
 *
 * Adheres strictly to the Financial Rules:
 * 1. Accumulates historical expenses using their recorded `homeAmount` snapshots.
 * 2. Does NOT recalculate historical transactions using current live market exchange rates.
 * 3. Keeps original currency totals grouped separately without cross-currency addition.
 * 4. Precision-safe arithmetic using BigDecimal with half-even rounding.
 */
class GetDashboardSummaryUseCase {

  operator fun invoke(
    allExpenses: List<Expense>,
    period: DashboardPeriod,
    currentHomeCurrency: Currency,
    destinationCurrency: Currency = Currency.EUR,
    dailySpendingCap: Double? = null,
    monthlySpendingCap: Double? = null,
    safeToSpendWarningThreshold: Double? = null,
    walletTransactions: List<com.pluto.app.domain.model.WalletTransaction> = emptyList(),
    destinationExchangeRate: BigDecimal? = null,
    categoryBudgets: Map<String, Double> = emptyMap(),
    recentLimit: Int = 10,
    userPersona: com.pluto.app.domain.model.UserPersona = com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
    academicTermSettings: com.pluto.app.domain.model.AcademicTermSettings? = null,
    tripSettings: com.pluto.app.domain.model.TripSettings? = null
  ): DashboardSummary {
    val customStart = when (period) {
      DashboardPeriod.ACADEMIC_TERM -> academicTermSettings?.termStartDate
      DashboardPeriod.CURRENT_TRIP -> tripSettings?.tripStartDate
      else -> null
    }
    val customEnd = when (period) {
      DashboardPeriod.ACADEMIC_TERM -> academicTermSettings?.termEndDate
      DashboardPeriod.CURRENT_TRIP -> tripSettings?.tripEndDate
      else -> null
    }
    val (startTime, endTime) = period.getBounds(customStart, customEnd)
    val (todayStart, todayEnd) = DashboardPeriod.TODAY.getBounds()
    val (monthStart, monthEnd) = DashboardPeriod.THIS_MONTH.getBounds()

    // 1. Filter expenses for the chosen period
    val periodExpenses = allExpenses.filter { it.timestamp in startTime..endTime }

    val effectiveDestRate = destinationExchangeRate ?: if (destinationCurrency == currentHomeCurrency) BigDecimal.ONE else null

    // 2. Sum total spending in home currency using persisted homeAmount snapshots
    val totalHomeBigDecimal = periodExpenses.fold(BigDecimal.ZERO) { acc, expense ->
      acc.add(expense.homeAmount.amount)
    }
    val totalHomeMoney = Money.of(totalHomeBigDecimal, currentHomeCurrency)
    val totalDestSpending = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = totalHomeBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    // 3. Today's total spending in home currency & destination currency
    val todayExpenses = allExpenses.filter { it.timestamp in todayStart..todayEnd }
    val todayHomeBigDecimal = todayExpenses.fold(BigDecimal.ZERO) { acc, expense ->
      acc.add(expense.homeAmount.amount)
    }
    val todayHomeMoney = Money.of(todayHomeBigDecimal, currentHomeCurrency)
    val todayDestSpending = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = todayHomeBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    // 4. Month's total spending in home currency & destination currency
    val monthExpenses = allExpenses.filter { it.timestamp in monthStart..monthEnd }
    val monthHomeBigDecimal = monthExpenses.fold(BigDecimal.ZERO) { acc, expense ->
      acc.add(expense.homeAmount.amount)
    }
    val monthHomeMoney = Money.of(monthHomeBigDecimal, currentHomeCurrency)
    val monthDestSpending = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = monthHomeBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    // 5. Today's Income from deposits & Safe-to-Spend Daily Budget
    val todayWalletTx = walletTransactions.filter { it.timestamp in todayStart..todayEnd }
    val todayIncomeBigDecimal = todayWalletTx
      .filter { it.type == com.pluto.app.domain.model.WalletTransactionType.DEPOSIT }
      .fold(BigDecimal.ZERO) { acc, tx ->
        val txHomeAmount = when {
          tx.amount.currency == currentHomeCurrency -> tx.amount.amount
          effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO && tx.amount.currency == destinationCurrency -> {
            tx.amount.amount.divide(effectiveDestRate, currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
          }
          else -> tx.amount.amount
        }
        acc.add(txHomeAmount)
      }
    val todayIncomeHome = Money.of(todayIncomeBigDecimal, currentHomeCurrency)
    val todayIncomeDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = todayIncomeBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    // Effective daily budget base combines daily spending cap with any income received today
    val effectiveDailyBudgetBigDecimal: BigDecimal? = when {
      dailySpendingCap != null && dailySpendingCap > 0.0 -> {
        BigDecimal(dailySpendingCap).add(todayIncomeBigDecimal)
      }
      todayIncomeBigDecimal > BigDecimal.ZERO -> {
        todayIncomeBigDecimal
      }
      else -> null
    }

    val effectiveDailyBudgetHome = effectiveDailyBudgetBigDecimal?.let { Money.of(it, currentHomeCurrency) }
    val effectiveDailyBudgetDest = if (effectiveDailyBudgetBigDecimal != null && effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = effectiveDailyBudgetBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    // Safe-to-Spend = (Daily Cap + Today's Income) - Today's Expenses
    val safeToSpendTodayHome = if (effectiveDailyBudgetBigDecimal != null) {
      val remaining = effectiveDailyBudgetBigDecimal.subtract(todayHomeBigDecimal)
      Money.of(remaining, currentHomeCurrency)
    } else {
      Money.zero(currentHomeCurrency)
    }

    val safeToSpendTodayDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO && effectiveDailyBudgetBigDecimal != null) {
      val remaining = effectiveDailyBudgetBigDecimal.subtract(todayHomeBigDecimal)
      val destAmount = remaining.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    val warningThresholdHome = if (safeToSpendWarningThreshold != null && safeToSpendWarningThreshold > 0.0) {
      Money.of(BigDecimal(safeToSpendWarningThreshold).setScale(currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN), currentHomeCurrency)
    } else null

    val warningThresholdDest = if (safeToSpendWarningThreshold != null && safeToSpendWarningThreshold > 0.0 && effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = BigDecimal(safeToSpendWarningThreshold).multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    val isBelowWarningThreshold = if (effectiveDailyBudgetBigDecimal != null && safeToSpendWarningThreshold != null && safeToSpendWarningThreshold > 0.0) {
      val remaining = effectiveDailyBudgetBigDecimal.subtract(todayHomeBigDecimal)
      val thresholdBd = BigDecimal(safeToSpendWarningThreshold)
      remaining > BigDecimal.ZERO && remaining <= thresholdBd
    } else false

    val dailyCapProgress = if (effectiveDailyBudgetBigDecimal != null && effectiveDailyBudgetBigDecimal > BigDecimal.ZERO) {
      (todayHomeBigDecimal.toDouble() / effectiveDailyBudgetBigDecimal.toDouble()).toFloat().coerceAtLeast(0f)
    } else null

    val dailySpendingCapDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO && dailySpendingCap != null && dailySpendingCap > 0.0) {
      val capAmount = BigDecimal(dailySpendingCap).multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(capAmount, destinationCurrency)
    } else null

    // 6. Monthly Cap Progress
    val monthlyCapProgress = if (monthlySpendingCap != null && monthlySpendingCap > 0.0) {
      (monthHomeBigDecimal.toDouble() / monthlySpendingCap).toFloat().coerceAtLeast(0f)
    } else null

    val monthlySpendingCapDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO && monthlySpendingCap != null && monthlySpendingCap > 0.0) {
      val capAmount = BigDecimal(monthlySpendingCap).multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(capAmount, destinationCurrency)
    } else null

    // 7. Cash Flow Calculations (Deposits in Period = Income)
    val periodWalletTx = walletTransactions.filter { it.timestamp in startTime..endTime }
    val totalIncomeBigDecimal = periodWalletTx
      .filter { it.type == com.pluto.app.domain.model.WalletTransactionType.DEPOSIT }
      .fold(BigDecimal.ZERO) { acc, tx -> acc.add(tx.amount.amount) }
    val totalIncomeHome = Money.of(totalIncomeBigDecimal, currentHomeCurrency)
    val totalIncomeDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = totalIncomeBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    val netCashFlowBigDecimal = totalIncomeBigDecimal.subtract(totalHomeBigDecimal)
    val netCashFlowHome = Money.of(netCashFlowBigDecimal, currentHomeCurrency)
    val netCashFlowDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = netCashFlowBigDecimal.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    // 8. Category Breakdown with Multiple Budgets
    val categoryBreakdowns = if (periodExpenses.isEmpty()) {
      emptyList()
    } else {
      periodExpenses
        .groupBy { it.category }
        .map { (category, expenses) ->
          val categorySum = expenses.fold(BigDecimal.ZERO) { acc, exp ->
            acc.add(exp.homeAmount.amount)
          }
          val percentage = if (totalHomeBigDecimal.compareTo(BigDecimal.ZERO) > 0) {
            categorySum.multiply(BigDecimal(100))
              .divide(totalHomeBigDecimal, 1, RoundingMode.HALF_EVEN)
          } else {
            BigDecimal.ZERO.setScale(1)
          }

          val categoryDestAmount = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
            val destAmount = categorySum.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
            Money.of(destAmount, destinationCurrency)
          } else null

          val budgetCap = categoryBudgets[category.id]
          val budgetHomeMoney = budgetCap?.let {
            Money.of(BigDecimal(it).setScale(currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN), currentHomeCurrency)
          }
          val budgetDestMoney = if (budgetCap != null && effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
            val destAmount = BigDecimal(budgetCap).multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
            Money.of(destAmount, destinationCurrency)
          } else null

          val progress = if (budgetCap != null && budgetCap > 0.0) {
            (categorySum.toDouble() / budgetCap).toFloat().coerceAtLeast(0f)
          } else null

          val isOver = if (budgetCap != null && budgetCap > 0.0) {
            categorySum > BigDecimal(budgetCap)
          } else false

          CategorySpendingSummary(
            category = category,
            totalHomeAmount = Money.of(categorySum, currentHomeCurrency),
            totalDestAmount = categoryDestAmount,
            transactionCount = expenses.size,
            percentageOfTotal = percentage,
            budgetHome = budgetHomeMoney,
            budgetDest = budgetDestMoney,
            budgetProgress = progress,
            isOverBudget = isOver
          )
        }
        .sortedByDescending { it.totalHomeAmount.amount }
    }

    // 9. Currency Breakdown
    val currencyBreakdowns = if (periodExpenses.isEmpty()) {
      emptyList()
    } else {
      periodExpenses
        .groupBy { it.originalCurrency }
        .map { (currency, expenses) ->
          val originalSum = expenses.fold(BigDecimal.ZERO) { acc, exp ->
            acc.add(exp.originalAmount.amount)
          }
          val homeEquivSum = expenses.fold(BigDecimal.ZERO) { acc, exp ->
            acc.add(exp.homeAmount.amount)
          }

          CurrencySpendingSummary(
            currency = currency,
            totalOriginalAmount = Money.of(originalSum, currency),
            totalHomeEquivalent = Money.of(homeEquivSum, currentHomeCurrency),
            transactionCount = expenses.size
          )
        }
        .sortedByDescending { it.totalHomeEquivalent.amount }
    }

    // 10. Unified Activity Feed (Dual-Currency: 1. Primary: Current Country, 2. Secondary: Home Country)
    val expenseItems = allExpenses.map { exp ->
      val destMoney: Money = when {
        exp.originalCurrency == destinationCurrency -> exp.originalAmount
        effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO -> {
          val converted = exp.homeAmount.amount.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
          Money.of(converted, destinationCurrency)
        }
        exp.originalCurrency == currentHomeCurrency && destinationCurrency == currentHomeCurrency -> exp.homeAmount
        else -> exp.originalAmount
      }

      val primaryStr = "-${destMoney.format()}"
      val secondaryStr = if (destMoney.currency != currentHomeCurrency) {
        "≈ -${exp.homeAmount.format()}"
      } else {
        "-${exp.homeAmount.format()}"
      }

      val subtitleText = if (exp.originalCurrency != destinationCurrency && exp.originalCurrency != currentHomeCurrency) {
        "${exp.category.name} · Paid ${exp.originalAmount.format()}"
      } else {
        exp.category.name
      }

      com.pluto.app.domain.model.UnifiedTransactionItem(
        id = exp.id,
        title = if (exp.merchant.isNotBlank()) exp.merchant else exp.category.name,
        subtitle = subtitleText,
        type = com.pluto.app.domain.model.UnifiedTransactionType.EXPENSE,
        primaryAmountFormatted = primaryStr,
        secondaryAmountFormatted = secondaryStr,
        timestamp = exp.timestamp,
        categoryName = exp.category.name,
        originalExpense = exp
      )
    }

    val walletItems = walletTransactions.mapNotNull { tx ->
      when (tx.type) {
        com.pluto.app.domain.model.WalletTransactionType.DEPOSIT -> {
          val destMoney: Money = when {
            tx.amount.currency == destinationCurrency -> tx.amount
            effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO && tx.amount.currency == currentHomeCurrency -> {
              val converted = tx.amount.amount.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
              Money.of(converted, destinationCurrency)
            }
            else -> tx.amount
          }

          val homeMoney: Money = when {
            tx.amount.currency == currentHomeCurrency -> tx.amount
            effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO && tx.amount.currency == destinationCurrency -> {
              val converted = tx.amount.amount.divide(effectiveDestRate, currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
              Money.of(converted, currentHomeCurrency)
            }
            else -> tx.amount
          }

          val primaryStr = "+${destMoney.format()}"
          val secondaryStr = if (destMoney.currency != currentHomeCurrency) "≈ +${homeMoney.format()}" else "+${homeMoney.format()}"

          com.pluto.app.domain.model.UnifiedTransactionItem(
            id = tx.id,
            title = if (tx.note.isNotBlank()) tx.note else "Income Deposit",
            subtitle = "Deposit · ${tx.amount.currency.code}",
            type = com.pluto.app.domain.model.UnifiedTransactionType.INCOME,
            primaryAmountFormatted = primaryStr,
            secondaryAmountFormatted = secondaryStr,
            timestamp = tx.timestamp,
            categoryName = "Income"
          )
        }
        com.pluto.app.domain.model.WalletTransactionType.TRANSFER_OUT -> {
          val targetDesc = tx.targetAmount?.let { "to ${it.currency.code}" } ?: "Transfer"
          val primaryStr = tx.amount.format()
          val secondaryStr = tx.targetAmount?.let { "→ ${it.format()}" }

          com.pluto.app.domain.model.UnifiedTransactionItem(
            id = tx.id,
            title = if (tx.note.isNotBlank()) tx.note else "Account Transfer",
            subtitle = "Transfer $targetDesc",
            type = com.pluto.app.domain.model.UnifiedTransactionType.TRANSFER,
            primaryAmountFormatted = primaryStr,
            secondaryAmountFormatted = secondaryStr,
            timestamp = tx.timestamp,
            categoryName = "Transfer"
          )
        }
        else -> null
      }
    }

    val unifiedList = (expenseItems + walletItems)
      .sortedByDescending { it.timestamp }
      .take(recentLimit)

    val recent = allExpenses
      .sortedByDescending { it.timestamp }
      .take(5)

    // 11. 30-Day Spending Trend Pattern (for Visual Trend Line component)
    val dayFormat = SimpleDateFormat("MMM d", Locale.getDefault())
    val fullDateFormat = SimpleDateFormat("EEEE, MMM d", Locale.getDefault())

    val todayCal = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

    val thirtyDayTrend = (29 downTo 0).map { daysAgo ->
      val dayCal = (todayCal.clone() as Calendar).apply {
        add(Calendar.DAY_OF_YEAR, -daysAgo)
      }
      val dayStart = dayCal.timeInMillis
      val dayEnd = dayStart + 86400000L - 1L

      val dayExpenses = allExpenses.filter { it.timestamp in dayStart..dayEnd }
      val dayHomeAmount = dayExpenses.fold(BigDecimal.ZERO) { acc, exp ->
        acc.add(exp.homeAmount.amount)
      }
      val dayHomeMoney = Money.of(dayHomeAmount, currentHomeCurrency)
      val dayDestMoney = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
        val destAmount = dayHomeAmount.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
        Money.of(destAmount, destinationCurrency)
      } else null

      DailySpendPoint(
        timestamp = dayStart,
        dayLabel = dayFormat.format(dayCal.time),
        fullDateLabel = fullDateFormat.format(dayCal.time),
        amountHome = dayHomeMoney,
        amountDest = dayDestMoney,
        transactionCount = dayExpenses.size
      )
    }

    val thirtyDayTotalHomeBd = thirtyDayTrend.fold(BigDecimal.ZERO) { acc, point ->
      acc.add(point.amountHome.amount)
    }
    val thirtyDayTotalHome = Money.of(thirtyDayTotalHomeBd, currentHomeCurrency)
    val thirtyDayTotalDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = thirtyDayTotalHomeBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    val thirtyDayDailyAvgHomeBd = thirtyDayTotalHomeBd.divide(BigDecimal(30), currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
    val thirtyDayDailyAvgHome = Money.of(thirtyDayDailyAvgHomeBd, currentHomeCurrency)
    val thirtyDayDailyAvgDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val destAmount = thirtyDayDailyAvgHomeBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(destAmount, destinationCurrency)
    } else null

    val thirtyDayPeakDay = thirtyDayTrend.filter { it.amountHome.amount > BigDecimal.ZERO }.maxByOrNull { it.amountHome.amount }

    // Trend percentage: compare recent 15 days vs prior 15 days
    val first15Days = thirtyDayTrend.take(15)
    val last15Days = thirtyDayTrend.drop(15)
    val first15Total = first15Days.fold(BigDecimal.ZERO) { acc, pt -> acc.add(pt.amountHome.amount) }
    val last15Total = last15Days.fold(BigDecimal.ZERO) { acc, pt -> acc.add(pt.amountHome.amount) }
    val thirtyDayTrendPercentage: Double? = if (first15Total > BigDecimal.ZERO) {
      val diff = last15Total.subtract(first15Total)
      diff.multiply(BigDecimal(100)).divide(first15Total, 1, RoundingMode.HALF_EVEN).toDouble()
    } else null

    // 12. Term Runway Telemetry (International Students & Semester Allowance Runway)
    val termSettings = academicTermSettings ?: com.pluto.app.domain.model.AcademicTermSettings()
    val nowMs = System.currentTimeMillis()
    val totalTermMillis = (termSettings.termEndDate - termSettings.termStartDate).coerceAtLeast(86400000L)
    val totalDays = kotlin.math.ceil(totalTermMillis.toDouble() / 86400000.0).toInt().coerceAtLeast(1)
    val diffMs = termSettings.termEndDate - nowMs
    val daysRemaining = if (diffMs > 0) {
      kotlin.math.ceil(diffMs.toDouble() / 86400000.0).toInt().coerceAtLeast(1)
    } else 0
    val daysPassed = (totalDays - daysRemaining).coerceAtLeast(1)
    val percentPassed = ((daysPassed.toFloat() / totalDays.toFloat()) * 100f).coerceIn(0f, 100f)

    // Term expenses within term bounds
    val termExpenses = allExpenses.filter { it.timestamp in termSettings.termStartDate..termSettings.termEndDate }
    val termSpentHomeBd = termExpenses.fold(BigDecimal.ZERO) { acc, exp -> acc.add(exp.homeAmount.amount) }
    val termSpentHome = Money.of(termSpentHomeBd, currentHomeCurrency)
    val termSpentDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val converted = termSpentHomeBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency)
    } else null

    val totalAllowanceBd = BigDecimal(termSettings.totalAllowanceHome).setScale(currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
    val totalAllowanceHome = Money.of(totalAllowanceBd, currentHomeCurrency)
    val totalAllowanceDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val converted = totalAllowanceBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency)
    } else null

    val committedFixedBd = BigDecimal(termSettings.tuitionAndFixedCommittedHome).setScale(currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
    val committedFixedHome = Money.of(committedFixedBd, currentHomeCurrency)
    val committedFixedDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val converted = committedFixedBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency)
    } else null

    // Discretionary allowance = Total Allowance - Committed Fixed (Tuition etc) - Term Expenses
    val netAllowanceAvailableBd = totalAllowanceBd.subtract(committedFixedBd)
    val remainingDiscretionaryBd = netAllowanceAvailableBd.subtract(termSpentHomeBd)
    val remainingDiscretionaryHome = Money.of(remainingDiscretionaryBd, currentHomeCurrency)
    val remainingDiscretionaryDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val converted = remainingDiscretionaryBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency)
    } else null

    // Daily safe-to-spend across remaining days
    val dailyRunwaySafeToSpendBd = if (daysRemaining > 0) {
      remainingDiscretionaryBd.divide(BigDecimal(daysRemaining), currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
    } else {
      remainingDiscretionaryBd
    }
    val dailyRunwaySafeToSpendHome = Money.of(dailyRunwaySafeToSpendBd, currentHomeCurrency)
    val dailyRunwaySafeToSpendDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val converted = dailyRunwaySafeToSpendBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency)
    } else null

    val actualDailyAvgBd = if (daysPassed > 0) {
      termSpentHomeBd.divide(BigDecimal(daysPassed), currentHomeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
    } else BigDecimal.ZERO
    val actualDailyAvgHome = Money.of(actualDailyAvgBd, currentHomeCurrency)
    val actualDailyAvgDest = if (effectiveDestRate != null && effectiveDestRate > BigDecimal.ZERO) {
      val converted = actualDailyAvgBd.multiply(effectiveDestRate).setScale(destinationCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
      Money.of(converted, destinationCurrency)
    } else null

    val runwayPaceStatus = when {
      remainingDiscretionaryBd < BigDecimal.ZERO -> com.pluto.app.domain.model.RunwayPaceStatus.DEFICIT
      actualDailyAvgBd > dailyRunwaySafeToSpendBd.multiply(BigDecimal(1.2)) -> com.pluto.app.domain.model.RunwayPaceStatus.CAUTION
      else -> com.pluto.app.domain.model.RunwayPaceStatus.ON_TRACK
    }

    val termRunwaySummary = com.pluto.app.domain.model.TermRunwaySummary(
      termName = termSettings.termName,
      daysRemaining = daysRemaining,
      totalDays = totalDays,
      percentPassed = percentPassed,
      totalAllowanceHome = totalAllowanceHome,
      totalAllowanceDest = totalAllowanceDest,
      committedFixedHome = committedFixedHome,
      committedFixedDest = committedFixedDest,
      termSpentHome = termSpentHome,
      termSpentDest = termSpentDest,
      remainingDiscretionaryHome = remainingDiscretionaryHome,
      remainingDiscretionaryDest = remainingDiscretionaryDest,
      dailyRunwaySafeToSpendHome = dailyRunwaySafeToSpendHome,
      dailyRunwaySafeToSpendDest = dailyRunwaySafeToSpendDest,
      actualDailyAverageHome = actualDailyAvgHome,
      actualDailyAverageDest = actualDailyAvgDest,
      paceStatus = runwayPaceStatus
    )

    return DashboardSummary(
      period = period,
      homeCurrency = currentHomeCurrency,
      destinationCurrency = destinationCurrency,
      totalHomeSpending = totalHomeMoney,
      totalDestSpending = totalDestSpending,
      transactionCount = periodExpenses.size,
      categoryBreakdowns = categoryBreakdowns,
      currencyBreakdowns = currencyBreakdowns,
      recentExpenses = recent,
      hasExpensesInPeriod = periodExpenses.isNotEmpty(),
      totalAllTimeExpensesCount = allExpenses.size,
      todayHomeSpending = todayHomeMoney,
      todayDestSpending = todayDestSpending,
      todayIncomeHome = todayIncomeHome,
      todayIncomeDest = todayIncomeDest,
      effectiveDailyBudgetHome = effectiveDailyBudgetHome,
      effectiveDailyBudgetDest = effectiveDailyBudgetDest,
      monthHomeSpending = monthHomeMoney,
      monthDestSpending = monthDestSpending,
      dailySpendingCap = dailySpendingCap,
      dailySpendingCapDest = dailySpendingCapDest,
      monthlySpendingCap = monthlySpendingCap,
      monthlySpendingCapDest = monthlySpendingCapDest,
      dailyCapProgress = dailyCapProgress,
      monthlyCapProgress = monthlyCapProgress,
      safeToSpendTodayHome = safeToSpendTodayHome,
      safeToSpendTodayDest = safeToSpendTodayDest,
      warningThresholdHome = warningThresholdHome,
      warningThresholdDest = warningThresholdDest,
      isBelowWarningThreshold = isBelowWarningThreshold,
      totalIncomeHome = totalIncomeHome,
      totalIncomeDest = totalIncomeDest,
      netCashFlowHome = netCashFlowHome,
      netCashFlowDest = netCashFlowDest,
      unifiedRecentTransactions = unifiedList,
      thirtyDaySpendingTrend = thirtyDayTrend,
      thirtyDayTotalHome = thirtyDayTotalHome,
      thirtyDayTotalDest = thirtyDayTotalDest,
      thirtyDayDailyAvgHome = thirtyDayDailyAvgHome,
      thirtyDayDailyAvgDest = thirtyDayDailyAvgDest,
      thirtyDayPeakDay = thirtyDayPeakDay,
      thirtyDayTrendPercentage = thirtyDayTrendPercentage,
      userPersona = userPersona,
      termRunwaySummary = termRunwaySummary
    )
  }
}
