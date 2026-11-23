package com.pluto.app.domain

import com.pluto.app.domain.model.Category
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.ExchangeRate
import com.pluto.app.domain.model.Expense
import com.pluto.app.domain.model.Money
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigDecimal

class MoneyAndCurrencyTest {

  @Test
  fun `currency adheres to ISO 4217 code and decimal formatting`() {
    val usd = Currency.USD
    val jpy = Currency.JPY
    val inr = Currency.INR

    assertEquals("USD", usd.code)
    assertEquals(2, usd.decimalPlaces)
    assertEquals("JPY", jpy.code)
    assertEquals(0, jpy.decimalPlaces)
    assertEquals("INR", inr.code)
    assertEquals(2, inr.decimalPlaces)
  }

  @Test
  fun `money preserves precision and prevents floating point errors`() {
    val eur = Currency.EUR
    val m1 = Money.of("25.50", eur)
    val m2 = Money.of("14.50", eur)
    val sum = m1 + m2

    assertEquals("40.00", sum.amount.toPlainString())
    assertEquals(eur, sum.currency)

    // JPY zero decimal places test
    val jpy = Currency.JPY
    val jpyMoney = Money.of("1500", jpy)
    assertEquals("1500", jpyMoney.amount.toPlainString())
  }

  @Test
  fun `exchange rate conversion converts accurately according to currency principle`() {
    val eur = Currency.EUR
    val inr = Currency.INR

    // €25.50 at rate 97.2549 => ~2480.00 INR
    val rate = ExchangeRate(
      fromCurrency = eur,
      toCurrency = inr,
      rate = BigDecimal("97.25490196")
    )

    val expenseOriginal = Money.of("25.50", eur)
    val converted = rate.convert(expenseOriginal)

    assertEquals("INR", converted.currency.code)
    assertEquals("2480.00", converted.amount.toPlainString())

    // Ensure original amount is fully preserved
    val expense = Expense.create(
      originalAmount = expenseOriginal,
      homeCurrency = inr,
      exchangeRate = rate,
      category = Category.FOOD,
      merchant = "Trattoria Roma",
      note = "Dinner with classmates"
    )

    assertEquals("25.50", expense.originalAmount.amount.toPlainString())
    assertEquals("EUR", expense.originalCurrency.code)
    assertEquals("2480.00", expense.homeAmount.amount.toPlainString())
    assertEquals("INR", expense.homeCurrency.code)
    assertEquals("Trattoria Roma", expense.merchant)
  }

  @Test
  fun `inverse exchange rate calculation works correctly`() {
    val usd = Currency.USD
    val eur = Currency.EUR

    // 1 USD = 0.92 EUR
    val usdToEur = ExchangeRate(
      fromCurrency = usd,
      toCurrency = eur,
      rate = BigDecimal("0.92000000")
    )

    val eurToUsd = usdToEur.inverse()
    assertEquals("EUR", eurToUsd.fromCurrency.code)
    assertEquals("USD", eurToUsd.toCurrency.code)
    assertTrue(eurToUsd.rate > BigDecimal.ONE)
  }
}
