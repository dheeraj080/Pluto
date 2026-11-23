package com.pluto.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Backspace
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Safely evaluates arithmetic expressions (e.g., "12.50 + 5.20 * 2") into an exact BigDecimal.
 * Supports +, -, × (*), ÷ (/) with standard operator precedence.
 */
object ArithmeticEvaluator {

  fun evaluate(expression: String): BigDecimal? {
    val clean = expression.replace(" ", "").replace("×", "*").replace("÷", "/")
    if (clean.isBlank()) return null

    // If it's a simple number
    clean.toBigDecimalOrNull()?.let { return it }

    return try {
      parseExpression(clean)
    } catch (_: Exception) {
      null
    }
  }

  private fun parseExpression(expr: String): BigDecimal {
    // Tokenize into numbers and operators
    val tokens = mutableListOf<String>()
    var currentNumber = StringBuilder()

    var i = 0
    while (i < expr.length) {
      val c = expr[i]
      if (c.isDigit() || c == '.') {
        currentNumber.append(c)
      } else if (c in listOf('+', '-', '*', '/')) {
        if (currentNumber.isNotEmpty()) {
          tokens.add(currentNumber.toString())
          currentNumber = StringBuilder()
        } else if (c == '-' && (tokens.isEmpty() || tokens.last() in listOf("+", "-", "*", "/"))) {
          // Negative sign for number
          currentNumber.append(c)
          i++
          continue
        }
        tokens.add(c.toString())
      }
      i++
    }
    if (currentNumber.isNotEmpty()) {
      tokens.add(currentNumber.toString())
    }

    if (tokens.isEmpty()) return BigDecimal.ZERO

    // Pass 1: Handle * and /
    val pass1 = mutableListOf<String>()
    var idx = 0
    while (idx < tokens.size) {
      val token = tokens[idx]
      if (token == "*" || token == "/") {
        val left = BigDecimal(pass1.removeAt(pass1.size - 1))
        val right = BigDecimal(tokens[++idx])
        val result = if (token == "*") {
          left.multiply(right)
        } else {
          if (right.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO
          left.divide(right, 4, RoundingMode.HALF_EVEN)
        }
        pass1.add(result.toPlainString())
      } else {
        pass1.add(token)
      }
      idx++
    }

    // Pass 2: Handle + and -
    var accumulator = BigDecimal(pass1[0])
    var p2Idx = 1
    while (p2Idx < pass1.size) {
      val op = pass1[p2Idx]
      val nextVal = BigDecimal(pass1[p2Idx + 1])
      accumulator = if (op == "+") {
        accumulator.add(nextVal)
      } else {
        accumulator.subtract(nextVal)
      }
      p2Idx += 2
    }

    return accumulator.setScale(2, RoundingMode.HALF_EVEN)
  }
}

/**
 * Built-in Modern Fintech Calculator Numpad for live arithmetic travel expense input.
 */
@Composable
fun CalculatorNumpad(
  currentExpression: String,
  onExpressionChange: (String) -> Unit,
  onDone: () -> Unit,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .testTag("calculator_numpad")
      .padding(horizontal = 12.dp, vertical = 6.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    // Row 1
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      NumpadKey(
        text = "C",
        onClick = { onExpressionChange("") },
        containerColor = MaterialTheme.colorScheme.surfaceVariant,
        contentColor = MaterialTheme.colorScheme.error,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_clear"
      )
      NumpadKey(
        text = "÷",
        onClick = { onExpressionChange(appendOperator(currentExpression, " ÷ ")) },
        containerColor = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_div"
      )
      NumpadKey(
        text = "×",
        onClick = { onExpressionChange(appendOperator(currentExpression, " × ")) },
        containerColor = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_mul"
      )
      NumpadIconKey(
        icon = Icons.AutoMirrored.Rounded.Backspace,
        contentDescription = "Backspace",
        onClick = { onExpressionChange(backspace(currentExpression)) },
        containerColor = MaterialTheme.colorScheme.surfaceVariant,
        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_backspace"
      )
    }

    // Row 2
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      NumpadKey(text = "7", onClick = { onExpressionChange(currentExpression + "7") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "8", onClick = { onExpressionChange(currentExpression + "8") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "9", onClick = { onExpressionChange(currentExpression + "9") }, modifier = Modifier.weight(1f))
      NumpadKey(
        text = "-",
        onClick = { onExpressionChange(appendOperator(currentExpression, " - ")) },
        containerColor = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_sub"
      )
    }

    // Row 3
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      NumpadKey(text = "4", onClick = { onExpressionChange(currentExpression + "4") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "5", onClick = { onExpressionChange(currentExpression + "5") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "6", onClick = { onExpressionChange(currentExpression + "6") }, modifier = Modifier.weight(1f))
      NumpadKey(
        text = "+",
        onClick = { onExpressionChange(appendOperator(currentExpression, " + ")) },
        containerColor = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_add"
      )
    }

    // Row 4
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      NumpadKey(text = "1", onClick = { onExpressionChange(currentExpression + "1") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "2", onClick = { onExpressionChange(currentExpression + "2") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "3", onClick = { onExpressionChange(currentExpression + "3") }, modifier = Modifier.weight(1f))
      NumpadKey(
        text = "=",
        onClick = {
          val evaluated = ArithmeticEvaluator.evaluate(currentExpression)
          if (evaluated != null) {
            onExpressionChange(evaluated.stripTrailingZeros().toPlainString())
          }
        },
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_eq"
      )
    }

    // Row 5
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      NumpadKey(text = "0", onClick = { onExpressionChange(currentExpression + "0") }, modifier = Modifier.weight(1f))
      NumpadKey(text = "00", onClick = { onExpressionChange(currentExpression + "00") }, modifier = Modifier.weight(1f))
      NumpadKey(
        text = ".",
        onClick = {
          if (!currentExpression.endsWith(".")) {
            onExpressionChange(currentExpression + ".")
          }
        },
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_dot"
      )
      NumpadIconKey(
        icon = Icons.Rounded.Check,
        contentDescription = "Confirm",
        onClick = {
          val evaluated = ArithmeticEvaluator.evaluate(currentExpression)
          if (evaluated != null) {
            onExpressionChange(evaluated.stripTrailingZeros().toPlainString())
          }
          onDone()
        },
        containerColor = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary,
        modifier = Modifier.weight(1f),
        testTag = "numpad_key_done"
      )
    }
  }
}

private fun appendOperator(expr: String, op: String): String {
  val trimmed = expr.trimEnd()
  if (trimmed.isEmpty()) return ""
  return if (trimmed.endsWith("+") || trimmed.endsWith("-") || trimmed.endsWith("×") || trimmed.endsWith("÷")) {
    trimmed.dropLast(1).trimEnd() + op
  } else {
    "$trimmed$op"
  }
}

private fun backspace(expr: String): String {
  val trimmed = expr.trimEnd()
  return if (trimmed.isNotEmpty()) {
    if (trimmed.endsWith(" +") || trimmed.endsWith(" -") || trimmed.endsWith(" ×") || trimmed.endsWith(" ÷")) {
      trimmed.dropLast(2).trimEnd()
    } else {
      trimmed.dropLast(1)
    }
  } else ""
}

@Composable
private fun NumpadKey(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  containerColor: Color = MaterialTheme.colorScheme.surface,
  contentColor: Color = MaterialTheme.colorScheme.onSurface,
  testTag: String = "numpad_key_$text"
) {
  Surface(
    shape = PlutoShapes.large,
    color = containerColor,
    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    modifier = modifier
      .height(52.dp)
      .minimumInteractiveComponentSize()
      .clip(PlutoShapes.large)
      .clickable(role = Role.Button, onClick = onClick)
      .testTag(testTag)
  ) {
    Box(
      modifier = Modifier.fillMaxWidth(),
      contentAlignment = Alignment.Center
    ) {
      Text(
        text = text,
        style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = contentColor
      )
    }
  }
}

@Composable
private fun NumpadIconKey(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  contentDescription: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  containerColor: Color = MaterialTheme.colorScheme.surface,
  contentColor: Color = MaterialTheme.colorScheme.onSurface,
  testTag: String
) {
  Surface(
    shape = PlutoShapes.large,
    color = containerColor,
    modifier = modifier
      .height(52.dp)
      .minimumInteractiveComponentSize()
      .clip(PlutoShapes.large)
      .clickable(role = Role.Button, onClick = onClick)
      .testTag(testTag)
  ) {
    Box(
      modifier = Modifier.fillMaxWidth(),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = icon,
        contentDescription = contentDescription,
        tint = contentColor,
        modifier = Modifier.size(22.dp)
      )
    }
  }
}
