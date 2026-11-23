package com.pluto.app.policy

import android.Manifest
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.test.core.app.ApplicationProvider
import com.pluto.app.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class PlayPolicyAndAssetsTest {

  @Test
  fun `manifest avoids broad media permissions and disables insecure auto-backup`() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    val packageInfo = context.packageManager.getPackageInfo(
      context.packageName,
      PackageManager.GET_PERMISSIONS
    )

    val requested = packageInfo.requestedPermissions?.toSet().orEmpty()
    assertTrue("INTERNET permission missing", Manifest.permission.INTERNET in requested)
    assertTrue("POST_NOTIFICATIONS permission missing", Manifest.permission.POST_NOTIFICATIONS in requested)
    assertTrue("USE_BIOMETRIC permission missing", Manifest.permission.USE_BIOMETRIC in requested)

    assertFalse("Broad READ_EXTERNAL_STORAGE must not be declared", Manifest.permission.READ_EXTERNAL_STORAGE in requested)
    assertFalse("Broad READ_MEDIA_IMAGES must not be declared", Manifest.permission.READ_MEDIA_IMAGES in requested)
    assertFalse("Broad READ_MEDIA_VIDEO must not be declared", Manifest.permission.READ_MEDIA_VIDEO in requested)

    val appInfo = packageInfo.applicationInfo
    assertNotNull(appInfo)
    assertEquals(0, appInfo!!.flags and ApplicationInfo.FLAG_ALLOW_BACKUP)
  }

  @Test
  fun `app identity string and generated visual assets and fonts resolve cleanly`() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    assertEquals("Pluto", context.getString(R.string.app_name))

    assertNotNull(ContextCompat.getDrawable(context, R.drawable.img_onboarding_hero))
    assertNotNull(ContextCompat.getDrawable(context, R.drawable.img_empty_expenses))
    assertNotNull(ContextCompat.getDrawable(context, R.drawable.img_empty_wallets))
    assertNotNull(ContextCompat.getDrawable(context, R.drawable.ic_notification_pluto))
    assertNotNull(ContextCompat.getDrawable(context, R.drawable.ic_launcher_foreground))

    context.resources.openRawResource(R.font.plus_jakarta_sans).use { stream ->
      assertTrue(stream.available() > 1024)
    }
    context.resources.openRawResource(R.font.jetbrains_mono).use { stream ->
      assertTrue(stream.available() > 1024)
    }
  }
}
