package com.pluto.app.currency

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
  fun evaluate_blankOrInvalidExpression_returnsNull() {
    assertNull(ArithmeticEvaluator.evaluate(""))
    assertNull(ArithmeticEvaluator.evaluate("   "))
  }
}
