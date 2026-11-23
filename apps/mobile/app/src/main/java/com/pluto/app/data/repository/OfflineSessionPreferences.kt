package com.pluto.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Device-local session store tracking whether the user chose to enter Pluto in Offline Mode.
 * Stored purely locally outside synced cloud preferences so offline state persists across restarts
 * without interfering with Firestore schemas or other signed-in devices.
 */
class OfflineSessionPreferences(context: Context) {

  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private val _isOfflineMode = MutableStateFlow(
    prefs.getBoolean(KEY_OFFLINE_MODE_ENABLED, false)
  )
  val isOfflineMode: StateFlow<Boolean> = _isOfflineMode.asStateFlow()

  fun setOfflineMode(enabled: Boolean) {
    prefs.edit()
      .putBoolean(KEY_OFFLINE_MODE_ENABLED, enabled)
      .apply()
    _isOfflineMode.value = enabled
  }

  companion object {
    private const val PREFS_NAME = "pluto_offline_session"
    private const val KEY_OFFLINE_MODE_ENABLED = "key_offline_mode_enabled"
  }
}
