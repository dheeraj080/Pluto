package com.pluto.app.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ShowChart
import androidx.compose.material.icons.automirrored.rounded.TrendingDown
import androidx.compose.material.icons.automirrored.rounded.TrendingFlat
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.domain.model.DailySpendPoint
import com.pluto.app.domain.model.DashboardSummary
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import java.math.BigDecimal
import kotlin.math.roundToInt

/**
 * Visual 30-Day Spending Trend Line Component.
 *
 * Implements Recharts-style interactive data visualization in Jetpack Compose:
 * - Smooth Monotone Cubic Bézier Curve with Gradient Area Fill
 * - Dual-Currency presentation (Primary: Destination/Trip country, Secondary: Home country)
 * - Interactive Touch Scrubber with real-time inspection tooltip
 * - Daily Average benchmark dashed guideline
 * - 30-Day telemetry insights (Total, Daily Average, Peak Day, Trend %)
 */
@Composable
fun SpendingTrendCard(
  summary: DashboardSummary,
  modifier: Modifier = Modifier
) {
  val trendPoints = summary.thirtyDaySpendingTrend
  val hasData = trendPoints.any { it.amountHome.amount > BigDecimal.ZERO }

  // Interactive scrubber state: index of the inspected day (null if not currently touching)
  var selectedIndex by remember { mutableStateOf<Int?>(null) }
  val activePoint = selectedIndex?.let { trendPoints.getOrNull(it) }

  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge,
    testTag = "spending_trend_card"
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(18.dp)
    ) {
      // 1. Header with Badge & Dual-Currency Total
      TrendCardHeader(summary = summary, activePoint = activePoint)

      Spacer(modifier = Modifier.height(14.dp))

      // 2. Telemetry Insight Pills
      TrendTelemetryBar(summary = summary)

      Spacer(modifier = Modifier.height(16.dp))

      // 3. Interactive Bézier Curve Chart Canvas
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(190.dp)
          .testTag("trend_line_chart_container")
      ) {
        if (trendPoints.isNotEmpty()) {
          TrendLineCanvas(
            points = trendPoints,
            dailyAvgHome = summary.thirtyDayDailyAvgHome.amount.toFloat(),
            selectedIndex = selectedIndex,
            onSelectIndex = { selectedIndex = it }
          )

          // Floating Tooltip when scrubbing
          if (activePoint != null) {
            ScrubberTooltipPill(
              point = activePoint,
              modifier = Modifier
                .align(Alignment.TopCenter)
                .testTag("trend_scrubber_tooltip")
            )
          }
        } else {
          Box(
            modifier = Modifier.fillMaxWidth().height(190.dp),
            contentAlignment = Alignment.Center
          ) {
            Text(
              text = "No spending history available",
              style = MaterialTheme.typography.bodyMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(8.dp))

      // 4. X-Axis Time Markers (5 evenly spaced date labels)
      if (trendPoints.size >= 5) {
        TrendXAxisLabels(points = trendPoints)
      }

      // 5. Empty State / Helpful Guidance Note
      if (!hasData) {
        Spacer(modifier = Modifier.height(8.dp))
        Surface(
          shape = PlutoShapes.medium,
          color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = Icons.Rounded.Info,
              contentDescription = null,
              modifier = Modifier.size(16.dp),
              tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = "No expenses recorded in the last 30 days. As you log spending, your trend curve will appear here.",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
    }
  }
}

@Composable
private fun TrendCardHeader(
  summary: DashboardSummary,
  activePoint: DailySpendPoint?,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    // Left: Icon + Title
    Row(verticalAlignment = Alignment.CenterVertically) {
      Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier.size(36.dp)
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ShowChart,
            contentDescription = "Spending Trend Chart",
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.size(20.dp)
          )
        }
      }

      Spacer(modifier = Modifier.width(10.dp))

      Column {
        Text(
          text = "30-Day Spending Pattern",
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurface
        )
        Text(
          text = if (activePoint != null) "Scrubbing ${activePoint.dayLabel}" else "Daily expenditure pattern",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }

    // Right: Dual-Currency 30-Day Total
    Column(horizontalAlignment = Alignment.End) {
      val hasDestTotal = summary.thirtyDayTotalDest != null
      val primaryTotal = if (hasDestTotal) {
        "LOCAL · ${summary.thirtyDayTotalDest!!.formatWithCode()}"
      } else {
        "HOME · ${summary.thirtyDayTotalHome.formatWithCode()}"
      }

      Text(
        text = primaryTotal,
        style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary
      )
      if (hasDestTotal) {
        Text(
          text = "HOME · ${summary.thirtyDayTotalHome.formatWithCode()}",
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

@Composable
private fun TrendTelemetryBar(
  summary: DashboardSummary,
  modifier: Modifier = Modifier
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    // 1. Daily Average Pill
    val hasAvgDest = summary.thirtyDayDailyAvgDest != null
    val avgDest = if (hasAvgDest) {
      "LOCAL · ${summary.thirtyDayDailyAvgDest!!.formatWithCode()}"
    } else {
      "HOME · ${summary.thirtyDayDailyAvgHome.formatWithCode()}"
    }
    TelemetryMetricPill(
      label = "Daily Avg",
      value = avgDest,
      subValue = if (hasAvgDest) "HOME · ${summary.thirtyDayDailyAvgHome.formatWithCode()}" else null,
      modifier = Modifier.weight(1f)
    )

    // 2. Peak Day Pill
    val peak = summary.thirtyDayPeakDay
    val peakVal = peak?.let {
      val hasDest = it.amountDest != null
      "${if (hasDest) "LOCAL · " else "HOME · "}${(it.amountDest ?: it.amountHome).formatWithCode()}"
    } ?: "None"
    val peakSub = peak?.dayLabel
    TelemetryMetricPill(
      label = "Peak Day",
      value = peakVal,
      subValue = peakSub,
      modifier = Modifier.weight(1f)
    )

    // 3. Trend % Pill
    val trendPct = summary.thirtyDayTrendPercentage
    val (trendText, trendColor, trendIcon) = when {
      trendPct == null -> Triple("Baseline", MaterialTheme.colorScheme.onSurfaceVariant, Icons.AutoMirrored.Rounded.TrendingFlat)
      trendPct > 5.0 -> Triple("+${"%.1f".format(trendPct)}%", MaterialTheme.colorScheme.error, Icons.AutoMirrored.Rounded.TrendingUp)
      trendPct < -5.0 -> Triple("${"%.1f".format(trendPct)}%", MaterialTheme.colorScheme.secondary, Icons.AutoMirrored.Rounded.TrendingDown)
      else -> Triple("Stable", MaterialTheme.colorScheme.secondary, Icons.AutoMirrored.Rounded.TrendingFlat)
    }

    Surface(
      shape = PlutoShapes.medium,
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
      modifier = Modifier.weight(1f)
    ) {
      Column(
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Text(
          text = "Trend (15d)",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          fontSize = 10.sp
        )
        Spacer(modifier = Modifier.height(2.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = trendIcon,
            contentDescription = null,
            tint = trendColor,
            modifier = Modifier.size(13.dp)
          )
          Spacer(modifier = Modifier.width(3.dp))
          Text(
            text = trendText,
            style = MaterialTheme.typography.labelMedium.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = trendColor,
            maxLines = 1
          )
        }
      }
    }
  }
}

@Composable
private fun TelemetryMetricPill(
  label: String,
  value: String,
  subValue: String?,
  modifier: Modifier = Modifier
) {
  Surface(
    shape = PlutoShapes.medium,
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    modifier = modifier
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontSize = 10.sp
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = value,
        style = MaterialTheme.typography.labelMedium.merge(PlutoNumericStyle),
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 1
      )
      if (subValue != null) {
        Text(
          text = subValue,
          style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          fontSize = 9.sp,
          maxLines = 1
        )
      }
    }
  }
}

/**
 * Native Jetpack Compose Canvas rendering the Monotone Cubic Bézier Curve,
 * Gradient Area Fill, Average Guideline, and Touch Scrubber.
 */
@Composable
private fun TrendLineCanvas(
  points: List<DailySpendPoint>,
  dailyAvgHome: Float,
  selectedIndex: Int?,
  onSelectIndex: (Int?) -> Unit,
  modifier: Modifier = Modifier
) {
  val primaryColor = MaterialTheme.colorScheme.primary
  val surfaceColor = MaterialTheme.colorScheme.surface
  val onSurfaceVariant = MaterialTheme.colorScheme.onSurfaceVariant

  Canvas(
    modifier = modifier
      .fillMaxWidth()
      .height(180.dp)
      .pointerInput(points) {
        detectTapGestures(
          onPress = { offset ->
            val idx = ((offset.x / size.width) * (points.size - 1))
              .roundToInt()
              .coerceIn(0, points.size - 1)
            onSelectIndex(idx)
            tryAwaitRelease()
            onSelectIndex(null)
          }
        )
      }
      .pointerInput(points) {
        detectDragGestures(
          onDragStart = { offset ->
            val idx = ((offset.x / size.width) * (points.size - 1))
              .roundToInt()
              .coerceIn(0, points.size - 1)
            onSelectIndex(idx)
          },
          onDrag = { change, _ ->
            change.consume()
            val idx = ((change.position.x / size.width) * (points.size - 1))
              .roundToInt()
              .coerceIn(0, points.size - 1)
            onSelectIndex(idx)
          },
          onDragEnd = { onSelectIndex(null) },
          onDragCancel = { onSelectIndex(null) }
        )
      }
  ) {
    val width = size.width
    val height = size.height
    val paddingBottom = 20f
    val paddingTop = 28f
    val chartHeight = height - paddingBottom - paddingTop

    val maxSpend = (points.maxOfOrNull { it.amountHome.amount.toFloat() } ?: 0f).coerceAtLeast(10f)

    fun getX(index: Int): Float {
      if (points.size <= 1) return width / 2f
      return (index.toFloat() / (points.size - 1).toFloat()) * width
    }

    fun getY(amount: Float): Float {
      val ratio = (amount / maxSpend).coerceIn(0f, 1f)
      return (height - paddingBottom) - (ratio * chartHeight)
    }

    // 1. Draw Subtle Horizontal Grid Lines (Max, 50%, Baseline)
    val gridColor = onSurfaceVariant.copy(alpha = 0.12f)
    val dashEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)

    // Baseline
    drawLine(
      color = gridColor,
      start = Offset(0f, height - paddingBottom),
      end = Offset(width, height - paddingBottom),
      strokeWidth = 1.5f
    )

    // Midline
    drawLine(
      color = gridColor,
      start = Offset(0f, getY(maxSpend / 2f)),
      end = Offset(width, getY(maxSpend / 2f)),
      strokeWidth = 1f,
      pathEffect = dashEffect
    )

    // Daily Average Guideline
    if (dailyAvgHome > 0f) {
      val avgY = getY(dailyAvgHome)
      drawLine(
        color = primaryColor.copy(alpha = 0.45f),
        start = Offset(0f, avgY),
        end = Offset(width, avgY),
        strokeWidth = 1.5f,
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 8f), 0f)
      )
    }

    if (points.isEmpty()) return@Canvas

    // 2. Compute Monotone Cubic Bézier Curve Path
    val path = Path()
    val fillPath = Path()

    val firstX = getX(0)
    val firstY = getY(points[0].amountHome.amount.toFloat())

    path.moveTo(firstX, firstY)
    fillPath.moveTo(firstX, height - paddingBottom)
    fillPath.lineTo(firstX, firstY)

    for (i in 0 until points.size - 1) {
      val p0X = getX(i)
      val p0Y = getY(points[i].amountHome.amount.toFloat())
      val p1X = getX(i + 1)
      val p1Y = getY(points[i + 1].amountHome.amount.toFloat())

      val cx1 = p0X + (p1X - p0X) / 2f
      val cy1 = p0Y
      val cx2 = p0X + (p1X - p0X) / 2f
      val cy2 = p1Y

      path.cubicTo(cx1, cy1, cx2, cy2, p1X, p1Y)
      fillPath.cubicTo(cx1, cy1, cx2, cy2, p1X, p1Y)
    }

    val lastX = getX(points.size - 1)
    fillPath.lineTo(lastX, height - paddingBottom)
    fillPath.close()

    // 3. Draw Gradient Area Fill under the Curve (Recharts Area effect)
    val areaBrush = Brush.verticalGradient(
      colors = listOf(
        primaryColor.copy(alpha = 0.38f),
        primaryColor.copy(alpha = 0.08f),
        primaryColor.copy(alpha = 0.0f)
      ),
      startY = paddingTop,
      endY = height - paddingBottom
    )
    drawPath(path = fillPath, brush = areaBrush)

    // 4. Draw Smooth Stroke Curve
    drawPath(
      path = path,
      color = primaryColor,
      style = Stroke(
        width = 3.dp.toPx(),
        cap = StrokeCap.Round
      )
    )

    // 5. Draw Interactive Scrubber if User is Inspecting
    if (selectedIndex != null && selectedIndex in points.indices) {
      val selectedPt = points[selectedIndex]
      val scrubX = getX(selectedIndex)
      val scrubY = getY(selectedPt.amountHome.amount.toFloat())

      // Vertical Scrubber Line
      drawLine(
        color = primaryColor.copy(alpha = 0.75f),
        start = Offset(scrubX, paddingTop),
        end = Offset(scrubX, height - paddingBottom),
        strokeWidth = 2.dp.toPx(),
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 6f), 0f)
      )

      // Outer Glow Halo
      drawCircle(
        color = primaryColor.copy(alpha = 0.25f),
        radius = 12.dp.toPx(),
        center = Offset(scrubX, scrubY)
      )

      // Middle White/Surface Ring
      drawCircle(
        color = surfaceColor,
        radius = 6.dp.toPx(),
        center = Offset(scrubX, scrubY)
      )

      // Inner Core Accent
      drawCircle(
        color = primaryColor,
        radius = 4.dp.toPx(),
        center = Offset(scrubX, scrubY)
      )
    }
  }
}

