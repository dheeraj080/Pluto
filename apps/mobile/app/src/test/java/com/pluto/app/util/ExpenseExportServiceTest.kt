package com.pluto.app.util

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class ExpenseExportServiceTest {

  @Test
  fun generateCsv_containsHeaderAndFormattedRows() {
    val expense = Expense(
      id = "test-exp-1",
      originalAmount = Money.of(BigDecimal("15.50"), Currency.EUR),
      homeAmount = Money.of(BigDecimal("16.74"), Currency.USD),
      exchangeRate = ExchangeRate(
        fromCurrency = Currency.EUR,
        toCurrency = Currency.USD,
        rate = BigDecimal("1.0800"),
        timestamp = 1700000000000L,
        source = "offline_cache"
      ),
      category = Category.FOOD,
      timestamp = 1700000500000L,
      merchant = "Café de Paris, France",
      note = "Breakfast with \"croissant\"\nand coffee"
    )

    val csv = ExpenseExportService.generateCsv(
      expenses = listOf(expense),
      homeCurrency = Currency.USD,
      periodTitle = "November 2026"
    )

    // Check header
    assertTrue(csv.contains("Transaction ID,Date,Category,Merchant/Payee,Original Amount"))
    // Check merchant with comma escaped
    assertTrue(csv.contains("\"Café de Paris, France\""))
    // Check note with quotes and newline escaped
    assertTrue(csv.contains("\"Breakfast with \"\"croissant\"\"\nand coffee\""))
    // Check currency and values
    assertTrue(csv.contains("15.50"))
    assertTrue(csv.contains("16.74"))
    assertTrue(csv.contains("EUR"))
    assertTrue(csv.contains("USD"))
    assertTrue(csv.contains("1.0800"))
  }

  @Test
  fun generateCsv_emptyExpenses_returnsValidHeader() {
    val csv = ExpenseExportService.generateCsv(
      expenses = emptyList(),
      homeCurrency = Currency.USD,
      periodTitle = "November 2026"
    )

    assertTrue(csv.contains("Transaction ID,Date,Category"))
    assertTrue(csv.contains("Home Reference Currency: USD"))
  }
}
