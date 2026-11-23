package com.pluto.app.util

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Handles hardware biometric authentication, system device credential fallback (PIN/Pattern),
 * and session background lock timeout policies for Pluto.
 */
object BiometricSecurityManager {

  private val _isAppLocked = MutableStateFlow(false)
  val isAppLocked: StateFlow<Boolean> = _isAppLocked.asStateFlow()

  private var lastBackgroundTimeMillis: Long = 0L

  /**
   * Checks whether the user's Android device supports biometric hardware or screen lock security.
   */
  fun canAuthenticate(context: Context): Boolean {
    val biometricManager = BiometricManager.from(context)
    val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL
    return biometricManager.canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS
  }

  /**
   * Called when the app moves to background to record the timestamp for auto-lock timeout.
   */
  fun onAppBackgrounded() {
    lastBackgroundTimeMillis = System.currentTimeMillis()
  }

  /**
   * Called when the app is brought to foreground to evaluate if the lock screen must be engaged.
   */
  fun onAppForegrounded(isBiometricEnabled: Boolean, timeoutMinutes: Int) {
    if (!isBiometricEnabled) {
      _isAppLocked.value = false
      return
    }

    // If already locked, keep locked
    if (_isAppLocked.value) return

    val elapsed = System.currentTimeMillis() - lastBackgroundTimeMillis
    val timeoutMillis = timeoutMinutes * 60 * 1000L

    if (lastBackgroundTimeMillis == 0L || elapsed >= timeoutMillis) {
      _isAppLocked.value = true
    }
  }

  /**
   * Forces the lock state immediately (e.g. on manual lock or initial cold launch).
   */
  fun lockApp() {
    _isAppLocked.value = true
  }

  /**
   * Unlocks the app following successful authentication.
   */
  fun unlockApp() {
    _isAppLocked.value = false
    lastBackgroundTimeMillis = System.currentTimeMillis()
  }

  /**
   * Launches Android BiometricPrompt with biometric or device PIN/pattern fallback.
   */
  fun authenticate(
    activity: FragmentActivity,
    title: String = "Unlock Pluto",
    subtitle: String = "Authenticate to access your multi-currency finances",
    onSuccess: () -> Unit,
    onError: (String) -> Unit
  ) {
    val executor = ContextCompat.getMainExecutor(activity)

    val callback = object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        super.onAuthenticationSucceeded(result)
        unlockApp()
        onSuccess()
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        super.onAuthenticationError(errorCode, errString)
        if (errorCode != BiometricPrompt.ERROR_USER_CANCELED &&
            errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
          onError(errString.toString())
        }
      }

      override fun onAuthenticationFailed() {
        super.onAuthenticationFailed()
        // Failed attempt (fingerprint unrecognised, user can try again)
      }
    }

    try {
      val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle(title)
        .setSubtitle(subtitle)
        .setAllowedAuthenticators(
          BiometricManager.Authenticators.BIOMETRIC_STRONG or
              BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        .build()

      val biometricPrompt = BiometricPrompt(activity, executor, callback)
      biometricPrompt.authenticate(promptInfo)
    } catch (e: Exception) {
      onError(e.message ?: "Biometric prompt initialization failed")
    }
  }
}
