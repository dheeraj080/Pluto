package com.pluto.app.ui.components

import com.pluto.app.domain.model.Currency
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Safely evaluates arithmetic expressions (e.g., "12.50 + 5.20 * 2") into an exact BigDecimal.
 * Supports +, -, × (*), ÷ (/) with standard operator precedence and currency-specific scale.
 */
object ArithmeticEvaluator {

  fun evaluate(expression: String, currency: Currency): BigDecimal? =
    evaluate(expression = expression, targetScale = currency.decimalPlaces)

  fun evaluate(expression: String, targetScale: Int = 2): BigDecimal? {
    require(targetScale >= 0) { "targetScale cannot be negative, got $targetScale" }
    val clean = expression.replace(" ", "").replace("×", "*").replace("÷", "/")
    if (clean.isBlank()) return null

    // If it's a simple number, normalize to the target currency scale
    clean.toBigDecimalOrNull()?.let {
      return it.setScale(targetScale, RoundingMode.HALF_EVEN)
    }

    return try {
      parseExpression(clean, targetScale)
    } catch (_: Exception) {
      null
    }
  }

  private fun parseExpression(expr: String, targetScale: Int): BigDecimal? {
    val tokens = mutableListOf<String>()
    var currentNumber = StringBuilder()

    var i = 0
    while (i < expr.length) {
      val c = expr[i]
      if (c.isDigit() || c == '.') {
        currentNumber.append(c)
      } else if (c == '+' || c == '-' || c == '*' || c == '/') {
        if (currentNumber.isNotEmpty()) {
          tokens.add(currentNumber.toString())
          currentNumber = StringBuilder()
        } else if (c == '-' && (tokens.isEmpty() || tokens.last() in listOf("+", "-", "*", "/"))) {
          // Unary minus for signed number
          currentNumber.append(c)
          i++
          continue
        } else {
          return null
        }
        tokens.add(c.toString())
      } else {
        return null
      }
      i++
    }
    if (currentNumber.isNotEmpty()) {
      tokens.add(currentNumber.toString())
    }

    if (tokens.isEmpty()) return null
    if (tokens.last() in listOf("+", "-", "*", "/")) return null

    val intermediateDivisionScale = (targetScale + 8).coerceAtLeast(10)

    // Pass 1: Handle * and /
    val pass1 = mutableListOf<String>()
    var idx = 0
    while (idx < tokens.size) {
      val token = tokens[idx]
      if (token == "*" || token == "/") {
        if (pass1.isEmpty() || idx + 1 >= tokens.size) return null
        val left = pass1.removeAt(pass1.size - 1).toBigDecimalOrNull() ?: return null
        val right = tokens[++idx].toBigDecimalOrNull() ?: return null
        val result = if (token == "*") {
          left.multiply(right)
        } else {
          if (right.compareTo(BigDecimal.ZERO) == 0) return null
          left.divide(right, intermediateDivisionScale, RoundingMode.HALF_EVEN)
        }
        pass1.add(result.toPlainString())
      } else {
        pass1.add(token)
      }
      idx++
    }

    // Pass 2: Handle + and -
    var accumulator = pass1.firstOrNull()?.toBigDecimalOrNull() ?: return null
    var p2Idx = 1
    while (p2Idx < pass1.size) {
      if (p2Idx + 1 >= pass1.size) return null
      val op = pass1[p2Idx]
      val nextVal = pass1[p2Idx + 1].toBigDecimalOrNull() ?: return null
      accumulator = if (op == "+") {
        accumulator.add(nextVal)
      } else if (op == "-") {
        accumulator.subtract(nextVal)
      } else {
        return null
      }
      p2Idx += 2
    }

    return accumulator.setScale(targetScale, RoundingMode.HALF_EVEN)
  }
}
