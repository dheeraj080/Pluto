package com.pluto.app.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Global application crash state holder.
 */
object GlobalCrashReporter {
  val uncaughtError = MutableStateFlow<Throwable?>(null)

  fun triggerError(throwable: Throwable) {
    uncaughtError.value = throwable
  }

  fun clear() {
    uncaughtError.value = null
  }
}

/**
 * Production Crash & Error Boundary Composable.
 * Prevents abrupt white-screen crashes, safeguards data integrity, and provides a polite recovery flow.
 */
@Composable
fun PlutoErrorBoundary(
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit
) {
  val caughtError by GlobalCrashReporter.uncaughtError.collectAsState()

  DisposableEffect(Unit) {
    val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { _, throwable ->
      // Handle in-app so the recovery screen can render instead of killing the process.
      Log.e("PlutoCrash", "Uncaught exception handled in-app", throwable)
      GlobalCrashReporter.uncaughtError.value = throwable
    }
    onDispose {
      Thread.setDefaultUncaughtExceptionHandler(defaultHandler)
    }
  }

  if (caughtError == null) {
    Box(modifier = modifier) {
      content()
    }
  } else {
    ErrorRecoveryScreen(
      throwable = caughtError!!,
      onReset = { GlobalCrashReporter.clear() },
      modifier = modifier
    )
  }
}

@Composable
fun ErrorRecoveryScreen(
  throwable: Throwable,
  onReset: () -> Unit,
  modifier: Modifier = Modifier
) {
  val context = LocalContext.current
  val scrollState = rememberScrollState()

  Scaffold(
    modifier = modifier
      .fillMaxSize()
      .testTag("error_recovery_screen"),
    containerColor = MaterialTheme.colorScheme.background,
    contentWindowInsets = WindowInsets.safeDrawing
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding),
      contentAlignment = Alignment.Center
    ) {
      Column(
        modifier = Modifier
          .widthIn(max = 480.dp)
          .fillMaxWidth()
          .verticalScroll(scrollState)
          .padding(PlutoSpacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
      ) {
        Surface(
          shape = CircleShape,
          color = MaterialTheme.colorScheme.errorContainer,
          modifier = Modifier.size(76.dp)
        ) {
          Box(contentAlignment = Alignment.Center) {
            Icon(
              imageVector = Icons.Rounded.Warning,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.error,
              modifier = Modifier.size(38.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(PlutoSpacing.xl))

        Text(
          text = "Pluto Encountered an Issue",
          style = MaterialTheme.typography.headlineSmall,
          fontWeight = FontWeight.Bold,
          textAlign = TextAlign.Center,
          color = MaterialTheme.colorScheme.onBackground,
          modifier = Modifier.plutoHeading()
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.sm))

        Text(
          text = "Don't worry — your offline transactions, travel wallets, and budgets remain safe in local storage.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          textAlign = TextAlign.Center,
          modifier = Modifier.padding(horizontal = PlutoSpacing.md)
        )

        Spacer(modifier = Modifier.height(PlutoSpacing.xl))

        PlutoCard(
          shape = PlutoShapes.large,
          containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(modifier = Modifier.padding(PlutoSpacing.lg)) {
            Text(
              text = "Error Diagnostics",
              style = MaterialTheme.typography.labelMedium,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(PlutoSpacing.xs))
            Text(
              text = "${throwable::class.simpleName ?: "Exception"}: ${throwable.message ?: "Unknown runtime issue"}",
              style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle).copy(
                fontSize = 11.sp
              ),
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }

        Spacer(modifier = Modifier.height(PlutoSpacing.xxl))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(PlutoSpacing.md)
        ) {
          PlutoButton(
            text = "Copy Log",
            onClick = {
              val clip = ClipData.newPlainText(
                "Pluto Error Log",
                "${throwable::class.java.name}: ${throwable.message}\n" +
                  throwable.stackTrace.take(8).joinToString("\n")
              )
              val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
              clipboard?.setPrimaryClip(clip)
              Toast.makeText(context, "Error details copied to clipboard", Toast.LENGTH_SHORT).show()
            },
            variant = PlutoButtonVariant.OUTLINED,
            leadingIcon = Icons.Rounded.ContentCopy,
            modifier = Modifier.weight(1f),
            testTag = "error_copy_log_button"
          )

          PlutoButton(
            text = "Continue",
            onClick = onReset,
            variant = PlutoButtonVariant.PRIMARY,
            leadingIcon = Icons.Rounded.Refresh,
            modifier = Modifier.weight(1f),
            testTag = "error_continue_button"
          )
        }
      }
    }
  }
}
