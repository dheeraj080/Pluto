package com.pluto.app.ui.onboarding

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.R
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.Money
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.CurrencyRow
import com.pluto.app.ui.components.PlutoCard
import com.pluto.app.ui.components.PrimaryActionButton
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoResponsive
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.theme.rememberPrefersReducedMotion
import java.math.BigDecimal
import java.math.RoundingMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
  viewModel: OnboardingViewModel,
  onOnboardingFinished: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  val prefersReducedMotion = rememberPrefersReducedMotion()

  BackHandler(enabled = uiState.currentStep > 1) {
    viewModel.previousStep()
  }

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        title = {
          // Animated Progress Dots
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
          ) {
            repeat(uiState.totalSteps) { index ->
              val step = index + 1
              val isActive = step == uiState.currentStep
              val isPast = step < uiState.currentStep
              val dotWidth by animateDpAsState(
                targetValue = if (isActive) 24.dp else 8.dp,
                animationSpec = tween(
                  durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.StateDurationMs,
                  easing = FastOutSlowInEasing
                ),
                label = "onboarding_dot_width"
              )
              val dotColor by animateColorAsState(
                targetValue = when {
                  isActive -> MaterialTheme.colorScheme.primary
                  isPast -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                  else -> MaterialTheme.colorScheme.surfaceVariant
                },
                animationSpec = tween(
                  durationMillis = if (prefersReducedMotion) 0 else PlutoMotion.StateDurationMs,
                  easing = FastOutSlowInEasing
                ),
                label = "onboarding_dot_color"
              )
              Box(
                modifier = Modifier
                  .padding(horizontal = 4.dp)
                  .size(dotWidth, 8.dp)
                  .clip(CircleShape)
                  .background(dotColor)
              )
            }
          }
        },
        navigationIcon = {
          if (uiState.currentStep > 1) {
            IconButton(
              onClick = { viewModel.previousStep() },
              modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("onboarding_back_button")
            ) {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = "Back"
              )
            }
          } else {
            Spacer(modifier = Modifier.size(48.dp))
          }
        },
        actions = {
          Spacer(modifier = Modifier.size(48.dp))
        },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.background
        )
      )
    }
  ) { innerPadding ->
    AnimatedContent(
      targetState = uiState.currentStep,
      transitionSpec = {
        if (prefersReducedMotion) {
          fadeIn(tween(0)).togetherWith(fadeOut(tween(0)))
        } else if (targetState > initialState) {
          (slideInHorizontally(tween(PlutoMotion.EntranceDurationMs, easing = FastOutSlowInEasing)) { width -> width } +
            fadeIn(tween(PlutoMotion.StateDurationMs))).togetherWith(
            slideOutHorizontally(tween(PlutoMotion.EntranceDurationMs, easing = FastOutSlowInEasing)) { width -> -width } +
              fadeOut(tween(PlutoMotion.PressDurationMs))
          )
        } else {
          (slideInHorizontally(tween(PlutoMotion.EntranceDurationMs, easing = FastOutSlowInEasing)) { width -> -width } +
            fadeIn(tween(PlutoMotion.StateDurationMs))).togetherWith(
            slideOutHorizontally(tween(PlutoMotion.EntranceDurationMs, easing = FastOutSlowInEasing)) { width -> width } +
              fadeOut(tween(PlutoMotion.PressDurationMs))
          )
        }
      },
      label = "onboarding_step_animation",
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
    ) { step ->
      Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
      ) {
        Box(
          modifier = Modifier
            .widthIn(max = 600.dp)
            .fillMaxSize()
        ) {
          when (step) {
            1 -> WelcomeStep(onGetStarted = { viewModel.nextStep() })
            2 -> CurrencySelectionStep(
              stepTitle = "What's your reference currency?",
              stepSubtitle = "We'll use this reference currency to calculate your overall spending, monthly budgets, and accounting totals.",
              selectedCurrency = uiState.homeCurrency,
              searchQuery = uiState.searchQuery,
              currencies = uiState.filteredCurrencies,
              quickPickCurrencies = listOf(Currency.USD, Currency.EUR, Currency.GBP, Currency.CAD, Currency.AUD, Currency.JPY),
              onSearchChange = viewModel::onSearchQueryChanged,
              onCurrencySelected = viewModel::onHomeCurrencySelected,
              onContinue = { viewModel.nextStep() },
              continueButtonText = "Continue with ${uiState.homeCurrency.code} (${uiState.homeCurrency.symbol})",
              searchTestTag = "onboarding_currency_search",
              listTestTag = "onboarding_currency_list",
              continueButtonTestTag = "onboarding_continue_button"
            )
            3 -> CurrencySelectionStep(
              stepTitle = "Which currency do you spend in?",
              stepSubtitle = "Select your local spending currency. Expenses will be logged in this currency and converted live to ${uiState.homeCurrency.code}.",
              selectedCurrency = uiState.destinationCurrency,
              searchQuery = uiState.searchQuery,
              currencies = uiState.filteredCurrencies,
              quickPickCurrencies = listOf(Currency.EUR, Currency.JPY, Currency.GBP, Currency.THB, Currency.CAD, Currency.AUD),
              onSearchChange = viewModel::onSearchQueryChanged,
              onCurrencySelected = viewModel::onDestinationCurrencySelected,
              onContinue = { viewModel.nextStep() },
              continueButtonText = "Use ${uiState.destinationCurrency.code} (${uiState.destinationCurrency.symbol}) as primary currency",
              searchTestTag = "onboarding_destination_currency_search",
              listTestTag = "onboarding_destination_currency_list",
              continueButtonTestTag = "onboarding_destination_continue_button"
            )
            4 -> ReadyStep(
              uiState = uiState,
              onSwapCurrencies = viewModel::onSwapCurrencies,
              onTermNameChanged = viewModel::onTermNameChanged,
              onAllowanceChanged = viewModel::onSemesterAllowanceChanged,
              onTuitionChanged = viewModel::onTuitionAndFixedChanged,
              onTermDaysChanged = viewModel::onTermDaysChanged,
              onDailyCapChanged = viewModel::onDailyCapChanged,
              onMonthlyCapChanged = viewModel::onMonthlyCapChanged,
              onTripBudgetChanged = viewModel::onTripBudgetChanged,
              onComplete = {
                viewModel.completeOnboarding(onSuccess = onOnboardingFinished)
              }
            )
          }
        }
      }
    }
  }
}

