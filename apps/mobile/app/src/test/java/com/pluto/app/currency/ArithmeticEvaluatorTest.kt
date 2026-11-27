package com.pluto.app.currency

import com.pluto.app.domain.model.Currency
import com.pluto.app.ui.components.ArithmeticEvaluator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigDecimal

class ArithmeticEvaluatorTest {

  @Test
  fun evaluate_singleNumber_returnsSameValue() {
    val result = ArithmeticEvaluator.evaluate("42.50")
    assertNotNull(result)
    assertEquals(BigDecimal("42.50"), result)
  }

  @Test
  fun evaluate_additionAndMultiplication_respectsPrecedence() {
    // 10 + 5 * 2 = 20
    val result = ArithmeticEvaluator.evaluate("10 + 5 * 2")
    assertNotNull(result)
    assertEquals(BigDecimal("20.00"), result)
  }

  @Test
  fun evaluate_arithmeticWithUnicodeSymbols() {
    // 12.50 + 5.20 × 2 = 12.50 + 10.40 = 22.90
    val result = ArithmeticEvaluator.evaluate("12.50 + 5.20 × 2")
    assertNotNull(result)
    assertEquals(BigDecimal("22.90"), result)
  }

  @Test
  fun evaluate_division() {
    // 50 ÷ 2 = 25
    val result = ArithmeticEvaluator.evaluate("50 ÷ 2")
    assertNotNull(result)
    assertEquals(BigDecimal("25.00"), result)
  }

  @Test
  fun evaluate_subtractionAndDecimals() {
    // 100 - 25.50 - 4.50 = 70.00
    val result = ArithmeticEvaluator.evaluate("100 - 25.50 - 4.50")
    assertNotNull(result)
    assertEquals(BigDecimal("70.00"), result)
  }

  @Test
  fun evaluate_zeroDecimalCurrency_usesScaleZeroAndHalfEven() {
    assertEquals(BigDecimal("33"), ArithmeticEvaluator.evaluate("100 ÷ 3", Currency.JPY))
    assertEquals(BigDecimal("1000"), ArithmeticEvaluator.evaluate("1000", Currency.KRW))
    assertEquals(BigDecimal("2"), ArithmeticEvaluator.evaluate("2.5", targetScale = 0))
    assertEquals(BigDecimal("4"), ArithmeticEvaluator.evaluate("3.5", targetScale = 0))
  }

  @Test
  fun evaluate_threeDecimalCurrency_usesScaleThreeAndHalfEven() {
    assertEquals(BigDecimal("33.333"), ArithmeticEvaluator.evaluate("100 ÷ 3", Currency.KWD))
    assertEquals(BigDecimal("1.250"), ArithmeticEvaluator.evaluate("10 ÷ 8", Currency.BHD))
    assertEquals(BigDecimal("13.456"), ArithmeticEvaluator.evaluate("12.345 + 1.111", Currency.OMR))
    assertEquals(BigDecimal("1.000"), ArithmeticEvaluator.evaluate("1.0005", Currency.JOD))
    assertEquals(BigDecimal("1.002"), ArithmeticEvaluator.evaluate("1.0015", Currency.TND))
    assertEquals(BigDecimal("10.000"), ArithmeticEvaluator.evaluate("10 ÷ 3 × 3", Currency.KWD))
  }

  @Test
  fun evaluate_twoDecimalCurrency_usesHalfEven() {
    assertEquals(BigDecimal("1.00"), ArithmeticEvaluator.evaluate("1.005", Currency.USD))
    assertEquals(BigDecimal("1.02"), ArithmeticEvaluator.evaluate("1.015", Currency.EUR))
    assertEquals(BigDecimal("33.33"), ArithmeticEvaluator.evaluate("100 ÷ 3", Currency.GBP))
  }

  @Test
  fun evaluate_blankOrInvalidExpression_returnsNull() {
    assertNull(ArithmeticEvaluator.evaluate(""))
    assertNull(ArithmeticEvaluator.evaluate("   "))
    assertNull(ArithmeticEvaluator.evaluate("10 +"))
    assertNull(ArithmeticEvaluator.evaluate("10 ÷ 0", Currency.USD))
    assertNull(ArithmeticEvaluator.evaluate("10 + abc", Currency.KWD))
  }
}
