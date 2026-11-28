package com.pluto.app.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.material.icons.rounded.PieChart
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Money
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.parseCategoryColor
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.rememberPrefersReducedMotion
import com.pluto.app.ui.theme.useLargeFontLayout
import java.math.BigDecimal
import kotlin.math.atan2
import kotlin.math.sqrt

/**
 * Modern Compose-based Data Visualization for Category Spending Breakdown & High-Cost Area Identification.
 * Features:
 * 1. Interactive multi-segment Canvas Donut Chart with center summary inspection.
 * 2. High-Cost Area Detection Banner flagging disproportionate category expenses (>20%).
 * 3. Comparative ranked horizontal bars for easy visual scanning of outflow distribution.
 */
@Composable
fun CategoryBreakdownChart(
  categorySummaries: List<CategorySpendingSummary>,
  homeCurrency: Currency,
  totalHomeSpending: Money,
  modifier: Modifier = Modifier
) {
  var selectedCategory by remember { mutableStateOf<CategorySpendingSummary?>(null) }

  // High-cost identification: sort descending by home spending amount
  val sortedSummaries = remember(categorySummaries) {
    categorySummaries.sortedByDescending { it.totalHomeAmount.amount }
  }

  val highestCostCategory = sortedSummaries.firstOrNull()
  val isHighConcentration = highestCostCategory != null &&
    highestCostCategory.percentageOfTotal >= BigDecimal("20.0") &&
    totalHomeSpending.amount > BigDecimal.ZERO

  PlutoCard(
    modifier = modifier.fillMaxWidth(),
    shape = PlutoShapes.extraLarge,
    testTag = "category_breakdown_chart_card"
  ) {
    Column(
      modifier = Modifier
        .padding(18.dp)
        .animateContentSize()
    ) {
      // Header
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(34.dp)
          ) {
            Box(contentAlignment = Alignment.Center) {
              Icon(
                imageVector = Icons.Rounded.PieChart,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp)
              )
            }
          }
          Spacer(modifier = Modifier.width(10.dp))
          Column {
            Text(
              text = "Category Breakdown",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.plutoHeading()
            )
            Text(
              text = "Visual spending distribution",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis
            )
          }
        }

        if (sortedSummaries.isNotEmpty()) {
          Surface(
            shape = PlutoShapes.medium,
            color = MaterialTheme.colorScheme.surfaceVariant
          ) {
            Text(
              text = "${sortedSummaries.size} Categories",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(18.dp))

      if (sortedSummaries.isEmpty() || totalHomeSpending.amount <= BigDecimal.ZERO) {
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), PlutoShapes.large),
          contentAlignment = Alignment.Center
        ) {
          Text(
            text = "No expenses recorded in this period",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
      } else {
        val largeFontLayout = useLargeFontLayout()
        // 1. Interactive Donut Chart with a width-responsive canvas.
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
          val donutSize = minOf(200.dp, maxWidth)
          val donutModifier = Modifier.size(donutSize)
          val onSliceTapped: (CategorySpendingSummary) -> Unit = { tapped ->
            selectedCategory = if (selectedCategory?.category?.id == tapped.category.id) null else tapped
          }
          val clearSelection: () -> Unit = { selectedCategory = null }

          if (largeFontLayout) {
            // Reflow: place the callout below the donut so scaled-up text has room.
            Column(
              modifier = Modifier.fillMaxWidth(),
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
              DonutChartCanvas(
                categorySummaries = sortedSummaries,
                selectedCategory = selectedCategory,
                onCategoryTapped = onSliceTapped,
                modifier = donutModifier
              )
              DonutCenterCallout(
                selectedCategory = selectedCategory,
                totalHomeSpending = totalHomeSpending,
                largeFontLayout = true,
                onClearSelection = clearSelection,
                modifier = Modifier
                  .fillMaxWidth()
                  .padding(horizontal = 8.dp)
              )
            }
          } else {
            Box(
              modifier = Modifier
                .fillMaxWidth()
                .height(210.dp),
              contentAlignment = Alignment.Center
            ) {
              DonutChartCanvas(
                categorySummaries = sortedSummaries,
                selectedCategory = selectedCategory,
                onCategoryTapped = onSliceTapped,
                modifier = donutModifier
              )
              DonutCenterCallout(
                selectedCategory = selectedCategory,
                totalHomeSpending = totalHomeSpending,
                largeFontLayout = false,
                onClearSelection = clearSelection,
                modifier = Modifier.padding(horizontal = 16.dp)
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // 2. High-Cost Area Alert Callout (Helps users immediately identify runaway costs)
        highestCostCategory?.takeIf { isHighConcentration }?.let { highCat ->
          Surface(
            shape = PlutoShapes.large,
            color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.28f)),
            modifier = Modifier
              .fillMaxWidth()
              .testTag("high_cost_area_alert")
          ) {
            Row(
              modifier = Modifier.padding(14.dp),
              verticalAlignment = Alignment.Top
            ) {
              Icon(
                imageVector = Icons.Rounded.WarningAmber,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier
                  .size(20.dp)
                  .padding(top = 1.dp)
              )
              Spacer(modifier = Modifier.width(10.dp))
              Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                  Text(
                    text = "High-Cost Area: ${highCat.category.name}",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    maxLines = if (largeFontLayout) 2 else 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                  )
                  Spacer(modifier = Modifier.width(6.dp))
                  Surface(
                    shape = PlutoShapes.small,
                    color = MaterialTheme.colorScheme.error
                  ) {
                    Text(
                      text = "${highCat.percentageOfTotal}%",
                      style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
                      fontWeight = FontWeight.Bold,
                      color = MaterialTheme.colorScheme.onError,
                      maxLines = 1,
                      overflow = TextOverflow.Ellipsis,
                      modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                  }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                  text = "${highCat.category.name} represents ${highCat.percentageOfTotal}% (${highCat.totalHomeAmount.format()}) of all expenses. Review recent transactions to keep spending balanced.",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant,
                  maxLines = if (largeFontLayout) 5 else 3,
                  overflow = TextOverflow.Ellipsis
                )
              }
            }
          }

          Spacer(modifier = Modifier.height(16.dp))
        }

        // 3. Ranked Expenditure Progress Bars
        Text(
          text = "RANKED BY EXPENDITURE",
          style = MaterialTheme.typography.labelSmall,
          fontWeight = FontWeight.Bold,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )

        Spacer(modifier = Modifier.height(10.dp))

        val maxAmount = sortedSummaries.maxOfOrNull { it.totalHomeAmount.amount } ?: BigDecimal.ONE

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          sortedSummaries.forEachIndexed { index, summaryItem ->
            val isSelected = selectedCategory?.category?.id == summaryItem.category.id
            val isHighCost = summaryItem.percentageOfTotal >= BigDecimal("20.0")

            RankedCategoryBarRow(
              rank = index + 1,
              item = summaryItem,
              maxAmount = maxAmount,
              isSelected = isSelected,
              isHighCost = isHighCost,
              onClick = {
                selectedCategory = if (isSelected) null else summaryItem
              }
            )
          }
        }
      }
    }
  }
}

