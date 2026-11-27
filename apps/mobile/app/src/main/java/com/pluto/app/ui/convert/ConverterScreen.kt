package com.pluto.app.ui.convert

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.SwapVert
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.domain.model.Currency
import com.pluto.app.ui.components.PlutoButton
import com.pluto.app.ui.components.PlutoButtonVariant
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.PlutoTopBar
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.PlutoSpacing
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.theme.rememberPrefersReducedMotion

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConverterScreen(
  viewModel: ConverterViewModel,
  onOpenCurrencyPicker: (isSource: Boolean, current: Currency) -> Unit,
  onNavigateBack: (() -> Unit)? = null,
  modifier: Modifier = Modifier
) {
  val sourceCurrency by viewModel.sourceCurrency.collectAsStateWithLifecycle()
  val targetCurrency by viewModel.targetCurrency.collectAsStateWithLifecycle()
  val amountInput by viewModel.amountInput.collectAsStateWithLifecycle()
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val prefersReducedMotion = rememberPrefersReducedMotion()
  var swapTriggerCount by remember { mutableIntStateOf(0) }
  val swapRotation by animateFloatAsState(
    targetValue = swapTriggerCount * 180f,
    animationSpec = tween(
      durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.PressDurationMs,
      easing = FastOutSlowInEasing
    ),
    label = "converter_swap_rotation"
  )

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      PlutoTopBar(
        title = "Currency Converter",
        onNavigateBack = onNavigateBack,
        titleStyle = MaterialTheme.typography.titleLarge,
        backButtonTestTag = "converter_back_button",
        actions = {
          IconButton(
            onClick = { viewModel.retry() },
            modifier = Modifier
              .minimumInteractiveComponentSize()
              .testTag("converter_refresh_button")
          ) {
            Icon(
              imageVector = Icons.Rounded.Refresh,
              contentDescription = "Refresh exchange rate"
            )
          }
        }
      )
    }
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding),
      contentAlignment = Alignment.TopCenter
    ) {
      Column(
        modifier = Modifier
          .widthIn(max = 640.dp)
          .fillMaxSize()
          .verticalScroll(rememberScrollState())
          .padding(horizontal = 20.dp, vertical = 12.dp)
      ) {
      Text(
        text = "Foreign Exchange Rate",
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.plutoHeading()
      )
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = "Real-time rates with offline caching for multi-currency budgets and spending.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      Spacer(modifier = Modifier.height(20.dp))

      // Source Currency Card & Input (20dp outer = 14dp padding + 6dp inner radius)
      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.extraLarge,
        testTag = "converter_source_card"
      ) {
        Column(modifier = Modifier.padding(14.dp)) {
          Text(
            text = "YOU CONVERT FROM",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
          )

          Spacer(modifier = Modifier.height(10.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
          ) {
            val sourcePickerInteraction = remember { MutableInteractionSource() }
            // Currency Selector Pill
            Surface(
              shape = PlutoShapes.small,
              color = MaterialTheme.colorScheme.surfaceVariant,
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .clip(PlutoShapes.small)
                .plutoPressableScale(
                  enabled = true,
                  pressedScale = PlutoMotion.PressScale,
                  interactionSource = sourcePickerInteraction
                )
                .clickable(
                  interactionSource = sourcePickerInteraction,
                  indication = androidx.compose.material3.ripple(),
                  role = Role.Button
                ) { onOpenCurrencyPicker(true, sourceCurrency) }
                .testTag("converter_source_currency_selector")
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                if (sourceCurrency.flagEmoji.isNotBlank()) {
                  Text(text = sourceCurrency.flagEmoji, fontSize = 20.sp)
                  Spacer(modifier = Modifier.width(6.dp))
                }
                Text(
                  text = sourceCurrency.code,
                  style = MaterialTheme.typography.titleMedium,
                  fontWeight = FontWeight.Bold
                )
              }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Amount Input Field
            OutlinedTextField(
              value = amountInput,
              onValueChange = viewModel::onAmountChanged,
              modifier = Modifier
                .weight(1f)
                .testTag("converter_amount_input"),
              textStyle = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle).copy(
                fontWeight = FontWeight.SemiBold
              ),
              placeholder = {
                Text(
                  text = sourceCurrency.zeroPlaceholder(),
                  style = MaterialTheme.typography.titleLarge.merge(PlutoNumericStyle)
                )
              },
              singleLine = true,
              keyboardOptions = KeyboardOptions(
                keyboardType = if (sourceCurrency.decimalPlaces == 0) KeyboardType.Number else KeyboardType.Decimal
              ),
              shape = PlutoShapes.small
            )
          }
        }
      }

      // Swap Control Button
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
      ) {
        val swapInteraction = remember { MutableInteractionSource() }
        IconButton(
          onClick = {
            swapTriggerCount += 1
            viewModel.swapCurrencies()
          },
          interactionSource = swapInteraction,
          modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(48.dp)
            .plutoPressableScale(
              enabled = true,
              pressedScale = PlutoMotion.PressScale,
              interactionSource = swapInteraction
            )
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer)
            .testTag("converter_swap_button")
        ) {
          Icon(
            imageVector = Icons.Rounded.SwapVert,
            contentDescription = "Swap currencies",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.graphicsLayer {
              rotationZ = swapRotation
            }
          )
        }
      }

      // Target Currency Card (20dp outer = 14dp padding + 6dp inner radius)
      PlutoCard(
        modifier = Modifier.fillMaxWidth(),
        shape = PlutoShapes.extraLarge,
        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
        testTag = "converter_target_card"
      ) {
        Column(modifier = Modifier.padding(14.dp)) {
          Text(
            text = "YOU CONVERT TO",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
          )

          Spacer(modifier = Modifier.height(10.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
          ) {
            val targetPickerInteraction = remember { MutableInteractionSource() }
            Surface(
              shape = PlutoShapes.small,
              color = MaterialTheme.colorScheme.surfaceVariant,
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .clip(PlutoShapes.small)
                .plutoPressableScale(
                  enabled = true,
                  pressedScale = PlutoMotion.PressScale,
                  interactionSource = targetPickerInteraction
                )
                .clickable(
                  interactionSource = targetPickerInteraction,
                  indication = androidx.compose.material3.ripple(),
                  role = Role.Button
                ) { onOpenCurrencyPicker(false, targetCurrency) }
                .testTag("converter_target_currency_selector")
            ) {
              Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                if (targetCurrency.flagEmoji.isNotBlank()) {
                  Text(text = targetCurrency.flagEmoji, fontSize = 20.sp)
                  Spacer(modifier = Modifier.width(6.dp))
                }
                Text(
                  text = targetCurrency.code,
                  style = MaterialTheme.typography.titleMedium,
                  fontWeight = FontWeight.Bold
                )
              }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Dynamic Result Representation
            Column(modifier = Modifier.weight(1f)) {
              when (val state = uiState) {
                is ConverterUiState.Loading -> {
                  Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(
                      modifier = Modifier
                        .size(24.dp)
                        .testTag("converter_loading_indicator"),
                      strokeWidth = 2.5.dp
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                      text = "Calculating...",
                      style = MaterialTheme.typography.bodyMedium,
                      color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                  }
                }

                is ConverterUiState.Success -> {
                  Text(
                    text = state.result.convertedMoney.format(),
                    style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.testTag("converter_result_text")
                  )
                  Spacer(modifier = Modifier.height(2.dp))
                  Text(
                    text = state.rateFormatted,
                    style = MaterialTheme.typography.bodySmall.merge(PlutoNumericStyle),
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.testTag("converter_rate_formatted")
                  )
                }

                is ConverterUiState.RateUnavailable -> {
                  Text(
                    text = "${targetCurrency.symbol} --",
                    style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                  Text(
                    text = "Rate unavailable offline",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("converter_rate_unavailable_text")
                  )
                }

                is ConverterUiState.Error -> {
                  Text(
                    text = "Conversion Error",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.error
                  )
                  Text(
                    text = state.message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                  )
                }

                ConverterUiState.Idle -> {
                  Text(
                    text = "${targetCurrency.symbol} 0.00",
                    style = MaterialTheme.typography.headlineMedium.merge(PlutoNumericStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                  )
                }
              }
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(20.dp))

      // Freshness & State Info Card
      when (val state = uiState) {
        is ConverterUiState.Success -> {
          Surface(
            shape = PlutoShapes.large,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier
              .fillMaxWidth()
              .testTag("converter_freshness_card")
          ) {
            Row(
              modifier = Modifier.padding(16.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
              )
              Spacer(modifier = Modifier.width(12.dp))
              Column {
                Text(
                  text = state.freshnessLabel,
                  style = MaterialTheme.typography.titleSmall,
                  fontWeight = FontWeight.SemiBold
                )
                Text(
                  text = "Original value (${state.originalMoney.format()}) is strictly preserved.",
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
          }
        }

        is ConverterUiState.RateUnavailable -> {
          Surface(
            shape = PlutoShapes.large,
            color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f),
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier.padding(16.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.WarningAmber,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
                modifier = Modifier.size(20.dp)
              )
              Spacer(modifier = Modifier.width(12.dp))
              Column(modifier = Modifier.weight(1f)) {
                Text(
                  text = "Rate Unavailable",
                  style = MaterialTheme.typography.titleSmall,
                  fontWeight = FontWeight.SemiBold,
                  color = MaterialTheme.colorScheme.error
                )
                Text(
                  text = state.reason,
                  style = MaterialTheme.typography.bodySmall,
                  color = MaterialTheme.colorScheme.onErrorContainer
                )
              }
              PlutoButton(
                text = "Retry",
                onClick = { viewModel.retry() },
                variant = PlutoButtonVariant.OUTLINED,
                modifier = Modifier.padding(start = PlutoSpacing.sm)
              )
            }
          }
        }

        else -> {
          Surface(
            shape = PlutoShapes.large,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
            modifier = Modifier.fillMaxWidth()
          ) {
            Row(
              modifier = Modifier.padding(16.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
              )
              Spacer(modifier = Modifier.width(12.dp))
              Text(
                text = "Enter any amount to convert with real-time and cached market rates.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(24.dp))
      }
    }
  }
}