@Composable
private fun WelcomeStep(
  onGetStarted: () -> Unit,
  modifier: Modifier = Modifier
) {
  BoxWithConstraints(
    modifier = modifier.fillMaxSize()
  ) {
    val isShortHeight = maxHeight < PlutoResponsive.ShortHeight
    val heroHeight = if (isShortHeight) 120.dp else 190.dp
    val sectionSpacing = if (isShortHeight) 16.dp else 28.dp
    val copySpacing = if (isShortHeight) 10.dp else 16.dp
    val featureSpacing = if (isShortHeight) 16.dp else 32.dp

    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 24.dp, vertical = if (isShortHeight) 12.dp else 20.dp)
    ) {
      // Only the copy scrolls; the CTA stays pinned to the bottom of the available height.
      Column(
        modifier = Modifier
          .weight(1f)
          .fillMaxWidth()
          .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Spacer(modifier = Modifier.height(if (isShortHeight) 8.dp else 16.dp))

        Image(
          painter = painterResource(id = R.drawable.img_onboarding_hero),
          contentDescription = "Pluto multi-currency finance illustration",
          contentScale = ContentScale.Crop,
          modifier = Modifier
            .fillMaxWidth()
            .height(heroHeight)
            .clip(PlutoShapes.extraLarge)
            .border(
              width = 1.dp,
              color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
              shape = PlutoShapes.extraLarge
            )
            .testTag("onboarding_hero_image")
        )

        Spacer(modifier = Modifier.height(sectionSpacing))

        Text(
          text = "Your money, wherever life takes you.",
          style = MaterialTheme.typography.headlineMedium,
          fontWeight = FontWeight.Bold,
          textAlign = TextAlign.Center,
          color = MaterialTheme.colorScheme.onBackground,
          modifier = Modifier.plutoHeading()
        )

        Spacer(modifier = Modifier.height(copySpacing))

        Text(
          text = "Track expenses, convert currencies in real-time, and understand your spending across countries with ease.",
          style = MaterialTheme.typography.bodyLarge,
          textAlign = TextAlign.Center,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          lineHeight = 24.sp
        )

        Spacer(modifier = Modifier.height(featureSpacing))

        // Feature highlights
        Surface(
          shape = PlutoShapes.large,
          color = MaterialTheme.colorScheme.surface,
          modifier = Modifier.fillMaxWidth()
        ) {
          Column(modifier = Modifier.padding(16.dp)) {
            FeatureHighlightRow(
              icon = Icons.Rounded.Public,
              text = "Dual-currency tracking: reference and primary currencies"
            )
            Spacer(modifier = Modifier.height(12.dp))
            FeatureHighlightRow(
              icon = Icons.Rounded.Verified,
              text = "Live exchange rates cached for offline use"
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(if (isShortHeight) 8.dp else 16.dp))

      PrimaryActionButton(
        text = "Get Started",
        onClick = onGetStarted,
        testTag = "onboarding_get_started_button"
      )
    }
  }
}

@Composable
private fun FeatureHighlightRow(
  icon: ImageVector,
  text: String
) {
  Row(verticalAlignment = Alignment.CenterVertically) {
    Icon(
      imageVector = icon,
      contentDescription = null,
      tint = MaterialTheme.colorScheme.primary,
      modifier = Modifier.size(20.dp)
    )
    Spacer(modifier = Modifier.width(12.dp))
    Text(
      text = text,
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurface
    )
  }
}

@Composable
private fun CurrencySelectionStep(
  stepTitle: String,
  stepSubtitle: String,
  selectedCurrency: Currency,
  searchQuery: String,
  currencies: List<Currency>,
  quickPickCurrencies: List<Currency>,
  onSearchChange: (String) -> Unit,
  onCurrencySelected: (Currency) -> Unit,
  onContinue: () -> Unit,
  continueButtonText: String,
  searchTestTag: String,
  listTestTag: String,
  continueButtonTestTag: String,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier
      .fillMaxSize()
      .padding(horizontal = 24.dp, vertical = 8.dp)
  ) {
    Text(
      text = stepTitle,
      style = MaterialTheme.typography.headlineSmall,
      fontWeight = FontWeight.Bold,
      color = MaterialTheme.colorScheme.onBackground,
      modifier = Modifier.plutoHeading()
    )

    Spacer(modifier = Modifier.height(8.dp))

    Text(
      text = stepSubtitle,
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )

    Spacer(modifier = Modifier.height(16.dp))

    // Quick pick chips for popular spending currencies
    LazyRow(
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      contentPadding = PaddingValues(bottom = 8.dp)
    ) {
      items(quickPickCurrencies, key = { it.code }) { currency ->
        val isSelected = currency == selectedCurrency
        FilterChip(
          selected = isSelected,
          onClick = { onCurrencySelected(currency) },
          label = {
            Text("${currency.flagEmoji} ${currency.code}")
          },
          colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
          )
        )
      }
    }

    OutlinedTextField(
      value = searchQuery,
      onValueChange = onSearchChange,
      modifier = Modifier
        .fillMaxWidth()
        .testTag(searchTestTag),
      placeholder = { Text("Search by code or country...") },
      leadingIcon = {
        Icon(
          imageVector = Icons.Rounded.Search,
          contentDescription = "Search"
        )
      },
      singleLine = true,
      shape = PlutoShapes.medium
    )

    Spacer(modifier = Modifier.height(12.dp))

    LazyColumn(
      modifier = Modifier
        .weight(1f)
        .testTag(listTestTag),
      verticalArrangement = Arrangement.spacedBy(8.dp),
      contentPadding = PaddingValues(vertical = 4.dp)
    ) {
      items(currencies, key = { it.code }) { currency ->
        CurrencyRow(
          currency = currency,
          isSelected = currency == selectedCurrency,
          onClick = { onCurrencySelected(currency) },
          testTag = "currency_row_${currency.code.lowercase()}"
        )
      }
    }

    Spacer(modifier = Modifier.height(12.dp))

    PrimaryActionButton(
      text = continueButtonText,
      onClick = onContinue,
      testTag = continueButtonTestTag
    )
  }
}

