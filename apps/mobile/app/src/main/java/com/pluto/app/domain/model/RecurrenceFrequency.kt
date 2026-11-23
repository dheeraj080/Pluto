package com.pluto.app.domain.model

import java.util.Calendar

/**
 * Frequency options for automated recurring expenses (subscriptions and fixed costs).
 */
enum class RecurrenceFrequency(val label: String) {
  MONTHLY("Monthly"),
  WEEKLY("Weekly"),
  YEARLY("Yearly");

  fun getNextTimestamp(fromTimestamp: Long): Long {
    val cal = Calendar.getInstance().apply {
      timeInMillis = fromTimestamp
    }
    when (this) {
      WEEKLY -> cal.add(Calendar.WEEK_OF_YEAR, 1)
      MONTHLY -> cal.add(Calendar.MONTH, 1)
      YEARLY -> cal.add(Calendar.YEAR, 1)
    }
    return cal.timeInMillis
  }

  companion object {
    fun fromName(name: String?): RecurrenceFrequency? {
      if (name.isNullOrBlank()) return null
      return entries.find { it.name.equals(name, ignoreCase = true) }
    }
  }
}
