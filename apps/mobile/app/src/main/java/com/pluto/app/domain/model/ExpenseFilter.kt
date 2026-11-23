package com.pluto.app.domain.model

import java.util.Calendar

/**
 * Filter criteria for expenses.
 */
enum class DateRangeFilter(val label: String) {
  ALL("All Time"),
  TODAY("Today"),
  THIS_WEEK("This Week"),
  THIS_MONTH("This Month"),
  CUSTOM("Custom Range");

  fun getBounds(customStart: Long? = null, customEnd: Long? = null): Pair<Long, Long>? {
    val now = Calendar.getInstance()
    return when (this) {
      ALL -> null
      TODAY -> {
        val start = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        val end = Calendar.getInstance().apply {
          set(Calendar.HOUR_OF_DAY, 23)
          set(Calendar.MINUTE, 59)
          set(Calendar.SECOND, 59)
          set(Calendar.MILLISECOND, 999)
        }
        Pair(start.timeInMillis, end.timeInMillis)
      }
      THIS_WEEK -> {
        val start = Calendar.getInstance().apply {
          set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        Pair(start.timeInMillis, now.timeInMillis + 86400000L)
      }
      THIS_MONTH -> {
        val start = Calendar.getInstance().apply {
          set(Calendar.DAY_OF_MONTH, 1)
          set(Calendar.HOUR_OF_DAY, 0)
          set(Calendar.MINUTE, 0)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
        Pair(start.timeInMillis, now.timeInMillis + 86400000L)
      }
      CUSTOM -> {
        if (customStart == null && customEnd == null) null
        else {
          val start = customStart ?: 0L
          val end = customEnd ?: Long.MAX_VALUE
          Pair(start, end)
        }
      }
    }
  }
}

data class ExpenseFilter(
  val searchQuery: String = "",
  val selectedCategoryId: String? = null,
  val dateRange: DateRangeFilter = DateRangeFilter.ALL,
  val customStartDateMillis: Long? = null,
  val customEndDateMillis: Long? = null
) {
  val isActive: Boolean
    get() = searchQuery.isNotBlank() || selectedCategoryId != null || dateRange != DateRangeFilter.ALL

  fun matches(expense: Expense): Boolean {
    // 1. Search Query (matches merchant or note or category name)
    if (searchQuery.isNotBlank()) {
      val query = searchQuery.trim()
      val matchesMerchant = expense.merchant.contains(query, ignoreCase = true)
      val matchesNote = expense.note.contains(query, ignoreCase = true)
      val matchesCategory = expense.category.name.contains(query, ignoreCase = true)
      val matchesCurrency = expense.originalCurrency.code.contains(query, ignoreCase = true)
      if (!matchesMerchant && !matchesNote && !matchesCategory && !matchesCurrency) {
        return false
      }
    }

    // 2. Category filter
    if (selectedCategoryId != null && expense.category.id != selectedCategoryId) {
      return false
    }

    // 3. Date Range filter
    val bounds = dateRange.getBounds(customStartDateMillis, customEndDateMillis)
    if (bounds != null) {
      val (start, end) = bounds
      if (expense.timestamp < start || expense.timestamp > end) {
        return false
      }
    }

    return true
  }
}
