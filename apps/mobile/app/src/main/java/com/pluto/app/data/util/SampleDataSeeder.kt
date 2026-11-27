package com.pluto.app.data.util

import com.pluto.app.data.local.AppDatabase
import com.pluto.app.data.local.expense.ExpenseEntity
import com.pluto.app.data.local.wallet.CurrencyWalletEntity
import com.pluto.app.data.local.wallet.WalletTransactionEntity
import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.UserSettingsRepository
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID

/**
 * Utility to seed comprehensive, realistic dummy data into the application.
 *
 * Populates:
 * 1. User preferences (Home currency: USD, Destination currency: JPY, daily cap: $60, monthly cap: $1,800,
 *    and category-specific budgets for Food, Transport, Accommodation, Groceries, Shopping, Entertainment).
 * 2. Multi-currency Wallets (USD Main Bank, JPY Travel Cash & Card, EUR Savings).
 * 3. Recent Wallet Transactions (Deposits, Currency Transfers).
 * 4. Realistic 30-day Expenses across categories denominated in both JPY and USD with real exchange rates.
 */
object SampleDataSeeder {

  suspend fun seedSampleData(
    database: AppDatabase,
    userSettingsRepository: UserSettingsRepository
  ) {
    val now = System.currentTimeMillis()
    val dayMillis = 86_400_000L

    // 1. Configure realistic User Settings tailored for International Student with fallback support for Expats & Tourists
    val sampleSettings = UserSettings(
      homeCurrency = Currency.USD,
      destinationCurrency = Currency.JPY,
      persona = com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
      budgetCycleType = com.pluto.app.domain.model.BudgetCycleType.ACADEMIC_TERM,
      academicTermSettings = com.pluto.app.domain.model.AcademicTermSettings(
        termName = "Fall Semester",
        termStartDate = now - (14 * dayMillis),
        termEndDate = now + (90 * dayMillis),
        totalAllowanceHome = BigDecimal("6500.00"),
        tuitionAndFixedCommittedHome = BigDecimal("1800.00")
      ),
      firstDayOfWeek = 1,
      defaultCategoryId = Category.CAMPUS_DINING.id,
      dailySpendingCap = BigDecimal("60.00"),
      monthlySpendingCap = BigDecimal("1800.00"),
      safeToSpendWarningThreshold = BigDecimal("20.00"),
      warningNotificationsEnabled = true,
      categoryMonthlyBudgets = mapOf(
        Category.FOOD.id to BigDecimal("500.00"),
        Category.CAMPUS_DINING.id to BigDecimal("350.00"),
        Category.BOOKS_SUPPLIES.id to BigDecimal("250.00"),
        Category.TRANSPORT.id to BigDecimal("150.00"),
        Category.DORM_RENT.id to BigDecimal("700.00"),
        Category.GROCERIES.id to BigDecimal("250.00")
      ),
      isOnboardingCompleted = true
    )
    userSettingsRepository.updateSettings(sampleSettings)

    // 2. Wallets
    val walletDao = database.currencyWalletDao()
    val walletTxDao = database.walletTransactionDao()

    walletDao.clearAll()
    walletTxDao.clearAll()

    val usdWalletId = "wallet-usd-main"
    val jpyWalletId = "wallet-jpy-travel"
    val eurWalletId = "wallet-eur-reserve"

    val usdWallet = CurrencyWalletEntity(
      id = usdWalletId,
      currencyCode = "USD",
      balance = "2450.00",
      initialBalance = "3000.00",
      createdAt = now - (35 * dayMillis),
      updatedAt = now
    )
    val jpyWallet = CurrencyWalletEntity(
      id = jpyWalletId,
      currencyCode = "JPY",
      balance = "85400",
      initialBalance = "100000",
      createdAt = now - (30 * dayMillis),
      updatedAt = now
    )
    val eurWallet = CurrencyWalletEntity(
      id = eurWalletId,
      currencyCode = "EUR",
      balance = "420.00",
      initialBalance = "500.00",
      createdAt = now - (20 * dayMillis),
      updatedAt = now
    )

    walletDao.insertWallet(usdWallet)
    walletDao.insertWallet(jpyWallet)
    walletDao.insertWallet(eurWallet)

    // Wallet Transactions (Income / Funding)
    val tx1 = WalletTransactionEntity(
      id = UUID.randomUUID().toString(),
      walletId = usdWalletId,
      type = "DEPOSIT",
      amount = "3000.00",
      currencyCode = "USD",
      timestamp = now - (32 * dayMillis),
      note = "Monthly Travel Stipend",
      createdAt = now - (32 * dayMillis)
    )
    val tx2 = WalletTransactionEntity(
      id = UUID.randomUUID().toString(),
      walletId = usdWalletId,
      type = "TRANSFER_OUT",
      amount = "550.00",
      currencyCode = "USD",
      timestamp = now - (15 * dayMillis),
      note = "Exchanged to Travel JPY Cash",
      targetWalletId = jpyWalletId,
      targetAmount = "82500",
      targetCurrencyCode = "JPY",
      exchangeRate = "150.00",
      exchangeRateSource = "Wise / Real-Time API",
      createdAt = now - (15 * dayMillis)
    )
    val tx3 = WalletTransactionEntity(
      id = UUID.randomUUID().toString(),
      walletId = jpyWalletId,
      type = "DEPOSIT",
      amount = "25000",
      currencyCode = "JPY",
      timestamp = now - (2 * dayMillis),
      note = "Friend Split Dinner Reimbursement",
      createdAt = now - (2 * dayMillis)
    )

    walletTxDao.insertTransactions(listOf(tx1, tx2, tx3))

    // 3. Clear and Populate 30 Days of Realistic Expenses
    val expenseDao = database.expenseDao()
    expenseDao.clearAll()

    val jpyRateToUsd = BigDecimal("0.00667") // ~150 JPY = 1 USD

    val expenses = mutableListOf<ExpenseEntity>()

    fun createExpense(
      daysAgo: Long,
      merchant: String,
      category: Category,
      jpyAmount: Long,
      note: String,
      location: String? = "Tokyo, Japan"
    ): ExpenseEntity {
      val origAmt = BigDecimal(jpyAmount)
      val homeAmt = origAmt.multiply(jpyRateToUsd).setScale(2, RoundingMode.HALF_EVEN)
      val time = now - (daysAgo * dayMillis) - (daysAgo * 3600_000L % 43_200_000L)
      return ExpenseEntity(
        id = UUID.randomUUID().toString(),
        originalAmount = origAmt.toPlainString(),
        originalCurrencyCode = "JPY",
        homeAmount = homeAmt.toPlainString(),
        homeCurrencyCode = "USD",
        exchangeRate = jpyRateToUsd.toPlainString(),
        exchangeRateTimestamp = time,
        exchangeRateSource = "Real-Time Exchange Rate",
        categoryId = category.id,
        timestamp = time,
        merchant = merchant,
        note = note,
        location = location,
        tripId = "japan-2026",
        createdAt = time,
        updatedAt = time
      )
    }

    // Today's expenses (Safe to spend gauge active)
    expenses.add(createExpense(0, "Ichiran Ramen", Category.FOOD, 1480, "Tonkotsu Ramen lunch"))
    expenses.add(createExpense(0, "7-Eleven Roppongi", Category.GROCERIES, 620, "Iced coffee and onigiri"))
    expenses.add(createExpense(0, "Tokyo Metro Pass", Category.TRANSPORT, 800, "24-hr unlimited subway ticket"))

    // Yesterday
    expenses.add(createExpense(1, "FamilyMart Shibuya", Category.GROCERIES, 1150, "Breakfast and snacks"))
    expenses.add(createExpense(1, "Sushi Zanmai", Category.FOOD, 4200, "Dinner sushi platter"))
    expenses.add(createExpense(1, "Bic Camera Akihabara", Category.SHOPPING, 6500, "Universal power adapter & accessories"))

    // 2-5 days ago
    expenses.add(createExpense(2, "Starbucks Reserve Ginza", Category.FOOD, 1300, "Cold brew tasting flight"))
    expenses.add(createExpense(3, "JR Yamanote Line", Category.TRANSPORT, 640, "Travel to Ueno and Asakusa"))
    expenses.add(createExpense(3, "Tokyo Skytree", Category.ENTERTAINMENT, 3100, "Observation deck sunset pass"))
    expenses.add(createExpense(4, "Lawson Shinjuku", Category.GROCERIES, 980, "Water, matcha latte, and pastries"))
    expenses.add(createExpense(5, "Gyukatsu Motomura", Category.FOOD, 2600, "Crispy beef cutlet set"))

    // 6-12 days ago
    expenses.add(createExpense(7, "TeamLab Planets", Category.ENTERTAINMENT, 3800, "Digital art immersion ticket"))
    expenses.add(createExpense(8, "Uniqlo Ginza Flagship", Category.SHOPPING, 8400, "Heattech thermal clothing"))
    expenses.add(createExpense(10, "Don Quijote Shinjuku", Category.SHOPPING, 4900, "Souvenirs and Japanese snacks"))
    expenses.add(createExpense(11, "Suica IC Card Reload", Category.TRANSPORT, 3000, "Transit card recharge"))
    expenses.add(createExpense(12, "CoCo Ichibanya", Category.FOOD, 1350, "Pork cutlet curry level 3"))

    // 14-20 days ago
    expenses.add(createExpense(14, "Shinjuku Granbell Hotel", Category.ACCOMMODATION, 36000, "Weekly lodging stay"))
    expenses.add(createExpense(15, "Matsumoto Kiyoshi", Category.HEALTH, 2200, "Eye drops & travel vitamins"))
    expenses.add(createExpense(18, "Shinkansen to Kyoto", Category.TRAVEL, 14200, "Bullet train round-trip ticket"))
    expenses.add(createExpense(19, "Fushimi Inari Teahouse", Category.FOOD, 1600, "Matcha soft serve & dango"))

    // 21-30 days ago
    expenses.add(createExpense(22, "Sim Card Japan 30-Day", Category.BILLS, 4500, "Unlimited travel eSIM data"))
    expenses.add(createExpense(25, "Ghibli Museum Mitaka", Category.ENTERTAINMENT, 1000, "Pre-booked admission ticket"))
    expenses.add(createExpense(27, "Yodobashi Camera", Category.SHOPPING, 5200, "Camera memory card & lens wipe"))
    expenses.add(createExpense(29, "Airport Limousine Bus", Category.TRANSPORT, 3200, "Narita Airport to Shinjuku"))

    expenses.forEach { expenseDao.insertExpense(it) }
  }
}
