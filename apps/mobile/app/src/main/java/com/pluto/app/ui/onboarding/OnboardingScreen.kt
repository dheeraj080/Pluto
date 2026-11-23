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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.FlightTakeoff
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.School
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pluto.app.R
import com.pluto.app.domain.model.Currency
import com.pluto.app.ui.components.CurrencyBadge
import com.pluto.app.ui.components.CurrencyRow
import com.pluto.app.ui.components.PrimaryActionButton
import com.pluto.app.ui.theme.PlutoMotion
import com.pluto.app.ui.theme.PlutoNumericStyle
import com.pluto.app.ui.theme.PlutoShapes
import com.pluto.app.ui.theme.plutoHeading
import com.pluto.app.ui.theme.plutoPressableScale
import com.pluto.app.ui.theme.rememberPrefersReducedMotion

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
              stepTitle = "What's your home currency?",
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
              stepTitle = "Where are you spending or traveling?",
              stepSubtitle = "Select your local spending currency. Expenses will be logged in this currency and converted live to ${uiState.homeCurrency.code}.",
              selectedCurrency = uiState.destinationCurrency,
              searchQuery = uiState.searchQuery,
              currencies = uiState.filteredCurrencies,
              quickPickCurrencies = listOf(Currency.EUR, Currency.JPY, Currency.GBP, Currency.THB, Currency.CAD, Currency.AUD),
              onSearchChange = viewModel::onSearchQueryChanged,
              onCurrencySelected = viewModel::onDestinationCurrencySelected,
              onContinue = { viewModel.nextStep() },
              continueButtonText = "Set ${uiState.destinationCurrency.code} (${uiState.destinationCurrency.symbol}) as Destination",
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
  Column(
    modifier = modifier
      .fillMaxSize()
      .padding(horizontal = 24.dp, vertical = 20.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.SpaceBetween
  ) {
    Spacer(modifier = Modifier.height(16.dp))

    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      modifier = Modifier.fillMaxWidth()
    ) {
      Image(
        painter = painterResource(id = R.drawable.img_onboarding_hero),
        contentDescription = "Pluto travel finance companion hero illustration",
        contentScale = ContentScale.Crop,
        modifier = Modifier
          .fillMaxWidth()
          .height(190.dp)
          .clip(PlutoShapes.extraLarge)
          .border(
            width = 1.dp,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.1f),
            shape = PlutoShapes.extraLarge
          )
          .testTag("onboarding_hero_image")
      )

      Spacer(modifier = Modifier.height(28.dp))

      Text(
        text = "Your money, wherever life takes you.",
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.plutoHeading()
      )

      Spacer(modifier = Modifier.height(16.dp))

      Text(
        text = "Track expenses, convert currencies in real-time, and understand your spending across countries with ease.",
        style = MaterialTheme.typography.bodyLarge,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        lineHeight = 24.sp
      )

      Spacer(modifier = Modifier.height(32.dp))

      // Feature highlights
      Surface(
        shape = PlutoShapes.large,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(modifier = Modifier.padding(16.dp)) {
          FeatureHighlightRow(
            icon = Icons.Rounded.Public,
            text = "Dual-currency tracking: home and destination"
          )
          Spacer(modifier = Modifier.height(12.dp))
          FeatureHighlightRow(
            icon = Icons.Rounded.Verified,
            text = "Live exchange rates cached for offline use"
          )
        }
      }
    }

    PrimaryActionButton(
      text = "Get Started",
      onClick = onGetStarted,
      testTag = "onboarding_get_started_button"
    )
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

    // Quick pick chips for popular travel currencies
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
      shape = RoundedCornerShape(12.dp)
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

@Composable
private fun PersonaSelectionStep(
  selectedPersona: com.pluto.app.domain.model.UserPersona,
  onPersonaSelected: (com.pluto.app.domain.model.UserPersona) -> Unit,
  onContinue: () -> Unit,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier
      .fillMaxSize()
      .padding(horizontal = 24.dp, vertical = 20.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.SpaceBetween
  ) {
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      modifier = Modifier.fillMaxWidth()
    ) {
      Text(
        text = "What describes your journey?",
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onBackground
      )

      Spacer(modifier = Modifier.height(8.dp))

      Text(
        text = "We will tailor your currency dashboard, runway calculators, and budgeting cycles.",
        style = MaterialTheme.typography.bodyMedium,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )

      Spacer(modifier = Modifier.height(24.dp))

      // Student Card (Highlighted / Recommended)
      PersonaChoiceCard(
        persona = com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
        icon = Icons.Rounded.School,
        title = "International Student",
        subtitle = "Semester allowance runway, tuition & books, flatmate splits, and daily safe-to-spend limit.",
        isSelected = selectedPersona == com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT,
        isRecommended = true,
        testTag = "onboarding_persona_student",
        onClick = { onPersonaSelected(com.pluto.app.domain.model.UserPersona.INTERNATIONAL_STUDENT) }
      )

      Spacer(modifier = Modifier.height(14.dp))

      // Expat Card
      PersonaChoiceCard(
        persona = com.pluto.app.domain.model.UserPersona.EXPAT,
        icon = Icons.Rounded.Home,
        title = "Expat & Remote Worker",
        subtitle = "Monthly salary cycles, rent & utilities, dual-currency cost of living, and remittances.",
        isSelected = selectedPersona == com.pluto.app.domain.model.UserPersona.EXPAT,
        isRecommended = false,
        testTag = "onboarding_persona_expat",
        onClick = { onPersonaSelected(com.pluto.app.domain.model.UserPersona.EXPAT) }
      )

      Spacer(modifier = Modifier.height(14.dp))

      // Tourist Card
      PersonaChoiceCard(
        persona = com.pluto.app.domain.model.UserPersona.TOURIST,
        icon = Icons.Rounded.FlightTakeoff,
        title = "Tourist & Traveler",
        subtitle = "Trip budget countdown, daily itinerary allowances, and real-time offline currency exchange.",
        isSelected = selectedPersona == com.pluto.app.domain.model.UserPersona.TOURIST,
        isRecommended = false,
        testTag = "onboarding_persona_tourist",
        onClick = { onPersonaSelected(com.pluto.app.domain.model.UserPersona.TOURIST) }
      )
    }

    PrimaryActionButton(
      text = "Continue as ${selectedPersona.displayName}",
      onClick = onContinue,
      testTag = "onboarding_persona_continue_button"
    )
  }
}

