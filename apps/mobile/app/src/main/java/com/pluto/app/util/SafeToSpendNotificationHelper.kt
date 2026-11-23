package com.pluto.app.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.pluto.app.MainActivity
import com.pluto.app.domain.model.DashboardSummary
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Helper to dispatch proactive threshold warning notifications when remaining daily
 * Safe-to-Spend drops below the user-defined safety threshold.
 *
 * Adheres strictly to dual-currency presentation:
 * - Primary: Active Trip Currency (Destination)
 * - Secondary: Home Currency Equivalent
 */
class SafeToSpendNotificationHelper(
  private val context: Context
) {

  private val prefs = context.applicationContext.getSharedPreferences(
    PREFS_NAME,
    Context.MODE_PRIVATE
  )

  init {
    createNotificationChannel()
  }

  fun hasNotificationPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = CHANNEL_DESC
        enableVibration(true)
        setShowBadge(true)
      }
      notificationManager?.createNotificationChannel(channel)
    }
  }

  /**
   * Evaluates summary and dispatches a threshold breach warning notification if needed.
   *
   * @param summary The current dashboard summary
   * @param force Whether to ignore deduplication and fire immediately (e.g. for testing)
   * @return true if notification was dispatched, false otherwise
   */
  fun notifyThresholdBreach(
    summary: DashboardSummary,
    force: Boolean = false
  ): Boolean {
    if (!hasNotificationPermission()) {
      Log.d(TAG, "Notification permission not granted")
      return false
    }

    if (!summary.isWarningActive && !force) {
      return false
    }

    val todayKey = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    val remainingDouble = summary.safeToSpendTodayHome.amount.toDouble()

    if (!force) {
      val lastNotifiedDate = prefs.getString(KEY_LAST_NOTIFIED_DATE, null)
      val lastNotifiedAmount = prefs.getFloat(KEY_LAST_NOTIFIED_AMOUNT, Float.MAX_VALUE).toDouble()

      // If already alerted today and spending hasn't dropped further by at least 1.0, don't spam
      if (lastNotifiedDate == todayKey && remainingDouble >= lastNotifiedAmount - 1.0) {
        return false
      }
    }

    val isExceeded = summary.isDailyBudgetExceeded
    val tripRemaining = summary.safeToSpendTodayDest?.format() ?: summary.safeToSpendTodayHome.format()
    val homeRemaining = summary.safeToSpendTodayHome.format()
    val thresholdHome = summary.warningThresholdHome?.format() ?: "$20.00"
    val thresholdTrip = summary.warningThresholdDest?.format()

    val thresholdDesc = if (thresholdTrip != null) {
      "$thresholdTrip (≈ $thresholdHome)"
    } else {
      thresholdHome
    }

    val title = if (isExceeded) {
      "Daily Spending Budget Exceeded"
    } else {
      "Safe-to-Spend Below Safety Buffer"
    }

    val contentText = if (isExceeded) {
      "Remaining daily safe-to-spend is -$tripRemaining ($homeRemaining in Home). Slow down spending today!"
    } else {
      "Remaining: $tripRemaining (≈ $homeRemaining). Dropped below your $thresholdDesc safety minimum."
    }

    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(com.pluto.app.R.drawable.ic_notification_pluto)
      .setContentTitle(title)
      .setContentText(contentText)
      .setStyle(NotificationCompat.BigTextStyle().bigText(contentText))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()

    return try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      prefs.edit()
        .putString(KEY_LAST_NOTIFIED_DATE, todayKey)
        .putFloat(KEY_LAST_NOTIFIED_AMOUNT, remainingDouble.toFloat())
        .apply()
      true
    } catch (e: SecurityException) {
      Log.e(TAG, "Failed to post notification: permission denied", e)
      false
    }
  }

  /**
   * Dispatches a test notification so the user can immediately verify push notifications.
   */
  fun sendTestNotification(summary: DashboardSummary): Boolean {
    if (!hasNotificationPermission()) return false

    val tripRemaining = summary.safeToSpendTodayDest?.format() ?: summary.safeToSpendTodayHome.format()
    val homeRemaining = summary.safeToSpendTodayHome.format()
    val thresholdDesc = summary.warningThresholdDest?.format()?.let { "$it (≈ ${summary.warningThresholdHome?.format()})" }
      ?: summary.warningThresholdHome?.format() ?: "$20.00"

    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID + 1,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val body = "Test alert: Your daily safe-to-spend is $tripRemaining (≈ $homeRemaining). Safety buffer: $thresholdDesc."

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(com.pluto.app.R.drawable.ic_notification_pluto)
      .setContentTitle("Safe-to-Spend Alert Test")
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()

    return try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID + 1, notification)
      true
    } catch (e: SecurityException) {
      Log.e(TAG, "Test notification failed", e)
      false
    }
  }

  companion object {
    private const val TAG = "SafeToSpendNotify"
    const val CHANNEL_ID = "safe_to_spend_alerts"
    const val CHANNEL_NAME = "Safe-to-Spend Alerts"
    const val CHANNEL_DESC = "Notifications for when your daily safe-to-spend budget is low or exceeded."
    const val NOTIFICATION_ID = 40401

    private const val PREFS_NAME = "safe_to_spend_notification_state"
    private const val KEY_LAST_NOTIFIED_DATE = "key_last_notified_date"
    private const val KEY_LAST_NOTIFIED_AMOUNT = "key_last_notified_amount"
  }
}