@Composable
private fun DonutCenterCallout(
  selectedCategory: CategorySpendingSummary?,
  totalHomeSpending: Money,
  largeFontLayout: Boolean,
  onClearSelection: () -> Unit,
  modifier: Modifier = Modifier
) {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = modifier
      .minimumInteractiveComponentSize()
      .clickable { onClearSelection() }
  ) {
    if (selectedCategory != null) {
      Text(
        text = selectedCategory.category.name,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        color = parseCategoryColor(selectedCategory.category.colorHex),
        maxLines = 2,
        overflow = TextOverflow.Ellipsis
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = selectedCategory.totalHomeAmount.format(),
        style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
        fontWeight = FontWeight.ExtraBold,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis
      )
      Text(
        text = "${selectedCategory.percentageOfTotal}% of total",
        style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    } else {
      Text(
        text = "Total Spent",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
      Spacer(modifier = Modifier.height(2.dp))
      Text(
        text = totalHomeSpending.format(),
        style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle),
        fontWeight = FontWeight.ExtraBold,
        color = MaterialTheme.colorScheme.primary,
        maxLines = if (largeFontLayout) 2 else 1,
        overflow = TextOverflow.Ellipsis
      )
      Text(
        text = "Tap slice to inspect",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}

private data class DonutSlice(
  val summary: CategorySpendingSummary,
  val startAngle: Float,
  val sweepAngle: Float
)

@Composable
private fun DonutChartCanvas(
  categorySummaries: List<CategorySpendingSummary>,
  selectedCategory: CategorySpendingSummary?,
  onCategoryTapped: (CategorySpendingSummary) -> Unit,
  modifier: Modifier = Modifier
) {
  val density = LocalDensity.current
  val strokeWidthPx = with(density) { 28.dp.toPx() }
  val slices = remember(categorySummaries) {
    val totalPct = categorySummaries.sumOf { it.percentageOfTotal.toDouble() }
    if (totalPct <= 0.0) {
      emptyList()
    } else {
      var angle = -90f
      categorySummaries.map { cat ->
        val sweep = ((cat.percentageOfTotal.toFloat() / 100f) * 360f).coerceAtLeast(3f)
        val slice = DonutSlice(summary = cat, startAngle = angle, sweepAngle = sweep)
        angle += sweep
        slice
      }
    }
  }

  Box(modifier = modifier.testTag("category_breakdown_donut_chart")) {
    Canvas(
      modifier = Modifier
        .matchParentSize()
        .pointerInput(slices) {
          detectTapGestures { offset ->
            val radius = (minOf(size.width, size.height) - strokeWidthPx) / 2f
            val center = Offset(size.width / 2f, size.height / 2f)
            val dx = offset.x - center.x
            val dy = offset.y - center.y
            val distance = sqrt(dx * dx + dy * dy)
            if (distance < radius - strokeWidthPx || distance > radius + strokeWidthPx + 8.dp.toPx()) {
              return@detectTapGestures
            }

            // Compose angles grow clockwise from 3 o'clock; slices start at 12 o'clock (-90°).
            val rawAngle = Math.toDegrees(atan2(dy, dx).toDouble()).toFloat()
            val relativeAngle = ((rawAngle + 90f) % 360f + 360f) % 360f

            // Minimum sweeps can push the accumulated angle past 360°, so hit ranges are
            // compared modulo the circle instead of assuming a single unwrapped lap.
            slices.forEach { slice ->
              val rawStart = ((slice.startAngle + 90f) % 360f + 360f) % 360f
              val rawEnd = rawStart + slice.sweepAngle
              val normalizedEnd = ((rawEnd % 360f) + 360f) % 360f
              val isHit = if (rawEnd <= 360f) {
                relativeAngle >= rawStart && relativeAngle < normalizedEnd
              } else {
                relativeAngle >= rawStart || relativeAngle < normalizedEnd
              }
              if (isHit) {
                onCategoryTapped(slice.summary)
                return@detectTapGestures
              }
            }
          }
        }
    ) {
      val canvasSize = size.minDimension
      val radius = (canvasSize - strokeWidthPx) / 2f
      val center = Offset(size.width / 2f, size.height / 2f)
      val gap = if (slices.size > 1) 2.5f else 0f

      slices.forEach { slice ->
        val cat = slice.summary
        val effectiveSweep = (slice.sweepAngle - gap).coerceAtLeast(1f)
        val isSelected = selectedCategory?.category?.id == cat.category.id
        val catColor = parseCategoryColor(cat.category.colorHex)

        val normalizedStartAngle = ((slice.startAngle + 90f) % 360f + 360f) % 360f - 90f
        drawArc(
          color = if (selectedCategory == null || isSelected) catColor else catColor.copy(alpha = 0.3f),
          startAngle = normalizedStartAngle + (gap / 2f),
          sweepAngle = effectiveSweep,
          useCenter = false,
          topLeft = Offset(center.x - radius, center.y - radius),
          size = Size(radius * 2f, radius * 2f),
          style = Stroke(
            width = if (isSelected) strokeWidthPx + 8.dp.toPx() else strokeWidthPx,
            cap = StrokeCap.Round
          )
        )
      }
    }

    // Semantics-only overlays keep each slice individually reachable by assistive tech and tests
    // without stealing touch events from the canvas gesture detector above.
    slices.forEach { slice ->
      val label = "${slice.summary.category.name}: ${slice.summary.totalHomeAmount.format()}, " +
        "${slice.summary.percentageOfTotal}% of total"
      Box(
        modifier = Modifier
          .matchParentSize()
          .semantics(mergeDescendants = true) {
            contentDescription = label
            role = Role.Button
            onClick {
              onCategoryTapped(slice.summary)
              true
            }
          }
      )
    }
  }
}

@Composable
private fun RankedCategoryBarRow(
  rank: Int,
  item: CategorySpendingSummary,
  maxAmount: BigDecimal,
  isSelected: Boolean,
  isHighCost: Boolean,
  onClick: () -> Unit
) {
  val progress = if (maxAmount > BigDecimal.ZERO) {
    (item.totalHomeAmount.amount.toDouble() / maxAmount.toDouble()).toFloat().coerceIn(0.05f, 1f)
  } else 0f

  val prefersReducedMotion = rememberPrefersReducedMotion()
  val animatedProgress by animateFloatAsState(
    targetValue = progress,
    animationSpec = if (prefersReducedMotion) snap() else PlutoMotion.NoBounceSpring,
    label = "category_bar_progress"
  )

  val categoryColor = parseCategoryColor(item.category.colorHex)

  Surface(
    shape = PlutoShapes.large,
    color = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.38f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.28f),
    border = BorderStroke(
      width = 1.dp,
      color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.45f) else MaterialTheme.colorScheme.outlineVariant
    ),
    modifier = Modifier
      .fillMaxWidth()
      .minimumInteractiveComponentSize()
      .clip(PlutoShapes.large)
      .clickable(role = Role.Button, onClick = onClick)
  ) {
    Column(modifier = Modifier.padding(12.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          // Rank pill (#1, #2, etc.)
          Surface(
            shape = PlutoShapes.small,
            color = if (rank == 1) categoryColor.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.padding(end = 8.dp)
          ) {
            Text(
              text = "#$rank",
              style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
              fontWeight = FontWeight.Bold,
              color = if (rank == 1) categoryColor else MaterialTheme.colorScheme.onSurfaceVariant,
              modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
          }

          // Category Color Indicator Dot
          Box(
            modifier = Modifier
              .size(10.dp)
              .clip(CircleShape)
              .background(categoryColor)
          )

          Spacer(modifier = Modifier.width(8.dp))

          Text(
            text = item.category.name,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
          )

          if (isHighCost) {
            Spacer(modifier = Modifier.width(6.dp))
            Surface(
              shape = PlutoShapes.small,
              color = MaterialTheme.colorScheme.errorContainer
            ) {
              Text(
                text = "HIGH COST",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.onErrorContainer,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
              )
            }
          }
        }

        // Amount & Percentage
        Column(horizontalAlignment = Alignment.End) {
          Text(
            text = item.totalHomeAmount.format(),
            style = MaterialTheme.typography.titleSmall.merge(PlutoNumericStyle),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
          Text(
            text = "${item.percentageOfTotal}% • ${item.transactionCount} txn",
            style = MaterialTheme.typography.labelSmall.merge(PlutoNumericStyle),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }

      Spacer(modifier = Modifier.height(8.dp))

      // Horizontal Bar
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(6.dp)
          .clip(PlutoShapes.extraSmall)
          .background(MaterialTheme.colorScheme.surfaceVariant)
      ) {
        Box(
          modifier = Modifier
            .fillMaxWidth(animatedProgress)
            .height(6.dp)
            .clip(PlutoShapes.extraSmall)
            .background(categoryColor)
        )
      }
    }
  }
}
