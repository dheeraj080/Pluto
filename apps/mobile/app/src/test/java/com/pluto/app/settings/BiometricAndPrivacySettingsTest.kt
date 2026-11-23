package com.pluto.app.settings

import androidx.test.core.app.ApplicationProvider
import com.pluto.app.data.repository.SharedPreferencesUserSettingsRepository
import com.pluto.app.util.BiometricSecurityManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class BiometricAndPrivacySettingsTest {

  @Test
  fun `sharedPreferences repository saves and reads biometric lock and privacy mode`() = runBlocking {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    val repository = SharedPreferencesUserSettingsRepository(context)

    // Defaults
    val initial = repository.getSettings()
    assertFalse(initial.isBiometricLockEnabled)
    assertFalse(initial.isPrivacyModeEnabled)
    assertEquals(1, initial.autoLockTimeoutMinutes)

    // Enable Biometric Lock with 5-minute timeout
    repository.updateBiometricLock(enabled = true, timeoutMinutes = 5)
    val afterLock = repository.getSettings()
    assertTrue(afterLock.isBiometricLockEnabled)
    assertEquals(5, afterLock.autoLockTimeoutMinutes)
    assertEquals(true, repository.observeSettings().first().isBiometricLockEnabled)

    // Enable Privacy Mode
    repository.updatePrivacyMode(enabled = true)
    val afterPrivacy = repository.getSettings()
    assertTrue(afterPrivacy.isPrivacyModeEnabled)
    assertEquals(true, repository.observeSettings().first().isPrivacyModeEnabled)

    // Disable Privacy Mode
    repository.updatePrivacyMode(enabled = false)
    assertFalse(repository.getSettings().isPrivacyModeEnabled)
  }

  @Test
  fun `biometricSecurityManager handles locking and unlocking correctly`() {
    BiometricSecurityManager.unlockApp()
    assertFalse(BiometricSecurityManager.isAppLocked.value)

    BiometricSecurityManager.lockApp()
    assertTrue(BiometricSecurityManager.isAppLocked.value)

    BiometricSecurityManager.unlockApp()
    assertFalse(BiometricSecurityManager.isAppLocked.value)
  }
}