/**
 * Floating Tooltip Pill showing date, primary (visiting currency), and secondary (home currency) values.
 */
@Composable
private fun ScrubberTooltipPill(
  point: DailySpendPoint,
  modifier: Modifier = Modifier
) {
  Surface(
    shape = PlutoShapes.large,
    color = MaterialTheme.colorScheme.surface,
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)),
    shadowElevation = 6.dp,
    modifier = modifier.padding(top = 4.dp)
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column {
        Text(
          text = point.fullDateLabel,
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
          val hasPointDest = point.amountDest != null
          val primaryText = if (hasPointDest) {
            "LOCAL · ${point.amountDest!!.formatWithCode()}"
          } else {
            "HOME · ${point.amountHome.formatWithCode()}"
          }
          Text(
            text = primaryText,
            style = MaterialTheme.typography.titleSmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
          )
          if (hasPointDest) {
            Spacer(modifier = Modifier.width(6.dp))
            Text(
              text = "HOME · ${point.amountHome.formatWithCode()}",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }

      if (point.transactionCount > 0) {
        Spacer(modifier = Modifier.width(12.dp))
        Surface(
          shape = CircleShape,
          color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
        ) {
          Text(
            text = "${point.transactionCount} tx",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
          )
        }
      }
    }
  }
}

/**
 * Evenly distributed date labels along the X-Axis (e.g. 30d ago, 22d ago, 15d ago, 7d ago, Today).
 */
@Composable
private fun TrendXAxisLabels(
  points: List<DailySpendPoint>,
  modifier: Modifier = Modifier
) {
  val indices = listOf(0, 7, 14, 21, points.lastIndex).filter { it in points.indices }.distinct()

  Row(
    modifier = modifier
      .fillMaxWidth()
      .padding(horizontal = 4.dp),
    horizontalArrangement = Arrangement.SpaceBetween
  ) {
    indices.forEach { idx ->
      val pt = points[idx]
      val label = if (idx == points.lastIndex) "Today" else pt.dayLabel
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        fontSize = 10.sp,
        color = if (idx == points.lastIndex) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}