private fun sanitizeOnboardingDecimal(input: String): String {
  val filtered = input.filter { it.isDigit() || it == '.' }
  val dotIndex = filtered.indexOf('.')
  return if (dotIndex == -1) {
    filtered
  } else {
    filtered.substring(0, dotIndex + 1) + filtered.substring(dotIndex + 1).replace(".", "")
  }
}

private fun formatOnboardingCap(amount: BigDecimal?): String {
  if (amount == null) return ""
  val stripped = amount.stripTrailingZeros()
  return if (stripped.scale() <= 0) stripped.toPlainString() else amount.toPlainString()
}

@Composable
private fun ReadyStep(
  uiState: OnboardingUiState,
  onSwapCurrencies: () -> Unit,
  onTermNameChanged: (String) -> Unit = {},
  onAllowanceChanged: (BigDecimal) -> Unit = {},
  onTuitionChanged: (BigDecimal) -> Unit = {},
  onTermDaysChanged: (Int) -> Unit = {},
  onDailyCapChanged: (BigDecimal?) -> Unit = {},
  onMonthlyCapChanged: (BigDecimal?) -> Unit = {},
  onTripBudgetChanged: (BigDecimal) -> Unit = {},
  onComplete: () -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = uiState.homeCurrency
  val destinationCurrency = uiState.destinationCurrency
  var monthlyCapInput by remember { mutableStateOf(formatOnboardingCap(uiState.monthlySpendingCap)) }
  var dailyCapInput by remember { mutableStateOf(formatOnboardingCap(uiState.dailySpendingCap)) }

  LazyColumn(
    modifier = modifier
      .fillMaxSize()
      .padding(horizontal = 24.dp, vertical = 20.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.SpaceBetween
  ) {
    item {
      Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
      ) {
        Box(
          modifier = Modifier
            .size(80.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.Rounded.Verified,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(44.dp)
          )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
          text = "Ready to start tracking!",
          style = MaterialTheme.typography.headlineMedium,
          fontWeight = FontWeight.Bold,
          textAlign = TextAlign.Center,
          color = MaterialTheme.colorScheme.onBackground,
          modifier = Modifier.plutoHeading()
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
          text = "Universal Multi-Currency Expense Tracker",
          style = MaterialTheme.typography.titleSmall,
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Dual currency pair card
        PlutoCard(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.extraLarge
        ) {
          Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            // Reference Currency Row
            Row(
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Box(
                modifier = Modifier
                  .size(34.dp)
                  .clip(CircleShape)
                  .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.Home,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.primary,
                  modifier = Modifier.size(18.dp)
                )
              }
              Spacer(modifier = Modifier.width(10.dp))
              Column(modifier = Modifier.weight(1f)) {
                Text(
                  text = "Reference Currency",
                  style = MaterialTheme.typography.labelSmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                  text = "${homeCurrency.name} (${homeCurrency.code})",
                  style = MaterialTheme.typography.bodyMedium,
                  fontWeight = FontWeight.SemiBold
                )
              }
              CurrencyBadge(currency = homeCurrency)
            }

            // Swap Action in Middle
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.Center,
              verticalAlignment = Alignment.CenterVertically
            ) {
              val swapInteraction = remember { MutableInteractionSource() }
              Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier
                  .minimumInteractiveComponentSize()
                  .plutoPressableScale(
                    enabled = true,
                    pressedScale = PlutoMotion.PressScale,
                    interactionSource = swapInteraction
                  )
                  .clip(CircleShape)
                  .clickable(
                    interactionSource = swapInteraction,
                    indication = androidx.compose.material3.ripple(),
                    role = Role.Button
                  ) { onSwapCurrencies() }
                  .testTag("onboarding_swap_currencies")
              ) {
                Row(
                  modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                  verticalAlignment = Alignment.CenterVertically
                ) {
                  Icon(
                    imageVector = Icons.Rounded.SwapHoriz,
                    contentDescription = "Swap Currencies",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp)
                  )
                  Spacer(modifier = Modifier.width(4.dp))
                  Text(
                    text = "Swap",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary
                  )
                }
              }
            }

            // Destination Currency Row
            Row(
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Box(
                modifier = Modifier
                  .size(34.dp)
                  .clip(CircleShape)
                  .background(MaterialTheme.colorScheme.secondary.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.FlightTakeoff,
                  contentDescription = null,
                  tint = MaterialTheme.colorScheme.secondary,
                  modifier = Modifier.size(18.dp)
                )
              }
              Spacer(modifier = Modifier.width(10.dp))
              Column(modifier = Modifier.weight(1f)) {
                Text(
                  text = "Primary Spending Currency",
                  style = MaterialTheme.typography.labelSmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                  text = "${destinationCurrency.name} (${destinationCurrency.code})",
                  style = MaterialTheme.typography.bodyMedium,
                  fontWeight = FontWeight.SemiBold
                )
              }
              CurrencyBadge(currency = destinationCurrency)
            }
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Universal Monthly & Daily Spending Caps Setup (20dp outer = 14dp padding + 6dp inner radius)
        PlutoCard(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.extraLarge,
          containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.28f)
        ) {
          Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
          ) {
            Text(
              text = "Spending Caps & Safe-to-Spend",
              style = MaterialTheme.typography.titleSmall,
              fontWeight = FontWeight.Bold,
              color = MaterialTheme.colorScheme.primary
            )

            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              OutlinedTextField(
                value = monthlyCapInput,
                onValueChange = { str ->
                  val sanitized = sanitizeOnboardingDecimal(str)
                  monthlyCapInput = sanitized
                  onMonthlyCapChanged(sanitized.toBigDecimalOrNull())
                },
                label = { Text("Monthly (${homeCurrency.code})") },
                textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier
                  .weight(1f)
                  .testTag("onboarding_monthly_cap_input"),
                singleLine = true
              )

              OutlinedTextField(
                value = dailyCapInput,
                onValueChange = { str ->
                  val sanitized = sanitizeOnboardingDecimal(str)
                  dailyCapInput = sanitized
                  onDailyCapChanged(sanitized.toBigDecimalOrNull())
                },
                label = { Text("Daily (${homeCurrency.code})") },
                textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier
                  .weight(1f)
                  .testTag("onboarding_daily_cap_input"),
                singleLine = true
              )
            }

            val estimatedDaily: BigDecimal = uiState.dailySpendingCap
              ?: (uiState.monthlySpendingCap?.divide(BigDecimal("30"), homeCurrency.decimalPlaces, RoundingMode.HALF_EVEN)
                ?: BigDecimal("50.00"))

            Surface(
              shape = PlutoShapes.small,
              color = MaterialTheme.colorScheme.surface,
              modifier = Modifier.fillMaxWidth()
            ) {
              Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
              ) {
                Column {
                  Text(
                    text = "Daily Safe-to-Spend Target",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                  )
                  Text(
                    text = "${Money.of(estimatedDaily, homeCurrency).format()} / day",
                    style = MaterialTheme.typography.titleMedium.merge(PlutoNumericStyle),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                  )
                }
                Text(
                  text = "Adjustable anytime",
                  style = MaterialTheme.typography.labelSmall,
                  color = MaterialTheme.colorScheme.onSurfaceVariant
                )
              }
            }
          }
        }

        Spacer(modifier = Modifier.height(24.dp))
      }
    }

    item {
      PrimaryActionButton(
        text = "Start Tracking",
        onClick = onComplete,
        testTag = "onboarding_start_tracking_button"
      )
    }
  }
}