@Composable
private fun PersonaChoiceCard(
  persona: com.pluto.app.domain.model.UserPersona,
  icon: ImageVector,
  title: String,
  subtitle: String,
  isSelected: Boolean,
  isRecommended: Boolean,
  testTag: String,
  onClick: () -> Unit
) {
  val cardInteraction = remember { MutableInteractionSource() }
  Card(
    modifier = Modifier
      .fillMaxWidth()
      .plutoPressableScale(
        enabled = true,
        pressedScale = PlutoMotion.CardPressScale,
        interactionSource = cardInteraction
      )
      .clip(PlutoShapes.large)
      .clickable(
        interactionSource = cardInteraction,
        indication = androidx.compose.material3.ripple(),
        role = Role.Button,
        onClick = onClick
      )
      .testTag(testTag),
    shape = PlutoShapes.large,
    colors = CardDefaults.cardColors(
      containerColor = if (isSelected) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
      } else {
        MaterialTheme.colorScheme.surface
      }
    ),
    border = if (isSelected) {
      BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
    } else {
      BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    },
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
  ) {
    Row(
      modifier = Modifier.padding(16.dp),
      verticalAlignment = Alignment.Top
    ) {
      Box(
        modifier = Modifier
          .size(44.dp)
          .clip(CircleShape)
          .background(
            if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
          ),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.size(24.dp)
        )
      }

      Spacer(modifier = Modifier.width(14.dp))

      Column(modifier = Modifier.weight(1f)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
          )
          if (isRecommended) {
            Surface(
              shape = RoundedCornerShape(6.dp),
              color = MaterialTheme.colorScheme.primary
            ) {
              Text(
                text = "PRIMARY",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
          text = subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          lineHeight = 18.sp
        )
      }
    }
  }
}

@Composable
private fun ReadyStep(
  uiState: OnboardingUiState,
  onSwapCurrencies: () -> Unit,
  onTermNameChanged: (String) -> Unit = {},
  onAllowanceChanged: (Double) -> Unit = {},
  onTuitionChanged: (Double) -> Unit = {},
  onTermDaysChanged: (Int) -> Unit = {},
  onDailyCapChanged: (Double?) -> Unit = {},
  onMonthlyCapChanged: (Double?) -> Unit = {},
  onTripBudgetChanged: (Double) -> Unit = {},
  onComplete: () -> Unit,
  modifier: Modifier = Modifier
) {
  val homeCurrency = uiState.homeCurrency
  val destinationCurrency = uiState.destinationCurrency

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
        Card(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.extraLarge,
          colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
          ),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
          Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            // Home Currency Row
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
                  text = "Home Reference Currency",
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
                  text = "Destination / Local Currency",
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
        Card(
          modifier = Modifier.fillMaxWidth(),
          shape = PlutoShapes.extraLarge,
          colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.28f)
          ),
          elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
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
                value = uiState.monthlySpendingCap?.toInt()?.toString() ?: "",
                onValueChange = { str -> onMonthlyCapChanged(str.toDoubleOrNull()) },
                label = { Text("Monthly (${homeCurrency.code})") },
                textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
                modifier = Modifier
                  .weight(1f)
                  .testTag("onboarding_monthly_cap_input"),
                singleLine = true
              )

              OutlinedTextField(
                value = uiState.dailySpendingCap?.toInt()?.toString() ?: "",
                onValueChange = { str -> onDailyCapChanged(str.toDoubleOrNull()) },
                label = { Text("Daily (${homeCurrency.code})") },
                textStyle = MaterialTheme.typography.bodyLarge.merge(PlutoNumericStyle),
                modifier = Modifier
                  .weight(1f)
                  .testTag("onboarding_daily_cap_input"),
                singleLine = true
              )
            }

            val estimatedDaily = uiState.dailySpendingCap
              ?: (uiState.monthlySpendingCap?.let { it / 30.0 } ?: 50.0)

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
                    text = "${homeCurrency.symbol}${String.format(java.util.Locale.US, "%.2f", estimatedDaily)} / day",
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
