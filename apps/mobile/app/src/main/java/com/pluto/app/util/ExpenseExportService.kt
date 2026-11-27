package com.pluto.app.util

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.pluto.app.domain.model.CategorySpendingSummary
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Expense
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Service providing CSV and PDF report generation and sharing for Pluto travel expenses.
 * Allows users to export itemized monthly statements for accountants, tax filing, or personal records.
 */
object ExpenseExportService {

  private val csvDateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
  private val pdfHeaderDateFormat = SimpleDateFormat("MMMM d, yyyy 'at' HH:mm", Locale.US)
  private val pdfTableDateFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)

  /**
   * Generates a standard RFC 4180 CSV export of expenses.
   */
  fun generateCsv(
    expenses: List<Expense>,
    homeCurrency: Currency,
    periodTitle: String
  ): String {
    val sb = StringBuilder()

    // Header comment/metadata
    sb.append("# Pluto Travel Expense Report\n")
    sb.append("# Period: ").append(escapeCsv(periodTitle)).append("\n")
    sb.append("# Generated: ").append(csvDateFormat.format(Date())).append("\n")
    sb.append("# Home Equivalent: immutable snapshot recorded per transaction (current home: ${homeCurrency.code})\n\n")

    // Column Headers
    sb.append("Transaction ID,Date,Category,Merchant/Payee,Original Amount,Original Currency,Home Equivalent,Home Currency,Exchange Rate,Exchange Rate Date,Receipt Attached,Note\n")

    expenses.sortedByDescending { it.timestamp }.forEach { exp ->
      val receiptStatus = if (!exp.receiptUri.isNullOrBlank()) "YES" else "NO"
      val rateDate = csvDateFormat.format(Date(exp.exchangeRate.timestamp))

      sb.append(escapeCsv(exp.id)).append(",")
      sb.append(escapeCsv(csvDateFormat.format(Date(exp.timestamp)))).append(",")
      sb.append(escapeCsv(exp.category.name)).append(",")
      sb.append(escapeCsv(exp.merchant)).append(",")
      sb.append(exp.originalAmount.amount.toPlainString()).append(",")
      sb.append(escapeCsv(exp.originalCurrency.code)).append(",")
      sb.append(exp.homeAmount.amount.toPlainString()).append(",")
      sb.append(escapeCsv(exp.homeCurrency.code)).append(",")
      sb.append(exp.exchangeRate.rate.toPlainString()).append(",")
      sb.append(escapeCsv(rateDate)).append(",")
      sb.append(receiptStatus).append(",")
      sb.append(escapeCsv(exp.note))
      sb.append("\n")
    }

    return sb.toString()
  }

  /**
   * Generates a PDF statement document using Android's native PdfDocument.
   */
  fun generatePdf(
    context: Context,
    expenses: List<Expense>,
    categorySummaries: List<CategorySpendingSummary>,
    homeCurrency: Currency,
    periodTitle: String,
    totalHomeSpentStr: String
  ): File {
    val pdfDocument = PdfDocument()

    val pageWidth = 595 // Standard A4 width in points
    val pageHeight = 842 // Standard A4 height in points
    val margin = 40f
    val contentWidth = pageWidth - (margin * 2)

    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(30, 41, 59)
      textSize = 10f
    }
    val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(15, 23, 42)
      textSize = 20f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val subtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(0, 137, 123) // Pluto emerald accent
      textSize = 11f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val headerLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(100, 116, 139)
      textSize = 9f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(226, 232, 240)
      style = Paint.Style.STROKE
      strokeWidth = 1f
    }
    val cardBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(248, 250, 252)
      style = Paint.Style.FILL
    }
    val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(238, 242, 255)
      style = Paint.Style.FILL
    }

    var pageNumber = 1
    var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
    var currentPage = pdfDocument.startPage(pageInfo)
    var canvas = currentPage.canvas
    var yPos = margin

    // 1. Header & Title
    canvas.drawText("Pluto Travel Expense Report", margin, yPos + 18f, titlePaint)
    yPos += 24f
    canvas.drawText("ACCOUNTING STATEMENT • ${periodTitle.uppercase(Locale.US)}", margin, yPos + 10f, subtitlePaint)
    yPos += 18f

    val generatedDate = pdfHeaderDateFormat.format(Date())
    paint.color = Color.rgb(100, 116, 139)
    paint.textSize = 9f
    canvas.drawText("Generated on $generatedDate | Current Home: ${homeCurrency.code} | Home snapshots vary by transaction", margin, yPos + 10f, paint)
    yPos += 22f

    // Divider line
    canvas.drawLine(margin, yPos, pageWidth - margin, yPos, borderPaint)
    yPos += 14f

    // 2. Summary KPI Cards
    val kpiBoxWidth = (contentWidth - 20f) / 3f
    val kpiBoxHeight = 52f

    // KPI 1: Total Spending
    canvas.drawRoundRect(margin, yPos, margin + kpiBoxWidth, yPos + kpiBoxHeight, 8f, 8f, cardBgPaint)
    canvas.drawRoundRect(margin, yPos, margin + kpiBoxWidth, yPos + kpiBoxHeight, 8f, 8f, borderPaint)
    canvas.drawText("TOTAL EXPENDITURE", margin + 10f, yPos + 16f, headerLabelPaint)
    val totalAmountPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(0, 137, 123)
      textSize = 14f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    canvas.drawText(totalHomeSpentStr, margin + 10f, yPos + 38f, totalAmountPaint)

    // KPI 2: Transaction Count
    val kpi2X = margin + kpiBoxWidth + 10f
    canvas.drawRoundRect(kpi2X, yPos, kpi2X + kpiBoxWidth, yPos + kpiBoxHeight, 8f, 8f, cardBgPaint)
    canvas.drawRoundRect(kpi2X, yPos, kpi2X + kpiBoxWidth, yPos + kpiBoxHeight, 8f, 8f, borderPaint)
    canvas.drawText("TRANSACTIONS", kpi2X + 10f, yPos + 16f, headerLabelPaint)
    val countPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(15, 23, 42)
      textSize = 14f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    canvas.drawText("${expenses.size} Items", kpi2X + 10f, yPos + 38f, countPaint)

    // KPI 3: Top Category
    val topCat = categorySummaries.maxByOrNull { it.totalHomeAmount.amount }
    val kpi3X = kpi2X + kpiBoxWidth + 10f
    canvas.drawRoundRect(kpi3X, yPos, kpi3X + kpiBoxWidth, yPos + kpiBoxHeight, 8f, 8f, cardBgPaint)
    canvas.drawRoundRect(kpi3X, yPos, kpi3X + kpiBoxWidth, yPos + kpiBoxHeight, 8f, 8f, borderPaint)
    canvas.drawText("TOP SPEND CATEGORY", kpi3X + 10f, yPos + 16f, headerLabelPaint)
    val topCatLabel = if (topCat != null) "${topCat.category.name} (${topCat.percentageOfTotal}%)" else "None"
    canvas.drawText(topCatLabel, kpi3X + 10f, yPos + 38f, countPaint)

    yPos += kpiBoxHeight + 18f

    // 3. Category Breakdown Mini-Table
    val sectionHeaderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(15, 23, 42)
      textSize = 12f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    canvas.drawText("Category Spending Breakdown", margin, yPos + 12f, sectionHeaderPaint)
    yPos += 18f

    // Category table header
    canvas.drawRoundRect(margin, yPos, pageWidth - margin, yPos + 18f, 4f, 4f, highlightPaint)
    canvas.drawText("Category", margin + 8f, yPos + 13f, headerLabelPaint)
    canvas.drawText("Transactions", margin + 180f, yPos + 13f, headerLabelPaint)
    canvas.drawText("Amount (${homeCurrency.code})", margin + 300f, yPos + 13f, headerLabelPaint)
    canvas.drawText("Share", pageWidth - margin - 50f, yPos + 13f, headerLabelPaint)
    yPos += 20f

    categorySummaries.forEach { cat ->
      textPaint.color = Color.rgb(51, 65, 85)
      canvas.drawText(cat.category.name, margin + 8f, yPos + 11f, textPaint)
      canvas.drawText("${cat.transactionCount}", margin + 180f, yPos + 11f, textPaint)
      canvas.drawText(cat.totalHomeAmount.format(), margin + 300f, yPos + 11f, textPaint)
      canvas.drawText("${cat.percentageOfTotal}%", pageWidth - margin - 50f, yPos + 11f, textPaint)
      yPos += 16f
      canvas.drawLine(margin, yPos, pageWidth - margin, yPos, borderPaint)
      yPos += 4f
    }

    yPos += 14f

    // 4. Itemized Transaction Ledger Header
    canvas.drawText("Itemized Transactions", margin, yPos + 12f, sectionHeaderPaint)
    yPos += 18f

    fun drawTableHeader(curY: Float) {
      canvas.drawRoundRect(margin, curY, pageWidth - margin, curY + 20f, 4f, 4f, highlightPaint)
      canvas.drawText("Date", margin + 6f, curY + 14f, headerLabelPaint)
      canvas.drawText("Category", margin + 70f, curY + 14f, headerLabelPaint)
      canvas.drawText("Merchant / Payee", margin + 170f, curY + 14f, headerLabelPaint)
      canvas.drawText("Original (ISO)", margin + 320f, curY + 14f, headerLabelPaint)
      canvas.drawText("Home (ISO)", pageWidth - margin - 110f, curY + 14f, headerLabelPaint)
    }

    drawTableHeader(yPos)
    yPos += 24f

    // Draw transactions with pagination support
    val sortedExpenses = expenses.sortedByDescending { it.timestamp }
    sortedExpenses.forEachIndexed { index, exp ->
      // If remaining vertical space is less than required for row + footer, start new page
      if (yPos > pageHeight - margin - 40f) {
        // Draw page footer on old page
        val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          color = Color.rgb(148, 163, 184)
          textSize = 8f
        }
        canvas.drawText("Page $pageNumber • Pluto Cross-Currency Expense Tracker", margin, pageHeight - margin + 10f, footerPaint)

        pdfDocument.finishPage(currentPage)
        pageNumber++
        pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
        currentPage = pdfDocument.startPage(pageInfo)
        canvas = currentPage.canvas
        yPos = margin

        // Draw continued header
        canvas.drawText("Pluto Travel Expense Report (Continued)", margin, yPos + 14f, subtitlePaint)
        yPos += 20f
        drawTableHeader(yPos)
        yPos += 24f
      }

      val rowY = yPos
      val dateStr = pdfTableDateFormat.format(Date(exp.timestamp))
      val merchantStr = exp.merchant.ifBlank { exp.note.ifBlank { "—" } }.take(22)
      val origAmountStr = exp.originalAmount.formatWithCode()
      val homeAmountStr = exp.homeAmount.formatWithCode()

      textPaint.color = Color.rgb(30, 41, 59)
      canvas.drawText(dateStr, margin + 6f, rowY + 11f, textPaint)
      canvas.drawText(exp.category.name.take(14), margin + 70f, rowY + 11f, textPaint)
      canvas.drawText(merchantStr, margin + 170f, rowY + 11f, textPaint)
      canvas.drawText(origAmountStr, margin + 320f, rowY + 11f, textPaint)

      val homeBoldPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(15, 23, 42)
        textSize = 9.5f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      }
      canvas.drawText(homeAmountStr, pageWidth - margin - 110f, rowY + 11f, homeBoldPaint)

      yPos += 18f
      canvas.drawLine(margin, yPos, pageWidth - margin, yPos, borderPaint)
      yPos += 4f
    }

    // Final page footer
    val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(148, 163, 184)
      textSize = 8f
    }
    canvas.drawText("Page $pageNumber • Pluto Cross-Currency Expense Tracker • End of Report", margin, pageHeight - margin + 10f, footerPaint)

    pdfDocument.finishPage(currentPage)

    // Save PDF to cache reports dir
    val reportsDir = File(context.cacheDir, "reports").apply { mkdirs() }
    val cleanPeriod = periodTitle.replace(" ", "_").lowercase(Locale.US)
    val pdfFile = File(reportsDir, "pluto_expense_report_${cleanPeriod}_${System.currentTimeMillis()}.pdf")
    FileOutputStream(pdfFile).use { out ->
      pdfDocument.writeTo(out)
    }
    pdfDocument.close()

    return pdfFile
  }

  /**
   * Saves raw CSV string to cache reports directory and returns File.
   */
  fun saveCsvToCache(context: Context, csvContent: String, periodTitle: String): File {
    val reportsDir = File(context.cacheDir, "reports").apply { mkdirs() }
    val cleanPeriod = periodTitle.replace(" ", "_").lowercase(Locale.US)
    val csvFile = File(reportsDir, "pluto_expenses_${cleanPeriod}_${System.currentTimeMillis()}.csv")
    csvFile.writeText(csvContent, Charsets.UTF_8)
    return csvFile
  }

  /**
   * Launches system sharesheet via FileProvider to send CSV or PDF directly to accountants, email, or apps.
   */
  fun shareFile(context: Context, file: File, mimeType: String, title: String) {
    val contentUri: Uri = FileProvider.getUriForFile(
      context,
      "${context.packageName}.fileprovider",
      file
    )

    val shareIntent = Intent(Intent.ACTION_SEND).apply {
      type = mimeType
      putExtra(Intent.EXTRA_STREAM, contentUri)
      putExtra(Intent.EXTRA_SUBJECT, title)
      putExtra(Intent.EXTRA_TEXT, "Here is the $title generated from Pluto Expense Tracker.")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    val chooser = Intent.createChooser(shareIntent, title)
    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(chooser)
  }

  private fun escapeCsv(value: String): String {
    val escaped = value.replace("\"", "\"\"")
    return if (escaped.contains(",") || escaped.contains("\"") || escaped.contains("\n") || escaped.contains("\r")) {
      "\"$escaped\""
    } else {
      escaped
    }
  }
}
